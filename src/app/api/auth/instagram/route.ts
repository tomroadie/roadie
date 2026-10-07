import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import {
  IG_OAUTH_STATE_COOKIE,
  INSTAGRAM_REDIRECT_URI,
  INSTAGRAM_SCOPES,
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

  const clientId = process.env.INSTAGRAM_APP_ID?.trim();
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/settings?error=instagram_connect_failed", request.url)
    );
  }

  // state = "<artistId>.<nonce>"; the nonce is also set as a cookie and
  // checked in the callback.
  const nonce = randomBytes(16).toString("hex");
  const state = `${activeArtistId}.${nonce}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: INSTAGRAM_REDIRECT_URI,
    scope: INSTAGRAM_SCOPES,
    response_type: "code",
    state,
  });

  const response = NextResponse.redirect(
    `https://www.instagram.com/oauth/authorize?${params.toString()}`
  );
  response.cookies.set(IG_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
