import { createServiceRoleClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";
import { cleanInstagramHandle } from "@/lib/new-lead-pipeline";
import {
  IG_GRAPH_BASE,
  INSTAGRAM_REDIRECT_URI,
  TEMPO_ORIGINS,
  expiresAtFromSeconds,
  instagramAppCredentials,
  verifyOAuthState,
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

export async function GET(request: Request) {
  // Until the state is verified, send people back to the main domain.
  let origin: string = TEMPO_ORIGINS[0];
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));
  const fail = (why: string, reason = "instagram_connect_failed") => {
    console.error(`instagram callback: ${why}`);
    return go(`/settings?error=${reason}`);
  };

  const url = new URL(request.url);

  const creds = instagramAppCredentials();
  if (!creds) {
    return fail("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET missing");
  }

  const state = url.searchParams.get("state")?.trim();
  const verified = state ? verifyOAuthState(state, creds.clientSecret) : null;
  if (verified && "origin" in verified) {
    origin = verified.origin;
  }

  // The artist cancelled on Instagram's permission screen.
  if (url.searchParams.get("error")) {
    return fail(
      `authorisation declined (${url.searchParams.get("error_reason") ?? "unknown"})`,
      "instagram_cancelled"
    );
  }

  const code = url.searchParams.get("code")?.trim();
  if (!code) {
    return fail("no code in callback");
  }
  if (!verified) {
    return fail("no state in callback");
  }
  if ("error" in verified) {
    return fail(verified.error);
  }
  const { artistId } = verified;

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
      return fail(`code exchange failed: ${shortJson.error_message ?? `HTTP ${shortRes.status}`}`);
    }

    // 2. Swap it for a 60-day long-lived token.
    const longUrl = new URL("https://graph.instagram.com/access_token");
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", creds.clientSecret);
    longUrl.searchParams.set("access_token", shortToken);

    const longRes = await fetch(longUrl.toString());
    const longJson = (await longRes.json()) as LongTokenResponse;
    if (!longRes.ok || longJson.error || !longJson.access_token) {
      return fail(`long-lived exchange failed: ${longJson.error?.message ?? `HTTP ${longRes.status}`}`);
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
      return fail(`/me failed: ${me.error?.message ?? `HTTP ${meRes.status}`}`);
    }

    const supabase = createServiceRoleClient();

    // Don't attach one artist's Instagram to another artist's profile
    // (easy to do when managing several artists from one login).
    const { data: profile } = await supabase
      .from("profiles")
      .select("instagram_handle")
      .eq("id", artistId)
      .maybeSingle();
    const expectedHandle = cleanInstagramHandle(profile?.instagram_handle ?? "");
    const connectedHandle = cleanInstagramHandle(me.username ?? "");
    if (expectedHandle && connectedHandle && expectedHandle !== connectedHandle) {
      return fail(
        `connected @${connectedHandle} but artist handle is @${expectedHandle}`,
        "instagram_wrong_account"
      );
    }

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
      return fail(`saving connection failed: ${dbError?.message ?? "no matching artist profile"}`);
    }

    return go("/insights?connected=true");
  } catch (e) {
    return fail(`unexpected error: ${e instanceof Error ? e.message : String(e)}`);
  }
}
