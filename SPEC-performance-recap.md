# Tempo — Performance Recap Loop

**Status:** Spec — adapted to existing schema, migration written, ready to build (step 2+)
**Goal:** Close the loop between planned content and actual results, so Tempo becomes a weekly scoreboard rather than a one-shot plan generator. This is the core retention feature.

---

## 0. Reality check (read this first)

The original draft of this spec assumed a clean-slate schema (`plan_items`, `post_metrics`, `user_id`-scoped RLS, daily snapshot history). Most of that doesn't match what's actually built. This version is corrected against the real codebase as of 2026-07-17. Load-bearing differences:

- **There is no `plan_items` table.** A week's plan is one row in `weekly_plans` (`artist_id`, `week_start`, `ideas jsonb`). Each idea is a JSON object identified by its `hook` string, not a row id. `mark-as-posted` already writes `posted`, `posted_at`, and `instagram_post_id` fields *inside* that JSON object per idea — there's no separate FK-able row to hang `ig_media_id`/`matched_at` off of, so those live as JSON fields, not migrated columns.
- **Ownership is `artist_id → artists.owner_user_id`, not a direct `user_id` column.** `artists.id` is the same value as `profiles.id` (legacy: profile id was originally the user id, backfilled into `artists`). All RLS in this feature follows that indirection, matching every other table in the codebase.
- **`post_performance` already exists** and is now the metrics table for this feature (extended, not replaced by a new `post_metrics` table). It stores **one row per post, updated in place** on each sync — not a daily-snapshot history. There is no "day-7 final snapshot" concept; "final" metrics just means "latest synced values."
- **Mark-as-posted already exists** (`MarkAsPostedSection` in `weekly-plan-section.tsx` + `POST /api/mark-idea-posted`). It already shows a picker of recent Instagram posts (sourced from `post_performance`) and links an idea to one by `instagram_post_id`. This feature extends that flow; it doesn't replace it.
- **`sync-post-performance`** (existing daily-ish cron) fetches the artist's recent media via Graph API and computes `likes`/`comments`/`engagement_rate` — it does **not** currently call the Insights endpoint, so `reach`/`saves`/`shares`/`follows` are not populated yet. That's new work, not already done (see §12).
- **`reanalyse-performance`** (existing monthly cron) is a different feature — it writes AI commentary into `audits.ai_pattern_analysis`/`ai_full_analysis`, on a monthly cadence. It is not the weekly recap builder and is left alone.

The migration for §3 has already been written and applied to extend the real schema rather than the originally-drafted one: `supabase/migrations/20260717120000_performance_recap_loop.sql`.

---

## 1. Why this exists

Today, a weekly plan is a prediction with no result. Once delivered, the user has no reason to return until the next plan — and week 6's plan is no smarter than week 1's. This feature:

1. Pulls actual Instagram performance for posts the user marked as posted.
2. Compares each post to the user's own rolling baseline (per content type).
3. Sends a Monday recap email (the "scoreboard") before/alongside the new plan.
4. Injects the recap into the Monday plan-generation prompt so the new plan **cites evidence** ("two reels this week because BTS video did 2.4x your average").

After ~6 weeks a user has an accumulated performance history that makes leaving costly. That's the moat.

---

## 2. Existing pieces we build on

