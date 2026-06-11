import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getMondayDateString } from "@/lib/week";

async function sendResendEmail(args: {
  apiKey: string;
  to: string;
  subject: string;
  text: string;
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
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, error: text || res.statusText };
  }

  return { ok: true };
}

export async function POST(request: Request) {
  let artistId = "";
  let artistNote = "";

  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = typeof body.artist_id === "string" ? body.artist_id.trim() : "";
    artistNote =
      typeof body.artist_note === "string" ? body.artist_note.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!artistId) {
    return NextResponse.json({ error: "Expected artist_id" }, { status: 400 });
  }

  if (!artistNote) {
    return NextResponse.json(
      { error: "Please describe what you would like changed." },
      { status: 400 }
    );
  }

  if (artistNote.length > 500) {
    return NextResponse.json(
      { error: "Note must be 500 characters or fewer." },
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

  const { data: artist, error: artistError } = await supabase
    .from("artists")
    .select("id")
    .eq("id", artistId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (artistError) {
    return NextResponse.json(
      { error: "Failed to verify artist", details: artistError.message },
      { status: 500 }
    );
  }

  if (!artist?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const weekStart = getMondayDateString();

  const { data: weeklyPlan, error: planError } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("artist_id", artistId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (planError) {
    return NextResponse.json(
      { error: "Failed to load weekly plan", details: planError.message },
      { status: 500 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name")
    .eq("id", artistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load profile", details: profileError.message },
      { status: 500 }
    );
  }

  const artistName = String(profile?.artist_name ?? "").trim() || "Unknown artist";

  const { error: insertError } = await supabase.from("plan_revision_requests").insert({
    artist_id: artistId,
    week_start: weekStart,
    weekly_plan_id: weeklyPlan?.id ?? null,
    artist_note: artistNote,
    status: "pending",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "You already have a pending revision request this week." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to submit revision request", details: insertError.message },
      { status: 500 }
    );
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const emailSend = await sendResendEmail({
      apiKey: resendKey,
      to: "tom@roadie.media",
      subject: `Revision request — ${artistName}`,
      text: [
        `Artist: ${artistName}`,
        `Week: ${weekStart}`,
        `Note: ${artistNote}`,
        "Review at: https://tempo.roadie.media/admin",
      ].join("\n"),
    });

    if (!emailSend.ok) {
      console.error("Resend send failed for revision request", {
        artist_id: artistId,
        status: emailSend.status,
        error: emailSend.error,
      });
    }
  }

  return NextResponse.json({ success: true });
}
