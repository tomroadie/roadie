import { NextResponse, after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { getPlanForGating } from "@/lib/plan-limits";
import { GENRES } from "@/app/onboarding/genres";
import { appBaseUrl } from "@/lib/email";
import { runConnectedAudit } from "@/lib/audit/connected-audit";
import { listBusinessInstagramAccounts } from "@/lib/facebook-business";

export const maxDuration = 300;

type Requested = { page_id: string; artist_name: string; genre: string };
type Result = { page_id: string; status: "created" | "updated" | "skipped"; artist_id?: string; note?: string };

async function syncNow(artistId: string): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  try {
    await fetch(`${appBaseUrl()}/api/cron/sync-post-performance?artist_id=${encodeURIComponent(artistId)}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
  } catch (e) {
    console.error("accounts import: sync failed", artistId, e);
  }
}

/**
 * Adds Instagram accounts reached through Facebook Business as Tempo artists
 * (or reconnects ones already here). Page tokens are looked up again on the
 * server; the browser only says which Pages. Admin only for now.
 */
export async function POST(request: Request) {
  let requested: Requested[] = [];
  try {
    const body = (await request.json()) as { accounts?: unknown };
    requested = (Array.isArray(body.accounts) ? body.accounts : [])
      .map((a) => a as Record<string, unknown>)
      .map((a) => ({
        page_id: typeof a.page_id === "string" ? a.page_id.trim() : "",
        artist_name: typeof a.artist_name === "string" ? a.artist_name.trim().slice(0, 80) : "",
        genre: typeof a.genre === "string" ? a.genre : "",
      }))
      .filter((a) => /^\d{1,32}$/.test(a.page_id))
      .slice(0, 50);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (requested.length === 0) return NextResponse.json({ error: "Pick at least one account" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await userIsAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createServiceRoleClient();
  const { data: conn } = await admin
    .from("facebook_connections")
    .select("user_access_token")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conn?.user_access_token) {
    return NextResponse.json({ error: "Connect Facebook Business first" }, { status: 400 });
  }

  let available;
  try {
    available = await listBusinessInstagramAccounts(String(conn.user_access_token));
  } catch (e) {
    return NextResponse.json(
      { error: `Facebook: ${e instanceof Error ? e.message : String(e)}. Try reconnecting.` },
      { status: 502 }
    );
  }
  const byPage = new Map(available.map((a) => [a.pageId, a]));

  const { data: planRow } = await supabase
    .from("profiles")
    .select("plan, plan_override")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();
  const plan = getPlanForGating(planRow ?? {});

  const results: Result[] = [];
  const toSync: { id: string; fresh: boolean }[] = [];

  for (const r of requested) {
    const acct = byPage.get(r.page_id);
    if (!acct) {
      results.push({ page_id: r.page_id, status: "skipped", note: "Not reachable from this Facebook login" });
      continue;
    }
    const connection = {
      instagram_user_id: acct.igUserId,
      instagram_access_token: acct.pageToken,
      instagram_token_expires_at: null,
      instagram_auth: "facebook",
      instagram_page_id: acct.pageId,
      ...(acct.username ? { instagram_handle: acct.username } : {}),
    };

    const { data: existing } = await admin
      .from("profiles")
      .select("id, owner_user_id")
      .eq("instagram_user_id", acct.igUserId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      if (existing.owner_user_id !== user.id) {
        results.push({
          page_id: r.page_id,
          status: "skipped",
          note: "Already in Tempo under another login",
        });
        continue;
      }
      const { error } = await admin.from("profiles").update(connection).eq("id", existing.id);
      if (error) {
        results.push({ page_id: r.page_id, status: "skipped", note: error.message });
        continue;
      }
      results.push({ page_id: r.page_id, status: "updated", artist_id: String(existing.id) });
      toSync.push({ id: String(existing.id), fresh: false });
      continue;
    }

    const name = r.artist_name || acct.name || acct.username || acct.pageName;
    const genre = (GENRES as readonly string[]).includes(r.genre) ? r.genre : null;
    const id = crypto.randomUUID();
    const { error: artistErr } = await admin.from("artists").insert({ id, owner_user_id: user.id });
    if (artistErr) {
      results.push({ page_id: r.page_id, status: "skipped", note: artistErr.message });
      continue;
    }
    const { error: profileErr } = await admin.from("profiles").insert({
      id,
      owner_user_id: user.id,
      artist_name: name,
      plan,
      genre,
      is_managed: true,
      is_private: true,
      cron_active: false,
      // Owned by the person who imported them: don't send them one email per artist.
      all_emails_paused: true,
      ...connection,
    });
    if (profileErr) {
      await admin.from("artists").delete().eq("id", id);
      results.push({ page_id: r.page_id, status: "skipped", note: profileErr.message });
      continue;
    }
    results.push({ page_id: r.page_id, status: "created", artist_id: id });
    toSync.push({ id, fresh: true });
  }

  // Pull their posts now and build the free audit for new ones, one at a time.
  if (toSync.length > 0) {
    after(async () => {
      for (const a of toSync) {
        await syncNow(a.id);
        if (a.fresh) {
          try {
            await runConnectedAudit(admin, a.id);
          } catch (e) {
            console.error("accounts import: audit failed", a.id, e);
          }
        }
      }
    });
  }

  return NextResponse.json({ results });
}
