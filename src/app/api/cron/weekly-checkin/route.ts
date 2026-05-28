import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { createCheckinToken } from "@/lib/checkin-token";
import { buildEmailRecipient, sendEmail } from "@/lib/email";
import { checkinFridayEmail } from "@/lib/email-templates";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const ELIGIBLE_PROFILES_FILTER =
  "is_managed.eq.true,and(is_managed.eq.false,plan.in.(starter,pro,label))";

function generateManagedWeeklyCheckinEmail(args: {
  artistName: string;
  checkinUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = "Quick question before your plan drops Monday";
  const greeting = args.artistName.trim() || "there";
  const body =
    `Hey ${greeting} — anything happening next week we should factor into your content plan? A show, release, studio session, anything at all. Reply to this email or click below.`;

  const text = `${body}\n\nTell us what's coming: ${args.checkinUrl}`;

  const html = buildWeeklyCheckinEmailHtml({
    subject,
    body,
    checkinUrl: args.checkinUrl,
    ctaLabel: "Tell us what's coming →",
  });

  return { subject, text, html };
}

function buildWeeklyCheckinEmailHtml(args: {
  subject: string;
  body: string;
  checkinUrl: string;
  ctaLabel: string;
  bodyIsHtml?: boolean;
}): string {
  const bodyContent = args.bodyIsHtml
    ? args.body
    : escapeHtml(args.body);

  return `
  <!doctype html>
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(args.subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:#0A0A0F;font-family:Arial, sans-serif;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0A0A0F;">
        <tr>
          <td align="center" style="padding:24px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;border-collapse:separate;">
              <tr>
                <td style="background:#111111;padding:26px 32px;text-align:left;border-bottom:1px solid rgba(0,255,135,0.22);">
                  <div style="font-weight:900;color:#00FF87;font-size:15px;letter-spacing:0.18em;">
                    TEMPO
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background:#111111;padding:28px 32px 18px 32px;">
                  <div style="color:#A1A1AA;font-size:14px;line-height:1.7;margin:0;">
                    ${bodyContent}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background:#111111;padding:0 32px 30px 32px;text-align:left;">
                  <a href="${escapeHtml(args.checkinUrl)}"
                     style="display:block;background:#00FF87;color:#0A0A0F;text-decoration:none;font-weight:900;font-size:14px;padding:16px 18px;border-radius:12px;text-align:center;">
                    ${escapeHtml(args.ctaLabel)}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="background:#0A0A0F;padding:18px 32px 28px 32px;text-align:left;">
                  <div style="color:#71717A;font-size:12px;line-height:1.6;margin:0;">
                    You&apos;re receiving this because you use Tempo at app.roadie.media
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `.trim();
}

async function sendResendEmail(args: {
  apiKey: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Tempo <hello@roadie.media>",
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text || res.statusText };
  }

  return { ok: true };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: missing RESEND_API_KEY" },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (!appUrl) {
      return NextResponse.json(
        { error: "Server misconfiguration: missing NEXT_PUBLIC_APP_URL" },
        { status: 500 }
      );
    }

    let supabase;
    try {
      supabase = createServiceRoleClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Configuration error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "id, artist_name, owner_user_id, is_managed, plan, marketing_unsubscribed, all_emails_paused"
      )
      .or(ELIGIBLE_PROFILES_FILTER)
      .eq("cron_active", true);

    if (profilesError) {
      return NextResponse.json(
        { error: "Failed to load artists", details: profilesError.message },
        { status: 500 }
      );
    }

    let sent = 0;

    for (const profile of profiles ?? []) {
      const artistId = String(profile.id ?? "").trim();
      const ownerUserId =
        typeof profile.owner_user_id === "string"
          ? profile.owner_user_id.trim()
          : "";
      if (!artistId || !ownerUserId) continue;

      const { data: authData, error: authError } =
        await supabase.auth.admin.getUserById(ownerUserId);
      if (authError) {
        console.error("weekly-checkin: auth lookup failed", {
          artist_id: artistId,
          error: authError.message,
        });
        continue;
      }

      const email = authData.user.email?.trim().toLowerCase();
      if (!email) {
        console.error("weekly-checkin: missing email", { artist_id: artistId });
        continue;
      }

      let token: string;
      try {
        token = createCheckinToken(artistId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Token error";
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      const checkinUrl = `${appUrl}/checkin?artist_id=${encodeURIComponent(artistId)}&token=${encodeURIComponent(token)}`;
      const artistName = String(profile.artist_name ?? "").trim();
      const isManaged = profile.is_managed === true;

      if (isManaged) {
        const emailContent = generateManagedWeeklyCheckinEmail({
          artistName,
          checkinUrl,
        });

        const emailSend = await sendResendEmail({
          apiKey: resendKey,
          to: email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        if (!emailSend.ok) {
          console.error("weekly-checkin: Resend failed", {
            artist_id: artistId,
            email,
            status: emailSend.status,
            error: emailSend.error,
          });
          continue;
        }

        sent += 1;
        continue;
      }

      const recipient = await buildEmailRecipient(supabase, profile);
      if (!recipient) {
        console.error("weekly-checkin: could not build recipient", {
          artist_id: artistId,
        });
        continue;
      }

      const emailContent = checkinFridayEmail({
        artistId,
        artistName: recipient.artistName,
        checkinUrl,
      });

      const ok = await sendEmail({
        to: recipient.email,
        subject: emailContent.subject,
        html: emailContent.html,
        recipient,
        type: "checkin_friday",
      });

      if (!ok) {
        console.error("weekly-checkin: send failed", {
          artist_id: artistId,
          email,
        });
        continue;
      }

      sent += 1;
    }

    return NextResponse.json({ sent });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
