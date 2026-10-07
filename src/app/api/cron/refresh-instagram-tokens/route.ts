import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import {
  IG_TOKEN_REFRESH_WINDOW_DAYS,
  isReconnectError,
  refreshLongLivedToken,
} from "@/lib/instagram-graph";

// Long-lived Instagram Login tokens last 60 days. Run this daily: it renews
// any token expiring within IG_TOKEN_REFRESH_WINDOW_DAYS. Tokens that have
// already expired or been revoked can't be refreshed — the artist has to
// reconnect, so they're cleared and reported.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const cutoff = new Date(
    Date.now() + IG_TOKEN_REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, instagram_access_token, instagram_token_expires_at")
    .not("instagram_access_token", "is", null)
    .lt("instagram_token_expires_at", cutoff);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load profiles", details: error.message },
      { status: 500 }
    );
  }

  let refreshed = 0;
  const disconnected: string[] = [];
  const errors: string[] = [];

  for (const profile of profiles ?? []) {
    const artistId = String(profile.id ?? "").trim();
    const token = String(profile.instagram_access_token ?? "").trim();
    if (!artistId || !token) continue;

    try {
      const result = await refreshLongLivedToken(token);

      if ("error" in result) {
        const expired =
          isReconnectError(result.error) ||
          (profile.instagram_token_expires_at &&
            new Date(profile.instagram_token_expires_at).getTime() < Date.now());

        if (expired) {
          await supabase
            .from("profiles")
            .update({
              instagram_access_token: null,
              instagram_user_id: null,
              instagram_token_expires_at: null,
            })
            .eq("id", artistId);
          disconnected.push(artistId);
        } else {
          errors.push(`${artistId}: ${result.error.message ?? "refresh failed"}`);
        }
        continue;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          instagram_access_token: result.accessToken,
          instagram_token_expires_at: result.expiresAt,
        })
        .eq("id", artistId);

      if (updateError) {
        errors.push(`${artistId}: ${updateError.message}`);
      } else {
        refreshed += 1;
      }
    } catch (e) {
      errors.push(`${artistId}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({
    checked: profiles?.length ?? 0,
    refreshed,
    disconnected,
    errors,
  });
}
