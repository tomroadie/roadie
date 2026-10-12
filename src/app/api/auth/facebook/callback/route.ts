import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { TEMPO_ORIGINS, verifyOAuthState } from "@/lib/instagram-graph";
import {
  exchangeCodeForUserToken,
  facebookAppCredentials,
  fetchFacebookUser,
  fetchGrantedScopes,
} from "@/lib/facebook-business";

/** Facebook sends people back here. Saves the login, then shows the account picker. */
export async function GET(request: Request) {
  let origin: string = TEMPO_ORIGINS[0];
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));
  const fail = (why: string, reason = "connect_failed") => {
    console.error(`facebook callback: ${why}`);
    return go(`/accounts/import?error=${reason}`);
  };

  const url = new URL(request.url);
  const creds = facebookAppCredentials();
  if (!creds) return fail("FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing", "not_configured");

  const state = url.searchParams.get("state")?.trim();
  const verified = state ? verifyOAuthState(state, creds.appSecret) : null;
  if (verified && "origin" in verified) origin = verified.origin;

  if (url.searchParams.get("error")) {
    return fail(`declined (${url.searchParams.get("error_reason") ?? "unknown"})`, "cancelled");
  }
  const code = url.searchParams.get("code")?.trim();
  if (!code) return fail("no code");
  if (!verified) return fail("no state");
  if ("error" in verified) return fail(verified.error);
  const userId = verified.artistId; // the Tempo user who started the connection

  try {
    const { token, expiresAt } = await exchangeCodeForUserToken(code, creds);
    const [fbUser, scopes] = await Promise.all([fetchFacebookUser(token), fetchGrantedScopes(token)]);

    const admin = createServiceRoleClient();
    const { error } = await admin.from("facebook_connections").upsert(
      {
        user_id: userId,
        fb_user_id: fbUser.id,
        fb_name: fbUser.name,
        user_access_token: token,
        token_expires_at: expiresAt,
        scopes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) return fail(`saving connection: ${error.message}`);

    return go("/accounts/import?connected=1");
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
