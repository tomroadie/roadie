import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { NextResponse } from "next/server";

const GRAPH_VERSION = "v19.0";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  if (!activeArtistId) {
    return NextResponse.json(
      { error: "No active artist. Complete onboarding first." },
      { status: 400 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("instagram_access_token, instagram_user_id")
    .eq("id", activeArtistId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "Failed to load profile", details: profileError.message },
      { status: 500 }
    );
  }

  const accessToken = profile?.instagram_access_token?.trim();
  const instagramUserId = profile?.instagram_user_id?.trim();

  if (!accessToken || !instagramUserId) {
    return NextResponse.json({ error: "not_connected" }, { status: 400 });
  }

  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  const until = Math.floor(todayUtc.getTime() / 1000);
  const sinceDate = new Date(todayUtc);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - 7);
  const since = Math.floor(sinceDate.getTime() / 1000);

  const mediaUrl = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${instagramUserId}/media`
  );
  mediaUrl.searchParams.set(
    "fields",
    [
      "id",
      "caption",
      "media_type",
      "timestamp",
      "permalink",
      "thumbnail_url",
      "media_url",
      "like_count",
      "comments_count",
      "insights.metric(impressions,reach)",
    ].join(",")
  );
  mediaUrl.searchParams.set("access_token", accessToken);
  mediaUrl.searchParams.set("limit", "10");

  const insightsUrl = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${instagramUserId}/insights`
  );
  insightsUrl.searchParams.set(
    "metric",
    "impressions,reach,profile_views"
  );
  insightsUrl.searchParams.set("period", "day");
  insightsUrl.searchParams.set("since", String(since));
  insightsUrl.searchParams.set("until", String(until));
  insightsUrl.searchParams.set("access_token", accessToken);

  let media: unknown;
  let insights: unknown;

  try {
    const [mediaRes, insightsRes] = await Promise.all([
      fetch(mediaUrl.toString()),
      fetch(insightsUrl.toString()),
    ]);

    media = await mediaRes.json();
    insights = await insightsRes.json();

    if (!mediaRes.ok || !insightsRes.ok) {
      return NextResponse.json(
        { error: "instagram_api_error", media, insights },
        { status: 502 }
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ media, insights });
}
