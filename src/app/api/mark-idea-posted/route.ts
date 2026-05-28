import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

  const artistId = (body as { artist_id?: unknown }).artist_id;
  const ideaHook = (body as { idea_hook?: unknown }).idea_hook;
  const instagramPostId = (body as { instagram_post_id?: unknown })
    .instagram_post_id;

  if (typeof artistId !== "string" || !artistId.trim()) {
    return NextResponse.json({ error: "Expected artist_id" }, { status: 400 });
  }
  if (typeof ideaHook !== "string" || !ideaHook.trim()) {
    return NextResponse.json({ error: "Expected idea_hook" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", artistId.trim())
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("id, ideas")
    .eq("artist_id", artistId.trim())
    .eq("is_research", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError) {
    return NextResponse.json(
      { error: "Failed to load plan", details: planError.message },
      { status: 500 }
    );
  }

  if (!plan) {
    return NextResponse.json({ error: "No plan found" }, { status: 404 });
  }

  const ideas = Array.isArray(plan.ideas) ? [...plan.ideas] : [];
  const idx = ideas.findIndex(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as { hook?: string }).hook === ideaHook.trim()
  );

  if (idx === -1) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const existing = ideas[idx] as Record<string, unknown>;
  ideas[idx] = {
    ...existing,
    posted: true,
    posted_at: new Date().toISOString(),
    instagram_post_id:
      typeof instagramPostId === "string" && instagramPostId.trim()
        ? instagramPostId.trim()
        : null,
  };

  const { error: updateError } = await supabase
    .from("weekly_plans")
    .update({ ideas })
    .eq("id", plan.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update plan", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
