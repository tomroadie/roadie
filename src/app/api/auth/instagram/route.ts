import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import {
  INSTAGRAM_REDIRECT_URI,
  INSTAGRAM_SCOPES,
  TEMPO_ORIGINS,
  instagramAppCredentials,
  signOAuthState,
} from "@/lib/instagram-graph";

export async function GET(request: Request) {
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

  const creds = instagramAppCredentials();
  if (!creds) {
    console.error("instagram connect: INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET missing");
    return NextResponse.redirect(
      new URL("/settings?error=instagram_connect_failed", request.url)
    );
  }

  // Send people back to the domain they started on, so they stay logged in.
  const requestOrigin = new URL(request.url).origin;
  const returnOrigin = (TEMPO_ORIGINS as readonly string[]).includes(requestOrigin)
    ? requestOrigin
    : TEMPO_ORIGINS[0];

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    scope: INSTAGRAM_SCOPES,
    response_type: "code",
    state: signOAuthState(activeArtistId, returnOrigin, creds.clientSecret),
  });

  return NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  );
}
