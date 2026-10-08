import { NextResponse } from "next/server";
import { IG_GRAPH_BASE } from "@/lib/instagram-graph";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getMondayDateString } from "@/lib/week";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";
import { linkPostsToConcepts } from "@/lib/concepts/link-posts";
import { sendPostResultEmail } from "@/lib/post-result-email";


type ProfileRow = {
  id: string;
  instagram_user_id: string | null;
  instagram_access_token: string | null;
};

type MediaItem = {
  id?: string;
  caption?: string;
  media_type?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
};

type GraphAccountResponse = {
  followers_count?: number;
  media_count?: number;
  error?: { message?: string };
};

/** Cover image: videos have a separate thumbnail, everything else uses the media itself. */
function coverImage(post: MediaItem): string | null {
  return post.thumbnail_url ?? (post.media_type?.toUpperCase() === "VIDEO" ? null : post.media_url) ?? null;
}

/** Runs fn over items with at most `limit` in flight. */
async function inBatches<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn));
  }
}

type GraphMediaResponse = {
  data?: MediaItem[];
  error?: { message?: string };
};

function mapPostType(
  mediaType: string | undefined
): "reel" | "carousel" | "image" | null {
  switch (mediaType?.toUpperCase()) {
    case "VIDEO":
      return "reel";
    case "CAROUSEL_ALBUM":
      return "carousel";
    case "IMAGE":
      return "image";
    default:
      return null;
  }
}

// Only fetch Insights for posts still within this window — matches the
// weekly recap's "final metrics" horizon (see SPEC-performance-recap.md §4).
const INSIGHTS_MAX_AGE_DAYS = 8;

function daysSinceIso(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

// Metric availability varies by media type and drifts over Graph API
// versions — an unsupported metric name fails the whole insights call, so
// we ask for the fields we actually map to columns and fall back to just
// "reach" (the most broadly supported metric) if that errors.
function insightsMetricChain(mediaType: string | undefined): string[] {
  switch (mediaType?.toUpperCase()) {
    case "VIDEO":
    case "REELS":
    case "CAROUSEL_ALBUM":
    case "IMAGE":
      return ["reach,saved,shares,views", "reach,saved,shares", "reach"];
    default:
      return ["reach"];
  }
}

type PostInsights = {
  reach: number | null;
  views: number | null;
  saves: number | null;
  shares: number | null;
  raw: Record<string, unknown>;
};

type GraphInsightsResponse = {
  data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
  error?: { message?: string; code?: number };
};

// Logs the raw payload once per distinct media_type seen in this cron run,
// so we can verify what Meta actually returns before trusting the mapped
// reach/saves/shares columns.
async function fetchPostInsights(
  mediaId: string,
  accessToken: string,
  mediaType: string | undefined,
  loggedMediaTypes: Set<string>
): Promise<PostInsights> {
  const empty: PostInsights = { reach: null, views: null, saves: null, shares: null, raw: {} };

  async function request(
    metrics: string
  ): Promise<{ ok: boolean; json: GraphInsightsResponse }> {
    const url = new URL(
      `${IG_GRAPH_BASE}/${mediaId}/insights`
    );
    url.searchParams.set("metric", metrics);
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url.toString());
    const json = (await res.json()) as GraphInsightsResponse;
    return { ok: res.ok && !json.error, json };
  }

  // An unsupported metric fails the whole call, so step down until one works.
  let ok = false;
  let json: GraphInsightsResponse = {};
  for (const metrics of insightsMetricChain(mediaType)) {
    ({ ok, json } = await request(metrics));
    if (ok) break;
  }

  const typeKey = (mediaType ?? "UNKNOWN").toUpperCase();
  if (!loggedMediaTypes.has(typeKey)) {
    loggedMediaTypes.add(typeKey);
    console.log(
      `sync-post-performance: raw insights payload for media_type=${typeKey}:`,
      JSON.stringify(json)
    );
  }

  if (!ok) return empty;

  const values: Record<string, number> = {};
  for (const entry of json.data ?? []) {
    const value = entry.values?.[0]?.value;
    if (entry.name && typeof value === "number") values[entry.name] = value;
  }

  return {
    reach: values.reach ?? null,
    views: values.views ?? null,
    saves: values.saved ?? null,
    shares: values.shares ?? null,
    raw: json,
  };
}

