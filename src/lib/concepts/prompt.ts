import { clip } from "@/lib/text";
import type { Concept, ConceptContext, ContextPost } from "./types";

export const POOL_SIZE = 5;

export const CONCEPT_SYSTEM_PROMPT = `You are Tempo, a content coach for independent musicians. Tempo is a "couch to 5K" for socials: it helps artists who have things worth sharing but don't post them to start posting consistently. Success is "did they post this week", not likes.

You write concepts, not prescriptions. A concept is a direction drawn from this artist's own world and posts, something they could return to across several weeks. Each concept comes with two or three example ways to do it, so the artist picks the one that fits their week.

The test every concept must pass: if you could swap in another band's name and it would still make sense, it isn't good enough. A strong concept names something only true for this artist: a song, a release, a place, a person they work with, a moment from their posts, something from their brief. Generic social media advice is what they can get anywhere; Tempo is only worth paying for when it knows them.

These directions are what every coach suggests, so treat them as a last resort and only use one when this artist's own posts make an unusually strong case, naming the specifics: crediting photographers or crew, behind the scenes, rehearsal or soundcheck footage, gear and tools, voice memos or demos, "a day in the life", full live performances, explaining what a song means.

Rules you never break:
1. Ground every concept in the numbered posts you are given. The "why" must point at what actually happened on specific posts, and evidence_posts must list those post numbers. Where a post has a result against their usual, use that ("did about twice your usual reach") rather than raw like counts, which mean nothing without their normal to compare with. The artist reads the "why" and has never seen the numbers, so describe posts by what they were ("your 'Lately' carousel", "the Dreams Fade release post"), never "Post 9". NEWS and STANDOUT are labels for you only; never use those words, or say a post was "marked" anything. Some posts come with a short description of the cover image ("looks:"); you may use it, but don't claim anything about an image beyond that, and never describe video you haven't seen. Only quote numbers that appear in the data. Never invent a statistic, a ratio or a post. If like counts are hidden, talk about comments or views instead.
2. A handful of posts is a small sample. Say "your post about X got the most comments" rather than claiming a trend from one data point. Posts marked STANDOUT are the real outliers; lean on those.
3. Separate the news from the technique. Posts marked NEWS (releases, gigs, announcements) get comments because of the news itself, whatever the caption does. A NEWS post can only be evidence for a concept that is itself about sharing news (about_news: true). Concepts about everyday content, people, process or personality (about_news: false) must cite only posts without the NEWS mark. STANDOUT is judged within each kind, so an everyday post marked STANDOUT did well against other everyday posts. Each post should back one concept, not several.
4. Don't assume what's next. Only frame a concept around unreleased music, a new release or a tour if the key dates or their recent posts say one is coming. Otherwise suggest things that work whatever stage they're at.
5. Lower the bar. Every concept must include at least one low-effort execution that could be made with a phone in under 20 minutes from things the artist already has (photos, voice memos, rehearsal clips, gig footage). The less they've posted recently, the lower the effort should skew. Be honest about effort: "low" means one person, one take or one existing photo, no editing beyond trimming. Anything that needs several people filmed separately, clips stitched together or more than one photo sourced is "medium" at least. Stories carry a line of text at most, not paragraphs.
6. Write like a supportive human in plain British English. No hype words ("elevate", "unleash", "game-changer"), no hashtags, no exclamation-mark pileups, no guilt about not posting.
7. The five concepts must be genuinely different directions, not five versions of one idea. Each concept needs its own evidence: never use the same post to justify two concepts. If you've run out of posts, mark the concept basis "starting_point" instead of reusing one.
8. Never repeat something the artist has turned down.
9. Describe Instagram as it is now: links in stories go in a link sticker (there is no swipe-up), and collaborators are added with a collab invite or a tag.`;

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
  const caption = clip(p.caption.replace(/\s+/g, " "), 400) || "(no caption)";
  const tags = [p.news ? "NEWS" : null, p.standout ? "STANDOUT" : null]
    .filter(Boolean)
    .map((t) => ` [${t}]`)
    .join("");
  const extra = [
    p.vsUsual ? `result: ${p.vsUsual}` : null,
    p.concept ? `concept: ${p.concept}` : null,
    p.looks ? `looks: ${clip(p.looks, 200)}` : null,
  ].filter(Boolean);
  return `Post ${p.n}${tags} — ${date} — ${p.type} — ${metrics.join(", ")}${extra.length ? `\n  ${extra.join(" · ")}` : ""}\n  "${caption}"`;
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

/** A reviewer's note on a redo. Theirs to steer with, within the rules. */
function reviewNoteSection(note: string | undefined): string {
  const n = note?.trim();
  return n
    ? `## Note from the Tempo team on the last draft (follow it)\n"${clip(n, 1000)}"\nThe rules above still apply: stay grounded in the posts.`
    : "";
}

