import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { generateEventId } from "@/lib/analytics";
import { capiCompleteRegistration } from "@/lib/meta-capi";

async function sendWelcomeEmail(args: {
  apiKey: string;
  to: string;
  onboardingUrl: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const bodyCopy =
    "Welcome to Tempo. You're one step away from your first AI content plan. Complete your profile to get started.";
  const footerCopy =
    "You're receiving this because you signed up at app.roadie.media";

  const text = [
    bodyCopy,
    "",
    args.onboardingUrl,
    "",
    footerCopy,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;background:#f6f6f6;padding:24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
    <tr><td style="padding:28px 24px;">
      <p style="margin:0 0 16px;font-size:16px;">${bodyCopy}</p>
      <p style="margin:0;">
        <a href="${args.onboardingUrl}" style="display:inline-block;background:#00FF87;color:#0A0A0F;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Complete your profile</a>
      </p>
      <p style="font-size:12px;color:#666;margin-top:40px;text-align:center;">${footerCopy}</p>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Tempo <hello@roadie.media>",
      to: [args.to],
      subject: "You're in — here's what happens next",
      text,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: errText || res.statusText };
  }

  return { ok: true };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let redirectPath = "/home";
  let registrationEventId: string | null = null;

  if (user?.id) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("artist_name")
      .eq("owner_user_id", user.id);

    const hasCompletedProfile = (profiles ?? []).some((p) =>
      Boolean(p.artist_name?.trim())
    );

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();

    const isNewUser = !existingProfile;

    if (!hasCompletedProfile) {
      if (isNewUser) {
        registrationEventId = generateEventId();
        redirectPath = `/onboarding?new=true&event_id=${encodeURIComponent(registrationEventId)}`;
      } else {
        redirectPath = "/onboarding";
      }
    }

    if (isNewUser && user.email) {
      const eventId = registrationEventId ?? generateEventId();
      try {
        await capiCompleteRegistration(user.email, eventId);
      } catch (e) {
        console.error("CAPI CompleteRegistration failed in auth callback", e);
      }

      const resendKey = process.env.RESEND_API_KEY;
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
        "https://app.roadie.media";
      const onboardingUrl = registrationEventId
        ? `${baseUrl}/onboarding?new=true&event_id=${encodeURIComponent(registrationEventId)}`
        : `${baseUrl}/onboarding`;

      if (resendKey) {
        const sent = await sendWelcomeEmail({
          apiKey: resendKey,
          to: user.email.trim().toLowerCase(),
          onboardingUrl,
        });
        if (!sent.ok) {
          console.error("Welcome email failed", {
            status: sent.status,
            error: sent.error,
            user_id: user.id,
          });
        }
      }
    }
  }

  return NextResponse.redirect(new URL(redirectPath, request.url));
}
