import type { ConceptContext, ContextPost } from "./types";

export const POOL_SIZE = 5;

export const CONCEPT_SYSTEM_PROMPT = `You are Tempo, a content coach for independent musicians. Tempo is a "couch to 5K" for socials: it helps artists who have things worth sharing but don't post them to start posting consistently. Success is "did they post this week", not likes.

You write concepts, not prescriptions. A concept is a direction drawn from this artist's own posts ("credit the people around you", "let people in on the writing"), something they could return to across several weeks. Each concept comes with two or three example ways to do it, so the artist picks the one that fits their week.

Rules you never break:
1. Ground every concept in the numbered posts you are given. The "why" must point at what actually happened on specific posts, and evidence_posts must list those post numbers. Only quote numbers that appear in the data. Never invent a statistic, a ratio or a post. If like counts are hidden, talk about comments or views instead.
2. A handful of posts is a small sample. Say "your post about X got the most comments" rather than claiming a trend from one data point. Posts marked STANDOUT are the real outliers; lean on those.
3. Separate the news from the technique. Release days, announcements and gig news get comments because of the news itself, whatever the caption does. Don't credit a release-day spike to a caption style (crediting people, explaining the song, a teaser format) unless a post without big news shows the same thing. When the only support for a technique is a release-day post, say so plainly ("your release posts get the most conversation") rather than inventing a cause. Each standout post should explain one concept, not several.
4. Don't assume what's next. Only frame a concept around unreleased music, a new release or a tour if the key dates or their recent posts say one is coming. Otherwise suggest things that work whatever stage they're at.
5. Lower the bar. Every concept must include at least one low-effort execution that could be made with a phone in under 20 minutes from things the artist already has (photos, voice memos, rehearsal clips, gig footage). The less they've posted recently, the lower the effort should skew.
6. Write like a supportive human in plain British English. No hype words ("elevate", "unleash", "game-changer"), no hashtags, no exclamation-mark pileups, no guilt about not posting.
7. The five concepts must be genuinely different directions, not five versions of one idea.
8. Never repeat something the artist has turned down.`;

function count(n: number, word: string): string {
  return `${n.toLocaleString("en-GB")} ${word}${n === 1 ? "" : "s"}`;
}

function postLine(p: ContextPost): string {
  const metrics: string[] = [];
  if (p.comments !== null) metrics.push(count(p.comments, "comment"));
  metrics.push(p.likes !== null ? count(p.likes, "like") : "likes hidden");
  if (p.views !== null) metrics.push(count(p.views, "view"));
  if (p.reach !== null) metrics.push(`${p.reach.toLocaleString("en-GB")} reach`);
  if (p.saves !== null) metrics.push(count(p.saves, "save"));
  if (p.shares !== null) metrics.push(count(p.shares, "share"));
  const date = p.date ? p.date.slice(0, 10) : "date unknown";
  const caption = p.caption.replace(/\s+/g, " ").slice(0, 400) || "(no caption)";
  return `Post ${p.n}${p.standout ? " [STANDOUT]" : ""} — ${date} — ${p.type} — ${metrics.join(", ")}\n  "${caption}"`;
}

function postingSituation(ctx: ConceptContext): string {
  const since =
    ctx.daysSinceLastPost === null
      ? "We can't tell when they last posted."
      : ctx.daysSinceLastPost === 0
        ? "They posted today."
        : `Their last post was ${ctx.daysSinceLastPost} day${ctx.daysSinceLastPost === 1 ? "" : "s"} ago.`;
  return `${ctx.postsLast28Days} post${ctx.postsLast28Days === 1 ? "" : "s"} in the last 4 weeks. ${since} This week's target is ${ctx.weeklyTarget} post${ctx.weeklyTarget === 1 ? "" : "s"}.`;
}

export function buildConceptPrompt(ctx: ConceptContext, today: string): string {
  const about = [
    `- Name: ${ctx.artistName}`,
    ctx.handle ? `- Instagram: @${ctx.handle}` : null,
    ctx.followers !== null ? `- Followers: ${ctx.followers.toLocaleString("en-GB")}` : null,
    `- Genre: ${ctx.genre ?? "not given"}`,
    ctx.sound ? `- How they describe their sound: ${ctx.sound}` : null,
    ctx.voice ? `- In their own words: ${ctx.voice}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const postsSection =
    ctx.posts.length > 0
      ? `## Their recent posts (newest first, ${ctx.postSource === "synced" ? "from their connected Instagram" : "from a public scrape"})\n${ctx.posts.map(postLine).join("\n")}`
      : "## Their recent posts\nNone available.";

  const auditSection = ctx.auditPattern
    ? `## What the audit found\n${ctx.auditPattern}`
    : "";

  const datesSection =
    ctx.keyDates.length > 0
      ? `## Key dates in the next 4 weeks\n${ctx.keyDates
          .map(
            (d) =>
              `- ${d.date}: ${d.title}${d.type ? ` (${d.type})` : ""}${d.notes ? ` — ${d.notes}` : ""}`
          )
          .join("\n")}\nAt least one concept must serve the nearest of these, with key_date set to its date. Don't make every concept about dates; the artist also needs things to post in between.`
      : "## Key dates in the next 4 weeks\nNone known. Set key_date to null on every concept.";

  const declinedSection =
    ctx.declined.length > 0
      ? `## Ideas they turned down\n${ctx.declined
          .map((d) => `- "${d.title}"${d.reason ? ` — ${d.reason}` : ""}`)
          .join("\n")}`
      : "";

  const coldStartNote = ctx.coldStart
    ? `## Starting from very little
There are fewer than four posts to learn from, so you can't ground concepts in what has worked. Instead, build concepts from what they've told us about themselves and things every working musician has to hand (rehearsals, writing, gear, gigs, the people they make music with). Mark these basis "starting_point" with evidence_posts empty, and make the focus about getting the first few posts out, not about performance. If there are one to three posts, you may still cite them where they genuinely support a concept (basis "from_data").`
    : `Every concept must have basis "from_data" and at least one evidence post.`;

  return `Today is ${today}.

## Artist
${about}

## Where they are with posting
${postingSituation(ctx)}

${postsSection}

${auditSection}

${datesSection}

${declinedSection}

${coldStartNote}

## What to produce
1. A focus line for this week's board: one encouraging sentence, at most 90 characters, naming the direction that's working or worth trying. It's the first thing the artist reads.
2. focus_why: one or two sentences for the Tempo team on why this focus, citing post numbers.
3. Exactly ${POOL_SIZE} concepts. For each:
   - title: the direction, phrased as something to do, at most 55 characters ("Spotlight the photographers who shoot your gigs").
   - why: one or two sentences in second person, pointing at what happened on specific posts.
   - evidence_posts: the post numbers the why refers to.
   - executions: two or three ways to do it. Each has format (reel, carousel, photo, story or text), idea (one or two sentences, concrete enough to start on today) and effort (low, medium or high). At least one must be low.
   - key_date: the ISO date of the key date it serves, or null.
   - basis: "from_data" or "starting_point".

Respond with only this JSON, no commentary or code fences:
{"focus":"...","focus_why":"...","concepts":[{"title":"...","why":"...","evidence_posts":[1,3],"executions":[{"format":"reel","idea":"...","effort":"low"}],"key_date":null,"basis":"from_data"}]}`.replace(
    /\n{3,}/g,
    "\n\n"
  );
}
