import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getActiveArtistIdForUser } from "@/lib/active-artist";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseIdeaFields(body: Record<string, unknown>): {
  idea_hook: string;
  idea_format: string;
  idea_caption: string;
  idea_why: string;
  idea_timing: string;
  refined_caption: string | null;
} {
  const idea_hook = asTrimmedString(body.idea_hook || body.hook);
  const idea_format = asTrimmedString(body.idea_format || body.format);
  const idea_caption = asTrimmedString(body.idea_caption || body.caption);
  const idea_why = asTrimmedString(body.idea_why || body.why);
  const idea_timing = asTrimmedString(body.idea_timing || body.timing);
  const refinedRaw =
    body.refined_caption !== undefined ? body.refined_caption : body.refinedCaption;
  const refined_caption = asTrimmedString(refinedRaw) || null;
  return {
    idea_hook,
    idea_format,
    idea_caption,
    idea_why,
    idea_timing,
    refined_caption,
  };
}

export async function POST(request: Request) {
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
  const { idea_hook, idea_format, idea_caption, idea_why, idea_timing, refined_caption } =
    parseIdeaFields(ideaBody);

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

  const { data, error: insertError } = await supabase
    .from("saved_ideas")
    .insert({
      owner_user_id: user.id,
      artist_id: activeArtistId,
      idea_hook,
      idea_format,
      idea_caption,
      idea_why,
      idea_timing,
      refined_caption,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save idea", details: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, id: asTrimmedString(data?.id) });
}

export async function GET() {
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

  const { data, error } = await supabase
    .from("saved_ideas")
    .select("*")
    .eq("artist_id", activeArtistId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load saved ideas", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ideas: data ?? [] });
}

