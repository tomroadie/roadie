import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IG_GRAPH_BASE } from "@/lib/instagram-graph";
import { buildEmailRecipient, everSent, sendEmail, appBaseUrl } from "@/lib/email";
import { auditReadyEmail } from "@/lib/email-templates";
import { buildArtistFullAuditPrompt, buildArtistPatternPrompt } from "./prompts";
import { requestFirstBoard } from "@/lib/concepts/first-board";

/**
 * The free audit, built only from the artist's connected Instagram account
 * (Instagram API with Instagram Login). No scraping.
 */

const MEDIA_LIMIT = 30;
const AUDIT_MODEL = process.env.AUDIT_MODEL?.trim() || "claude-sonnet-4-5";

type GraphAccount = {
  username?: string;
  biography?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  error?: { message?: string };
};

type GraphMedia = {
  id?: string;
  caption?: string;
  media_type?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

const TYPE_NAME: Record<string, string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Sidecar",
};

async function graph<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${IG_GRAPH_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Instagram HTTP ${res.status}`);
  return json;
}

async function fetchAccount(igUserId: string, token: string): Promise<GraphAccount> {
  try {
    return await graph<GraphAccount>(igUserId, { fields: "username,biography,followers_count,follows_count,media_count" }, token);
  } catch {
    // Not every account type returns every field; fall back to the basics.
    return graph<GraphAccount>(igUserId, { fields: "username,followers_count,media_count" }, token);
  }
}

function formatProfile(a: GraphAccount, fallbackHandle: string): string {
  return [
    "Profile",
    `Username: ${a.username || fallbackHandle || "—"}`,
    `Bio: ${a.biography?.trim() || "—"}`,
    `Followers: ${a.followers_count ?? "—"}`,
    `Following: ${a.follows_count ?? "—"}`,
    `Posts: ${a.media_count ?? "—"}`,
  ].join("\n");
}

/** Same layout the scraper audits used, so existing parsers keep working. */
function formatPosts(media: GraphMedia[], views: Map<string, number | null>): string {
  return media
    .map((p, i) => {
      const v = p.id ? views.get(p.id) : null;
      return (
        `Post ${i + 1}\n` +
        `Type: ${TYPE_NAME[p.media_type ?? ""] ?? p.media_type ?? "—"}\n` +
        `Date: ${p.timestamp ?? "—"}\n` +
        `Views: ${v ?? "—"}\n` +
        `Likes: ${p.like_count ?? "—"}\n` +
        `Comments: ${p.comments_count ?? "—"}\n` +
        `Caption: ${p.caption?.trim() || "—"}\n\n---\n\n`
      );
    })
    .join("");
}

function textOf(m: Anthropic.Message): string {
  const block = m.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Unexpected model response shape");
  return block.text.trim();
}

export type ConnectedAuditResult = { auditId: string; posts: number };

/**
 * Runs the audit for one artist from their connected account, saves it,
 * marks the profile and sends the audit-ready email (once per artist).
 * `pendingLeadId` is the progress row to mark complete or failed.
 */
export async function runConnectedAudit(
  admin: SupabaseClient,
  artistId: string,
  opts: { pendingLeadId?: string } = {}
): Promise<ConnectedAuditResult> {
  const finish = async (status: "complete" | "failed") => {
    if (opts.pendingLeadId) await admin.from("pending_leads").update({ status }).eq("id", opts.pendingLeadId);
  };

  try {
    const { data: profile, error } = await admin
      .from("profiles")
      .select(
        "id, owner_user_id, artist_name, genre, plan, instagram_handle, instagram_user_id, instagram_access_token, marketing_unsubscribed, all_emails_paused, board_enabled"
      )
      .eq("id", artistId)
      .maybeSingle();
    if (error || !profile) throw new Error(`profile: ${error?.message ?? "not found"}`);
    const token = String(profile.instagram_access_token ?? "").trim();
    const igUserId = String(profile.instagram_user_id ?? "").trim();
    if (!token || !igUserId) throw new Error("Instagram isn't connected");

    const [account, mediaRes, { data: synced }] = await Promise.all([
      fetchAccount(igUserId, token),
      graph<{ data?: GraphMedia[] }>(
        `${igUserId}/media`,
        { fields: "id,caption,media_type,timestamp,like_count,comments_count", limit: String(MEDIA_LIMIT) },
        token
      ),
      admin.from("post_performance").select("instagram_post_id, views").eq("artist_id", artistId),
    ]);
    const media = mediaRes.data ?? [];
    const views = new Map(
      (synced ?? []).map((r) => [String(r.instagram_post_id), typeof r.views === "number" ? r.views : null])
    );

    const artistName = String(profile.artist_name ?? "").trim() || account.username || "Unknown artist";
    const formattedProfile = formatProfile(account, String(profile.instagram_handle ?? ""));
    const hasPosts = media.length > 0;
    const formattedPosts = hasPosts ? formatPosts(media, views) : "Posts\nNo post data was available for this artist.\n";
    const noPostsNote = hasPosts
      ? ""
      : "\n\nNote: No post data was available. Base your analysis on the profile only and say so clearly.\n\n";

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const [m1, m2] = await Promise.all([
      anthropic.messages.create({
        model: AUDIT_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: buildArtistPatternPrompt(artistName, formattedProfile, noPostsNote, hasPosts ? formatPosts(media.slice(0, 10), views) : ""),
          },
        ],
      }),
      anthropic.messages.create({
        model: AUDIT_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: buildArtistFullAuditPrompt(artistName, String(profile.genre ?? "Unknown"), formattedProfile, formattedPosts, noPostsNote),
          },
        ],
      }),
    ]);
    const ai_pattern_analysis = textOf(m1);
    const ai_full_analysis = textOf(m2);

    const recipient = await buildEmailRecipient(admin as Parameters<typeof buildEmailRecipient>[0], profile);

    const { data: inserted, error: insertError } = await admin
      .from("audits")
      .insert({
        user_id: profile.owner_user_id ?? null,
        artist_id: artistId,
        email: recipient?.email ?? "",
        instagram_handle: account.username ?? String(profile.instagram_handle ?? ""),
        followers: account.followers_count ?? 0,
        following: account.follows_count ?? 0,
        post_count: account.media_count ?? 0,
        bio: account.biography ?? "",
        recent_posts: null,
        recent_posts_raw: formattedPosts,
        ai_pattern_analysis,
        ai_full_analysis,
        is_research: false,
      })
      .select("id")
      .single();
    if (insertError || !inserted) throw new Error(`saving audit: ${insertError?.message ?? "no row"}`);

    await admin.from("profiles").update({ audit_completed_at: new Date().toISOString() }).eq("id", artistId);
    await finish("complete");

    if (recipient && !(await everSent(artistId, "audit_ready"))) {
      const email = auditReadyEmail({
        artistId,
        artistName: recipient.artistName,
        followers: account.followers_count ?? 0,
        following: account.follows_count ?? 0,
        postCount: account.media_count ?? 0,
        patternAnalysis: ai_pattern_analysis,
        appUrl: appBaseUrl(),
      });
      await sendEmail({ to: recipient.email, subject: email.subject, html: email.html, recipient, type: "audit_ready" });
    }

    // A board artist with no ideas yet gets a first draft for review.
    if (profile.board_enabled) await requestFirstBoard(artistId);

    return { auditId: String(inserted.id), posts: media.length };
  } catch (e) {
    await finish("failed");
    throw e;
  }
}

/** Starts the progress row the Home page watches while an audit runs. */
export async function startAuditProgress(
  admin: SupabaseClient,
  input: { email: string; handle: string; artistName: string }
): Promise<string | null> {
  const { data } = await admin
    .from("pending_leads")
    .insert({
      email: input.email.trim().toLowerCase(),
      instagram_handle: input.handle,
      artist_name: input.artistName,
      status: "processing",
      is_research: false,
    })
    .select("id")
    .single();
  return data?.id ? String(data.id) : null;
}
