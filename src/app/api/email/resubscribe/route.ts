import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";

type PreferenceType = "marketing" | "all";

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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected JSON object body" }, { status: 400 });
  }

  const artistId =
    typeof (body as { artistId?: unknown }).artistId === "string"
      ? (body as { artistId: string }).artistId.trim()
      : "";
  const type = (body as { type?: unknown }).type;

  if (!artistId) {
    return NextResponse.json({ error: "Missing artistId" }, { status: 400 });
  }

  if (type !== "marketing" && type !== "all") {
    return NextResponse.json(
      { error: 'type must be "marketing" or "all"' },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", artistId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to verify artist", details: profileError.message },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json({ error: "Artist not found" }, { status: 403 });
  }

  let serviceSupabase;
  try {
    serviceSupabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const update =
    type === "marketing"
      ? {
          marketing_unsubscribed: false,
          unsubscribed_at: null,
        }
      : {
          all_emails_paused: false,
        };

  const { error: updateError } = await serviceSupabase
    .from("profiles")
    .update(update)
    .eq("id", artistId)
    .eq("owner_user_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update preferences", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
