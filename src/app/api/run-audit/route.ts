import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { enqueueNewLead } from "@/lib/new-lead-pipeline";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected JSON object body" }, { status: 400 });
  }

  const artistId = String(
    (body as Record<string, unknown>).artist_id ?? ""
  ).trim();

  if (!artistId) {
    return NextResponse.json({ error: "Missing artist_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email?.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("instagram_handle, artist_name, owner_user_id")
    .eq("id", artistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile || profile.owner_user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!profile.artist_name?.trim()) {
    return NextResponse.json(
      { error: "Artist profile is missing a name" },
      { status: 400 }
    );
  }

  const ig = profile.instagram_handle?.trim();
  if (!ig) {
    return NextResponse.json(
      { error: "No Instagram handle on file" },
      { status: 400 }
    );
  }

  try {
    await enqueueNewLead({
      email: user.email.trim(),
      artist_name: profile.artist_name.trim(),
      instagram_input: ig,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to start audit";
    const lower = msg.toLowerCase();
    let status = 502;
    if (lower.includes("could not extract")) status = 400;
    else if (lower.includes("misconfiguration")) status = 500;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({
    success: true,
    message: "Audit started — results appear in 3-5 minutes",
  });
}
