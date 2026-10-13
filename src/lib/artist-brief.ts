import type { SupabaseClient } from "@supabase/supabase-js";
import { ask } from "@/lib/themes/ai";
import { clip } from "@/lib/text";
import { fetchPage, pageText } from "@/lib/date-links";

/**
 * An act's brief: their website, bio, press or release pages, read once and
 * summarised for the idea writer, alongside notes from the Tempo team.
 */

const MAX_LINKS = 4;

const SYSTEM = `You read pages about a music act (their website, bio, press, release or label pages) and write a short brief for someone planning their Instagram posts.
Keep what makes them specific: who they are and where from, their sound in plain words, their story, what's current (a release, album campaign, tour), notable facts (syncs, press quotes, collaborators, producers, labels), and anything in their own words worth building posts around.
Leave out ticket prices, cookie banners, navigation and generic marketing copy. Don't invent anything.
Plain British English, under 1200 characters, as short paragraphs or a few lines. If the pages say nothing useful about the act, reply with exactly NONE.
Reply with JSON only: {"brief":"..."}`;

export function splitLinks(raw: string | null | undefined): string[] {
  return [...new Set(String(raw ?? "").split(/\s+/).map((s) => s.trim()).filter(Boolean))]
    .map((t) => (/^https?:\/\//i.test(t) ? t : `https://${t}`))
    .filter((t) => {
      try {
        return new URL(t).hostname.includes(".");
      } catch {
        return false;
      }
    })
    .slice(0, MAX_LINKS);
}

/** Summarises page texts into a brief, or null if there's nothing useful. */
export async function summariseBrief(artistName: string, pages: string[]): Promise<string | null> {
  if (pages.length === 0) return null;
  try {
    const raw = (await ask(SYSTEM, `Act: ${artistName}\n\n${pages.join("\n\n---\n\n")}`, 900)) as { brief?: unknown };
    const b = typeof raw.brief === "string" ? raw.brief.trim() : "";
    return b && b.toUpperCase() !== "NONE" ? b.slice(0, 1500) : null;
  } catch {
    return null;
  }
}

/** Reads the links and saves the summary. Returns how many pages were read. */
export async function readArtistBrief(admin: SupabaseClient, artistId: string): Promise<{ read: number; tried: number }> {
  const { data: p } = await admin.from("profiles").select("artist_name, brief_links").eq("id", artistId).maybeSingle();
  const links = splitLinks(p?.brief_links);
  if (links.length === 0) {
    await admin.from("profiles").update({ brief_context: null, brief_checked_at: new Date().toISOString() }).eq("id", artistId);
    return { read: 0, tried: 0 };
  }
  const pages: string[] = [];
  for (const url of links) {
    try {
      const html = await fetchPage(url);
      const text = html ? pageText(html) : "";
      if (text.length >= 80) pages.push(`Page: ${url}\n${clip(text, 5000)}`);
    } catch {
      // unreadable page: skip it
    }
  }
  const brief = await summariseBrief(String(p?.artist_name ?? "the act"), pages);
  await admin
    .from("profiles")
    .update({ brief_context: brief, brief_checked_at: new Date().toISOString() })
    .eq("id", artistId);
  return { read: brief ? pages.length : 0, tried: links.length };
}
