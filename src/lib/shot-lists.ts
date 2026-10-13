import type { SupabaseClient } from "@supabase/supabase-js";
import { ask } from "@/lib/themes/ai";
import { clip } from "@/lib/text";
import { loadPostResults } from "@/lib/post-results";
import { formatName, formatRatio } from "@/lib/themes/load";
import { VISUAL_KIND_LABEL } from "@/lib/visual-kinds";

/**
 * A shot to capture. why says what it's for; anchorLabel says what in their
 * own world it builds on ("Like your 12 Sep crowd Reel, 3.1×"). Older lists
 * have only shot and format.
 */
export type Shot = {
  shot: string;
  format: "reel" | "photo" | "story" | "carousel";
  why?: string;
  anchorLabel?: string;
  anchorHref?: string | null;
};
export type ShotList = { eventId: string; title: string; date: string; type: string; themeName: string | null; shots: Shot[] };

const FORMATS = ["reel", "photo", "story", "carousel"] as const;
/** Every kind of date except "Other" gets a shot list. */
const SHOT_TYPES = ["Show", "Release", "Rehearsal", "Studio session", "Press/Interview", "Collaboration"];
const MAX_SHOTS = 3;

const SYSTEM = `You write a short shot list for one music act's upcoming date (a gig, release day, session), to capture on a phone.
Everything must come from THIS act's world. Every shot is anchored to exactly one of:
- one of their past posts that did well (ref "P1", "P2"…): capture the same kind of thing again, for this date;
- something specific from the date's details or linked page (ref "D"): a named act on the bill, the venue, the release, a song;
- one of the ideas on their board this week (ref "I1", "I2"…) that needs footage from the day.
If you can't anchor a shot, leave it out. Fewer, better shots: at most ${MAX_SHOTS}.
Rules:
- Each shot is one plain sentence under 110 characters: exactly what to capture and when ("10 seconds of the first chorus from the side of the stage").
- why is one short sentence under 90 characters saying why it's worth getting, in their terms ("Your crowd Reels do best").
- Vertical by default. Nothing posed or staged for the camera, no props, no photos of screens, nothing needing a second person or setup.
- Match the date: release day shots for a release, show shots for a show. Don't mix them.
- British English, no emoji, no hashtags, no captions, no editing instructions.
Reply with JSON only.`;

