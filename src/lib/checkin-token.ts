import { createHmac, timingSafeEqual } from "crypto";
import { getMondayDateString } from "@/lib/week";

function checkinSecret(): string {
  return (
    process.env.CHECKIN_TOKEN_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

export function createCheckinToken(artistId: string): string {
  const secret = checkinSecret();
  if (!secret) {
    throw new Error("Missing CHECKIN_TOKEN_SECRET or CRON_SECRET");
  }
  return createHmac("sha256", secret)
    .update(artistId.trim())
    .digest("hex")
    .slice(0, 24);
}

export function verifyCheckinToken(artistId: string, token: string): boolean {
  const secret = checkinSecret();
  if (!secret || !artistId.trim() || !token.trim()) return false;

  const expected = createCheckinToken(artistId);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Week start (Monday) for the plan that drops after a Friday check-in. */
export function getUpcomingPlanWeekStart(d = new Date()): string {
  const monday = getMondayDateString(d);
  const date = new Date(`${monday}T12:00:00`);
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}
