import { Resend } from "resend";
import { createServiceRoleClient } from "@/utils/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export type EmailType =
  | "audit_ready"
  | "free_day3"
  | "free_day7"
  | "free_day14"
  | "trial_welcome"
  | "trial_no_plan_day2"
  | "trial_engaged_day5"
  | "trial_ending"
  | "trial_ended"
  | "weekly_plan_ready"
  | "winback_day1"
  | "winback_day7"
  | "winback_day30"
  | "checkin_friday";

export type EmailRecipient = {
  userId: string;
  artistId: string;
  email: string;
  artistName: string;
  plan: string;
  marketingUnsubscribed: boolean;
  allEmailsPaused: boolean;
};

const TRANSACTIONAL_TYPES: EmailType[] = [
  "audit_ready",
  "trial_welcome",
  "trial_ending",
  "weekly_plan_ready",
  "checkin_friday",
];

export function isTransactional(type: EmailType): boolean {
  return TRANSACTIONAL_TYPES.includes(type);
}

export function shouldSendEmail(
  recipient: EmailRecipient,
  type: EmailType
): boolean {
  if (recipient.allEmailsPaused) return false;

  if (recipient.marketingUnsubscribed && !isTransactional(type)) {
    return false;
  }

  return true;
}

export async function alreadySentToday(
  artistId: string,
  type: EmailType
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("email_log")
    .select("id")
    .eq("artist_id", artistId)
    .eq("email_type", type)
    .gte("sent_at", `${today}T00:00:00Z`)
    .limit(1)
    .maybeSingle();

  return !!data;
}

export async function everSent(
  artistId: string,
  type: EmailType
): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from("email_log")
    .select("id")
    .eq("artist_id", artistId)
    .eq("email_type", type)
    .limit(1)
    .maybeSingle();

  return !!data;
}

export async function logEmail(
  userId: string,
  artistId: string,
  type: EmailType,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceRoleClient();

  await supabase.from("email_log").insert({
    user_id: userId,
    artist_id: artistId,
    email_type: type,
    metadata: metadata ?? null,
  });
}

export function unsubscribeUrl(
  artistId: string,
  type: "marketing" | "all"
): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://app.roadie.media";
  const token = Buffer.from(
    JSON.stringify({ artistId, type, ts: Date.now() })
  ).toString("base64url");
  return `${base}/api/email/unsubscribe?token=${token}`;
}

export function unsubscribeFooter(artistId: string): string {
  const marketingUrl = unsubscribeUrl(artistId, "marketing");
  const pauseUrl = unsubscribeUrl(artistId, "all");

  return `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #333;text-align:center;font-family:sans-serif;font-size:12px;color:#666;line-height:1.6">
  <p style="margin:0 0 8px">
    You're receiving this because you have a Tempo account.
  </p>
  <p style="margin:0">
    <a href="${marketingUrl}" style="color:#666;text-decoration:underline">
      Unsubscribe from marketing emails
    </a>
    &nbsp;·&nbsp;
    <a href="${pauseUrl}" style="color:#666;text-decoration:underline">
      Pause all emails
    </a>
  </p>
  <p style="margin:8px 0 0;color:#555">
    You'll still receive emails about your account and content plans.
  </p>
</div>`;
}

export async function sendEmail({
  to,
  subject,
  html,
  recipient,
  type,
  metadata,
}: {
  to: string;
  subject: string;
  html: string;
  recipient: EmailRecipient;
  type: EmailType;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (!shouldSendEmail(recipient, type)) {
    return false;
  }

  if (await alreadySentToday(recipient.artistId, type)) {
    return false;
  }

  try {
    await resend.emails.send({
      from: "Tom at Tempo <hello@roadie.media>",
      to,
      subject,
      html,
    });

    await logEmail(recipient.userId, recipient.artistId, type, metadata);

    return true;
  } catch (e) {
    console.error(`Failed to send ${type}:`, e);
    return false;
  }
}
