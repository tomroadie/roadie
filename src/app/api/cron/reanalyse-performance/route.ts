import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { PUBLIC_PROFILES_OR_FILTER } from "@/lib/public-profiles-filter";

type ProfileRow = {
  id: string;
  artist_name: string | null;
  genre: string | null;
  voice_description: string | null;
  instagram_user_id: string | null;
  plan: string | null;
};

type PostPerformanceRow = {
  post_type: string | null;
  likes: number | null;
  comments: number | null;
  engagement_rate: number | null;
  caption: string | null;
  post_date: string | null;
};

type PrevMonthSummaryRow = {
  post_type: string;
  post_count: number;
  avg_engagement: number;
  best_engagement: number;
  worst_engagement: number;
};

type ArtistResult =
  | { status: "processed"; artistId: string }
  | { status: "skipped"; artistId: string; reason: string }
  | { status: "failed"; artistId: string; error: string };

function startOfCurrentMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function endOfTodayIso(): string {
  const d = new Date();
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    23,
    59,
    59,
    999
  ).toISOString();
}

function startOfPreviousMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString();
}

function formatCurrentMonthPosts(posts: PostPerformanceRow[]): string {
  return posts
    .map((p, i) =>
      `
Post ${i + 1}:
- Date: ${p.post_date ?? "unknown"}
- Type: ${p.post_type ?? "unknown"}
- Likes: ${p.likes ?? 0} | Comments: ${p.comments ?? 0}
- Engagement: ${p.engagement_rate ?? 0}%
- Caption: "${(p.caption ?? "no caption").slice(0, 120)}"
  `.trim()
    )
    .join("\n\n");
}

function formatPrevMonthSummary(rows: PrevMonthSummaryRow[]): string {
  if (!rows.length) return "No data available for previous month.";
  return rows
    .map(
      (r) =>
        `${r.post_type}: ${r.post_count} posts, ` +
        `avg ${r.avg_engagement}% engagement ` +
        `(best: ${r.best_engagement}%, worst: ${r.worst_engagement}%)`
    )
    .join("\n");
}

