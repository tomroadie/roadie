import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What each post looks like, read from its cover image by a small vision
 * model: a kind (live, posed, poster…) and one plain line. The artist can
 * correct either; once they have, Tempo never overwrites it.
 */

import { VISUAL_KINDS, asVisualKind, type VisualKind } from "@/lib/visual-kinds";

export { VISUAL_KINDS, VISUAL_KIND_LABEL, asVisualKind, type VisualKind } from "@/lib/visual-kinds";

const VISION_MODEL = process.env.VISION_MODEL ?? "claude-haiku-4-5";
/** Posts read per artist per sync run; the backlog clears over a few runs. */
const PER_RUN = 8;
const BATCH = 4;
const MAX_ATTEMPTS = 3;

const SYSTEM = `You describe the cover image of a music act's Instagram post, so a content tool knows what their posts look like.
For each image give:
- kind: one of ${VISUAL_KINDS.join(", ")}. live = on stage or in a crowd; posed = a set-up photo of the act; candid = unposed moments, behind the scenes, everyday life; studio = recording or rehearsing; artwork = a release cover or art piece; poster = a gig or event poster or flyer; graphic = other text-led graphics or screenshots.
- label: 2 to 5 plain words naming it, as the act would ("Festival poster, band photo", "Bassist under blue lights", "Single artwork").
- note: one plain line under 160 characters saying what's actually in it: who or what is in frame, the setting, the light or colour, how it's shot (phone, handheld, flash, wide), and any text on it in a few words.
Plain British English. No judgements ("great shot"), no guessing names. Reply with JSON only: {"images":[{"n":1,"kind":"","label":"","note":""}]}`;

type Pending = { instagram_post_id: string; thumbnail_url: string | null; ig_media_type: string | null; visual_attempts: number };

/** A fresh image URL from Instagram (stored ones expire). */
async function freshImageUrl(graphBase: string, token: string, mediaId: string): Promise<string | null> {
  const get = async (path: string, fields: string) => {
    const u = new URL(`${graphBase}/${path}`);
    u.searchParams.set("fields", fields);
    u.searchParams.set("access_token", token);
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  };
  const m = await get(mediaId, "media_type,media_url,thumbnail_url");
  if (!m) return null;
  const type = String(m.media_type ?? "").toUpperCase();
  const pick = (o: Record<string, unknown>, t: string) =>
    (typeof o.thumbnail_url === "string" && o.thumbnail_url) ||
    (t !== "VIDEO" && typeof o.media_url === "string" && o.media_url) ||
    null;
  const direct = pick(m, type);
  if (direct) return direct;
  if (type === "CAROUSEL_ALBUM") {
    const kids = await get(`${mediaId}/children`, "media_type,media_url,thumbnail_url");
    const first = Array.isArray(kids?.data) ? (kids!.data[0] as Record<string, unknown> | undefined) : undefined;
    if (first) return pick(first, String(first.media_type ?? "").toUpperCase());
  }
  return null;
}

/** Downloads and shrinks to 512px JPEG: plenty to describe, and cheap to send. */
async function loadImage(url: string): Promise<string | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > 15_000_000) return null;
  const out = await sharp(buf).resize({ width: 512, height: 640, fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
  return out.toString("base64");
}

async function describe(images: string[]): Promise<{ kind: VisualKind | null; label: string; note: string }[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const content: Anthropic.ContentBlockParam[] = [];
  images.forEach((data, i) => {
    content.push({ type: "text", text: `Image ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
  });
  content.push({ type: "text", text: `Describe all ${images.length} images.` });
  const res = await new Anthropic({ apiKey }).messages.create({
    model: VISION_MODEL,
    max_tokens: 200 + images.length * 120,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON in vision reply");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { images?: unknown };
  const out: { kind: VisualKind | null; label: string; note: string }[] = images.map(() => ({ kind: null, label: "", note: "" }));
  for (const row of Array.isArray(parsed.images) ? parsed.images : []) {
    const r = row as Record<string, unknown>;
    const n = Number(r.n);
    if (!Number.isInteger(n) || n < 1 || n > images.length) continue;
    out[n - 1] = {
      kind: asVisualKind(r.kind),
      label: typeof r.label === "string" ? r.label.trim().replace(/[.]$/, "").slice(0, 40) : "",
      note: typeof r.note === "string" ? r.note.trim().slice(0, 200) : "",
    };
  }
  return out;
}

/**
 * Reads cover images for posts that haven't been described yet, newest
 * first, a batch per sync run. Needs a service-role client and the artist's
 * Instagram token. Returns how many were described.
 */
export async function describeNewPosts(
  admin: SupabaseClient,
  artistId: string,
  graphBase: string,
  token: string
): Promise<number> {
  const { data, error } = await admin
    .from("post_performance")
    .select("instagram_post_id, thumbnail_url, ig_media_type, visual_attempts")
    .eq("artist_id", artistId)
    // Not described yet, or described before short labels existed.
    .or("visual_source.is.null,and(visual_source.eq.ai,visual_label.is.null)")
    .lt("visual_attempts", MAX_ATTEMPTS)
    .order("post_date", { ascending: false })
    .limit(PER_RUN);
  if (error) throw new Error(`posts: ${error.message}`);
  const posts = (data ?? []) as Pending[];
  let done = 0;

  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH);
    const loaded: { post: Pending; image: string }[] = [];
    for (const post of batch) {
      let image: string | null = null;
      try {
        const url = (await freshImageUrl(graphBase, token, post.instagram_post_id)) ?? post.thumbnail_url;
        if (url) image = await loadImage(url);
      } catch {
        image = null;
      }
      if (image) loaded.push({ post, image });
      else await bumpAttempts(admin, artistId, post);
    }
    if (loaded.length === 0) continue;

    let notes: { kind: VisualKind | null; label: string; note: string }[];
    try {
      notes = await describe(loaded.map((l) => l.image));
    } catch (e) {
      for (const l of loaded) await bumpAttempts(admin, artistId, l.post);
      console.error("describe posts failed", artistId, e instanceof Error ? e.message : e);
      continue;
    }
    for (let j = 0; j < loaded.length; j++) {
      const { kind, label, note } = notes[j];
      if (!kind || !note || !label) {
        await bumpAttempts(admin, artistId, loaded[j].post);
        continue;
      }
      // Never overwrite an artist's correction made while this ran.
      const { error: upErr } = await admin
        .from("post_performance")
        .update({ visual_kind: kind, visual_label: label, visual_note: note, visual_source: "ai" })
        .eq("artist_id", artistId)
        .eq("instagram_post_id", loaded[j].post.instagram_post_id)
        .or("visual_source.is.null,visual_source.eq.ai");
      if (!upErr) done++;
    }
  }
  return done;
}

async function bumpAttempts(admin: SupabaseClient, artistId: string, post: Pending) {
  await admin
    .from("post_performance")
    .update({ visual_attempts: post.visual_attempts + 1 })
    .eq("artist_id", artistId)
    .eq("instagram_post_id", post.instagram_post_id);
}
