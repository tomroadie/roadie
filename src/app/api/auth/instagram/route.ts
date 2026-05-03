import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveArtistIdForUser } from "@/lib/active-artist";

export async function GET() {
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
      { error: "No active artist selected. Complete onboarding first." },
      { status: 400 }
    );
  }

  const redirectUri =
    "https://app.roadie.media/api/auth/instagram/callback";
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    redirect_uri: redirectUri,
    scope:
      "instagram_basic,pages_show_list,pages_read_engagement,business_management,instagram_manage_insights",
    response_type: "code",
    state: activeArtistId,
  });

  const url = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  return NextResponse.redirect(url);
}
