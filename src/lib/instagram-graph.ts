import { createHmac, timingSafeEqual } from "node:crypto";

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

// OAuth state is "<payload>.<hmac>", where payload is base64url JSON with
// the artist ID, when it was issued and which Tempo domain the person started
// on. It's signed with the app secret and checked without a cookie, because
// Tempo runs on more than one domain but Instagram always sends people back
// to tempo.roadie.media, where a cookie set on another domain is missing.
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

// Domains people may be sent back to after connecting.
export const TEMPO_ORIGINS = [
  "https://tempo.roadie.media",
  "https://app.roadie.media",
] as const;

type StatePayload = { a: string; t: number; o: string };

function stateSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signOAuthState(
  artistId: string,
  origin: string,
  secret: string
): string {
  const body: StatePayload = { a: artistId, t: Date.now(), o: origin };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${stateSignature(payload, secret)}`;
}

// Returns the artist ID and return origin if the state is genuine and recent,
// otherwise a reason for the logs.
export function verifyOAuthState(
  state: string,
  secret: string
): { artistId: string; origin: string } | { error: string } {
  const [payload, signature, ...rest] = state.split(".");
  if (!payload || !signature || rest.length) return { error: "malformed state" };

  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(stateSignature(payload, secret), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: "state signature mismatch" };
  }

  let body: StatePayload;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString()) as StatePayload;
  } catch {
    return { error: "unreadable state" };
  }

  const age = Date.now() - Number(body.t);
  if (!Number.isFinite(age) || age < 0 || age > STATE_MAX_AGE_MS) {
    return { error: "state expired" };
  }
  if (!body.a) return { error: "state missing artist" };

  const origin = (TEMPO_ORIGINS as readonly string[]).includes(body.o)
    ? body.o
    : TEMPO_ORIGINS[0];
  return { artistId: body.a, origin };
}

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
