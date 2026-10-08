import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { verifyEmailToken } from "@/lib/email-token";

// Links keep working for a year; the signature is what stops forgery.
const TOKEN_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function page(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Tempo</title>
  <style>
    body { font-family: sans-serif; background: #0A0A0F; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { text-align: center; max-width: 400px; padding: 40px; }
    h1 { color: #00FF87; font-size: 24px; }
    p { color: #999; line-height: 1.6; }
    a { color: #00FF87; }
    button { background: #00FF87; color: #0A0A0F; border: 0; border-radius: 8px; padding: 14px 24px; font-weight: 900; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
  </style>
</head>
<body><div class="card">${inner}</div></body>
</html>`;
}

/**
 * Opening the link only shows a button; the change happens on POST. Email
 * security scanners open links automatically, and a GET that changed
 * settings would unsubscribe people without them asking.
 */
function confirmHtml(token: string, type: "marketing" | "all"): string {
  const what =
    type === "marketing"
      ? "Stop marketing emails from Tempo? You'll still get emails about your account and your weekly board."
      : "Pause all emails from Tempo? You can turn them back on in your account settings.";
  return page(
    "Unsubscribe",
    `<h1>${type === "marketing" ? "Unsubscribe" : "Pause emails"}</h1>
<p>${what}</p>
<form method="post"><input type="hidden" name="token" value="${esc(token)}" />
<button type="submit">${type === "marketing" ? "Unsubscribe" : "Pause all emails"}</button></form>`
  );
}

function invalidHtml(): string {
  return page(
    "Link not valid",
    `<h1>That link doesn't work</h1>
<p>It may be old or incomplete. You can change which emails you get in your <a href="/settings">account settings</a>.</p>`
  );
}

function confirmationHtml(type: "marketing" | "all"): string {
  const body =
    type === "marketing"
      ? `You've been unsubscribed from marketing emails. You'll still receive emails about your account and your weekly board.`
      : `All emails paused. You can turn them back on in your <a href="/settings">account settings</a>.`;
  return page("Unsubscribed", `<h1>Done.</h1><p>${body}</p>`);
}

function html(body: string, status = 200): NextResponse {
  return new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("token");
  const token = verifyEmailToken(raw, TOKEN_MAX_AGE_MS);
  if (!token || !raw) return html(invalidHtml(), 400);
  return html(confirmHtml(raw, token.type));
}

export async function POST(request: Request) {
  let raw: string | null = null;
  try {
    const form = await request.formData();
    const value = form.get("token");
    raw = typeof value === "string" ? value : null;
  } catch {
    raw = null;
  }
  // One-click unsubscribe (RFC 8058) posts to the URL with the token in the query.
  raw ??= new URL(request.url).searchParams.get("token");

  const token = verifyEmailToken(raw, TOKEN_MAX_AGE_MS);
  if (!token) return html(invalidHtml(), 400);

  const artistId = token.artistId;
  const type = token.type;

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (type === "marketing") {
    const { error } = await supabase
      .from("profiles")
      .update({
        marketing_unsubscribed: true,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("id", artistId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update preferences", details: error.message },
        { status: 500 }
      );
    }
  } else {
    const { error } = await supabase
      .from("profiles")
      .update({ all_emails_paused: true })
      .eq("id", artistId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to update preferences", details: error.message },
        { status: 500 }
      );
    }
  }

  return html(confirmationHtml(type));
}