function engagementRate(
  likes: number,
  comments: number,
  followers: number
): number {
  if (followers <= 0) return 0;
  return Math.round(((likes + comments) / followers) * 100 * 100) / 100;
}

async function linkPostsToPlanIdeas(
  supabase: ReturnType<typeof createServiceRoleClient>,
  artistId: string
): Promise<{ linked: number; errors: string[] }> {
  const errors: string[] = [];
  let linked = 0;

  const { data: plans, error: plansError } = await supabase
    .from("weekly_plans")
    .select("id, week_start, ideas")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (plansError) {
    errors.push(`${artistId}: linking plans fetch failed: ${plansError.message}`);
    return { linked, errors };
  }

  const ideasByWeekStart = new Map<
    string,
    Array<{ hook: string; format: string }>
  >();

  for (const plan of plans ?? []) {
    const weekStart = String(plan.week_start ?? "").trim();
    if (!weekStart) continue;

    const ideas = normalizeIdeasFromDb(plan.ideas) ?? [];
    if (ideas.length === 0) continue;

    ideasByWeekStart.set(
      weekStart,
      ideas.map((idea) => ({
        hook: idea.hook.trim(),
        format: idea.format.trim(),
      }))
    );
  }

  if (ideasByWeekStart.size === 0) {
    return { linked, errors };
  }

  const { data: unlinkedPosts, error: postsError } = await supabase
    .from("post_performance")
    .select("id, week_start, caption")
    .eq("artist_id", artistId)
    .is("linked_idea_hook", null)
    .in("week_start", [...ideasByWeekStart.keys()]);

  if (postsError) {
    errors.push(`${artistId}: linking posts fetch failed: ${postsError.message}`);
    return { linked, errors };
  }

  for (const post of unlinkedPosts ?? []) {
    const weekStart = String(post.week_start ?? "").trim();
    const ideas = ideasByWeekStart.get(weekStart);
    if (!ideas) continue;

    const caption = String(post.caption ?? "").trim().toLowerCase();
    if (!caption) continue;

    for (const idea of ideas) {
      const hookLower = idea.hook.toLowerCase();
      if (!hookLower || !caption.includes(hookLower)) continue;

      const { error: linkError } = await supabase
        .from("post_performance")
        .update({
          linked_idea_hook: idea.hook,
          linked_idea_format: idea.format,
        })
        .eq("id", post.id);

      if (linkError) {
        errors.push(`${artistId}/${post.id}: linking failed: ${linkError.message}`);
      } else {
        linked += 1;
      }
      break;
    }
  }

  return { linked, errors };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let supabase;
    try {
      supabase = createServiceRoleClient();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Configuration error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // ?artist_id=… syncs just that artist (used straight after they connect).
    const onlyArtist = new URL(request.url).searchParams.get("artist_id")?.trim() || null;
    let profilesQuery = supabase
      .from("profiles")
      .select("id, instagram_user_id, instagram_access_token")
      .not("instagram_access_token", "is", null)
      .not("instagram_user_id", "is", null);
    if (onlyArtist) profilesQuery = profilesQuery.eq("id", onlyArtist);
    const { data: profiles, error: profilesError } = await profilesQuery;
    // No is_private filter: syncing only reads an account its owner chose to
    // connect and sends nothing. Admin-created client artists are all
    // private, so filtering them out meant nothing ever synced.

    if (profilesError) {
      return NextResponse.json(
        {
          error: "Failed to load profiles",
          details: profilesError.message,
        },
        { status: 500 }
      );
    }

    const connectedProfiles = (profiles ?? []).filter((profile) => {
      const row = profile as ProfileRow;
      return (
        String(row.instagram_access_token ?? "").trim() &&
        String(row.instagram_user_id ?? "").trim()
      );
    });

    let synced = 0;
    let linked = 0;
    let emailsSent = 0;
    const errors: string[] = [];
    const loggedMediaTypes = new Set<string>();

    for (const profile of connectedProfiles) {
      const artistId = String(profile.id ?? "").trim();
      const instagramUserId = String(profile.instagram_user_id ?? "").trim();
      const accessToken = String(profile.instagram_access_token ?? "").trim();

      if (!artistId || !instagramUserId || !accessToken) continue;

      try {
        const mediaUrl = new URL(
          `${IG_GRAPH_BASE}/${instagramUserId}/media`
        );
        mediaUrl.searchParams.set(
          "fields",
          "id,caption,media_type,timestamp,like_count,comments_count,thumbnail_url,media_url,permalink"
        );
        mediaUrl.searchParams.set("limit", "20");
        mediaUrl.searchParams.set("access_token", accessToken);

        const mediaRes = await fetch(mediaUrl.toString());
        const mediaJson = (await mediaRes.json()) as GraphMediaResponse;

        if (!mediaRes.ok || mediaJson.error) {
          errors.push(
            `${artistId}: ${mediaJson.error?.message ?? `HTTP ${mediaRes.status}`}`
          );
          continue;
        }

        const posts = mediaJson.data ?? [];
        if (posts.length === 0) continue;

        // Today's follower count, kept daily so growth can be shown later.
        let followers = 0;
        try {
          const accountUrl = new URL(`${IG_GRAPH_BASE}/${instagramUserId}`);
          accountUrl.searchParams.set("fields", "followers_count,media_count");
          accountUrl.searchParams.set("access_token", accessToken);
          const accountRes = await fetch(accountUrl.toString());
          const account = (await accountRes.json()) as GraphAccountResponse;
          if (accountRes.ok && !account.error && typeof account.followers_count === "number") {
            followers = account.followers_count;
            const { error: snapErr } = await supabase.from("instagram_account_snapshots").upsert(
              {
                artist_id: artistId,
                snapshot_date: new Date().toISOString().slice(0, 10),
                followers_count: account.followers_count,
                media_count: account.media_count ?? null,
              },
              { onConflict: "artist_id,snapshot_date" }
            );
            if (snapErr) errors.push(`${artistId}: follower snapshot failed: ${snapErr.message}`);
          }
        } catch (e) {
          errors.push(`${artistId}: account fetch failed: ${e instanceof Error ? e.message : "Unknown error"}`);
        }

        const { data: audit } = followers > 0 ? { data: null } : await supabase
          .from("audits")
          .select("followers")
          .eq("artist_id", artistId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (followers === 0 && audit?.followers != null) {
          followers = Number(audit.followers) || 0;
        }

        const postIds = posts
          .map((post) => post.id?.trim())
          .filter((id): id is string => Boolean(id));

        const { data: existingRows, error: existingError } = await supabase
          .from("post_performance")
          .select("instagram_post_id, reach")
          .eq("artist_id", artistId)
          .in("instagram_post_id", postIds);

        if (existingError) {
          errors.push(`${artistId}: ${existingError.message}`);
          continue;
        }

        const existingIds = new Set(
          (existingRows ?? []).map((row) => row.instagram_post_id)
        );
        // Older posts synced before we kept reach get it filled in once.
        const missingReach = new Set(
          (existingRows ?? []).filter((row) => row.reach == null).map((row) => row.instagram_post_id)
        );
        const scrapedAt = new Date().toISOString();

        await inBatches(posts, 5, async (post) => {
          const instagramPostId = post.id?.trim();
          if (!instagramPostId) return;

          const likes = Number(post.like_count) || 0;
          const comments = Number(post.comments_count) || 0;
          const rate = engagementRate(likes, comments, followers);

          const ageDays = daysSinceIso(post.timestamp);
          const withinInsightsWindow =
            (ageDays !== null && ageDays <= INSIGHTS_MAX_AGE_DAYS) ||
            !existingIds.has(instagramPostId) ||
            missingReach.has(instagramPostId);

          let insights: PostInsights = {
            reach: null,
            views: null,
            saves: null,
            shares: null,
            raw: {},
          };
          if (withinInsightsWindow) {
            try {
              insights = await fetchPostInsights(
                instagramPostId,
                accessToken,
                post.media_type,
                loggedMediaTypes
              );
            } catch (e) {
              errors.push(
                `${artistId}/${instagramPostId}: insights fetch failed: ${
                  e instanceof Error ? e.message : "Unknown error"
                }`
              );
            }
          }

          if (existingIds.has(instagramPostId)) {
            const { error: updateError } = await supabase
              .from("post_performance")
              .update({
                likes,
                comments,
                engagement_rate: rate,
                ig_media_type: post.media_type ?? null,
                permalink: post.permalink ?? null,
                thumbnail_url: coverImage(post),
                ...(withinInsightsWindow
                  ? {
                      reach: insights.reach,
                      views: insights.views,
                      saves: insights.saves,
                      shares: insights.shares,
                      raw: insights.raw,
                    }
                  : {}),
              })
              .eq("artist_id", artistId)
              .eq("instagram_post_id", instagramPostId);

            if (updateError) {
              errors.push(`${artistId}/${instagramPostId}: ${updateError.message}`);
              return;
            }
          } else {
            const postDate = post.timestamp
              ? new Date(post.timestamp).toISOString()
              : null;
            const weekStart = post.timestamp
              ? getMondayDateString(new Date(post.timestamp))
              : null;

            const { error: insertError } = await supabase
              .from("post_performance")
              .insert({
                artist_id: artistId,
                instagram_post_id: instagramPostId,
                post_date: postDate,
                caption: post.caption ?? null,
                post_type: mapPostType(post.media_type),
                ig_media_type: post.media_type ?? null,
                permalink: post.permalink ?? null,
                thumbnail_url: coverImage(post),
                likes,
                comments,
                engagement_rate: rate,
                week_start: weekStart,
                scraped_at: scrapedAt,
                reach: insights.reach,
                views: insights.views,
                saves: insights.saves,
                shares: insights.shares,
                raw: insights.raw,
              });

            if (insertError) {
              errors.push(`${artistId}/${instagramPostId}: ${insertError.message}`);
              return;
            }
          }

          synced += 1;
        });

        const conceptLink = await linkPostsToConcepts(supabase, artistId);
        linked += conceptLink.linked;
        if (conceptLink.error) errors.push(`${artistId}: linking board ideas failed: ${conceptLink.error}`);

        // "You posted, here's how it did" for the newest settled post, if due.
        try {
          const outcome = await sendPostResultEmail(supabase, artistId);
          if (outcome.sent) emailsSent += 1;
        } catch (e) {
          errors.push(`${artistId}: post result email failed: ${e instanceof Error ? e.message : "Unknown error"}`);
        }

        try {
          const linkResult = await linkPostsToPlanIdeas(supabase, artistId);
          linked += linkResult.linked;
          errors.push(...linkResult.errors);
        } catch (e) {
          errors.push(
            `${artistId}: linking pass failed: ${e instanceof Error ? e.message : "Unknown error"}`
          );
        }
      } catch (e) {
        errors.push(
          `${artistId}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    if (errors.length > 0) {
      console.error("sync-post-performance errors", errors);
    }

    // 207 when some artists failed, 502 when every connected artist failed,
    // so cron-job.org shows a failure instead of a quiet 200.
    const failedArtists = new Set(errors.map((e) => e.split(/[:/]/)[0]));
    const status =
      connectedProfiles.length > 0 && failedArtists.size >= connectedProfiles.length
        ? 502
        : errors.length > 0
          ? 207
          : 200;

    return NextResponse.json(
      {
        synced,
        artists: connectedProfiles.length,
        linked,
        emails_sent: emailsSent,
        errors,
      },
      { status }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
