import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { parseFullAnalysisText } from "@/lib/parse-full-analysis";

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
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
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
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Followers</dt>
                <dd className="font-medium text-foreground">
                  {audit.followers.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Following</dt>
                <dd className="font-medium text-foreground">
                  {audit.following.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Posts</dt>
                <dd className="font-medium text-foreground">
                  {audit.post_count.toLocaleString()}
                </dd>
              </div>
            </dl>
            {audit.bio?.trim() ? (
              <p className="mt-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {audit.bio}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Your content pattern
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {audit.ai_pattern_analysis}
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Full analysis
            </h2>
            <div className="mt-4 space-y-6">
              {parseFullAnalysisText(audit.ai_full_analysis).map((sec, i) => (
                <div key={`${sec.title}-${i}`}>
                  <h3 className="text-sm font-semibold text-foreground">
                    {sec.title}
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {audit.recent_posts_raw?.trim() ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Recent posts analysed
              </h2>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {audit.recent_posts_raw}
              </pre>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
