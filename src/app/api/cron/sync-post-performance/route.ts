import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { PUBLIC_PROFILES_OR_FILTER } from "@/lib/public-profiles-filter";
import { getMondayDateString } from "@/lib/week";
import { normalizeIdeasFromDb } from "@/lib/parse-ideas-json";

const GRAPH_VERSION = "v19.0";

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
};

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

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, instagram_user_id, instagram_access_token")
      .not("instagram_access_token", "is", null)
      .not("instagram_user_id", "is", null)
      .or(PUBLIC_PROFILES_OR_FILTER);

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
    const errors: string[] = [];

    for (const profile of connectedProfiles) {
      const artistId = String(profile.id ?? "").trim();
      const instagramUserId = String(profile.instagram_user_id ?? "").trim();
      const accessToken = String(profile.instagram_access_token ?? "").trim();

      if (!artistId || !instagramUserId || !accessToken) continue;

      try {
        const mediaUrl = new URL(
          `https://graph.facebook.com/${GRAPH_VERSION}/${instagramUserId}/media`
        );
        mediaUrl.searchParams.set(
          "fields",
          "id,caption,media_type,timestamp,like_count,comments_count,thumbnail_url,media_url"
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

        let followers = 0;
        const { data: audit } = await supabase
          .from("audits")
          .select("followers")
          .eq("artist_id", artistId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (audit?.followers != null) {
          followers = Number(audit.followers) || 0;
        }

        const postIds = posts
          .map((post) => post.id?.trim())
          .filter((id): id is string => Boolean(id));

        const { data: existingRows, error: existingError } = await supabase
          .from("post_performance")
          .select("instagram_post_id")
          .eq("artist_id", artistId)
          .in("instagram_post_id", postIds);

        if (existingError) {
          errors.push(`${artistId}: ${existingError.message}`);
          continue;
        }

        const existingIds = new Set(
          (existingRows ?? []).map((row) => row.instagram_post_id)
        );
        const scrapedAt = new Date().toISOString();

        for (const post of posts) {
          const instagramPostId = post.id?.trim();
          if (!instagramPostId) continue;

          const likes = Number(post.like_count) || 0;
          const comments = Number(post.comments_count) || 0;
          const rate = engagementRate(likes, comments, followers);

          if (existingIds.has(instagramPostId)) {
            const { error: updateError } = await supabase
              .from("post_performance")
              .update({
                likes,
                comments,
                engagement_rate: rate,
              })
              .eq("artist_id", artistId)
              .eq("instagram_post_id", instagramPostId);

            if (updateError) {
              errors.push(`${artistId}/${instagramPostId}: ${updateError.message}`);
              continue;
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
                likes,
                comments,
                engagement_rate: rate,
                week_start: weekStart,
                scraped_at: scrapedAt,
              });

            if (insertError) {
              errors.push(`${artistId}/${instagramPostId}: ${insertError.message}`);
              continue;
            }
          }

          synced += 1;
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

    return NextResponse.json({
      synced,
      artists: connectedProfiles.length,
      linked,
      errors,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
