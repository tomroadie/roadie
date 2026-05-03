import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { userIsAdmin } from "@/lib/is-admin";
import { NextResponse } from "next/server";

const GRAPH_VERSION = "v19.0";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const admin = await userIsAdmin(supabase, user.id);

  const url = new URL(request.url);
  const requestedArtistId = url.searchParams.get("artist_id")?.trim() ?? "";

  let profileId: string | null = null;

  if (requestedArtistId) {
    if (admin) {
      const { data: row, error } = await supabase
        .from("artists")
        .select("id")
        .eq("id", requestedArtistId)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: "Lookup failed", details: error.message },
          { status: 500 }
        );
      }
      if (!row?.id) {
        return NextResponse.json({ error: "Artist not found" }, { status: 404 });
      }
      profileId = row.id;
    } else {
      const { data: row, error } = await supabase
        .from("artists")
        .select("id")
        .eq("id", requestedArtistId)
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (error) {
        return NextResponse.json(
          { error: "Lookup failed", details: error.message },
          { status: 500 }
        );
      }
      if (!row?.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      profileId = row.id;
    }
  } else {
    profileId = await getActiveArtistIdForUser(
      supabase,
      user.id,
      cookieStore
    );

    if (!profileId) {
      return NextResponse.json(
        { error: "No active artist. Complete onboarding first." },
        { status: 400 }
      );
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("instagram_access_token, instagram_user_id")
    .eq("id", profileId)
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
