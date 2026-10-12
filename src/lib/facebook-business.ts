import { FB_GRAPH_BASE, IG_GRAPH_VERSION } from "@/lib/instagram-graph";

/**
 * "Tempo for Teams": the second Meta app, using Facebook Login. A manager
 * (or Roadie) logs in with Facebook once and Tempo can see every Instagram
 * account linked to a Page they manage, including through Business Manager.
 * Artists connecting themselves keep using Instagram Login (instagram-graph.ts).
 */

export const FACEBOOK_REDIRECT_URI = "https://tempo.roadie.media/api/auth/facebook/callback";

export const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
  "business_management",
];

export function facebookAppCredentials(): { appId: string; appSecret: string } | null {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

/**
 * Business apps use Facebook Login for Business, where the permissions live
 * in a saved "configuration" (FACEBOOK_LOGIN_CONFIG_ID) rather than a scope
 * list. Without one, fall back to asking for the scopes directly.
 */
export function facebookDialogUrl(appId: string, state: string): string {
  const configId = process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: FACEBOOK_REDIRECT_URI,
    response_type: "code",
    state,
    ...(configId ? { config_id: configId } : { scope: FACEBOOK_SCOPES.join(",") }),
  });
  return `https://www.facebook.com/${IG_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

type GraphError = { message?: string; code?: number };

async function getJson<T>(url: URL): Promise<T> {
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as T & { error?: GraphError };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Facebook HTTP ${res.status}`);
  return json;
}

/** Code → short-lived user token → long-lived (about 60 days) user token. */
export async function exchangeCodeForUserToken(
  code: string,
  creds: { appId: string; appSecret: string }
): Promise<{ token: string; expiresAt: string | null }> {
  const shortUrl = new URL(`${FB_GRAPH_BASE}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", creds.appId);
  shortUrl.searchParams.set("client_secret", creds.appSecret);
  shortUrl.searchParams.set("redirect_uri", FACEBOOK_REDIRECT_URI);
  shortUrl.searchParams.set("code", code);
  const short = await getJson<{ access_token?: string }>(shortUrl);
  if (!short.access_token) throw new Error("No access token from code exchange");

  const longUrl = new URL(`${FB_GRAPH_BASE}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", creds.appId);
  longUrl.searchParams.set("client_secret", creds.appSecret);
  longUrl.searchParams.set("fb_exchange_token", short.access_token);
  const long = await getJson<{ access_token?: string; expires_in?: number }>(longUrl);
  if (!long.access_token) throw new Error("No long-lived token");

  return {
    token: long.access_token,
    expiresAt:
      typeof long.expires_in === "number" && long.expires_in > 0
        ? new Date(Date.now() + long.expires_in * 1000).toISOString()
        : null,
  };
}

export async function fetchFacebookUser(token: string): Promise<{ id: string; name: string | null }> {
  const url = new URL(`${FB_GRAPH_BASE}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", token);
  const me = await getJson<{ id?: string; name?: string }>(url);
  if (!me.id) throw new Error("No Facebook user id");
  return { id: me.id, name: me.name ?? null };
}

export async function fetchGrantedScopes(token: string): Promise<string[]> {
  const url = new URL(`${FB_GRAPH_BASE}/me/permissions`);
  url.searchParams.set("access_token", token);
  const res = await getJson<{ data?: { permission?: string; status?: string }[] }>(url);
  return (res.data ?? []).filter((p) => p.status === "granted" && p.permission).map((p) => String(p.permission));
}

export type BusinessInstagramAccount = {
  pageId: string;
  pageName: string;
  /** Page token: reads the linked Instagram account. Server only. */
  pageToken: string;
  igUserId: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  followers: number | null;
};

type AccountsPage = {
  data?: {
    id?: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: {
      id?: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
      followers_count?: number;
    };
  }[];
  paging?: { next?: string };
};

/**
 * Every Page the person manages that has an Instagram professional account
 * linked, with its Page token. Pages without Instagram are left out.
 */
export async function listBusinessInstagramAccounts(userToken: string): Promise<BusinessInstagramAccount[]> {
  const first = new URL(`${FB_GRAPH_BASE}/me/accounts`);
  first.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count}"
  );
  first.searchParams.set("limit", "100");
  first.searchParams.set("access_token", userToken);

  const out: BusinessInstagramAccount[] = [];
  let next: string | undefined = first.toString();
  for (let guard = 0; next && guard < 20; guard++) {
    const page: AccountsPage = await getJson<AccountsPage>(new URL(next));
    for (const p of page.data ?? []) {
      const ig = p.instagram_business_account;
      if (!p.id || !p.access_token || !ig?.id) continue;
      out.push({
        pageId: p.id,
        pageName: p.name ?? "",
        pageToken: p.access_token,
        igUserId: ig.id,
        username: ig.username ?? null,
        name: ig.name ?? null,
        profilePictureUrl: ig.profile_picture_url ?? null,
        followers: typeof ig.followers_count === "number" ? ig.followers_count : null,
      });
    }
    next = page.paging?.next;
  }
  return out.sort((a, b) => (a.username ?? a.pageName).localeCompare(b.username ?? b.pageName));
}
