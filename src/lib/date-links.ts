import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ask } from "@/lib/themes/ai";
import { clip } from "@/lib/text";

/**
 * Optional links on dates (ticket page, festival page, Bandcamp, press
 * release): read once, kept as a short summary for shot lists and ideas.
 * Some sites (big ticketing ones especially) block this or build the page
 * in the browser; those are marked failed and everything carries on.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? privateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Only public http(s) addresses on standard ports. */
async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.port && u.port !== "80" && u.port !== "443") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (addrs.length === 0 || addrs.some((a) => privateIp(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}

export async function fetchPage(raw: string): Promise<string | null> {
  let url = await safeUrl(raw);
  for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TempoBot/1.0; +https://tempo.roadie.media)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-GB,en;q=0.8",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      url = next ? await safeUrl(new URL(next, url).toString()) : null;
      continue;
    }
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return new TextDecoder().decode(buf.slice(0, MAX_BYTES));
    return new TextDecoder().decode(buf);
  }
  return null;
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** Title, meta descriptions and visible text, roughly. */
export function pageText(html: string): string {
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i");
    return decode((html.match(re)?.[1] ?? html.match(re2)?.[1] ?? "").trim());
  };
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");
  const body = decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
  return [
    title && `Title: ${title}`,
    meta("og:title") && `Page: ${meta("og:title")}`,
    (meta("og:description") || meta("description")) && `Description: ${meta("og:description") || meta("description")}`,
    body && `Text: ${body}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM = `You read a web page linked to a music act's upcoming date (a gig, festival, release or session) and write a short brief for their content planning.
Keep only what's useful for planning posts: what the date is, where, who else is on the bill (support acts, headliners, other names), release details (title, format, tracks), and any lines about the act worth quoting or building on. Leave out prices, booking terms, cookie banners and site navigation.
Plain British English, under 600 characters. If the page has nothing useful about this date or act, reply with exactly NONE.
Reply with JSON only: {"brief":"..."}`;

/** Reads one link. Returns the brief, or null when it couldn't be read or had nothing useful. */
export async function readDateLink(
  url: string,
  date: { title: string; event_type: string; event_date: string; artistName: string }
): Promise<string | null> {
  let html: string | null = null;
  try {
    html = await fetchPage(url);
  } catch {
    html = null;
  }
  if (!html) return null;
  const text = pageText(html);
  if (text.length < 80) return null;
  const prompt = `Act: ${date.artistName}
Their date: ${date.event_type}: "${clip(date.title, 120)}" on ${date.event_date}
Link: ${url}

${clip(text, 6000)}`;
  try {
    const raw = (await ask(SYSTEM, prompt, 400)) as { brief?: unknown };
    const brief = typeof raw.brief === "string" ? raw.brief.trim() : "";
    if (!brief || brief.toUpperCase() === "NONE") return null;
    return brief.slice(0, 800);
  } catch {
    return null;
  }
}

type EventRow = { id: string; artist_id: string; title: string; event_type: string; event_date: string; link_url: string };

async function readAndSave(admin: SupabaseClient, e: EventRow, artistName: string): Promise<{ status: "ok" | "failed"; context: string | null }> {
  const context = await readDateLink(e.link_url, {
    title: e.title,
    event_type: e.event_type,
    event_date: e.event_date,
    artistName,
  });
  const status = context ? "ok" : "failed";
  // Only save if the link hasn't changed while we read it.
  await admin
    .from("events")
    .update({ link_context: context, link_status: status, link_checked_at: new Date().toISOString() })
    .eq("id", e.id)
    .eq("link_url", e.link_url);
  return { status, context };
}

async function artistName(admin: SupabaseClient, artistId: string): Promise<string> {
  const { data } = await admin.from("profiles").select("artist_name").eq("id", artistId).maybeSingle();
  return String(data?.artist_name ?? "the artist");
}

/** Reads one date's link now (when the artist saves it). Service-role client. */
export async function readLinkForEvent(admin: SupabaseClient, eventId: string) {
  const { data: e } = await admin
    .from("events")
    .select("id, artist_id, title, event_type, event_date, link_url")
    .eq("id", eventId)
    .maybeSingle();
  if (!e?.link_url) return { status: "failed" as const, context: null };
  return readAndSave(admin, e as EventRow, await artistName(admin, String(e.artist_id)));
}

/** Catch-up in the sync: upcoming dates with a link not read yet. */
export async function readDueDateLinks(admin: SupabaseClient, artistId: string, now: Date = new Date()): Promise<number> {
  const today = now.toISOString().slice(0, 10);
  const { data } = await admin
    .from("events")
    .select("id, artist_id, title, event_type, event_date, link_url")
    .eq("artist_id", artistId)
    .not("link_url", "is", null)
    .is("link_checked_at", null)
    .gte("event_date", today)
    .order("event_date")
    .limit(3);
  if (!data?.length) return 0;
  const name = await artistName(admin, artistId);
  let ok = 0;
  for (const e of data as EventRow[]) {
    const r = await readAndSave(admin, e, name);
    if (r.status === "ok") ok++;
  }
  return ok;
}
