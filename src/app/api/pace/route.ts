import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { trackUsage } from "@/lib/track-usage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Posting pace answers. The database functions check access.
 *   { action: "prime", artist_id, prime }  confirm or change the prime
 *   { action: "step", artist_id, accept }  answer "Up for n+1 next week?"
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const artistId = typeof body.artist_id === "string" ? body.artist_id.trim() : "";
  if (!UUID_RE.test(artistId)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let error: { code?: string; message: string } | null = null;
  let event = "";
  if (body.action === "prime") {
    const prime = Number(body.prime);
    if (!Number.isInteger(prime)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    ({ error } = await supabase.rpc("set_posting_prime", { p_artist_id: artistId, p_prime: prime }));
    event = "pace_prime_set";
  } else if (body.action === "step" && typeof body.accept === "boolean") {
    ({ error } = await supabase.rpc("answer_step_offer", { p_artist_id: artistId, p_accept: body.accept }));
    event = body.accept ? "pace_step_accepted" : "pace_step_declined";
  } else {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "22023" ? 409 : error.code === "P0002" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  await trackUsage({ supabase, userId: user.id, artistId, eventType: event });
  return NextResponse.json({ ok: true });
}
