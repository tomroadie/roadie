import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { parseFullAnalysisText } from "@/lib/parse-full-analysis";
import Link from "next/link";
import { canDo, normalizePlan } from "@/lib/plan-limits";
import { RefreshAuditButton } from "./refresh-audit-button";
import { RecentPostsCards } from "./recent-posts-cards";

function sectionAccent(title: string): { border: string; label: string } {
  const t = title.toLowerCase();
  if (t.includes("position")) return { border: "border-l-purple-400", label: "text-purple-200" };
  if (t.includes("content")) return { border: "border-l-sky-400", label: "text-sky-200" };
  if (t.includes("engagement")) return { border: "border-l-teal-400", label: "text-teal-200" };
  if (t.includes("core")) return { border: "border-l-amber-400", label: "text-amber-200" };
  if (t.includes("opportun")) return { border: "border-l-emerald-400", label: "text-emerald-200" };
  return { border: "border-l-zinc-600", label: "text-foreground" };
}

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: planRow, error: planError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("owner_user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (planError) {
    throw new Error(planError.message);
  }

  const plan = normalizePlan(planRow?.plan);
  const canRefreshAudit = canDo(plan, "canRefreshAudit");
  const canViewLiveSocialData = canDo(plan, "canViewLiveSocialData");

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  if (!activeArtistId) {
    redirect("/onboarding");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name, instagram_handle")
    .eq("id", activeArtistId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile?.artist_name?.trim()) {
    redirect("/onboarding");
  }

  console.log("[Insights] activeArtistId", activeArtistId);

  // Method 1: fetch by artist_id
  const { data: auditByArtistId, error: auditByArtistIdError } = await supabase
    .from("audits")
    .select("*")
    .eq("artist_id", activeArtistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // `.single()` throws for “no rows”; treat that as “no audit yet”.
  if (auditByArtistIdError && auditByArtistIdError.code !== "PGRST116") {
    throw new Error(auditByArtistIdError.message);
  }

  // Method 2 (fallback): fetch by instagram_handle
  const { data: auditByHandle, error: auditByHandleError } =
    auditByArtistId || !profile?.instagram_handle?.trim()
      ? { data: null, error: null }
      : await supabase
          .from("audits")
          .select("*")
          .eq("instagram_handle", profile.instagram_handle)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

  if (auditByHandleError && auditByHandleError.code !== "PGRST116") {
    throw new Error(auditByHandleError.message);
  }

  const audit = auditByArtistId ?? auditByHandle ?? null;
  console.log("[Insights] audit found", audit ? { id: audit.id, created_at: audit.created_at } : null);

  const emptyMessage =
    "Your Instagram audit will appear here once you've completed the lead form. Share your profile to get started.";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            Insights
          </h1>
          <p className="mt-2 text-muted">
            Instagram audit and positioning notes for your active artist.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canRefreshAudit ? <RefreshAuditButton /> : null}
          <LogoutButton />
        </div>
      </header>

      <AppNavWrapper />

      <div className="mt-10">
        {!audit ? (
          <div className="rounded-xl border border-dashed border-card-border bg-input p-10 text-center">
            <p className="text-sm leading-relaxed text-muted">
              {emptyMessage}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-xl border border-card-border bg-card p-7">
              <p className="text-xs font-bold uppercase tracking-widest text-brand">
                @{audit.instagram_handle.replace(/^@/, "")}
              </p>
              <h2 className="mt-2 text-xl font-black uppercase tracking-tight text-foreground">
                Artist snapshot
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-card-border bg-input p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand">
                    Followers
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                    {audit.followers.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-card-border bg-input p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand">
                    Following
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                    {audit.following.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-card-border bg-input p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand">
                    Posts
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                    {audit.post_count.toLocaleString()}
                  </p>
                </div>
              </div>
              {audit.bio?.trim() ? (
                <p className="mt-5 text-sm leading-relaxed text-muted-strong">
                  {audit.bio}
                </p>
              ) : null}
            </section>

            <section className="rounded-xl border border-card-border bg-card p-7 border-l-4 border-brand">
              <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
                Your content pattern
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
                {audit.ai_pattern_analysis}
              </p>
            </section>

            <section className="rounded-xl border border-card-border bg-card p-7">
              <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
                Full analysis
              </h2>
              <div className="mt-5 space-y-4">
                {parseFullAnalysisText(audit.ai_full_analysis).map((sec, i) => {
                  const a = sectionAccent(sec.title);
                  return (
                    <div
                      key={`${sec.title}-${i}`}
                      className={`rounded-xl border border-card-border bg-input p-6 ${a.border} border-l-4`}
                    >
                      <h3 className={`text-sm font-bold uppercase tracking-widest ${a.label}`}>
                        {sec.title}
                      </h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-strong">
                        {sec.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {audit.recent_posts_raw?.trim() ? (
              <RecentPostsCards raw={audit.recent_posts_raw} />
            ) : null}
          </div>
        )}
      </div>

      <section className="mt-12">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            Live social performance
          </h2>
          <span className="inline-flex items-center rounded-full border border-card-border bg-input px-3 py-1 text-xs font-bold uppercase tracking-widest text-muted">
            Pro feature
          </span>
        </div>

        <div
          className={[
            "mt-4 rounded-xl border border-card-border bg-card p-7",
            canViewLiveSocialData ? "" : "opacity-60 grayscale",
          ].join(" ")}
        >
          <p className="text-sm leading-relaxed text-muted">
            Connect your Instagram, TikTok and Facebook to see real-time performance data,
            post analytics, and what&apos;s driving growth.
          </p>
          <div className="mt-5">
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
