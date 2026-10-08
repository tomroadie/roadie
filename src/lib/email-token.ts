import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed tokens for links in emails (unsubscribe, pause). The payload is
 * readable but can't be changed or forged without the server secret.
 */

export type EmailTokenPayload = {
  artistId: string;
  type: "marketing" | "all";
  ts: number;
};

function secret(): string {
  const s = process.env.EMAIL_TOKEN_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  if (!s) throw new Error("Missing EMAIL_TOKEN_SECRET or CRON_SECRET");
  return s;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createEmailToken(payload: EmailTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Returns the payload only if the signature matches and it hasn't expired. */
export function verifyEmailToken(raw: string | null, maxAgeMs: number, now = Date.now()): EmailTokenPayload | null {
  if (!raw) return null;
  const [body, sig] = raw.trim().split(".");
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<EmailTokenPayload>;
    if (
      typeof p.artistId !== "string" ||
      !p.artistId.trim() ||
      (p.type !== "marketing" && p.type !== "all") ||
      typeof p.ts !== "number" ||
      now - p.ts > maxAgeMs
    ) {
      return null;
    }
    return { artistId: p.artistId.trim(), type: p.type, ts: p.ts };
  } catch {
    return null;
  }
}
