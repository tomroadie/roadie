import type { SupabaseClient } from "@supabase/supabase-js";
import { ask } from "@/lib/themes/ai";
import { clip } from "@/lib/text";

export type Shot = { shot: string; format: "reel" | "photo" | "story" | "carousel" };
export type ShotList = { eventId: string; title: string; date: string; type: string; themeName: string | null; shots: Shot[] };

const FORMATS = ["reel", "photo", "story", "carousel"] as const;
/** Every kind of date except "Other" gets a shot list. */
const SHOT_TYPES = ["Show", "Release", "Rehearsal", "Studio session", "Press/Interview", "Collaboration"];

const SYSTEM = `You help independent musicians capture content around a key date (a gig, release, session).
Write a short shot list: concrete, phone-only things to film or photograph, specific to this kind of date.
Each shot is one plain sentence under 110 characters, saying exactly what to capture and when (e.g. "10 seconds of the crowd during the second song, from the side of the stage").
No editing instructions, no captions, no hashtags, no emoji. British English. Reply with JSON only.`;

function londonDate(offsetDays: number, now: Date): string {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Makes shot lists for dates tomorrow (and today, if one was missed) that
 * don't have one yet. Uses the artist's concepts so the shots fit how they
 * already post. Needs a service-role client. Returns how many were made.
 */
export async function makeDueShotLists(admin: SupabaseClient, artistId: string, now: Date = new Date()): Promise<number> {
  const today = londonDate(0, now);
  const tomorrow = londonDate(1, now);
  const { data: events } = await admin
    .from("events")
    .select("id, title, event_date, event_type, notes")
    .eq("artist_id", artistId)
    .gte("event_date", today)
    .lte("event_date", tomorrow)
    .in("event_type", SHOT_TYPES);
  if (!events?.length) return 0;

  const { data: existing } = await admin.from("shot_lists").select("event_id").in("event_id", events.map((e) => e.id));
  const done = new Set((existing ?? []).map((r) => String(r.event_id)));
  const due = events.filter((e) => !done.has(String(e.id)));
  if (due.length === 0) return 0;

  const [{ data: profile }, { data: themes }] = await Promise.all([
    admin.from("profiles").select("artist_name, genre, voice_description").eq("id", artistId).maybeSingle(),
    admin.from("content_themes").select("name, description").eq("artist_id", artistId).eq("status", "active").order("position"),
  ]);
  const themeList = (themes ?? []).map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ""}`).join("\n");

  let made = 0;
  for (const e of due) {
    const prompt = `Artist: ${profile?.artist_name ?? "the artist"}${profile?.genre ? ` (${profile.genre})` : ""}
${profile?.voice_description ? `How they come across: ${clip(String(profile.voice_description), 300)}\n` : ""}
The date: ${e.event_type}: "${clip(String(e.title), 120)}" on ${e.event_date}${e.notes ? ` (${clip(String(e.notes), 200)})` : ""}

Their content concepts (the themes their posts live in):
${themeList || "(none yet)"}

Pick the one concept this date fits best, and write 4 to 6 shots for it. Mix formats, but mostly what's quick to capture on the day.

{"concept":"<one concept name from the list, or null>","shots":[{"shot":"","format":"reel|photo|story|carousel"}]}`;
    try {
      const raw = (await ask(SYSTEM, prompt, 900)) as { concept?: unknown; shots?: unknown };
      const shots: Shot[] = (Array.isArray(raw.shots) ? raw.shots : [])
        .map((s) => s as Record<string, unknown>)
        .map((s) => ({
          shot: typeof s.shot === "string" ? s.shot.trim().slice(0, 160) : "",
          format: (FORMATS as readonly string[]).includes(String(s.format)) ? (s.format as Shot["format"]) : "reel",
        }))
        .filter((s) => s.shot)
        .slice(0, 6);
      if (shots.length < 3) continue;
      const names = new Set((themes ?? []).map((t) => String(t.name)));
      const themeName = typeof raw.concept === "string" && names.has(raw.concept) ? raw.concept : null;
      const { error } = await admin
        .from("shot_lists")
        .insert({ event_id: e.id, artist_id: artistId, theme_name: themeName, shots });
      if (!error) made++;
    } catch (err) {
      console.error("shot list failed", artistId, e.id, err);
    }
  }
  return made;
}

/** Shot lists for today and tomorrow, for Home. Works with the artist's own client. */
export async function loadUpcomingShotLists(supabase: SupabaseClient, artistId: string, now: Date = new Date()): Promise<ShotList[]> {
  const today = londonDate(0, now);
  const tomorrow = londonDate(1, now);
  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_date, event_type")
    .eq("artist_id", artistId)
    .gte("event_date", today)
    .lte("event_date", tomorrow)
    .order("event_date");
  if (!events?.length) return [];
  const { data: lists } = await supabase
    .from("shot_lists")
    .select("event_id, theme_name, shots")
    .in("event_id", events.map((e) => e.id));
  const byEvent = new Map((lists ?? []).map((l) => [String(l.event_id), l]));
  return events
    .filter((e) => byEvent.has(String(e.id)))
    .map((e) => {
      const l = byEvent.get(String(e.id))!;
      return {
        eventId: String(e.id),
        title: String(e.title),
        date: String(e.event_date),
        type: String(e.event_type),
        themeName: l.theme_name ? String(l.theme_name) : null,
        shots: (Array.isArray(l.shots) ? l.shots : []) as Shot[],
      };
    });
}
