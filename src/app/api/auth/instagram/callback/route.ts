import { createServiceRoleClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  IG_GRAPH_BASE,
  IG_OAUTH_STATE_COOKIE,
  INSTAGRAM_REDIRECT_URI,
  expiresAtFromSeconds,
  instagramAppCredentials,
  type IgGraphError,
} from "@/lib/instagram-graph";

type ShortTokenResponse = {
  // Meta has returned both shapes for this endpoint.
  access_token?: string;
  user_id?: string | number;
  data?: Array<{ access_token?: string; user_id?: string | number }>;
  error_type?: string;
  error_message?: string;
};

type LongTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: IgGraphError;
};

type MeResponse = {
  id?: string;
  user_id?: string | number;
  username?: string;
  account_type?: string;
  error?: IgGraphError;
};

function redirectTo(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.delete(IG_OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const fail = (reason = "instagram_connect_failed") =>
    redirectTo(request, `/settings?error=${reason}`);

  const url = new URL(request.url);

  // The artist cancelled on Instagram's permission screen.
  if (url.searchParams.get("error")) {
    return fail("instagram_cancelled");
  }

  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  if (!code || !state) {
    return fail();
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(IG_OAUTH_STATE_COOKIE)?.value;
  if (!expectedState || expectedState !== state) {
    return fail();
  }

  const artistId = state.split(".")[0];
  if (!artistId) {
    return fail();
  }

  const creds = instagramAppCredentials();
  if (!creds) {
    console.error("instagram callback: INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET missing");
    return fail();
  }

  try {
    // 1. Exchange the code for a short-lived token.
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: INSTAGRAM_REDIRECT_URI,
        code: code.replace(/#_$/, ""),
      }).toString(),
    });
    const shortJson = (await shortRes.json()) as ShortTokenResponse;
    const shortToken = shortJson.access_token ?? shortJson.data?.[0]?.access_token;
    if (!shortRes.ok || !shortToken) {
      console.error("instagram callback: code exchange failed", shortJson.error_message);
      return fail();
    }

    // 2. Swap it for a 60-day long-lived token.
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", creds.clientSecret);
    longUrl.searchParams.set("access_token", shortToken);

    const longRes = await fetch(longUrl.toString());
    const longJson = (await longRes.json()) as LongTokenResponse;
    if (!longRes.ok || longJson.error || !longJson.access_token) {
      console.error("instagram callback: long-lived exchange failed", longJson.error?.message);
      return fail();
    }

    // 3. Look up the account. user_id is the professional account ID used
    //    for /{id}/media and insights calls.
    const meUrl = new URL(`${IG_GRAPH_BASE}/me`);
    meUrl.searchParams.set("fields", "user_id,username,account_type");
    meUrl.searchParams.set("access_token", longJson.access_token);
    const meRes = await fetch(meUrl.toString());
    const me = (await meRes.json()) as MeResponse;
    const igUserId = String(me.user_id ?? me.id ?? "").trim();
    if (!meRes.ok || me.error || !igUserId) {
      console.error("instagram callback: /me failed", me.error?.message);
      return fail();
    }

    const supabase = createServiceRoleClient();
    const { data: updated, error: dbError } = await supabase
      .from("profiles")
      .update({
        instagram_access_token: longJson.access_token,
        instagram_user_id: igUserId,
        instagram_token_expires_at: expiresAtFromSeconds(longJson.expires_in),
      })
      .eq("id", artistId)
      .select("id");

    if (dbError || !updated?.length) {
      console.error("instagram callback: saving connection failed", dbError?.message);
      return fail();
    }

    return redirectTo(request, "/insights?connected=true");
  } catch (e) {
    console.error("instagram callback: unexpected error", e);
    return fail();
  }
}
