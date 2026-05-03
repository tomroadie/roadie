import { createServiceRoleClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";

const GRAPH_VERSION = "v19.0";
const REDIRECT_URI = "https://app.roadie.media/api/auth/instagram/callback";

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

type TokenResponse = {
  access_token?: string;
  error?: { message?: string };
};

type AccountsResponse = {
  data?: Array<{ id: string; access_token: string }>;
  error?: { message?: string };
};

type PageIgResponse = {
  instagram_business_account?: { id: string };
  error?: { message?: string };
};

export async function GET(request: Request) {
  const fail = () => redirect(request, "/settings?error=instagram_connect_failed");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code?.trim() || !state?.trim()) {
    return fail();
  }

  const clientId = process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.FACEBOOK_APP_SECRET;
  if (!clientId || !clientSecret) {
    return fail();
  }

  try {
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      code: code.trim(),
    });

    const shortRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody.toString(),
      }
    );
    const shortJson = (await shortRes.json()) as TokenResponse;
    const shortToken = shortJson.access_token;
    if (!shortToken || shortJson.error) {
      return fail();
    }

    const longUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", clientId);
    longUrl.searchParams.set("client_secret", clientSecret);
    longUrl.searchParams.set("fb_exchange_token", shortToken);

    const longRes = await fetch(longUrl.toString());
    const longJson = (await longRes.json()) as TokenResponse;
    const userAccessToken = longJson.access_token;
    if (!userAccessToken || longJson.error) {
      return fail();
    }

    const accountsUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
    accountsUrl.searchParams.set("access_token", userAccessToken);

    const accountsRes = await fetch(accountsUrl.toString());
    const accountsJson = (await accountsRes.json()) as AccountsResponse;
    const pages = accountsJson.data;
    if (!pages?.length || accountsJson.error) {
      return fail();
    }

    let igUserId: string | null = null;
    let pageAccessToken: string | null = null;

    for (const page of pages) {
      const pageUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${page.id}`);
      pageUrl.searchParams.set("fields", "instagram_business_account");
      pageUrl.searchParams.set("access_token", page.access_token);

      const pageRes = await fetch(pageUrl.toString());
      const pageJson = (await pageRes.json()) as PageIgResponse;
      const igId = pageJson.instagram_business_account?.id;
      if (igId && page.access_token) {
        igUserId = igId;
        pageAccessToken = page.access_token;
        break;
      }
    }

    if (!igUserId || !pageAccessToken) {
      return fail();
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    const supabase = createServiceRoleClient();
    const { data: updated, error: dbError } = await supabase
      .from("profiles")
      .update({
        instagram_access_token: pageAccessToken,
        instagram_user_id: igUserId,
        instagram_token_expires_at: expiresAt.toISOString(),
      })
      .eq("id", state.trim())
      .select("id");

    if (dbError || !updated?.length) {
      return fail();
    }

    return redirect(request, "/insights?connected=true");
  } catch {
    return fail();
  }
}
