import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { appBaseUrl } from "@/lib/email";
import { refreshThemesForArtist } from "@/lib/themes/refresh";
import { describeNewPosts } from "@/lib/visual-notes";
import { syncTourPage } from "@/lib/tour-page";
import { graphBaseFor } from "@/lib/instagram-graph";
import { generateConceptPool } from "@/lib/concepts/generate";
import { saveDraftGeneration } from "@/lib/concepts/store";
import { getsWeeklyIdeas } from "@/lib/account-types";
import { loadSetupState } from "@/lib/admin-setup";

export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Action = "status" | "posts" | "concepts" | "images" | "dates" | "ideas";
const ACTIONS: Action[] = ["status", "posts", "concepts", "images", "dates", "ideas"];

/**
 * Admin-only setup for one account, a step at a time:
 *   status    where they are (the checklist)
 *   posts     pull their posts and results from Instagram
 *   concepts  suggest and sort their concepts
 *   images    describe a batch of post images
 *   dates     { tour_page_url? } save and read their tour page (or skip)
 *   ideas     write the first week as a draft (artists only)
 * Every action returns the fresh status, so the panel just redraws.
 * Publishing goes through /api/admin/publish-concepts as before.
 */
export async function POST(request: Request) {
  let artistId = "";
  let action: Action = "status";
  let tourPageUrl: string | null | undefined;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = typeof body.artist_id === "string" ? body.artist_id.trim() : "";
    action = ACTIONS.includes(body.action as Action) ? (body.action as Action) : "status";
    if (typeof body.tour_page_url === "string") tourPageUrl = body.tour_page_url.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!UUID_RE.test(artistId)) return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await userIsAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createServiceRoleClient();
  let note: string | null = null;

  try {
    if (action === "posts") {
      const secret = process.env.CRON_SECRET;
      if (!secret) throw new Error("CRON_SECRET missing");
      const res = await fetch(
        `${appBaseUrl()}/api/cron/sync-post-performance?artist_id=${encodeURIComponent(artistId)}&full=1`,
        { headers: { authorization: `Bearer ${secret}` }, cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as { synced?: number; errors?: string[] };
      if (!res.ok) throw new Error(json.errors?.[0] ?? `Sync failed (HTTP ${res.status})`);
      const mine = (json.errors ?? []).filter((e) => e.startsWith(artistId));
      note = `${json.synced ?? 0} posts updated${mine.length ? ` · ${mine.length} warnings` : ""}`;
    } else if (action === "concepts") {
      const r = await refreshThemesForArtist(admin, artistId);
      note = JSON.stringify(r) === "{}" ? null : summarise(r as Record<string, unknown>);
    } else if (action === "images") {
      const { data: p } = await admin
        .from("profiles")
        .select("instagram_user_id, instagram_access_token, instagram_auth")
        .eq("id", artistId)
        .maybeSingle();
      if (!p?.instagram_access_token) throw new Error("Instagram isn't connected");
      const done = await describeNewPosts(admin, artistId, graphBaseFor(p.instagram_auth), String(p.instagram_access_token));
      note = `${done} described`;
    } else if (action === "dates") {
      if (tourPageUrl !== undefined) {
        const url = tourPageUrl ? normalise(tourPageUrl) : null;
        if (tourPageUrl && !url) throw new Error("That doesn't look like a web address");
        await admin
          .from("profiles")
          .update({ tour_page_url: url, tour_page_checked_at: null, tour_page_status: null, tour_page_found: null })
          .eq("id", artistId);
        if (url) {
          const r = await syncTourPage(admin, artistId, { force: true });
          note =
            r?.status === "failed"
              ? "Couldn't read that page"
              : `${r?.found ?? 0} upcoming dates found, ${r?.added ?? 0} waiting to add`;
        }
      }
      await admin.from("profiles").update({ setup_dates_done: true }).eq("id", artistId);
    } else if (action === "ideas") {
      const { data: p } = await admin.from("profiles").select("account_type").eq("id", artistId).maybeSingle();
      if (!getsWeeklyIdeas(p?.account_type)) throw new Error("Weekly ideas are for artist accounts");
      const result = await generateConceptPool(admin, artistId);
      await saveDraftGeneration(admin, result, user.id, { kind: "setup" });
      note = `${result.pool.concepts.length} ideas drafted`;
    }

    const state = await loadSetupState(admin, artistId);
    return NextResponse.json({ ok: true, note, state });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("admin setup failed", { artistId, action, message });
    const state = await loadSetupState(admin, artistId).catch(() => null);
    return NextResponse.json({ error: message, state }, { status: 502 });
  }
}

function summarise(r: Record<string, unknown>): string {
  return Object.entries(r)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k, v]) => `${v} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`)
    .join(" · ");
}

function normalise(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.hostname.includes(".") ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}
