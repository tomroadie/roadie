import { createClient } from "@/utils/supabase/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { parseFullAnalysisText } from "@/lib/parse-full-analysis";
import Link from "next/link";
import { canDo, normalizePlan } from "@/lib/plan-limits";
import { userIsAdmin } from "@/lib/is-admin";
import { RefreshAuditButton } from "./refresh-audit-button";
import { RecentPostsCards } from "./recent-posts-cards";
import { InsightsAuditEmptyState } from "./insights-audit-empty-state";
import {
  LiveStatsSection,
  type InstagramLiveInsightRow,
  type InstagramLiveMediaRow,
} from "./live-stats-section";

function sortRecentPostsRawByDateDesc(raw: string): string {
  const blocks = raw
    .split(/\n\s*---\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const scored = blocks.map((block, idx) => {
    const dateMatch = block.match(/^Date:\s*(.+)$/m);
    const dateStr = dateMatch?.[1]?.trim() ?? "";
    const d = dateStr ? new Date(dateStr) : null;
    const ts = d && Number.isFinite(d.getTime()) ? d.getTime() : null;
    return { block, idx, ts };
  });

  scored.sort((a, b) => {
    const at = a.ts;
    const bt = b.ts;
    if (at === null && bt === null) return a.idx - b.idx;
    if (at === null) return 1;
    if (bt === null) return -1;
    return bt - at; // newest first
  });

  return scored.map((x) => x.block).join("\n\n---\n\n");
}

function sumInstagramAccountMetric(insightsPayload: unknown, metric: string): number {
  if (!insightsPayload || typeof insightsPayload !== "object") return 0;
  const data = (insightsPayload as { data?: unknown }).data;
  if (!Array.isArray(data)) return 0;
  const row = data.find(
    (d: unknown) =>
      d &&
      typeof d === "object" &&
      (d as { name?: string }).name === metric
  ) as { values?: Array<{ value?: number }> } | undefined;
  if (!row?.values || !Array.isArray(row.values)) return 0;
  return row.values.reduce(
    (acc, v) => acc + (typeof v?.value === "number" ? v.value : 0),
    0
  );
}

function mediaMetric(
  item: Record<string, unknown>,
  metric: string
): number | null {
  const insights = item.insights;
  if (!insights || typeof insights !== "object") return null;
  const data = (insights as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  const row = data.find(
    (r: unknown) =>
      r &&
      typeof r === "object" &&
      (r as { name?: string }).name === metric
  ) as { values?: Array<{ value?: number }> } | undefined;
  const v = row?.values?.[0]?.value;
  return typeof v === "number" ? v : null;
}

function normalizeInstagramLivePayload(payload: {
  media?: unknown;
  insights?: unknown | null;
}): {
  insights: InstagramLiveInsightRow[];
  media: InstagramLiveMediaRow[];
} {
  const insightsPayload = payload.insights;

  const insights: InstagramLiveInsightRow[] =
    insightsPayload === null || insightsPayload === undefined
      ? []
      : [
          {
            key: "impressions",
            label: "Impressions",
            value: sumInstagramAccountMetric(insightsPayload, "impressions"),
          },
          {
            key: "reach",
            label: "Reach",
            value: sumInstagramAccountMetric(insightsPayload, "reach"),
          },
          {
            key: "profile_views",
            label: "Profile views",
            value: sumInstagramAccountMetric(
              insightsPayload,
              "profile_views"
            ),
          },
        ];

  const rawMedia = payload.media;
  const list =
    rawMedia &&
    typeof rawMedia === "object" &&
    Array.isArray((rawMedia as { data?: unknown }).data)
      ? ((rawMedia as { data: Record<string, unknown>[] }).data ?? [])
      : [];

  const sorted = [...list].sort((a, b) => {
    const ta =
      typeof a.timestamp === "string"
        ? new Date(a.timestamp).getTime()
        : 0;
    const tb =
      typeof b.timestamp === "string"
        ? new Date(b.timestamp).getTime()
        : 0;
    return tb - ta;
  });

  const media: InstagramLiveMediaRow[] = sorted.slice(0, 5).map((item) => {
    const id = typeof item.id === "string" ? item.id : "";
    const caption =
      typeof item.caption === "string" ? item.caption : null;
    const thumbnailUrl =
      (typeof item.thumbnail_url === "string" && item.thumbnail_url) ||
      (typeof item.media_url === "string" && item.media_url) ||
      null;
    const likes =
      typeof item.like_count === "number" ? item.like_count : 0;
    const comments =
      typeof item.comments_count === "number" ? item.comments_count : 0;

    const timestamp =
      typeof item.timestamp === "string" ? item.timestamp : "";

    return {
      id,
      caption,
      thumbnailUrl,
      likes,
      comments,
      impressions: mediaMetric(item, "impressions"),
      reach: mediaMetric(item, "reach"),
      timestamp,
    };
  });

  return { insights, media };
}

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

  const isAdmin = await userIsAdmin(supabase, user.id);

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
  const canRefreshAudit = canDo(plan, "canRefreshAudit", isAdmin);
  const canViewLiveSocialData = canDo(plan, "canViewLiveSocialData", isAdmin);

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
    .select(
      "artist_name, instagram_handle, instagram_user_id, instagram_access_token"
    )
    .eq("id", activeArtistId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile?.artist_name?.trim()) {
    redirect("/onboarding");
  }

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

  let liveSocialStats: {
    insights: InstagramLiveInsightRow[];
    media: InstagramLiveMediaRow[];
  } | null = null;

  const instagramUserId = profile?.instagram_user_id?.trim();
  const instagramAccessToken = profile?.instagram_access_token?.trim();

  if (instagramUserId && instagramAccessToken) {
    const headersList = await headers();
    const cookie = headersList.get("cookie") ?? "";
    const hdrHost = headersList.get("x-forwarded-host") ?? headersList.get("host");
    const hdrProto = headersList.get("x-forwarded-proto") ?? "http";
    const fallbackOrigin = hdrHost
      ? `${hdrProto}://${hdrHost}`
      : "http://localhost:3000";
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? fallbackOrigin;

    const statsRes = await fetch(
      `${baseUrl}/api/instagram-stats?artist_id=${activeArtistId}`,
      {
        headers: { cookie },
        cache: "no-store",
      }
    );

    const statsJson = statsRes.ok ? await statsRes.json() : null;
    if (
      statsJson &&
      typeof statsJson === "object" &&
      (statsJson as { error?: string }).error !== "not_connected"
    ) {
      liveSocialStats = normalizeInstagramLivePayload(
        statsJson as { media?: unknown; insights?: unknown }
      );
    }
  }

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
          {canRefreshAudit ? (
            <RefreshAuditButton artistId={activeArtistId} />
          ) : null}
          <LogoutButton />
        </div>
      </header>

      <AppNavWrapper />

      <div className="mt-10">
        {!audit ? (
          <div className="rounded-xl border border-dashed border-card-border bg-input p-10 text-center">
            <InsightsAuditEmptyState
              artistId={activeArtistId}
              instagramHandle={profile?.instagram_handle ?? null}
            />
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
              <RecentPostsCards raw={sortRecentPostsRawByDateDesc(audit.recent_posts_raw)} />
            ) : null}

            <section className="mt-10 rounded-xl border border-card-border bg-card p-7">
              <Link
                href="/dashboard"
                className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand px-5 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 sm:w-auto"
              >
                Generate my weekly plan using these insights →
              </Link>
              <p className="mt-3 text-sm text-muted">
                Your content plan uses this audit to shape every idea.
              </p>
            </section>
          </div>
        )}
      </div>

      <section className="mt-12">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
            Live social performance
          </h2>
          {!canViewLiveSocialData ? (
            <span className="inline-flex items-center rounded-full border border-card-border bg-input px-3 py-1 text-xs font-bold uppercase tracking-widest text-muted">
              Pro feature
            </span>
          ) : null}
        </div>

        <div
          className={[
            "mt-4 rounded-xl border border-card-border bg-card p-7",
            canViewLiveSocialData ? "" : "opacity-60 grayscale",
          ].join(" ")}
        >
          {canViewLiveSocialData && liveSocialStats ? (
            <LiveStatsSection
              insights={liveSocialStats.insights}
              media={liveSocialStats.media}
              followers={audit?.followers ?? 0}
              timestamps={liveSocialStats.media.map((m) => m.timestamp)}
            />
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted">
                Connect your Instagram, TikTok and Facebook to see real-time performance data,
                post analytics, and what&apos;s driving growth.
              </p>
              {!canViewLiveSocialData ? (
                <div className="mt-5">
                  <Link
                    href="/pricing"
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95"
                  >
                    Upgrade to Pro
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
