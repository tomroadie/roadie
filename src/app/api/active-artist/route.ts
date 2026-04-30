import { createClient } from "@/utils/supabase/server";
import { ACTIVE_ARTIST_COOKIE } from "@/lib/active-artist";
import { userIsAdmin } from "@/lib/is-admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("artistId" in body)) {
    return NextResponse.json({ error: "Expected artistId" }, { status: 400 });
  }

  const artistId = (body as { artistId: unknown }).artistId;
  if (typeof artistId !== "string" || !artistId.trim()) {
    return NextResponse.json({ error: "Invalid artistId" }, { status: 400 });
  }

  const admin = await userIsAdmin(supabase, user.id);

  const lookup = supabase
    .from("artists")
    .select("id")
    .eq("id", artistId.trim());

  const { data: row, error } = admin
    ? await lookup.maybeSingle()
    : await lookup.eq("owner_user_id", user.id).maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Lookup failed", details: error.message },
      { status: 500 }
    );
  }

  if (!row) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, artistId: row.id });
  res.cookies.set(ACTIVE_ARTIST_COOKIE, row.id, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: false,
  });
  return res;
}
