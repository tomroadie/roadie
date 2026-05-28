import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { enqueueNewLead } from "@/lib/new-lead-pipeline";

const ARTIST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let artistId = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId =
      typeof body.artist_id === "string" ? body.artist_id.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!artistId || !ARTIST_ID_UUID_RE.test(artistId)) {
    return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userIsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let adminSupabase: ReturnType<typeof createServiceRoleClient>;
  try {
    adminSupabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("artist_name, instagram_handle, owner_user_id")
    .eq("id", artistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load profile", details: profileError.message },
      { status: 500 }
    );
  }

  const ig = profile?.instagram_handle?.trim();
  if (!ig) {
    return NextResponse.json(
      { error: "This artist has no Instagram handle on file." },
      { status: 400 }
    );
  }

  const artistName = profile?.artist_name?.trim();
  if (!artistName) {
    return NextResponse.json(
      { error: "This artist has no name on file." },
      { status: 400 }
    );
  }

  const ownerId = profile?.owner_user_id;
  if (!ownerId) {
    return NextResponse.json({ error: "Missing owner for this artist." }, { status: 400 });
  }

  const { data: authData, error: authErr } =
    await adminSupabase.auth.admin.getUserById(ownerId);
  if (authErr) {
    return NextResponse.json(
      { error: "Failed to resolve owner email", details: authErr.message },
      { status: 500 }
    );
  }

  const email = authData.user.email?.trim();
  if (!email) {
    return NextResponse.json(
      { error: "Could not resolve owner email for this artist." },
      { status: 400 }
    );
  }

  try {
    await enqueueNewLead({
      email,
      artist_name: artistName,
      instagram_input: ig,
      is_research: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Audit enqueue failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