- Meta Graph API integration (already connected per-artist via `profiles.instagram_access_token` / `instagram_user_id`, used by the audit feature and `sync-post-performance`).
- `post_performance` table — existing metrics table, extended by this feature (see §3).
- Mark-as-posted flow — exists (`MarkAsPostedSection`, `/api/mark-idea-posted`), extended in §5.
- `sync-post-performance` cron — existing daily media sync; extended to also pull Insights metrics (§6a).
- `reanalyse-performance` cron — existing, separate monthly feature; not touched by this work.
- Email infrastructure via Resend (`src/lib/email.ts`); exact type-numbering scheme to be confirmed at implementation time rather than assumed.
- cron-job.org scheduled jobs (Friday check-in via `weekly-checkin`, Monday generation via `generate-weekly-plans`, already run this way).
- Monday plan generation via Anthropic API (`claude-sonnet-4-20514`, per `reanalyse-performance`'s usage — confirm exact model id used in `generate-weekly-plans` at implementation time).
- Supabase Postgres with RLS, scoped via `artists.owner_user_id = auth.uid()`.

---

## 3. Data model (Supabase migration — written, `20260717120000_performance_recap_loop.sql`)

Extends the real schema instead of introducing a parallel one.

```sql
-- post_performance: existing table, new columns for insight-derived metrics.
alter table public.post_performance add column if not exists ig_media_type text;
alter table public.post_performance add column if not exists reach integer;
alter table public.post_performance add column if not exists saves integer;
alter table public.post_performance add column if not exists shares integer;
alter table public.post_performance add column if not exists follows integer;
alter table public.post_performance add column if not exists raw jsonb not null default '{}'::jsonb;

create index if not exists post_performance_artist_post_date_idx
  on public.post_performance (artist_id, post_date desc);

-- Reconnect banner flag for expired/invalid Instagram tokens.
alter table public.profiles add column if not exists ig_token_stale boolean not null default false;

-- Rolling per-content-type baselines, recomputed weekly.
create table public.user_baselines (
  artist_id uuid not null references public.artists (id) on delete cascade,
  media_type text not null,
  window_days integer not null default 30,
  avg_reach numeric,
  avg_engagement numeric,
  post_count integer not null default 0,
  computed_at timestamptz not null default now(),
  primary key (artist_id, media_type)
);

-- One row per artist per week. The Monday email and plan prompt both read this.
create table public.weekly_recaps (
  id uuid default gen_random_uuid() primary key,
  artist_id uuid not null references public.artists (id) on delete cascade,
  week_start date not null,
  summary jsonb not null,
  insight_text text,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (artist_id, week_start)
);
```

RLS on `user_baselines` and `weekly_recaps` follows the codebase's existing pattern: `artist_id in (select id from artists where owner_user_id = auth.uid())` for `select`, plus a `service_role` full-access policy for cron writes (see `post_performance`, `plan_revision_requests` for the same shape).

No `plan_items` table is created. Idea identity for matching stays as it already is: `weekly_plans.ideas[].hook`.

---

## 4. Metric definitions

- **"Final" metrics for a post** = the latest synced row in `post_performance` for that `instagram_post_id` (there is no separate daily-snapshot history — `post_performance` is update-in-place).
- **Engagement** = likes + comments + saves + shares.
- **Baseline** = mean of reach / engagement across the artist's matched posts of the same `ig_media_type` in the last 30 days, minimum 3 posts.
- **"Still climbing" posts** — posts younger than 3 days at recap-build time: no multiplier is computed. The recap shows **absolute reach only**, flagged `"still_climbing": true` in the summary jsonb (see §7), and these posts are **excluded from baseline computation** (their numbers aren't settled yet and would skew the average low).
- **Stories** — untracked for metrics in v1. `sync-post-performance`'s `mapPostType()` stays as-is (stories map to `null`/are skipped for metric purposes). Stories still appear on the weekly scoreboard, but as **posted / not-posted only** — no reach, no engagement, no multiplier. This is a deliberate v1 scope cut, not a bug; revisit once story insights are worth the added Graph API calls.
- **Multiplier** = post reach ÷ baseline avg_reach, displayed to 1 decimal place ("2.4x avg"). Only computed for posts that are (a) not "still climbing" and (b) not a story.
  - ≥ 1.5x → success styling
  - 0.8x–1.5x → neutral
  - < 0.8x → warning styling (never red; underperformance is information, not failure)

---

## 5. Matching UX (already exists — this is the extension, not a new build)

Current flow (`MarkAsPostedSection` in `weekly-plan-section.tsx`, `POST /api/mark-idea-posted`):

1. User taps "Mark as posted" on an idea.
2. Picker shows recent posts already synced into `post_performance` for that artist (thumbnail/caption not currently shown — currently caption + engagement_rate + post_type + relative date; confirm whether a thumbnail grid is worth adding here, since Graph API media fields already include `thumbnail_url`/`media_url`).
3. Tap a post → writes `instagram_post_id` onto the matching idea inside `weekly_plans.ideas` (keyed by `hook`), or "Yes, I posted it" with no linked post.
4. `sync-post-performance`'s `linkPostsToPlanIdeas()` also auto-links unlinked `post_performance` rows to ideas via caption-substring match on `hook`, as a fallback/backfill for posts synced before the user manually links.

Extension needed for this feature: none structurally — the existing hook-based link is sufficient for pulling a post's metrics into the recap. Confirm the picker surfaces enough info (thumbnail) to make the "escape hatch" cases in the original draft (§5 of the old version: "posted as something else" / "skip — don't track this one") worth adding; not required for v1 since matching already works via the existing flow.

Edge case (unchanged from original draft): user deletes the IG post later → Graph API errors for that media id on next sync → mark that `post_performance` row (or the idea's link) as stale, stop syncing it, exclude from baselines.

---

## 6. Cron jobs

### 6a. Extend `sync-post-performance` — existing cron, add Insights fetch
Currently fetches `id,caption,media_type,timestamp,like_count,comments_count,thumbnail_url,media_url` from `/{ig-user-id}/media` and computes `engagement_rate` manually. Needs a new call per post to `GET /{ig-media-id}/insights?metric=reach,likes,comments,saves,shares` (metric set varies by media type — store what comes back; nulls elsewhere; full payload into the new `raw` column) and to populate the new `ig_media_type`/`reach`/`saves`/`shares`/`follows` columns on upsert.

Rate limiting / token handling: on expired token or repeated Graph errors for a profile, set `profiles.ig_token_stale = true` and skip — surface a reconnect banner in-app. Clear the flag on next successful sync.

### 6b. New: weekly recap build cron — Sunday, before Monday generation
`POST /api/cron/build-recaps` (new route)

For each artist with `instagram_user_id` set and `ig_token_stale = false`:

1. Recompute `user_baselines` (30-day window, per `ig_media_type`, min 3 posts, excluding "still climbing" posts per §4).
2. Gather last week's plan items (from `weekly_plans.ideas` for `week_start` = the week just ending) with their linked `post_performance` metrics (matched via `hook` → `instagram_post_id` → `post_performance` row).
3. Build `summary` jsonb (schema in §7) and pick the **headline**: highest multiplier post if any ≥ 1.2x; otherwise highest absolute reach; if nothing was posted, headline is null.
4. Generate `insight_text` with one Anthropic call (low max_tokens): input = last 4 weeks of `weekly_recaps.summary` rows; output = ONE sentence identifying the strongest pattern, plain text, no preamble. If < 2 weeks of data, skip generation and use the cold-start copy (§9).
5. Upsert into `weekly_recaps` on `(artist_id, week_start)` — idempotent, safe to re-run.

### 6c. Monday email — hook into the existing `generate-weekly-plans` cron
After plan generation succeeds for an artist, send the recap email using their `weekly_recaps` row for the prior week, then stamp `email_sent_at`. If the recap row is missing (new artist, job failure), send the plan email as today — the recap is additive, never blocking. Exact email-type/template wiring (numbering, Resend template id) to be confirmed against `src/lib/email.ts` at implementation time rather than assumed.

---

## 7. `weekly_recaps.summary` schema

```json
{
  "week_start": "2026-07-13",
  "planned_count": 4,
  "posted_count": 3,
  "streak_weeks": 4,
  "headline": {
    "idea_hook": "…",
    "title": "Studio B-roll reel",
    "media_type": "REEL",
    "reach": 12400,
    "multiplier": 2.4,
    "saves": 41,
    "still_climbing": false,
    "note": "Best post in 6 weeks"
  },
  "items": [
    {
      "idea_hook": "…",
      "title": "Studio B-roll reel",
      "media_type": "REEL",
      "day": "Tue",
      "posted": true,
      "reach": 12400,
      "engagement": 310,
      "multiplier": 2.4,
      "still_climbing": false
    },
    {
      "idea_hook": "…",
      "title": "Fan Q&A story set",
      "media_type": "STORY",
      "day": "Sun",
      "posted": true,
      "still_climbing": null
    },
    {
      "idea_hook": "…",
      "title": "Tour announce carousel",
      "media_type": "CAROUSEL_ALBUM",
      "day": "Fri",
      "posted": false
    }
  ],
  "format_trend": {
    "media_type": "REEL",
    "weeks_leading": 3
  }
}
```

Note: `idea_hook` replaces the original draft's `plan_item_id` — there is no row id to reference. Stories always carry `still_climbing: null` (not applicable, per §4) and never carry `reach`/`multiplier`.

`streak_weeks` = consecutive weeks with `posted_count >= 1`. Keep the bar low; the streak should be winnable.

---

## 8. Monday recap email

Structure top to bottom (unchanged from original intent):
1. **Win banner** — headline post + multiplier + one supporting stat. Skip section entirely if headline is null.
2. **Scoreboard** — one row per planned item: icon by media_type, title, day, reach, multiplier pill (or absolute reach + "still climbing" for posts <3 days old, or nothing for stories beyond posted/not-posted). Unposted items shown greyed with "not posted."
3. **Insight line** — `insight_text` + explicit bridge to this week's plan.
4. **Footer** — streak line + "See this week's plan" CTA.

Tone: coach, not analyst. Underperformance is neutral/warning-toned information, never failure language.

### In-app mirror
`WeeklyRecapCard` component, reads `weekly_recaps` directly, same visual hierarchy as the email, rendered at the top of the plan page (`weekly-plan-section.tsx` or a sibling).

---

## 9. Cold start (weeks 1–2)

No baseline yet (< 3 settled posts of a type in window):

- Multiplier pills → absolute reach numbers.
- Insight line → "We're building your baseline — comparisons unlock next week."
- Win banner → highest absolute reach post, no multiplier.

Same treatment applies to any individual post that's "still climbing" (§4), independent of whether the baseline itself exists yet.

---

## 10. Plan-prompt injection

In the Monday plan-generation Anthropic call (`generate-weekly-plans` / wherever the plan prompt is actually assembled — confirm file at implementation time), prepend:

```
PERFORMANCE CONTEXT (last 4 weeks):
{compact serialization of the last 4 weekly_recaps.summary rows}

When generating this week's plan:
- Weight content types by demonstrated performance for THIS artist.
- In the plan's intro/rationale, cite at least one specific result from last week
  by name and multiplier (e.g. "…because your studio B-roll reel did 2.4x your
  average reach"). Only cite real numbers from the context. If no performance
  context exists, say nothing about performance.
```

The citation requirement is the point — the user must *see* the product learning.

---

## 11. Edge cases & guardrails

- **Token expiry / IG disconnect** → `profiles.ig_token_stale = true`, reconnect banner, skip in crons, recap still sends with whatever data exists.
- **Zero posts in a week** → recap still sends: no win banner, scoreboard shows all items as not posted, insight line becomes a gentle restart nudge, streak resets. Never guilt language.
- **Posts <3 days old at recap build time** → "still climbing": absolute reach shown, no multiplier, excluded from baseline (§4).
- **Stories** → posted/not-posted only, no metrics, in v1 (§4).
- **Graph API metric drift** → metric availability varies by media type and changes over time; always store the raw payload in `post_performance.raw` and treat individual metrics as nullable.
- **Timezones** → no per-artist timezone column exists yet. Default to Europe/London for week boundaries (current user base is UK) until one is added.
- **Idempotency** → all crons upsert; re-running never duplicates rows or re-sends email (guard on `email_sent_at`).
- **RLS** → `user_baselines` and `weekly_recaps` are owner-scoped via `artists.owner_user_id` before any client code reads them (already applied in the migration).

---

## 12. Build order

1. ~~Migration: extend `post_performance`, add `profiles.ig_token_stale`, `user_baselines`, `weekly_recaps` + RLS + indexes.~~ **Done** — `20260717120000_performance_recap_loop.sql`, applied to the linked Supabase project.
2. Extend `sync-post-performance` to call the Insights endpoint and populate `ig_media_type`/`reach`/`saves`/`shares`/`follows`/`raw`. Verify against a real matched post for 3–4 days.
3. Weekly recap build cron (`build-recaps`): baselines (excluding still-climbing posts) + summary jsonb. Insight generation last.
4. `WeeklyRecapCard` in-app component.
5. Recap email + hook into `generate-weekly-plans`.
6. Plan-prompt injection.
7. Cold-start / still-climbing / story display states.

Step 2 is the risk (Graph API Insights behavior, metric availability per media type); do it first and let real data accumulate while building 3–7.

---

## 13. Out of scope (deliberately, for v1)

- Push notifications / daily "today's post" nudges.
- Story analytics beyond posted/not-posted (§4, §11).
- Cross-user benchmarks ("artists like you") — needs more users first.
- Follower growth attribution.
- Per-artist timezone storage (defaults to Europe/London for now).
