import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import {
  editConcept,
  editFocus,
  loadDraftView,
  moveConcept,
  regenerateDraft,
  replaceConcept,
} from "@/lib/concepts/edit";

/** Replacing or redoing calls the model, which can take a minute. */
export const maxDuration = 120;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await userIsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Admin-only: load a saved generation (usually a draft from the weekly job)
 * in the same shape the review page renders, evidence posts included.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("generation_id")?.trim() ?? "";
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid generation_id" }, { status: 400 });
  }
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await loadDraftView(createServiceRoleClient(), id));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: message === "Draft not found" ? 404 : 500 });
  }
}

/**
 * Admin-only: change a draft before publishing. Body:
 *   { generation_id, action: "focus", focus }
 *   { generation_id, action: "edit", concept_id, title, why, executions }
 *   { generation_id, action: "move", concept_id, direction: "up" | "down" }
 *   { generation_id, action: "replace", concept_id, note? }
 *   { generation_id, action: "regenerate", note? }
 *   { generation_id, action: "hold", held }   stop or allow publishing itself
 * Returns the updated draft.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const generationId = typeof body.generation_id === "string" ? body.generation_id.trim() : "";
  const conceptId = typeof body.concept_id === "string" ? body.concept_id.trim() : "";
  const note = typeof body.note === "string" ? body.note : undefined;
  if (!UUID_RE.test(generationId)) {
    return NextResponse.json({ error: "Invalid generation_id" }, { status: 400 });
  }
  const needsConcept = ["edit", "move", "replace"].includes(String(body.action));
  if (needsConcept && !UUID_RE.test(conceptId)) {
    return NextResponse.json({ error: "Invalid concept_id" }, { status: 400 });
  }

  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = createServiceRoleClient();
  try {
    switch (body.action) {
      case "focus":
        await editFocus(admin, generationId, body.focus);
        break;
      case "edit":
        await editConcept(admin, generationId, conceptId, {
          title: body.title,
          why: body.why,
          executions: body.executions,
        });
        break;
      case "move":
        if (body.direction !== "up" && body.direction !== "down") {
          return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
        }
        await moveConcept(admin, generationId, conceptId, body.direction);
        break;
      case "replace":
        await replaceConcept(admin, generationId, conceptId, note);
        break;
      case "regenerate":
        await regenerateDraft(admin, generationId, note);
        break;
      case "hold": {
        const { error } = await admin
          .from("concept_generations")
          .update({ held: body.held === true })
          .eq("id", generationId)
          .eq("status", "draft");
        if (error) throw new Error(error.message);
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json(await loadDraftView(admin, generationId));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("drafts action failed", { generationId, action: body.action, message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
