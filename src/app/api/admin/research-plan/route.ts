import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { userIsAdmin } from "@/lib/is-admin";
import type { ContentIdea } from "@/types/content-plan";

const ARTIST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let artistId = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId =
      typeof body.artist_id === "string" ? body.artist_id.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!artistId || !ARTIST_ID_UUID_RE.test(artistId)) {
    return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });
  }

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

  const webhookSecret = process.env.WEBHOOK_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!webhookSecret || !appUrl) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing WEBHOOK_SECRET or app URL" },
      { status: 500 }
    );
  }

  const genRes = await fetch(`${appUrl}/api/generate-plan`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-artist-id": artistId,
      "x-webhook-secret": webhookSecret,
    },
    body: JSON.stringify({ is_research: true }),
  });

  const data = (await genRes.json().catch(() => ({}))) as {
    ideas?: ContentIdea[];
    error?: string;
    details?: string;
  };

  if (!genRes.ok) {
    return NextResponse.json(
      {
        error: data.error ?? "Failed to generate research plan",
        details: data.details,
      },
      { status: genRes.status }
    );
  }

  return NextResponse.json({
    success: true,
    ideas: data.ideas ?? [],
  });
}
