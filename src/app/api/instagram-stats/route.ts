import { createClient } from "@/utils/supabase/server";
import {
  IG_GRAPH_BASE,
  isReconnectError,
  type IgGraphError,
} from "@/lib/instagram-graph";
import { cookies } from "next/headers";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { userIsAdmin } from "@/lib/is-admin";
import { NextResponse } from "next/server";

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

  const mediaUrl = new URL(
    `${IG_GRAPH_BASE}/${instagramUserId}/media`
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
    ].join(",")
  );
  mediaUrl.searchParams.set("access_token", accessToken);
  mediaUrl.searchParams.set("limit", "10");

  let media: unknown;

  try {
    const mediaRes = await fetch(mediaUrl.toString());
    media = await mediaRes.json();

    if (!mediaRes.ok) {
      const graphError = (media as { error?: IgGraphError } | null)?.error;
      return NextResponse.json(
        {
          error: isReconnectError(graphError)
            ? "reconnect_required"
            : "instagram_api_error",
          media,
          insights: null,
        },
        { status: 502 }
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Enrich with insights. Each call is best-effort: a metric Meta won't
  // return for a given post or account just shows as "—" in the panel.
  const items = ((media as { data?: Array<Record<string, unknown>> }).data ?? []);
  const [mediaInsights, accountInsights, account] = await Promise.all([
    Promise.all(
      items.map((item) =>
        typeof item.id === "string"
          ? fetchMediaInsights(item.id, accessToken)
          : Promise.resolve([])
      )
    ),
    fetchAccountInsights(instagramUserId, accessToken),
    fetchAccount(instagramUserId, accessToken),
  ]);
  items.forEach((item, i) => {
    item.insights = { data: mediaInsights[i] };
  });

  return NextResponse.json({
    media,
    insights: accountInsights.length ? { data: accountInsights } : null,
    followers: account.followers,
    account: {
      username: account.username,
      profile_picture_url: account.profilePictureUrl,
    },
  });
}

type MetricRow = { name: string; values: Array<{ value: number }> };

type GraphInsightsJson = {
  data?: Array<{
    name?: string;
    values?: Array<{ value?: number }>;
    total_value?: { value?: number };
  }>;
  error?: IgGraphError;
};

// Normalises both insights shapes (values[] and total_value) to values[].
function toMetricRows(json: GraphInsightsJson): MetricRow[] {
  const rows: MetricRow[] = [];
  for (const entry of json.data ?? []) {
    if (!entry.name) continue;
    const value =
      typeof entry.total_value?.value === "number"
        ? entry.total_value.value
        : entry.values?.[0]?.value;
    if (typeof value === "number") rows.push({ name: entry.name, values: [{ value }] });
  }
  return rows;
}

async function getInsights(url: URL): Promise<MetricRow[]> {
  try {
    const res = await fetch(url.toString());
    const json = (await res.json()) as GraphInsightsJson;
    if (!res.ok || json.error) return [];
    return toMetricRows(json);
  } catch {
    return [];
  }
}

// Reach and views per post. Asked for one at a time because an unsupported
// metric fails the whole call (availability varies by media type).
async function fetchMediaInsights(mediaId: string, accessToken: string) {
  const results = await Promise.all(
    ["reach", "views"].map((metric) => {
      const url = new URL(`${IG_GRAPH_BASE}/${mediaId}/insights`);
      url.searchParams.set("metric", metric);
      url.searchParams.set("access_token", accessToken);
      return getInsights(url);
    })
  );
  return results.flat();
}

// Account totals for the last 7 days.
async function fetchAccountInsights(igUserId: string, accessToken: string) {
  const until = Math.floor(Date.now() / 1000);
  const since = until - 7 * 24 * 60 * 60;
  const results = await Promise.all(
    ["views", "reach", "profile_views"].map((metric) => {
      const url = new URL(`${IG_GRAPH_BASE}/${igUserId}/insights`);
      url.searchParams.set("metric", metric);
      url.searchParams.set("period", "day");
      url.searchParams.set("metric_type", "total_value");
      url.searchParams.set("since", String(since));
      url.searchParams.set("until", String(until));
      url.searchParams.set("access_token", accessToken);
      return getInsights(url);
    })
  );
  return results.flat();
}

/** The connected account's profile: who they are and how many follow them. */
async function fetchAccount(igUserId: string, accessToken: string) {
  const empty = { username: null as string | null, profilePictureUrl: null as string | null, followers: null as number | null };
  try {
    const url = new URL(`${IG_GRAPH_BASE}/${igUserId}`);
    url.searchParams.set("fields", "username,profile_picture_url,followers_count");
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url.toString());
    const json = (await res.json()) as {
      username?: string;
      profile_picture_url?: string;
      followers_count?: number;
    };
    return {
      username: typeof json.username === "string" ? json.username : null,
      profilePictureUrl: typeof json.profile_picture_url === "string" ? json.profile_picture_url : null,
      followers: typeof json.followers_count === "number" ? json.followers_count : null,
    };
  } catch {
    return empty;
  }
}
