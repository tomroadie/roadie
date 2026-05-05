import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { userIsAdmin } from "@/lib/is-admin";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function sendResendEmail(args: {
  apiKey: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: "Roadie <hello@roadie.media>",
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

function parseIdeaFields(body: Record<string, unknown>): {
  idea_hook: string;
  idea_format: string;
  idea_caption: string;
  idea_why: string;
  idea_timing: string;
  notes: string;
} {
  const idea_hook = asTrimmedString(body.idea_hook || body.hook);
  const idea_format = asTrimmedString(body.idea_format || body.format);
  const idea_caption = asTrimmedString(body.idea_caption || body.caption);
  const idea_why = asTrimmedString(body.idea_why || body.why);
  const idea_timing = asTrimmedString(body.idea_timing || body.timing);
  const notes = asTrimmedString(body.notes);
  return { idea_hook, idea_format, idea_caption, idea_why, idea_timing, notes };
}

function parseFileUrls(body: Record<string, unknown>): string[] {
  const raw = body.file_urls;
  if (!Array.isArray(raw)) return [];
  const values = raw.map((v) => asTrimmedString(v)).filter((v) => !!v);
  return values
    .map((v) => {
      // Accept both legacy full URLs and new storage paths; always persist paths.
      if (/^https?:\/\//i.test(v)) {
        try {
          const u = new URL(v);
          const marker = "/content-reviews/";
          const idx = u.pathname.indexOf(marker);
          if (idx !== -1) {
            return decodeURIComponent(u.pathname.slice(idx + marker.length)).trim();
          }
        } catch {
          // fall through
        }
      }
      return v.replace(/^\/+/, "").trim();
    })
    .filter(Boolean);
}

export async function POST(request: Request) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing RESEND_API_KEY" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected JSON object body" }, { status: 400 });
  }

  const ideaBody = body as Record<string, unknown>;
  const { idea_hook, idea_format, idea_caption, idea_why, idea_timing, notes } =
    parseIdeaFields(ideaBody);
  const file_urls = parseFileUrls(ideaBody);

  if (!idea_hook || !idea_format || !idea_caption || !idea_why || !idea_timing) {
    return NextResponse.json(
      { error: "Missing required idea fields" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(supabase, user.id, cookieStore);

  if (!activeArtistId) {
    return NextResponse.json(
      { error: "No active artist. Complete onboarding first." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name")
    .eq("id", activeArtistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load artist", details: profileError.message },
      { status: 500 }
    );
  }

  const artistName = asTrimmedString(profile?.artist_name) || "Unknown artist";

  const { error: insertError } = await supabase.from("content_reviews").insert({
    owner_user_id: user.id,
    artist_id: activeArtistId,
    idea_hook,
    idea_format,
    idea_caption,
    idea_why,
    idea_timing,
    notes: notes || null,
    status: "pending",
    file_urls: file_urls.length ? file_urls : [],
  });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to create content review", details: insertError.message },
      { status: 500 }
    );
  }

  const emailLines: string[] = [
    "New content review request",
    "",
    `Artist: ${artistName}`,
    "",
    `Hook: ${idea_hook}`,
    "",
    `Format: ${idea_format}`,
    "",
    `Why: ${idea_why}`,
    "",
    `Timing: ${idea_timing}`,
    "",
    `Caption: ${idea_caption}`,
  ];

  if (notes) {
    emailLines.push("", `Notes: ${notes}`);
  }

  if (file_urls.length) {
    emailLines.push("", "Submitted files:", ...file_urls.map((u) => `- ${u}`));
  }

  emailLines.push("", "Review in admin: https://app.roadie.media/admin");

  const emailText = emailLines.join("\n");

  const emailSend = await sendResendEmail({
    apiKey: resendKey,
    to: "tom@roadie.media",
    subject: "New content review request",
    text: emailText,
  });

  if (!emailSend.ok) {
    console.error("Resend send failed", {
      artist_id: activeArtistId,
      status: emailSend.status,
      error: emailSend.error,
    });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing RESEND_API_KEY" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected JSON object body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const id = asTrimmedString(o.id);
  const feedback = asTrimmedString(o.feedback);

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  if (!feedback) {
    return NextResponse.json({ error: "Missing feedback" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await userIsAdmin(supabase, user.id);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let adminSupabase: ReturnType<typeof createServiceRoleClient>;
  try {
    adminSupabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: row, error: fetchError } = await adminSupabase
    .from("content_reviews")
    .select("id, artist_id, idea_hook, idea_caption")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to load review", details: fetchError.message },
      { status: 500 }
    );
  }
  if (!row?.id) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const artistId = asTrimmedString(row.artist_id);
  if (!artistId) {
    return NextResponse.json({ error: "Review missing artist_id" }, { status: 500 });
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("artist_name, owner_user_id")
    .eq("id", artistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load artist", details: profileError.message },
      { status: 500 }
    );
  }

  const ownerUserId = asTrimmedString(profile?.owner_user_id);
  const artistName = asTrimmedString(profile?.artist_name) || "Your artist profile";

  if (!ownerUserId) {
    return NextResponse.json({ error: "Artist missing owner_user_id" }, { status: 500 });
  }

  const { data: userRow, error: userError } =
    await adminSupabase.auth.admin.getUserById(ownerUserId);

  if (userError) {
    return NextResponse.json(
      { error: "Failed to load artist email", details: userError.message },
      { status: 500 }
    );
  }

  const toEmail = asTrimmedString(userRow.user?.email)?.toLowerCase();
  if (!toEmail) {
    return NextResponse.json({ error: "Artist email missing" }, { status: 500 });
  }

  const { error: updateError } = await adminSupabase
    .from("content_reviews")
    .update({
      feedback,
      status: "reviewed",
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update review", details: updateError.message },
      { status: 500 }
    );
  }

  const emailText = [
    "Your content review feedback is ready.",
    "",
    `Artist: ${artistName}`,
    "",
    `Idea: ${asTrimmedString(row.idea_hook)}`,
    "",
    "Feedback:",
    feedback,
    "",
    `Caption: ${asTrimmedString(row.idea_caption)}`,
  ].join("\n");

  const safeArtistName = asTrimmedString(artistName) || "Your artist profile";
  const safeHook = asTrimmedString(row.idea_hook) || "—";
  const safeCaption = asTrimmedString(row.idea_caption) || "—";
  const safeFeedback = feedback || "—";

  const emailHtml = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0a;color:#ffffff;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
    <div style="width:100%;background:#0a0a0a;padding:32px 16px;">
      <div style="max-width:640px;margin:0 auto;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;background:#0a0a0a;">
        <div style="padding:28px 24px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:24px;line-height:1.2;font-weight:800;color:#ffffff;">
            Your content review is ready
          </div>
          <div style="margin-top:10px;font-size:12px;letter-spacing:0.12em;font-weight:800;text-transform:uppercase;color:#00ff87;">
            ${safeArtistName}
          </div>
        </div>

        <div style="padding:24px;">
          <div style="font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:rgba(255,255,255,0.65);">
            THE IDEA
          </div>
          <div style="margin-top:10px;font-size:20px;line-height:1.35;font-weight:800;color:#ffffff;">
            ${safeHook}
          </div>

          <div style="margin-top:20px;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:rgba(255,255,255,0.65);">
            CAPTION
          </div>
          <div style="margin-top:10px;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.92);white-space:pre-wrap;line-height:1.5;">
            ${safeCaption}
          </div>

          <div style="margin-top:20px;font-size:12px;letter-spacing:0.14em;font-weight:800;text-transform:uppercase;color:rgba(255,255,255,0.65);">
            FEEDBACK
          </div>
          <div style="margin-top:10px;padding:14px 16px;border-left:4px solid #00ff87;border-radius:12px;background:rgba(255,255,255,0.02);color:#ffffff;white-space:pre-wrap;line-height:1.55;">
            ${safeFeedback}
          </div>
        </div>

        <div style="padding:18px 24px;border-top:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:13px;line-height:1.5;color:rgba(255,255,255,0.8);">
            View your dashboard → <a href="https://app.roadie.media/dashboard" style="color:#00ff87;text-decoration:underline;">https://app.roadie.media/dashboard</a>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  const emailSend = await sendResendEmail({
    apiKey: resendKey,
    to: toEmail,
    subject: "Your content review feedback",
    text: emailText,
    html: emailHtml,
  });

  if (!emailSend.ok) {
    console.error("Resend send failed", {
      review_id: id,
      status: emailSend.status,
      error: emailSend.error,
    });
  }

  return NextResponse.json({ success: true });
}

