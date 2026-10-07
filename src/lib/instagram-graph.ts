// Instagram API with Instagram Login.
// Artists sign in with their Instagram professional (Business or Creator)
// account directly — no Facebook Page involved.

export const IG_GRAPH_VERSION = "v21.0";
export const IG_GRAPH_BASE = `https://graph.instagram.com/${IG_GRAPH_VERSION}`;

export const INSTAGRAM_REDIRECT_URI =
  "https://tempo.roadie.media/api/auth/instagram/callback";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
].join(",");

// Short-lived cookie holding the OAuth state, so the callback can check the
// response belongs to the browser that started the connection.
export const IG_OAUTH_STATE_COOKIE = "ig_oauth_state";

// Refresh tokens this close to expiry (long-lived tokens last 60 days).
export const IG_TOKEN_REFRESH_WINDOW_DAYS = 10;

export function instagramAppCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env.INSTAGRAM_APP_ID?.trim();
  const clientSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function expiresAtFromSeconds(expiresIn: number | undefined): string {
  const seconds =
    typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 60 * 24 * 60 * 60;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export type IgGraphError = {
  message?: string;
  type?: string;
  code?: number;
};

// Code 190 = invalid/expired/revoked token. The artist needs to reconnect.
export function isReconnectError(error: IgGraphError | undefined): boolean {
  return error?.code === 190;
}

type LongLivedTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: IgGraphError;
};

export async function refreshLongLivedToken(
  accessToken: string
): Promise<{ accessToken: string; expiresAt: string } | { error: IgGraphError }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = (await res.json()) as LongLivedTokenResponse;
  if (!res.ok || json.error || !json.access_token) {
    return { error: json.error ?? { message: `HTTP ${res.status}` } };
  }
  return {
    accessToken: json.access_token,
    expiresAt: expiresAtFromSeconds(json.expires_in),
  };
}
