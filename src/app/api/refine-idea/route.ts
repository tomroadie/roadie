import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { NextResponse } from "next/server";

function optionalBodyString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function POST(request: Request) {
  let hook = "";
  let caption = "";
  let instruction = "";

  try {
    const body = (await request.json()) as Record<string, unknown>;
    hook = optionalBodyString(body.hook);
    caption = optionalBodyString(body.caption);
    instruction = optionalBodyString(body.instruction);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!hook || !caption || !instruction) {
    return NextResponse.json(
      { error: "Expected hook, caption, and instruction" },
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
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  if (!activeArtistId) {
    return NextResponse.json(
      { error: "No active artist. Complete onboarding first." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name, voice_description, genre")
    .eq("id", activeArtistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load profile", details: profileError.message },
      { status: 500 }
    );
  }

  const artistName = profile?.artist_name?.trim();
  if (!artistName) {
    return NextResponse.json(
      { error: "Artist profile is missing a name" },
      { status: 400 }
    );
  }

  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .select("ai_pattern_analysis, created_at")
    .eq("artist_id", activeArtistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auditError) {
    return NextResponse.json(
      { error: "Failed to load audit", details: auditError.message },
      { status: 500 }
    );
  }

  const voiceDescription = profile?.voice_description?.trim() || "not provided";
  const genre = profile?.genre?.trim() || "unspecified";
  const aiPatternAnalysis = String(audit?.ai_pattern_analysis ?? "").trim() || "—";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing ANTHROPIC_API_KEY" },
      { status: 500 }
    );
  }

  const prompt = `You are rewriting a social media caption for ${artistName}.

Their voice: ${voiceDescription}
Genre: ${genre}
Content pattern insight: ${aiPatternAnalysis}

Original caption:
${caption}

The artist wants you to: ${instruction}

Rewrite the caption only. Keep it authentic to their voice. Return just the new caption text, nothing else.`;

  const anthropic = new Anthropic({ apiKey });
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json(
      { error: "Unexpected model response shape" },
      { status: 502 }
    );
  }

  const refinedCaption = textBlock.text.trim();
  if (!refinedCaption) {
    return NextResponse.json(
      { error: "Model returned empty caption" },
      { status: 502 }
    );
  }

  return NextResponse.json({ refinedCaption });
}

