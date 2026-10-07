import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { loadBoard } from "@/lib/concepts/store";
import { trackUsage } from "@/lib/track-usage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = ["pin", "bin", "posted", "let_go"] as const;
type Action = (typeof ACTIONS)[number];

/**
 * Board and shelf actions. The database function checks the artist owns the
 * concept, changes its status and refills the slot in one transaction.
 * Returns the fresh board so the client can redraw.
 */
export async function POST(request: Request) {
  let conceptId = "";
  let action = "";
  let reason: string | null = null;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    conceptId = typeof body.concept_id === "string" ? body.concept_id.trim() : "";
    action = typeof body.action === "string" ? body.action : "";
    reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!UUID_RE.test(conceptId) || !ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: updated, error } = await supabase.rpc("apply_concept_action", {
    p_concept_id: conceptId,
    p_action: action,
    p_reason: reason,
  });

  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "22023" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  const artistId = String((updated as { artist_id?: string })?.artist_id ?? "");
  const board = await loadBoard(supabase, artistId);

  await trackUsage({
    supabase,
    userId: user.id,
    artistId,
    eventType: `concept_${action}`,
    metadata: { concept_id: conceptId, ...(reason ? { reason } : {}) },
  });

  return NextResponse.json({ board });
}
