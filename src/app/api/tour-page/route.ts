import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { syncTourPage } from "@/lib/tour-page";

export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** "bandsintown.com/a/1" → "https://bandsintown.com/a/1"; null if not a web address. */
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

/**
 * { artistId, url }: save (or clear, with an empty url) the
 * artist's website, then read it straight away. The database function checks access.
 */
export async function POST(request: Request) {
  let artistId = "";
  let rawUrl = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = typeof body.artistId === "string" ? body.artistId.trim() : "";
    rawUrl = typeof body.url === "string" ? body.url : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!UUID_RE.test(artistId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const url = normalise(rawUrl);
  if (rawUrl.trim() && !url) {
    return NextResponse.json({ error: "That doesn't look like a web address." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.rpc("set_tour_page", { p_artist_id: artistId, p_url: url, p_bandsintown_key: null });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 500 });
  }
  if (!url) return NextResponse.json({ status: null, found: 0, added: 0, note: null });

  try {
    const result = await syncTourPage(createServiceRoleClient(), artistId, { force: true });
    return NextResponse.json(result ?? { status: "failed", found: 0, added: 0, note: null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't read that page" }, { status: 500 });
  }
}
