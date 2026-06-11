import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import type { ContentIdea } from "@/types/content-plan";

function isContentIdea(value: unknown): value is ContentIdea {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.format === "string" &&
    typeof o.hook === "string" &&
    typeof o.caption === "string" &&
    typeof o.why === "string" &&
    typeof o.timing === "string"
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function formatWeekStartLabel(weekStart: string): string {
  const d = new Date(`${weekStart}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return weekStart;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function appBaseUrl(request: Request): string {
  const hdrHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hdrProto = request.headers.get("x-forwarded-proto") ?? "http";
  const fallbackOrigin = hdrHost
    ? `${hdrProto}://${hdrHost}`
    : "http://localhost:3000";
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? fallbackOrigin;
}

function generatePlanReadyEmail(args: {
  weekStart: string;
  adminNote: string;
  dashboardUrl: string;
}): { subject: string; text: string; html: string } {
  const weekLabel = formatWeekStartLabel(args.weekStart);
  const subject = "Your weekly plan is ready";
  const noteBlock = args.adminNote.trim();

  const text = [
    `Your plan for the week of ${weekLabel} is ready.`,
    noteBlock ? `\nNote from your Tempo team:\n${noteBlock}\n` : "",
    `View your plan: ${args.dashboardUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const noteHtml = noteBlock
    ? `<div style="margin:20px 0 0 0;padding:16px 18px;background:rgba(0,255,135,0.08);border:1px solid rgba(0,255,135,0.25);border-radius:12px;">
         <div style="color:#00FF87;font-size:12px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 8px 0;">
           Note from your Tempo team
         </div>
         <div style="color:#E4E4E7;font-size:14px;line-height:1.7;margin:0;">
           ${nl2br(noteBlock)}
         </div>
       </div>`
    : "";

  const html = `
  <!doctype html>
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(subject)}</title>
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
                  <div style="color:#ffffff;font-weight:900;font-size:24px;line-height:1.25;margin:0 0 10px 0;">
                    Your weekly plan is ready
                  </div>
                  <div style="color:#A1A1AA;font-size:14px;line-height:1.7;margin:0;">
                    Your plan for the week of ${escapeHtml(weekLabel)} is ready.
                  </div>
                  ${noteHtml}
                </td>
              </tr>
              <tr>
                <td style="background:#111111;padding:0 32px 30px 32px;text-align:left;">
                  <a href="${escapeHtml(args.dashboardUrl)}"
                     style="display:block;background:#00FF87;color:#0A0A0F;text-decoration:none;font-weight:900;font-size:14px;padding:16px 18px;border-radius:12px;text-align:center;">
                    View your plan &rarr;
                  </a>
                </td>
              </tr>
              <tr>
                <td style="background:#0A0A0F;padding:18px 32px 28px 32px;text-align:left;">
                  <div style="color:#71717A;font-size:12px;line-height:1.6;margin:0;">
                    You're receiving this because you use Tempo at tempo.roadie.media
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

  return { subject, text, html };
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

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userIsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const planId = typeof body.plan_id === "string" ? body.plan_id.trim() : "";
  if (!planId) {
    return NextResponse.json({ error: "Missing plan_id" }, { status: 400 });
  }

  const adminNote =
    typeof body.admin_note === "string" ? body.admin_note.trim() : "";

  let adminSupabase: ReturnType<typeof createServiceRoleClient>;
  try {
    adminSupabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const rawIdeas = body.ideas;
  if (!Array.isArray(rawIdeas)) {
    const updatePayload: Record<string, unknown> = {
      admin_note: adminNote || null,
      status: "pending_review",
    };

    if (body.concepts !== undefined) {
      updatePayload.concepts = body.concepts;
    }

    const { error: draftError } = await adminSupabase
      .from("weekly_plans")
      .update(updatePayload)
      .eq("id", planId)
      .eq("status", "pending_review");

    if (draftError) {
      return NextResponse.json(
        { error: "Failed to save draft", details: draftError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  }

  const ideas = rawIdeas.filter(isContentIdea);
  if (ideas.length === 0) {
    return NextResponse.json({ error: "Invalid ideas array" }, { status: 400 });
  }

  const { data: planRow, error: planFetchError } = await adminSupabase
    .from("weekly_plans")
    .select("id, artist_id, week_start")
    .eq("id", planId)
    .maybeSingle();

  if (planFetchError) {
    return NextResponse.json(
      { error: "Failed to load plan", details: planFetchError.message },
      { status: 500 }
    );
  }

  if (!planRow?.artist_id) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const publishedAt = new Date().toISOString();

  const { error: updateError } = await adminSupabase
    .from("weekly_plans")
    .update({
      ideas,
      admin_note: adminNote || null,
      status: "published",
      published_at: publishedAt,
    })
    .eq("id", planId)
    .eq("status", "pending_review");

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to publish plan", details: updateError.message },
      { status: 500 }
    );
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("owner_user_id, artist_name")
    .eq("id", planRow.artist_id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile for plan publish email", {
      plan_id: planId,
      error: profileError.message,
    });
    return NextResponse.json({ success: true });
  }

  const ownerUserId =
    typeof profile?.owner_user_id === "string" ? profile.owner_user_id.trim() : "";
  if (!ownerUserId) {
    console.error("Missing owner_user_id for plan publish email", {
      plan_id: planId,
      artist_id: planRow.artist_id,
    });
    return NextResponse.json({ success: true });
  }

  const { data: authData, error: authError } =
    await adminSupabase.auth.admin.getUserById(ownerUserId);

  if (authError) {
    console.error("Failed to load artist email for plan publish", {
      plan_id: planId,
      owner_user_id: ownerUserId,
      error: authError.message,
    });
    return NextResponse.json({ success: true });
  }

  const artistEmail = authData.user.email?.trim().toLowerCase();
  if (!artistEmail) {
    console.error("Artist email missing for plan publish", {
      plan_id: planId,
      owner_user_id: ownerUserId,
    });
    return NextResponse.json({ success: true });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("Missing RESEND_API_KEY for plan publish email", {
      plan_id: planId,
    });
    return NextResponse.json({ success: true });
  }

  const weekStart = String(planRow.week_start ?? "");
  const dashboardUrl = `${appBaseUrl(request)}/dashboard`;
  const email = generatePlanReadyEmail({
    weekStart,
    adminNote,
    dashboardUrl,
  });

  const emailSend = await sendResendEmail({
    apiKey: resendKey,
    to: artistEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  if (!emailSend.ok) {
    console.error("Resend send failed for plan publish", {
      plan_id: planId,
      artist_email: artistEmail,
      status: emailSend.status,
      error: emailSend.error,
    });
  }

  return NextResponse.json({ success: true });
}
