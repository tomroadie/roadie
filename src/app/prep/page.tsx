import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { userIsAdmin } from "@/lib/is-admin";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";
import type { ContentIdea } from "@/types/content-plan";
import { PrepSection, type PrepArtist } from "./prep-section";

export default async function PrepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = await userIsAdmin(supabase, user.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, artist_name, genre, instagram_handle, created_at")
    .not("artist_name", "is", null)
    .neq("artist_name", "")
    .order("created_at", { ascending: false });

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const artistIds = (profiles ?? [])
    .map((profile) => String(profile.id ?? "").trim())
    .filter(Boolean);

  const { data: audits, error: auditsError } = await supabase
    .from("audits")
    .select("artist_id, followers, created_at")
    .not("artist_id", "is", null)
    .eq("is_research", false)
    .order("created_at", { ascending: false });

  if (auditsError) {
    throw new Error(auditsError.message);
  }

  const latestAuditByArtistId = new Map<string, { followers: number }>();
  for (const row of audits ?? []) {
    const artistId = typeof row.artist_id === "string" ? row.artist_id : "";
    if (!artistId || latestAuditByArtistId.has(artistId)) continue;
    latestAuditByArtistId.set(artistId, {
      followers: Number(row.followers ?? 0),
    });
  }

  const researchAuditByArtistId = new Map<
    string,
    { ai_pattern_analysis: string; ai_full_analysis: string; followers: number }
  >();
  const researchPlanByArtistId = new Map<
    string,
    { ideas: ContentIdea[] }
  >();

  if (artistIds.length > 0) {
    const { data: researchAudits, error: researchAuditsError } = await supabase
      .from("audits")
      .select("artist_id, ai_pattern_analysis, ai_full_analysis, followers, created_at")
      .in("artist_id", artistIds)
      .eq("is_research", true)
      .order("created_at", { ascending: false });

    if (researchAuditsError) {
      throw new Error(researchAuditsError.message);
    }

    for (const row of researchAudits ?? []) {
      const artistId = String(row.artist_id ?? "").trim();
      if (!artistId || researchAuditByArtistId.has(artistId)) continue;
      researchAuditByArtistId.set(artistId, {
        ai_pattern_analysis: String(row.ai_pattern_analysis ?? ""),
        ai_full_analysis: String(row.ai_full_analysis ?? ""),
        followers: Number(row.followers ?? 0),
      });
    }

    const { data: researchPlans, error: researchPlansError } = await supabase
      .from("weekly_plans")
      .select("artist_id, ideas, created_at")
      .in("artist_id", artistIds)
      .eq("is_research", true)
      .order("created_at", { ascending: false });

    if (researchPlansError) {
      throw new Error(researchPlansError.message);
    }

    for (const row of researchPlans ?? []) {
      const artistId = String(row.artist_id ?? "").trim();
      if (!artistId || researchPlanByArtistId.has(artistId)) continue;
      researchPlanByArtistId.set(artistId, {
        ideas: normalizeIdeasFromDb(row.ideas) ?? [],
      });
    }
  }

  const artists: PrepArtist[] = (profiles ?? []).map((profile) => {
    const id = String(profile.id ?? "");
    const latestAudit = latestAuditByArtistId.get(id);
    const hasAudit = !!latestAudit;

    return {
      id,
      artist_name: String(profile.artist_name ?? "").trim() || "Unnamed artist",
      genre: String(profile.genre ?? "").trim(),
      instagram_handle: (profile.instagram_handle ?? "").trim().replace(/^@/, ""),
      followers: hasAudit ? latestAudit.followers : null,
      has_audit: hasAudit,
      researchAudit: researchAuditByArtistId.get(id) ?? null,
      researchPlan: researchPlanByArtistId.get(id) ?? null,
    };
  });

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            CLIENT PREP
          </h1>
          <p className="mt-2 text-muted">
            Prepare for client calls using Tempo&apos;s analysis
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNavWrapper />

      <PrepSection artists={artists} />
    </div>
  );
}
