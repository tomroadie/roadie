import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function PATCH(request: Request) {
  let requestId = "";

  try {
    const body = (await request.json()) as Record<string, unknown>;
    requestId =
      typeof body.request_id === "string" ? body.request_id.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!requestId) {
    return NextResponse.json({ error: "Expected request_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: fetchError } = await supabase
    .from("plan_revision_requests")
    .select("id, artist_id")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to load revision request", details: fetchError.message },
      { status: 500 }
    );
  }

  if (!row?.id) {
    return NextResponse.json({ error: "Revision request not found" }, { status: 404 });
  }

  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("id")
    .eq("id", row.artist_id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (artistError) {
    return NextResponse.json(
      { error: "Failed to verify artist", details: artistError.message },
      { status: 500 }
    );
  }

  if (!artist?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("plan_revision_requests")
    .update({ artist_acknowledged_at: new Date().toISOString() })
    .eq("id", requestId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to acknowledge revision request", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
