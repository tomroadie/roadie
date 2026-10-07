import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import type {
  Concept,
  ConceptContext,
  ConceptExecution,
  ContextKeyDate,
  ContextPost,
} from "@/lib/concepts/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Admin-only: load a saved generation (usually a draft from the weekly job)
 * in the same shape the preview page renders, evidence posts included.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("generation_id")?.trim() ?? "";
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid generation_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await userIsAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const [{ data: gen }, { data: rows }] = await Promise.all([
    admin
      .from("concept_generations")
      .select("id, artist_id, focus, focus_why, status, model, attempts, warnings, context_summary, created_at")
      .eq("id", id)
      .maybeSingle(),
    admin
      .from("concepts")
      .select("title, why, evidence_posts, executions, key_date, basis, about_news")
      .eq("generation_id", id)
      .order("position"),
  ]);
  if (!gen) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const s = (gen.context_summary ?? {}) as Record<string, unknown>;
  const snap = (s.snapshot ?? {}) as Record<string, unknown>;
  const posts = (Array.isArray(snap.posts) ? snap.posts : []) as ContextPost[];

  const context: ConceptContext = {
    artistId: String(gen.artist_id),
    artistName: String(snap.artist_name ?? ""),
    genre: null,
    sound: null,
    voice: null,
    handle: null,
    followers: null,
    postSource: (s.post_source as ConceptContext["postSource"]) ?? "none",
    auditCreatedAt: typeof s.audit_created_at === "string" ? s.audit_created_at : null,
    posts,
    postsLast28Days: Number(s.posts_last_28_days ?? 0),
    daysSinceLastPost: typeof s.days_since_last_post === "number" ? s.days_since_last_post : null,
    weeklyTarget: Number(s.target ?? s.weekly_target ?? 1),
    auditPattern: null,
    keyDates: (Array.isArray(snap.key_dates) ? snap.key_dates : []) as ContextKeyDate[],
    declined: [],
    postedIdeas: [],
    pinnedIdeas: [],
    coldStart: Boolean(s.cold_start),
  };

  const concepts: Concept[] = (rows ?? []).map((r) => ({
    title: String(r.title),
    why: String(r.why),
    evidence_posts: (r.evidence_posts ?? []) as number[],
    executions: (Array.isArray(r.executions) ? r.executions : []) as ConceptExecution[],
    key_date: r.key_date ? String(r.key_date) : null,
    basis: r.basis as Concept["basis"],
    about_news: r.about_news === true,
  }));

  return NextResponse.json({
    generation_id: gen.id,
    status: gen.status,
    kind: s.kind ?? "manual",
    created_at: gen.created_at,
    pool: { focus: gen.focus, focus_why: gen.focus_why ?? "", concepts },
    context,
    warnings: Array.isArray(gen.warnings) ? gen.warnings : [],
    attempts: Number(gen.attempts ?? 1),
    model: String(gen.model ?? ""),
    ms: 0,
  });
}
