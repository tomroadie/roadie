import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";

const TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type UnsubscribeToken = {
  artistId?: string;
  type?: string;
  ts?: number;
};

function decodeToken(raw: string | null): UnsubscribeToken | null {
  if (!raw?.trim()) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as UnsubscribeToken;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function confirmationHtml(type: "marketing" | "all"): string {
  const body =
    type === "marketing"
      ? `You've been unsubscribed from marketing emails. You'll still receive emails about your account and content plans.`
      : `All emails paused. You can re-enable them in your <a href="/settings">account settings</a>.`;

  return `<!DOCTYPE html>
<html>
<head>
  <title>Unsubscribed — Tempo</title>
  <style>
    body {
      font-family: sans-serif;
      background: #0A0A0F;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      text-align: center;
      max-width: 400px;
      padding: 40px;
    }
    h1 { color: #00FF87; font-size: 24px; }
    p { color: #999; line-height: 1.6; }
    a { color: #00FF87; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Done.</h1>
    <p>${body}</p>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = decodeToken(searchParams.get("token"));

  if (
    !token?.artistId?.trim() ||
    (token.type !== "marketing" && token.type !== "all") ||
    typeof token.ts !== "number"
  ) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  if (Date.now() - token.ts > TOKEN_MAX_AGE_MS) {
    return NextResponse.json({ error: "Token expired" }, { status: 400 });
  }

  const artistId = token.artistId.trim();
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

  return new NextResponse(confirmationHtml(type), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
