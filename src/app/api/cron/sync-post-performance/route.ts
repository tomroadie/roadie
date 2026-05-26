import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { getMondayDateString } from "@/lib/week";

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
      .not("instagram_user_id", "is", null);

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
                scraped_at: scrapedAt,
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
      } catch (e) {
        errors.push(
          `${artistId}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      synced,
      artists: connectedProfiles.length,
      errors,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
