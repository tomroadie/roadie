import { createServiceRoleClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";
import {
  IG_ACCOUNT_SELECTION_COOKIE,
  instagramTokenExpiresAt,
  type IgAccountSelectionEntry,
} from "@/lib/instagram-account-selection";

const GRAPH_VERSION = "v19.0";
const REDIRECT_URI = "https://tempo.roadie.media/api/auth/instagram/callback";

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

type TokenResponse = {
  access_token?: string;
  error?: { message?: string };
};

type AccountsResponse = {
  data?: Array<{ id: string; access_token: string; name?: string }>;
  error?: { message?: string };
};

type PageIgResponse = {
  instagram_business_account?: { id: string };
  error?: { message?: string };
};

type IgInfoResponse = {
  username?: string;
  error?: { message?: string };
};

type FoundAccount = {
  igUserId: string;
  pageAccessToken: string;
  username: string;
  pageName: string;
};

async function saveInstagramConnection(
  artistId: string,
  igUserId: string,
  pageAccessToken: string
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data: updated, error: dbError } = await supabase
    .from("profiles")
    .update({
      instagram_access_token: pageAccessToken,
      instagram_user_id: igUserId,
      instagram_token_expires_at: instagramTokenExpiresAt(),
    })
    .eq("id", artistId)
    .select("id");

  return !dbError && !!updated?.length;
}

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

    const supabase = createServiceRoleClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("instagram_handle")
      .eq("id", state.trim())
      .maybeSingle();

    const expectedHandle = profile?.instagram_handle
      ?.trim()
      .toLowerCase()
      .replace(/^@/, "");

    const accountsUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
    accountsUrl.searchParams.set("access_token", userAccessToken);

    const accountsRes = await fetch(accountsUrl.toString());
    const accountsJson = (await accountsRes.json()) as AccountsResponse;
    const pages = accountsJson.data;
    if (!pages?.length || accountsJson.error) {
      return fail();
    }

    const foundAccounts: FoundAccount[] = [];

    for (const page of pages) {
      const pageUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${page.id}`);
      pageUrl.searchParams.set("fields", "instagram_business_account");
      pageUrl.searchParams.set("access_token", page.access_token);

      const pageRes = await fetch(pageUrl.toString());
      const pageJson = (await pageRes.json()) as PageIgResponse;
      const igId = pageJson.instagram_business_account?.id;
      if (!igId || !page.access_token) {
        continue;
      }

      let igUsername = "";
      try {
        const igInfoUrl = new URL(
          `https://graph.facebook.com/${GRAPH_VERSION}/${igId}`
        );
        igInfoUrl.searchParams.set("fields", "username");
        igInfoUrl.searchParams.set("access_token", page.access_token);
        const igInfoRes = await fetch(igInfoUrl.toString());
        const igInfoJson = (await igInfoRes.json()) as IgInfoResponse;
        igUsername = igInfoJson.username?.toLowerCase().trim() ?? "";
      } catch {
        // still include in selection list
      }

      foundAccounts.push({
        igUserId: igId,
        pageAccessToken: page.access_token,
        username: igUsername,
        pageName: page.name ?? "",
      });
    }

    if (foundAccounts.length === 0) {
      return fail();
    }

    const matched = expectedHandle
      ? foundAccounts.find((a) => a.username === expectedHandle)
      : null;

    if (matched) {
      const saved = await saveInstagramConnection(
        state.trim(),
        matched.igUserId,
        matched.pageAccessToken
      );
      if (!saved) {
        return fail();
      }
      return redirect(request, "/insights?connected=true");
    }

    if (foundAccounts.length === 1) {
      const only = foundAccounts[0];
      const saved = await saveInstagramConnection(
        state.trim(),
        only.igUserId,
        only.pageAccessToken
      );
      if (!saved) {
        return fail();
      }
      return redirect(request, "/insights?connected=true");
    }

    const payload = JSON.stringify({
      artistId: state.trim(),
      accounts: foundAccounts.map(
        (a): IgAccountSelectionEntry => ({
          igUserId: a.igUserId,
          pageAccessToken: a.pageAccessToken,
          username: a.username,
          pageName: a.pageName,
        })
      ),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const response = redirect(request, "/connect/instagram/select");
    response.cookies.set(IG_ACCOUNT_SELECTION_COOKIE, payload, {
      httpOnly: true,
      secure: true,
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch {
    return fail();
  }
}