function aggregatePrevMonth(
  posts: PostPerformanceRow[]
): PrevMonthSummaryRow[] {
  const byType = new Map<string, number[]>();

  for (const post of posts) {
    const type = String(post.post_type ?? "unknown").trim() || "unknown";
    const rate = Number(post.engagement_rate);
    const values = byType.get(type) ?? [];
    values.push(Number.isFinite(rate) ? rate : 0);
    byType.set(type, values);
  }

  return [...byType.entries()]
    .map(([post_type, rates]) => ({
      post_type,
      post_count: rates.length,
      avg_engagement:
        Math.round(
          (rates.reduce((sum, rate) => sum + rate, 0) / rates.length) * 100
        ) / 100,
      best_engagement: Math.max(...rates),
      worst_engagement: Math.min(...rates),
    }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement);
}

function extractAnthropicText(
  content: Anthropic.Message["content"]
): string | null {
  const block = content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  return block.text.trim();
}

async function reanalyseArtist(
  supabase: ReturnType<typeof createServiceRoleClient>,
  anthropic: Anthropic,
  profile: ProfileRow
): Promise<ArtistResult> {
  const artistId = String(profile.id ?? "").trim();
  if (!artistId) {
    return { status: "failed", artistId: "unknown", error: "Missing artist id" };
  }

  const artistName = profile.artist_name?.trim() || "Unknown artist";
  const genre = profile.genre?.trim() || null;
  const voiceDescription = profile.voice_description?.trim() || null;

  const { count: totalPosts, error: totalPostsError } = await supabase
    .from("post_performance")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", artistId);

  if (totalPostsError) {
    return {
      status: "failed",
      artistId,
      error: totalPostsError.message,
    };
  }

  if (!totalPosts || totalPosts === 0) {
    console.warn(`reanalyse-performance: skip ${artistId} — no post data`);
    return {
      status: "skipped",
      artistId,
      reason: "no post_performance rows",
    };
  }

  const monthStart = startOfCurrentMonthIso();
  const todayEnd = endOfTodayIso();
  const prevMonthStart = startOfPreviousMonthIso();

  const { data: currentMonthPosts, error: currentMonthError } = await supabase
    .from("post_performance")
    .select("post_type, likes, comments, engagement_rate, caption, post_date")
    .eq("artist_id", artistId)
    .gte("post_date", monthStart)
    .lte("post_date", todayEnd)
    .order("post_date", { ascending: false });

  if (currentMonthError) {
    return {
      status: "failed",
      artistId,
      error: currentMonthError.message,
    };
  }

  const currentPosts = (currentMonthPosts ?? []) as PostPerformanceRow[];

  if (currentPosts.length < 3) {
    console.warn(
      `reanalyse-performance: skip ${artistId} — only ${currentPosts.length} posts this month`
    );
    return {
      status: "skipped",
      artistId,
      reason: "fewer than 3 posts in current month",
    };
  }

  const { data: prevMonthPosts, error: prevMonthError } = await supabase
    .from("post_performance")
    .select("post_type, engagement_rate")
    .eq("artist_id", artistId)
    .gte("post_date", prevMonthStart)
    .lt("post_date", monthStart);

  if (prevMonthError) {
    return {
      status: "failed",
      artistId,
      error: prevMonthError.message,
    };
  }

  const prevSummary = aggregatePrevMonth(
    (prevMonthPosts ?? []) as PostPerformanceRow[]
  );
  const formattedCurrentPosts = formatCurrentMonthPosts(currentPosts);
  const formattedPrevSummary = formatPrevMonthSummary(prevSummary);

  const analysis1Prompt = `You are a supportive music industry strategist re-analysing an artist's Instagram presence using their latest performance data.

Artist: ${artistName}
Genre: ${genre ?? "not specified"}
Voice: ${voiceDescription ?? "not specified"}

## This month's posts (full detail)
${formattedCurrentPosts}

## Previous month summary (by format)
${formattedPrevSummary}

Your job is to identify the single most important pattern in how this artist is showing up right now.

Focus on: what their recent content reveals about their current strategy, whether there is a clear pattern emerging, and what is working vs what is being underused.

Write in a direct, evidence-based tone — like a trusted strategist. Never use: nobody cares, begging, desperate, panic, failing, sarcasm, or dismissive language. Prefer: the data suggests..., the missed opportunity is..., your audience responds more strongly when...

Do not reference posts by number. Reference them by their content instead.

Return 2-3 sentences maximum. Start with what is working or what is clear about their current momentum, then note the key opportunity.`;

  const analysis2Prompt = `You are a trusted music industry strategist giving a private review of an artist's recent Instagram performance. Your tone is direct, evidence-based, and encouraging — critique the content strategy, never the artist.

Artist: ${artistName}
Genre: ${genre ?? "not specified"}
Voice: ${voiceDescription ?? "not specified"}

## This month's posts (full detail)
${formattedCurrentPosts}

## Previous month performance summary
${formattedPrevSummary}

CRITICAL TONE RULES:
- Never use: nobody cares, begging, desperate, panic, failing, people don't care, your audience ignores you, trying too hard
- Never use sarcasm, dismissiveness, insults, or language that makes the artist feel judged
- Prefer: your audience responds more strongly when..., the data suggests..., the missed opportunity is..., the strongest signal is...
- Always acknowledge what IS working first, specifically and with data
- Frame every gap as an untapped opportunity with evidence
- Be specific and use real data points
- Sound like a conversation, not a report
- Do not reference posts by number — reference them by their content

Provide a strategic analysis with these exact sections:
**POSITIONING** — what makes this artist distinct and what they are already doing well this month
**CONTENT PATTERN** — what the data shows about how they are showing up, specific observations
**ENGAGEMENT REALITY** — what is actually connecting with their audience and why
**THE HIDDEN PATTERN** — one concise paragraph on the deeper audience/content behaviour behind the numbers
**BIGGEST MISSED OPPORTUNITY** — the single biggest lever they could pull right now
**WHAT HAPPENS IF NOTHING CHANGES** — likely consequence of continuing the current pattern, without fearmongering
**YOUR NEXT MOVE** — exactly 3 specific teaser actions as a numbered list (1. 2. 3.), in their voice

Be specific, warm, and actionable. Max 400 words total.`;

  let ai_pattern_analysis: string;
  let ai_full_analysis: string;

  try {
    const [m1, m2] = await Promise.all([
      anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [{ role: "user", content: analysis1Prompt }],
      }),
      anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: analysis2Prompt }],
      }),
    ]);

    const patternText = extractAnthropicText(m1.content);
    const fullText = extractAnthropicText(m2.content);

    if (!patternText || !fullText) {
      return {
        status: "failed",
        artistId,
        error: "Unexpected model response shape",
      };
    }

    ai_pattern_analysis = patternText;
    ai_full_analysis = fullText;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI analysis failed";
    return { status: "failed", artistId, error: msg };
  }

  const { data: auditRow, error: auditFetchError } = await supabase
    .from("audits")
    .select("id")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (auditFetchError) {
    return {
      status: "failed",
      artistId,
      error: auditFetchError.message,
    };
  }

  if (!auditRow?.id) {
    console.warn(
      `reanalyse-performance: skip update for ${artistId} — no audit row`
    );
    return {
      status: "skipped",
      artistId,
      reason: "no audit row to update",
    };
  }

  const { error: auditUpdateError } = await supabase
    .from("audits")
    .update({
      ai_pattern_analysis,
      ai_full_analysis,
      created_at: new Date().toISOString(),
    })
    .eq("id", auditRow.id);

  if (auditUpdateError) {
    return {
      status: "failed",
      artistId,
      error: auditUpdateError.message,
    };
  }

  return { status: "processed", artistId };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: missing ANTHROPIC_API_KEY" },
        { status: 500 }
      );
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
      .select(
        "id, artist_name, genre, voice_description, instagram_user_id, plan"
      )
      .in("plan", ["pro", "label"])
      .not("instagram_user_id", "is", null)
      .or(PUBLIC_PROFILES_OR_FILTER)
      .or("cron_active.eq.true,cron_active.is.null");

    if (profilesError) {
      return NextResponse.json(
        { error: "Failed to load profiles", details: profilesError.message },
        { status: 500 }
      );
    }

    const artists = (profiles ?? []) as ProfileRow[];
    if (artists.length === 0) {
      return NextResponse.json({
        processed: 0,
        skipped: 0,
        failed: 0,
        artists: 0,
      });
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const results = await Promise.allSettled(
      artists.map((artist) => reanalyseArtist(supabase, anthropic, artist))
    );

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const result of results) {
      if (result.status === "rejected") {
        failed += 1;
        console.error("reanalyse-performance: unhandled rejection", result.reason);
        continue;
      }

      const value = result.value;
      if (value.status === "processed") processed += 1;
      else if (value.status === "skipped") skipped += 1;
      else failed += 1;
    }

    return NextResponse.json({
      processed,
      skipped,
      failed,
      artists: artists.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
