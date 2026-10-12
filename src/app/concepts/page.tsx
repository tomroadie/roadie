import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { boardWeek } from "@/lib/board-week";
import { loadPostResults, type PostResult } from "@/lib/post-results";
import { CONCEPT_COLUMNS, toBoardConcept, type BoardConcept, type ConceptRow } from "@/lib/concepts/store";
import type { ExecutionFormat } from "@/lib/concepts/types";
import { getsWeeklyIdeas } from "@/lib/account-types";

const isMonitored = (t: string | null | undefined) => !getsWeeklyIdeas(t);
import { computeLearnings, formatName, formatRatio, loadThemes, statsFor, type Theme } from "@/lib/themes/load";
import {
  AddThemeForm,
  ArchiveThemeButton,
  RenameThemeForm,
  PostThemeReview,
  SuggestedThemeActions,
  type ReviewPost,
} from "./concepts-actions";

const FORMAT_LABEL: Record<ExecutionFormat, string> = {
  reel: "Reel",
  carousel: "Carousel",
  photo: "Photo",
  story: "Story",
  text: "Text post",
};

const REVIEW_DAYS = 30;
const REVIEW_SHOWN = 6;

type Idea = BoardConcept & { status: string; instagram_post_id: string | null };

function ratioClass(ratio: number | null): string {
  if (ratio === null) return "text-muted";
  if (ratio >= 1.05) return "text-brand";
  if (ratio <= 0.95) return "text-quiet";
  return "text-muted";
}

function ideaResult(idea: Idea, postsById: Map<string, PostResult>): { text: string; cls: string } {
  const post = idea.instagram_post_id ? postsById.get(idea.instagram_post_id) : undefined;
  const c = post?.comparison;
  if (c?.settled) return { text: formatRatio(c.ratio), cls: ratioClass(c.ratio) };
  if (c) return { text: "Settling", cls: "text-muted" };
  switch (idea.status) {
    case "board":
      return { text: "This week", cls: "text-muted" };
    case "pinned":
      return { text: "Pinned", cls: "text-muted" };
    case "posted":
      return { text: "Posted", cls: "text-muted" };
    default:
      return { text: "", cls: "text-muted" };
  }
}

/** Milliseconds timestamp for `days` ago. Server component: runs once per request. */
function daysAgo(days: number): number {
  return Date.now() - days * 86400000;
}

function dateLabel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
}