function londonDate(offsetDays: number, now: Date): string {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function shortDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

type TopPost = {
  label: string;
  href: string | null;
  line: string;
};

/**
 * Their best recent posts against their own usual, described by what they
 * look like (from the image scan) and what they said. Also a line on which
 * kinds of post work for them, when there's enough to say.
 */
async function topPostsFor(admin: SupabaseClient, artistId: string, now: Date): Promise<{ posts: TopPost[]; kindsLine: string | null }> {
  const results = await loadPostResults(admin, artistId, londonDate(0, now), now).catch(() => null);
  const settled = (results?.posts ?? []).filter((p) => !p.excluded && p.comparison?.settled);
  const posts = [...settled]
    .sort((a, b) => b.comparison!.ratio - a.comparison!.ratio)
    .slice(0, 6)
    .map((p) => {
      const fmt = formatName(p.mediaType);
      const kind = p.visualKind ? VISUAL_KIND_LABEL[p.visualKind].toLowerCase() : null;
      const ratio = formatRatio(p.comparison!.ratio);
      return {
        label: `Like your ${shortDay(p.postDate)} ${kind && kind !== "other" ? `${kind} ` : ""}${fmt}, ${ratio}`,
        href: p.permalink,
        line: [
          `${fmt}, ${ratio} vs their usual`,
          p.visualNote ? `looks like: ${p.visualNote}` : null,
          p.caption ? `caption: "${clip(p.caption.replace(/\s+/g, " "), 140)}"` : null,
        ]
          .filter(Boolean)
          .join("; "),
      };
    });

  const byKind = new Map<string, number[]>();
  for (const p of settled) {
    if (!p.visualKind || p.visualKind === "other") continue;
    byKind.set(p.visualKind, [...(byKind.get(p.visualKind) ?? []), p.comparison!.ratio]);
  }
  const kinds = [...byKind.entries()]
    .filter(([, r]) => r.length >= 2)
    .map(([k, r]) => {
      const sorted = [...r].sort((a, b) => a - b);
      return { k, med: sorted[Math.floor(sorted.length / 2)], n: r.length };
    })
    .sort((a, b) => b.med - a.med);
  const kindsLine =
    kinds.length >= 2
      ? kinds.map((x) => `${VISUAL_KIND_LABEL[x.k as keyof typeof VISUAL_KIND_LABEL]}: ${formatRatio(x.med)} (${x.n} posts)`).join(", ")
      : null;
  return { posts, kindsLine };
}

/**
 * Makes shot lists for dates tomorrow (and today, if one was missed) that
 * don't have one yet. Built from their best posts, the date's details and
 * linked page, and this week's board ideas. Needs a service-role client.
 * Returns how many were made.
 */
export async function makeDueShotLists(admin: SupabaseClient, artistId: string, now: Date = new Date()): Promise<number> {
  const today = londonDate(0, now);
  const tomorrow = londonDate(1, now);
  const { data: events } = await admin
    .from("events")
    .select("id, title, event_date, event_type, notes, link_context")
    .eq("artist_id", artistId)
    .gte("event_date", today)
    .lte("event_date", tomorrow)
    .in("event_type", SHOT_TYPES);
  if (!events?.length) return 0;

  const { data: existing } = await admin.from("shot_lists").select("event_id").in("event_id", events.map((e) => e.id));
  const done = new Set((existing ?? []).map((r) => String(r.event_id)));
  const due = events.filter((e) => !done.has(String(e.id)));
  if (due.length === 0) return 0;

  const [{ data: profile }, { data: themes }, { data: ideas }, top] = await Promise.all([
    admin.from("profiles").select("artist_name, genre, voice_description").eq("id", artistId).maybeSingle(),
    admin.from("content_themes").select("name, description").eq("artist_id", artistId).eq("status", "active").order("position"),
    admin
      .from("concepts")
      .select("title, why")
      .eq("artist_id", artistId)
      .in("status", ["board", "pinned"])
      .order("slot", { nullsFirst: false })
      .limit(6),
    topPostsFor(admin, artistId, now),
  ]);
  const themeList = (themes ?? []).map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ""}`).join("\n");
  const ideaList = (ideas ?? []).map((i, n) => `I${n + 1}. ${clip(String(i.title), 120)}${i.why ? ` (${clip(String(i.why), 140)})` : ""}`);
  const postList = top.posts.map((p, n) => `P${n + 1}. ${p.line}`);

  let made = 0;
  for (const e of due) {
    const prompt = `Act: ${profile?.artist_name ?? "the act"}${profile?.genre ? ` (${profile.genre})` : ""}
${profile?.voice_description ? `How they come across: ${clip(String(profile.voice_description), 300)}\n` : ""}
The date (ref D): ${e.event_type}: "${clip(String(e.title), 120)}" on ${e.event_date}${e.notes ? `\nTheir notes: ${clip(String(e.notes), 300)}` : ""}${e.link_context ? `\nFrom the linked page: ${clip(String(e.link_context), 800)}` : ""}

Their best recent posts against their own usual:
${postList.join("\n") || "(not enough results yet)"}
${top.kindsLine ? `\nHow kinds of post do for them: ${top.kindsLine}\n` : ""}
Ideas on their board this week:
${ideaList.join("\n") || "(none)"}

Their content concepts:
${themeList || "(none yet)"}

Also give a short plain title for the date if theirs is messy (e.g. "single release" → "Release day"), else repeat theirs.

{"title":"","concept":"<one concept name from the list, or null>","shots":[{"shot":"","format":"reel|photo|story|carousel","why":"","ref":"P1|D|I1"}]}`;
    try {
      const raw = (await ask(SYSTEM, prompt, 900)) as { concept?: unknown; shots?: unknown };
      const shots: Shot[] = [];
      for (const item of Array.isArray(raw.shots) ? raw.shots : []) {
        const s = item as Record<string, unknown>;
        const shot = typeof s.shot === "string" ? s.shot.trim().slice(0, 160) : "";
        const ref = typeof s.ref === "string" ? s.ref.trim().toUpperCase() : "";
        if (!shot) continue;
        let anchorLabel: string | undefined;
        let anchorHref: string | null = null;
        const pm = ref.match(/^P(\d+)$/);
        const im = ref.match(/^I(\d+)$/);
        if (pm && top.posts[Number(pm[1]) - 1]) {
          anchorLabel = top.posts[Number(pm[1]) - 1].label;
          anchorHref = top.posts[Number(pm[1]) - 1].href;
        } else if (im && ideas?.[Number(im[1]) - 1]) {
          anchorLabel = `For your idea: ${clip(String(ideas[Number(im[1]) - 1].title), 80)}`;
        } else if (ref === "D") {
          anchorLabel = e.link_context ? "From the date's page" : "For this date";
        } else {
          continue; // unanchored: dropped, as the prompt says
        }
        shots.push({
          shot,
          format: (FORMATS as readonly string[]).includes(String(s.format)) ? (s.format as Shot["format"]) : "reel",
          why: typeof s.why === "string" ? s.why.trim().slice(0, 120) : undefined,
          anchorLabel,
          anchorHref,
        });
        if (shots.length >= MAX_SHOTS) break;
      }
      if (shots.length < 2) continue;
      const names = new Set((themes ?? []).map((t) => String(t.name)));
      const themeName = typeof raw.concept === "string" && names.has(raw.concept) ? raw.concept : null;
      const title = typeof (raw as { title?: unknown }).title === "string" ? String((raw as { title?: unknown }).title).trim().slice(0, 80) : "";
      const { error } = await admin
        .from("shot_lists")
        .insert({ event_id: e.id, artist_id: artistId, theme_name: themeName, shots, title: title || null });
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
    .select("event_id, theme_name, shots, title")
    .in("event_id", events.map((e) => e.id));
  const byEvent = new Map((lists ?? []).map((l) => [String(l.event_id), l]));
  return events
    .filter((e) => byEvent.has(String(e.id)))
    .map((e) => {
      const l = byEvent.get(String(e.id))!;
      return {
        eventId: String(e.id),
        title: l.title ? String(l.title) : String(e.title),
        date: String(e.event_date),
        type: String(e.event_type),
        themeName: l.theme_name ? String(l.theme_name) : null,
        shots: (Array.isArray(l.shots) ? l.shots : []) as Shot[],
      };
    });
}
