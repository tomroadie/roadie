import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  if (!activeArtistId) {
    return NextResponse.json(
      { error: "No active artist. Complete onboarding first." },
      { status: 400 }
    );
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ tiktok_waitlist: true })
    .eq("id", activeArtistId);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to join waitlist", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