export function buildConceptPrompt(
  ctx: ConceptContext,
  today: string,
  opts: { note?: string } = {}
): string {
  const about = [
    `- Name: ${ctx.artistName}`,
    ctx.handle ? `- Instagram: @${ctx.handle}` : null,
    ctx.followers !== null ? `- Followers: ${ctx.followers.toLocaleString("en-GB")}` : null,
    `- Genre: ${ctx.genre ?? "not given"}`,
    ctx.sound ? `- How they describe their sound: ${ctx.sound}` : null,
    ctx.voice ? `- In their own words: ${ctx.voice}` : null,
    ctx.confidence === "hard"
      ? "- They find posting hard. Keep every idea gentle and low-exposure: no talking to camera required for the low-effort options."
      : ctx.confidence === "getting_there"
        ? "- They're getting there with posting. Mostly low effort, with the odd stretch."
        : null,
    ctx.contentDays.length > 0
      ? `- Days they usually have time to make content: ${ctx.contentDays
          .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
          .join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const briefSection = ctx.brief
    ? `## What we know about them beyond Instagram
${ctx.brief.notes ? `From the Tempo team (trust this; it comes from people who work with them): "${clip(ctx.brief.notes, 1500)}"\n` : ""}${ctx.brief.context ? `From their website, bio or press: ${clip(ctx.brief.context, 1500)}\n` : ""}Use this to make concepts specific to them. Something from here can ground a concept even without an evidence post (basis "starting_point"), but never invent numbers for it.`
    : "";

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
              `- ${d.date}: ${d.title}${d.type ? ` (${d.type})` : ""}${d.notes ? ` — ${d.notes}` : ""}${
                d.linkContext ? `\n  From its page: ${clip(d.linkContext, 600)}` : ""
              }`
          )
          .join("\n")}\nAt least one concept must serve the nearest of these, with key_date set to its date. Only set key_date on a concept that is actually about that date (its title or why names it); every other concept gets null. Don't make every concept about dates; the artist also needs things to post in between.`
      : "## Key dates in the next 4 weeks\nNone known. Set key_date to null on every concept.";

  const ranked = (ctx.themeStats ?? []).filter((t) => t.ratio !== null);
  const fmt = (r: number) => {
    const pct = Math.round((r - 1) * 100);
    return Math.abs(pct) < 5 ? "on par with their usual" : pct > 0 ? `${pct}% above their usual` : `${Math.abs(pct)}% below their usual`;
  };
  const themesSection =
    ranked.length >= 2
      ? `## How their content concepts are doing, best first
${ranked.map((t) => `- ${t.name}: ${fmt(t.ratio!)} (${t.posts} posts)`).join("\n")}${
          ranked.every((t) => t.ratio! < 0.95)
            ? "\nAll of them are below their usual because their reach has dipped overall lately, so compare them with each other."
            : ""
        }
Lean towards what works: most concepts should give fresh angles on the stronger ones, and at most one should sit in the weakest. This is a steer, not a reason to cite these figures in a why.`
      : "";

  const reasonCounts = new Map<string, number>();
  for (const d of ctx.declined) {
    if (d.reason) reasonCounts.set(d.reason, (reasonCounts.get(d.reason) ?? 0) + 1);
  }
  const repeatedReasons = [...reasonCounts].filter(([, n]) => n >= 2).map(([r]) => r);

  const boardHistorySection = [
    ctx.postedIdeas.length > 0
      ? `## Board ideas they posted
${ctx.postedIdeas.map((t) => `- ${t}`).join("\n")}
They actually made these. Where a result follows the arrow, that's how the post did against their own usual reach. Lean towards directions that did well and give fresh angles on them; don't drop a direction because of one quieter result. Don't repeat the same ideas.`
      : "",
    ctx.pinnedIdeas.length > 0
      ? `## On their shelf (pinned, not done yet)
${ctx.pinnedIdeas.map((t) => `- ${t}`).join("\n")}
They already have these. Don't suggest the same ideas again.`
      : "",
    repeatedReasons.length > 0
      ? `## Reasons they keep giving for "Not for me"
${repeatedReasons.map((r) => `- ${r}`).join("\n")}
Take these seriously: "No time" means lower the effort; "No gear for this" means phone-only; "Not my style" means stay closer to how they already post.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const comingUpSection = ctx.comingUpNote
    ? `## What they told us is coming up (their words)\n"${ctx.comingUpNote}"\nUse this where it fits, even if no exact date was given.`
    : "";

  const weekNotesSection = ctx.weekNotes
    ? `## This week, in their words (from their check-in)
${ctx.weekNotes.comingUp ? `- Coming up: "${clip(ctx.weekNotes.comingUp, 600)}"\n` : ""}${ctx.weekNotes.unposted ? `- Made but not posted yet: "${clip(ctx.weekNotes.unposted, 600)}"\n` : ""}${ctx.weekNotes.wantToPost ? `- Want to post about: "${clip(ctx.weekNotes.wantToPost, 600)}"\n` : ""}This is the most current thing you know about them. Build at least two concepts directly on it. If they've made something they haven't posted, make one concept about getting that out, using what they already have.`
    : "";

  const declinedSection =
    ctx.declined.length > 0
      ? `## Ideas they turned down\n${ctx.declined
          .map((d) => `- "${d.title}"${d.reason ? ` — ${d.reason}` : ""}`)
          .join("\n")}`
      : "";

  const everydayCount = ctx.posts.filter((p) => !p.news).length;
  const newsOnlyNote =
    !ctx.coldStart && everydayCount < 3
      ? `## They mostly post news
Only ${everydayCount} of their ${ctx.posts.length} posts ${everydayCount === 1 ? "isn't" : "aren't"} about a release, gig or announcement. That's the pattern to gently break: they go quiet between announcements. Most concepts should be things to post in those gaps. Each everyday post can back one concept at most; every other everyday concept is a starting point. Say so honestly, mark it basis "starting_point" with evidence_posts empty, and keep it low effort. Don't stretch a release post, or the one everyday post, to justify several ideas.`
      : "";

  const coldStartNote = ctx.coldStart
    ? `## Starting from very little
There are fewer than four posts to learn from, so you can't ground concepts in what has worked. Instead, build concepts from what they've told us about themselves and things every working musician has to hand (rehearsals, writing, gear, gigs, the people they make music with). Mark these basis "starting_point" with evidence_posts empty, and make the focus about getting the first few posts out, not about performance. If there are one to three posts, you may still cite them where they genuinely support a concept (basis "from_data").`
    : everydayCount < 3
      ? `Concepts about news must have basis "from_data" and cite news posts.`
      : ctx.brief
        ? `Every concept must have basis "from_data" and at least one evidence post, except at most two grounded in what we know about them beyond Instagram, which are basis "starting_point" with evidence_posts empty.`
        : `Every concept must have basis "from_data" and at least one evidence post.`;

  return `Today is ${today}.

## Artist
${about}

${briefSection}

## Where they are with posting
${postingSituation(ctx)}

${postsSection}

${auditSection}

${datesSection}

${themesSection}

${weekNotesSection}

${comingUpSection}

${declinedSection}

${boardHistorySection}

${newsOnlyNote}

${coldStartNote}

${reviewNoteSection(opts.note)}

## What to produce
1. A focus line for this week's board: one short instruction, at most 70 characters, phrased as something to do this week and specific to them. It's the first thing the artist reads. No numbers, no comparisons, no dashes, no "your X outperform your Y"; the evidence belongs in focus_why.
2. focus_why: one or two sentences for the Tempo team on why this focus, citing post numbers.
3. Exactly ${POOL_SIZE} concepts. For each:
   - title: the direction, phrased as something to do, at most 55 characters, naming something specific to them (it must pass the swap test).
   - why: one or two sentences in second person, pointing at what happened on specific posts.
   - evidence_posts: the post numbers the why refers to.
   - executions: two or three ways to do it. Each has format (reel, carousel, photo, story or text), idea (one or two sentences, concrete enough to start on today; one clear thing to make and where it goes, never two options that contradict each other) and effort (low, medium or high). At least one must be low.
   - key_date: the ISO date of the key date it serves, or null.
   - basis: "from_data" or "starting_point".
   - about_news: true only if the concept is about sharing a release, gig or announcement. At most two concepts should be about news; the artist needs things to post between announcements.

Respond with only this JSON, no commentary or code fences:
{"focus":"...","focus_why":"...","concepts":[{"title":"...","why":"...","evidence_posts":[1,3],"executions":[{"format":"reel","idea":"...","effort":"low"}],"key_date":null,"basis":"from_data","about_news":false}]}`.replace(
    /\n{3,}/g,
    "\n\n"
  );
}

function conceptLine(c: Concept): string {
  const ev = c.evidence_posts.length ? `posts ${c.evidence_posts.join(", ")}` : "no posts (starting point)";
  return `- "${c.title}" (${ev})`;
}

/**
 * Asks for one concept to replace a weak one in a draft. The rest of the
 * draft stays as it is, so the new one must differ from all of them.
 */
export function buildReplacementPrompt(
  ctx: ConceptContext,
  today: string,
  input: { focus: string; keep: Concept[]; replacing: Concept; note?: string }
): string {
  const base = buildConceptPrompt(ctx, today).split("## What to produce")[0];
  const note = input.note?.trim();
  return `${base}
## This time: replace one concept
This week's focus line is "${input.focus}". These concepts are staying on the list:
${input.keep.map(conceptLine).join("\n")}

This one is being replaced, so don't write it again or anything close to it:
${conceptLine(input.replacing)}
${note ? `\nWhat the Tempo team wants instead (follow it): "${clip(note, 1000)}"\n` : ""}
Write ONE new concept that's a genuinely different direction from all of the above. Prefer evidence posts the staying concepts don't already cite. Same fields and rules as always: title (at most 55 characters), why, evidence_posts, two or three executions with at least one low effort, key_date, basis, about_news.

Respond with only this JSON, no commentary or code fences:
{"concept":{"title":"...","why":"...","evidence_posts":[1],"executions":[{"format":"photo","idea":"...","effort":"low"}],"key_date":null,"basis":"from_data","about_news":false}}`.replace(
    /\n{3,}/g,
    "\n\n"
  );
}
