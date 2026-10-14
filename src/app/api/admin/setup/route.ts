import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { appBaseUrl } from "@/lib/email";
import { refreshThemesForArtist } from "@/lib/themes/refresh";
import { describeNewPosts } from "@/lib/visual-notes";
import { syncTourPage } from "@/lib/tour-page";
import { suggestDatesFromPosts } from "@/lib/key-dates-from-posts";
import { graphBaseFor } from "@/lib/instagram-graph";
import { generateConceptPool } from "@/lib/concepts/generate";
import { saveDraftGeneration } from "@/lib/concepts/store";
import { getsWeeklyIdeas } from "@/lib/account-types";
import { loadSetupState } from "@/lib/admin-setup";
import { syncBriefDates } from "@/lib/brief-dates";
import { readArtistBrief } from "@/lib/artist-brief";

export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Action = "status" | "posts" | "concepts" | "images" | "dates" | "add_dates" | "brief" | "ideas";
const ACTIONS: Action[] = ["status", "posts", "concepts", "images", "dates", "add_dates", "brief", "ideas"];

/**
 * Admin-only setup for one account, a step at a time:
 *   status    where they are (the checklist)
 *   posts     pull their posts and results from Instagram
 *   concepts  suggest and sort their concepts
 *   images    describe a batch of post images
 *   dates     { tour_page_url? } read recent captions for dates, and save
 *             and read their tour page if given (or skip)
 *   add_dates add every waiting suggested date to their dates
 *   brief     { brief_links?, brief_notes? } save, read the links (or skip)
 *   ideas     write the first week as a draft (artists only)
 * Every action returns the fresh status, so the panel just redraws.
 * Publishing goes through /api/admin/publish-concepts as before.
 */
export async function POST(request: Request) {
  let artistId = "";
  let action: Action = "status";
  let tourPageUrl: string | null | undefined;
  let briefLinks: string | undefined;
  let briefNotes: string | undefined;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = typeof body.artist_id === "string" ? body.artist_id.trim() : "";
    action = ACTIONS.includes(body.action as Action) ? (body.action as Action) : "status";
    if (typeof body.tour_page_url === "string") tourPageUrl = body.tour_page_url.trim();
    if (typeof body.brief_links === "string") briefLinks = body.brief_links.trim().slice(0, 2000);
    if (typeof body.brief_notes === "string") briefNotes = body.brief_notes.trim().slice(0, 8000);
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
      // Dates they've announced in captions ("6 Nov at the Cavendish"),
      // so the first week knows about them. Accounts that aren't live
      // aren't read by the regular sync yet.
      const fromCaptions = await suggestDatesFromPosts(admin, artistId).catch(() => 0);
      if (tourPageUrl !== undefined) {
        const url = tourPageUrl ? normalise(tourPageUrl) : null;
        if (tourPageUrl && !url) throw new Error("That doesn't look like a web address");
        await admin
          .from("profiles")
          .update({
            tour_page_url: url,
            tour_page_checked_at: null,
            tour_page_status: null,
            tour_page_found: null,
            tour_page_note: null,
            bandsintown_key: null,
          })
          .eq("id", artistId);
        if (url) {
          const r = await syncTourPage(admin, artistId, { force: true });
          note =
            r?.status === "failed"
              ? "Couldn't open that site"
              : `${r?.found ?? 0} upcoming dates found on their site, ${r?.added ?? 0} new`;
        }
      }
      if (fromCaptions > 0) note = `${note ? `${note} · ` : ""}${fromCaptions} spotted in captions`;
      await admin.from("profiles").update({ setup_dates_done: true }).eq("id", artistId);
    } else if (action === "add_dates") {
      note = `${await addWaitingDates(admin, artistId)} added`;
    } else if (action === "brief") {
      if (briefLinks !== undefined || briefNotes !== undefined) {
        await admin
          .from("profiles")
          .update({
            ...(briefLinks !== undefined ? { brief_links: briefLinks || null } : {}),
            ...(briefNotes !== undefined ? { brief_notes: briefNotes || null } : {}),
          })
          .eq("id", artistId);
        if (briefLinks !== undefined) {
          const r = await readArtistBrief(admin, artistId);
          if (r.tried > 0) note = r.read > 0 ? `Read ${r.read} of ${r.tried} links` : "Couldn't read those links";
        }
        if (briefNotes) {
          // Dates in their plan become suggestions on Dates (only when the notes changed).
          try {
            const d = await syncBriefDates(admin, artistId);
            if (d && d.added > 0) note = `${note ? `${note} · ` : ""}${d.added} ${d.added === 1 ? "date" : "dates"} from the plan to add`;
          } catch (e) {
            console.error("setup: plan dates", e);
          }
        }
      }
      await admin.from("profiles").update({ setup_brief_done: true }).eq("id", artistId);
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

/** Adds every waiting upcoming suggestion as a date (admin, so no RPC access check). */
async function addWaitingDates(admin: ReturnType<typeof createServiceRoleClient>, artistId: string): Promise<number> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const [{ data: rows }, { data: artist }] = await Promise.all([
    admin
      .from("date_suggestions")
      .select("id, title, event_date, event_type, notes, source")
      .eq("artist_id", artistId)
      .eq("status", "pending")
      .gte("event_date", today),
    admin.from("artists").select("owner_user_id").eq("id", artistId).maybeSingle(),
  ]);
  let added = 0;
  for (const r of rows ?? []) {
    const { data: ev, error } = await admin
      .from("events")
      .insert({
        artist_id: artistId,
        user_id: artist?.owner_user_id ?? null,
        title: r.title,
        event_date: r.event_date,
        event_type: r.event_type,
        notes: r.notes ?? (r.source === "tour_page" ? "From your website" : "Spotted in your Instagram post"),
      })
      .select("id")
      .single();
    if (error || !ev) continue;
    await admin
      .from("date_suggestions")
      .update({ status: "accepted", event_id: ev.id, status_changed_at: new Date().toISOString() })
      .eq("id", r.id);
    added++;
  }
  return added;
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
