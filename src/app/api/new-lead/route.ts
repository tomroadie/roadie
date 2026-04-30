import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { enqueueNewLead } from "@/lib/new-lead-pipeline";

function verifyWebhookSecret(headerValue: string | null, secret: string): boolean {
  if (!headerValue || !secret) return false;
  const a = Buffer.from(headerValue, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const provided = request.headers.get("x-webhook-secret");
  if (!verifyWebhookSecret(provided, webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Expected JSON object body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const email = o.email;
  const artist_name = o.artist_name;
  const instagram_input = o.instagram_url ?? o.instagram_handle ?? o.instagram;

  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Invalid or missing email" }, { status: 400 });
  }
  if (typeof artist_name !== "string" || !artist_name.trim()) {
    return NextResponse.json({ error: "Invalid or missing artist_name" }, { status: 400 });
  }
  if (typeof instagram_input !== "string" || !instagram_input.trim()) {
    return NextResponse.json({ error: "Invalid or missing instagram" }, { status: 400 });
  }

  try {
    await enqueueNewLead({
      email: email.trim(),
      artist_name: artist_name.trim(),
      instagram_input: instagram_input.trim(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to enqueue lead";
    const lower = msg.toLowerCase();
    const status =
      lower.includes("could not extract") || lower.includes("missing") ? 400 : 502;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ success: true });
}