export default async function ConceptsPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const { theme: themeParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const activeArtistId = await getActiveArtistIdForUser(supabase, user.id, await cookies());
  if (!activeArtistId) redirect("/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("artist_name, board_enabled, week_start_day, account_type")
    .eq("id", activeArtistId)
    .maybeSingle();
  // Concepts sit on top of the board; artists on the old weekly plan don't have them.
  if (!profile || (!profile.board_enabled && !isMonitored(profile.account_type))) redirect("/home");

  const week = boardWeek(profile.week_start_day);
  const eightWeeksAgo = new Date(daysAgo(56)).toISOString().slice(0, 10);
  const [themes, results, ideasRes] = await Promise.all([
    loadThemes(supabase, activeArtistId),
    loadPostResults(supabase, activeArtistId, week.startsAt),
    supabase
      .from("concepts")
      .select(`${CONCEPT_COLUMNS}, status, instagram_post_id, posted_at`)
      .eq("artist_id", activeArtistId)
      .or(`status.in.(board,pinned),and(status.eq.posted,posted_at.gte.${eightWeeksAgo})`),
  ]);

  const posts = results?.posts ?? [];
  const postsById = new Map(posts.map((p) => [p.id, p]));
  const ideas: Idea[] = ((ideasRes.data ?? []) as (ConceptRow & { status: string; instagram_post_id: string | null })[]).map(
    (r) => ({ ...toBoardConcept(r), status: r.status, instagram_post_id: r.instagram_post_id })
  );

  const selected: Theme | null =
    themes.active.find((t) => t.id === themeParam) ?? themes.active[0] ?? null;
  const learnings = selected
    ? computeLearnings(
        posts.filter((p) => p.themeId === selected.id),
        []
      )
    : [];
  const selectedStats = selected ? statsFor(posts, selected.id) : null;
  const selectedIdeas = selected ? ideas.filter((i) => i.theme?.id === selected.id) : [];
  const selectedPosts = selected ? posts.filter((p) => p.themeId === selected.id) : [];
  const bestThemeId = (() => {
    let best: { id: string; r: number } | null = null;
    for (const t of themes.active) {
      const r = statsFor(posts, t.id).ratio;
      if (r !== null && r >= 1.1 && (!best || r > best.r)) best = { id: t.id, r };
    }
    return best?.id ?? null;
  })();

  const reviewSince = daysAgo(REVIEW_DAYS);
  const review: ReviewPost[] = posts
    .filter((p) => p.themeSource !== "artist" && p.postDate && Date.parse(p.postDate) >= reviewSince)
    .slice(0, REVIEW_SHOWN)
    .map((p) => ({
      id: p.id,
      thumbnailUrl: p.thumbnailUrl,
      caption: p.caption,
      dateLabel: dateLabel(p.postDate),
      themeId: p.themeId,
    }));

  // The format tip for the selected theme: which kind of post does best in it.
  const formatTip = (() => {
    if (!selected) return null;
    const settled = selectedPosts.filter((p) => !p.excluded && p.comparison?.settled);
    const byFormat = new Map<string, number[]>();
    for (const p of settled) {
      const f = formatName(p.mediaType);
      byFormat.set(f, [...(byFormat.get(f) ?? []), p.comparison!.ratio]);
    }
    let best: { f: string; avg: number } | null = null;
    for (const [f, rs] of byFormat) {
      if (rs.length < 2) continue;
      const avg = rs.reduce((a, b) => a + b, 0) / rs.length;
      if (avg >= 1.2 && (!best || avg > best.avg)) best = { f, avg };
    }
    return best ? `${best.f}s are doing best in this concept so far.` : null;
  })();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-8">
      <AppNavWrapper />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Concepts</h1>
          <p className="max-w-2xl text-muted">
            The themes your posts live in. Tempo learns which ones work for you and shifts your weeks towards them.
          </p>
        </div>
        <AddThemeForm artistId={activeArtistId} />
      </div>

      {themes.active.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-card-border bg-card p-6 text-muted">
          Your concepts are being worked out from your posts. They&rsquo;ll show up here soon, or add your own above.
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap items-start gap-6">
          <nav aria-label="Your concepts" className="flex min-w-0 flex-[1_1_260px] flex-col gap-2">
            {themes.active.map((t) => {
              const st = statsFor(posts, t.id);
              const ideaCount = ideas.filter((i) => i.theme?.id === t.id).length;
              const isSel = selected?.id === t.id;
              return (
                <Link
                  key={t.id}
                  href={`/concepts?theme=${t.id}`}
                  aria-current={isSel ? "page" : undefined}
                  className={`flex min-h-16 items-center justify-between gap-3 rounded-xl px-4 py-3 ${
                    isSel ? "border-2 border-ink bg-card" : "border border-card-border hover:bg-card"
                  }`}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold text-foreground">{t.name}</span>
                    <span className="text-sm text-muted">
                      {ideaCount} {ideaCount === 1 ? "idea" : "ideas"} · {st.posts} {st.posts === 1 ? "post" : "posts"}
                    </span>
                  </span>
                  {st.ratio !== null ? (
                    <span className={`shrink-0 text-sm font-semibold ${ratioClass(st.ratio)}`}>
                      {formatRatio(st.ratio)}
                    </span>
                  ) : null}
                </Link>
              );
            })}

            {themes.suggested.map((t) => (
              <div
                key={t.id}
                className="mt-2 flex flex-col gap-2 rounded-xl border border-dashed border-muted/50 bg-card p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-brand">Suggested by Tempo</p>
                <p className="font-semibold text-foreground">{t.name}</p>
                {t.description ? <p className="text-sm text-muted">{t.description}</p> : null}
                <SuggestedThemeActions themeId={t.id} />
              </div>
            ))}
          </nav>

          {selected && selectedStats ? (
            <section
              aria-labelledby="theme-heading"
              className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 rounded-2xl border border-card-border bg-card p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex max-w-xl flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 id="theme-heading" className="text-2xl font-bold text-foreground sm:text-3xl">
                      {selected.name}
                    </h2>
                    {bestThemeId === selected.id ? (
                      <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
                        Your best
                      </span>
                    ) : null}
                  </div>
                  {selected.description ? <p className="text-muted">{selected.description}</p> : null}
                </div>
                <dl className="flex flex-wrap gap-6">
                  <div className="flex flex-col">
                    <dt className="order-2 text-sm text-muted">vs your usual</dt>
                    <dd className={`font-display text-2xl font-bold ${ratioClass(selectedStats.ratio)}`}>
                      {selectedStats.ratio !== null ? formatRatio(selectedStats.ratio) : "—"}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="order-2 text-sm text-muted">posts lately</dt>
                    <dd className="font-display text-2xl font-bold text-foreground">{selectedStats.posts}</dd>
                  </div>
                </dl>
              </div>

              {learnings[0] || formatTip || selectedStats.ratio === null ? (
                <div className="flex gap-3 rounded-xl bg-background px-4 py-3 text-sm leading-relaxed text-foreground">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                  </svg>
                  <p>
                    {selectedStats.ratio === null
                      ? "Not enough settled posts here yet to say what's working. A few more and it'll show."
                      : formatTip ?? learnings[0]?.body}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">Angles</h3>
                {selectedIdeas.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {selectedIdeas.map((idea) => {
                      const res = ideaResult(idea, postsById);
                      const formats = [...new Set(idea.executions.map((e) => e.format))];
                      return (
                        <li key={idea.id} className="rounded-xl border border-card-border p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="min-w-0 flex-[1_1_240px] font-semibold text-foreground">{idea.title}</span>
                            <span className="flex flex-wrap gap-1.5">
                              {formats.map((f) => (
                                <span key={f} className="rounded-full bg-input px-2.5 py-0.5 text-xs font-medium text-muted-strong">
                                  {FORMAT_LABEL[f] ?? f}
                                </span>
                              ))}
                            </span>
                            {res.text ? (
                              <span className={`min-w-20 text-sm font-semibold ${res.cls}`}>{res.text}</span>
                            ) : null}
                          </div>
                          <details className="group mt-2">
                            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:border-muted">
                              <span className="group-open:hidden">Inspire me</span>
                              <span className="hidden group-open:inline">Hide</span>
                            </summary>
                            <p className="mt-3 text-sm leading-relaxed text-muted-strong">{idea.why}</p>
                            <ul className="mt-3 space-y-2">
                              {idea.executions.map((e, i) => (
                                <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
                                  <span className="mt-0.5 shrink-0 self-start rounded bg-input px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                                    {FORMAT_LABEL[e.format] ?? e.format}
                                  </span>
                                  <span>{e.idea}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="rounded-xl border border-dashed border-card-border p-4 text-sm text-muted">
                    No ideas under this concept right now. New ones arrive with your weekly update.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-base font-semibold text-foreground">Your posts in this concept</h3>
                {selectedPosts.length > 0 ? (
                  <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {selectedPosts.slice(0, 8).map((p) => {
                      const c = p.comparison;
                      const text = p.excluded ? "Ad or collab" : c?.settled ? formatRatio(c.ratio) : c ? "Settling" : "";
                      const tile = (
                        <div className="relative flex aspect-[4/5] items-end overflow-hidden rounded-lg bg-input p-2">
                          {p.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          ) : null}
                          <span className="relative rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground">
                            {formatName(p.mediaType)}
                          </span>
                        </div>
                      );
                      return (
                        <li key={p.id} className="flex flex-col gap-1">
                          {p.permalink ? (
                            <a href={p.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open on Instagram${p.line ? `. ${p.line}` : ""}`}>
                              {tile}
                            </a>
                          ) : (
                            tile
                          )}
                          {text ? (
                            <span className={`text-sm font-semibold ${c?.settled ? ratioClass(c.ratio) : "text-muted"}`}>{text}</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Nothing sorted into this concept yet.</p>
                )}
              </div>

              <div className="flex flex-wrap items-start gap-3 border-t border-card-border pt-4">
                <RenameThemeForm
                  key={selected.id}
                  themeId={selected.id}
                  name={selected.name}
                  description={selected.description}
                />
                <ArchiveThemeButton themeId={selected.id} name={selected.name} />
              </div>
            </section>
          ) : null}
        </div>
      )}

      {review.length > 0 && themes.active.length > 0 ? (
        <section
          aria-labelledby="review-heading"
          className="mt-8 flex flex-col gap-4 rounded-2xl border border-card-border bg-card p-6"
        >
          <div className="flex flex-col gap-1">
            <h2 id="review-heading" className="text-xl font-bold text-foreground">
              {review.length} recent {review.length === 1 ? "post needs" : "posts need"} a concept
            </h2>
            <p className="text-sm text-muted">Tempo had a guess. Confirm so your learnings stay accurate.</p>
          </div>
          <PostThemeReview posts={review} themes={themes.active.map((t) => ({ id: t.id, name: t.name }))} />
        </section>
      ) : null}
    </div>
  );
}
