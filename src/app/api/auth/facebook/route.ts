import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { userIsAdmin } from "@/lib/is-admin";
import { TEMPO_ORIGINS, signOAuthState } from "@/lib/instagram-graph";
import { facebookAppCredentials, facebookDialogUrl } from "@/lib/facebook-business";

/**
 * Starts "Connect Facebook Business". Admin only for now: until the Teams
 * app passes review, it only works for businesses Roadie manages anyway.
 * The signed state carries the Tempo user, not an artist.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!(await userIsAdmin(supabase, user.id))) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  const creds = facebookAppCredentials();
  if (!creds) {
    console.error("facebook connect: FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing");
    return NextResponse.redirect(new URL("/accounts/import?error=not_configured", request.url));
  }

  const requestOrigin = new URL(request.url).origin;
  const returnOrigin = (TEMPO_ORIGINS as readonly string[]).includes(requestOrigin)
    ? requestOrigin
    : TEMPO_ORIGINS[0];

  return NextResponse.redirect(
    facebookDialogUrl(creds.appId, signOAuthState(user.id, returnOrigin, creds.appSecret))
  );
}
