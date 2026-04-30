import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { parseFullAnalysisText } from "@/lib/parse-full-analysis";

function sectionAccent(title: string): { border: string; label: string } {
  const t = title.toLowerCase();
  if (t.includes("position")) return { border: "border-l-purple-500", label: "text-purple-700" };
  if (t.includes("content")) return { border: "border-l-blue-500", label: "text-blue-700" };
  if (t.includes("engagement")) return { border: "border-l-teal-500", label: "text-teal-700" };
  if (t.includes("core")) return { border: "border-l-amber-500", label: "text-amber-800" };
  if (t.includes("opportun")) return { border: "border-l-emerald-500", label: "text-emerald-700" };
  return { border: "border-l-zinc-300 dark:border-l-zinc-700", label: "text-slate-700 dark:text-slate-200" };
}

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
    .select("artist_name")
    .eq("id", activeArtistId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile?.artist_name?.trim()) {
    redirect("/onboarding");
  }

  const { data: audit, error: auditError } = await supabase
    .from("audits")
    .select(
      "instagram_handle, followers, following, post_count, bio, ai_pattern_analysis, ai_full_analysis, recent_posts_raw, created_at"
    )
    .eq("artist_id", activeArtistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auditError) {
    throw new Error(auditError.message);
  }

  const emptyMessage =
    "Your Instagram audit will appear here once you've completed the lead form. Share your profile to get started.";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-6 py-14">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Insights
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Instagram audit and positioning notes for your active artist.
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNavWrapper />

      {!audit ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-10 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-8">
          <section className="rounded-2xl border border-zinc-200 bg-purple-50/40 p-7 shadow-sm dark:border-zinc-800 dark:bg-purple-950/10">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              @{audit.instagram_handle.replace(/^@/, "")}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              Artist snapshot
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Followers
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {audit.followers.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Following
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {audit.following.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Posts
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                  {audit.post_count.toLocaleString()}
                </p>
              </div>
            </div>
            {audit.bio?.trim() ? (
              <p className="mt-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {audit.bio}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Your content pattern
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {audit.ai_pattern_analysis}
            </p>
          </section>

          <section className="rounded-2xl bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Full analysis
            </h2>
            <div className="mt-5 space-y-4">
              {parseFullAnalysisText(audit.ai_full_analysis).map((sec, i) => {
                const a = sectionAccent(sec.title);
                return (
                  <div
                    key={`${sec.title}-${i}`}
                    className={`rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950 ${a.border} border-l-4`}
                  >
                    <h3 className={`text-sm font-semibold ${a.label}`}>
                      {sec.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {sec.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {audit.recent_posts_raw?.trim() ? (
            <section className="rounded-2xl bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-950">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Recent posts analysed
              </h2>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {audit.recent_posts_raw}
              </pre>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
