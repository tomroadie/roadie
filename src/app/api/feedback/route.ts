import { Resend } from "resend";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { getPlanForGating } from "@/lib/plan-limits";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message =
    typeof (body as { message?: unknown })?.message === "string"
      ? (body as { message: string }).message.trim()
      : "";

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (message.length > 1000) {
    return NextResponse.json(
      { error: "Message must be 1000 characters or fewer" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  let artistName = "Unknown artist";
  let plan = "free";

  if (activeArtistId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("artist_name, plan, plan_override")
      .eq("id", activeArtistId)
      .maybeSingle();

    if (profile?.artist_name?.trim()) {
      artistName = profile.artist_name.trim();
    }
    plan = getPlanForGating(profile ?? {});
  }

  const email = user.email?.trim() ?? "unknown@email.com";

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing RESEND_API_KEY" },
      { status: 500 }
    );
  }

  try {
    await resend.emails.send({
      from: "Tempo Feedback <hello@roadie.media>",
      to: "tom@roadie.media",
      subject: `Tempo feedback — ${artistName}`,
      text: `From: ${email} (${artistName}, ${plan})\n\n${message}`,
    });
  } catch (e) {
    console.error("feedback send failed:", e);
    return NextResponse.json(
      { error: "Failed to send feedback" },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
