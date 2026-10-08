import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { appBaseUrl } from "@/lib/email";
import { inviteEmail } from "@/lib/email-templates";

/**
 * Closed beta: signing up needs a one-time invite link. Invites live on
 * access_requests (a request from the homepage, or one Tom adds by hand).
 * Set BETA_OPEN_SIGNUP=on to let anyone sign up again.
 */

export function openSignupOn(): boolean {
  return process.env.BETA_OPEN_SIGNUP?.trim().toLowerCase() === "on";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function inviteUrl(token: string, email: string): string {
  return `${appBaseUrl()}/login?mode=signup&invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

/**
 * Creates (or refreshes) an invite for an email and sends the invite email.
 * Re-inviting gives a new link; the old one stops working.
 */
export async function sendInvite(
  admin: SupabaseClient,
  input: { email: string; name?: string | null; requestId?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "That doesn't look like an email address." };

  const token = randomBytes(24).toString("base64url");
  const now = new Date().toISOString();

  const { data: existing } = input.requestId
    ? await admin.from("access_requests").select("id, artist_name, joined_at").eq("id", input.requestId).maybeSingle()
    : await admin.from("access_requests").select("id, artist_name, joined_at").ilike("email", email).maybeSingle();
  if (existing?.joined_at) return { ok: false, error: "They've already signed up." };

  const name = input.name?.trim() || (existing?.artist_name ? String(existing.artist_name) : null);
  const { error } = existing
    ? await admin
        .from("access_requests")
        .update({ status: "invited", invite_token: token, invited_at: now, artist_name: name })
        .eq("id", existing.id)
    : await admin.from("access_requests").insert({
        email,
        artist_name: name,
        status: "invited",
        invite_token: token,
        invited_at: now,
        source: "admin",
      });
  if (error) return { ok: false, error: error.message };

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email isn't configured (RESEND_API_KEY)." };
  const mail = inviteEmail({ name, url: inviteUrl(token, email) });
  const { error: sendError } = await new Resend(key).emails.send({
    from: "Tom at Tempo <hello@roadie.media>",
    to: email,
    subject: mail.subject,
    html: mail.html,
  });
  if (sendError) return { ok: false, error: `Invite saved, but the email failed: ${sendError.message}` };
  return { ok: true };
}

/** The invite row for this token and email, if it's valid and unused. */
export async function findInvite(
  admin: SupabaseClient,
  token: string,
  email: string
): Promise<{ id: string } | null> {
  if (!token) return null;
  const { data } = await admin
    .from("access_requests")
    .select("id, email, joined_at")
    .eq("invite_token", token)
    .eq("status", "invited")
    .maybeSingle();
  if (!data || data.joined_at) return null;
  if (String(data.email).toLowerCase() !== email.trim().toLowerCase()) return null;
  return { id: String(data.id) };
}

export async function markInviteJoined(admin: SupabaseClient, id: string): Promise<void> {
  await admin.from("access_requests").update({ joined_at: new Date().toISOString() }).eq("id", id);
}
