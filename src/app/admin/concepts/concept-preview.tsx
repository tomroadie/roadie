"use client";

import { useState } from "react";
import type {
  Concept,
  ContextPost,
  GenerateResult,
} from "@/lib/concepts/types";

export type PreviewArtist = {
  id: string;
  name: string;
  genre: string | null;
  hasAudit: boolean;
  boardEnabled: boolean;
  liveSince: string | null;
};

export type PendingDraft = {
  generationId: string;
  artistId: string;
  artistName: string;
  createdAt: string;
  kind?: "weekly" | "first";
};

type PreviewResponse = GenerateResult & {
  ms: number;
  generation_id: string;
  kind?: string;
  created_at?: string;
};

/** Audit scrapes over a month old miss recent posts. */
function isAuditStale(ctx: GenerateResult["context"]): boolean {
  return (
    ctx.postSource === "audit" &&
    !!ctx.auditCreatedAt &&
    Date.now() - Date.parse(ctx.auditCreatedAt) > 30 * 86400000
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const BOARD_SLOTS = 3;

function metricSummary(p: ContextPost): string {
  const parts: string[] = [];
  if (p.comments !== null) parts.push(`${p.comments} comments`);
  if (p.likes !== null) parts.push(`${p.likes} likes`);
  if (p.views !== null) parts.push(`${p.views} views`);
  if (p.reach !== null) parts.push(`${p.reach} reach`);
  if (p.saves !== null) parts.push(`${p.saves} saves`);
  return parts.join(" · ") || "no metrics";
}

function PostRef({ post }: { post: ContextPost }) {
  return (
    <li className="rounded-lg border border-card-border bg-input p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2 text-muted">
        <span className="font-bold text-foreground">Post {post.n}</span>
        {post.news && (
          <span className="rounded-full bg-sky-400/15 px-2 py-0.5 font-bold text-sky-300">
            news
          </span>
        )}
        {post.standout && (
          <span className="rounded-full bg-brand/15 px-2 py-0.5 font-bold text-brand">
            standout
          </span>
        )}
        <span>{post.date?.slice(0, 10) ?? "no date"}</span>
        <span>{post.type}</span>
        <span>{metricSummary(post)}</span>
      </div>
      <p className="mt-1 line-clamp-3 text-muted-strong">
        {post.caption || "(no caption)"}
      </p>
    </li>
  );
}

function ConceptCard({
  concept,
  posts,
  onBoard,
}: {
  concept: Concept;
  posts: ContextPost[];
  onBoard: boolean;
}) {
  const cited = concept.evidence_posts
    .map((n) => posts.find((p) => p.n === n))
    .filter((p): p is ContextPost => !!p);

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-card-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-widest">
        <span className={onBoard ? "text-brand" : "text-muted"}>
          {onBoard ? "On the board" : "Spare"}
        </span>
        {concept.basis === "starting_point" && (
          <span className="text-amber-300">Starting point</span>
        )}
        {concept.about_news && <span className="text-sky-300">About news</span>}
        {concept.key_date && (
          <span className="text-sky-300">For {concept.key_date}</span>
        )}
      </div>
      <h3 className="mt-2 text-lg font-bold text-foreground">
        {concept.title}
      </h3>
      <p className="mt-2 text-sm text-muted-strong">{concept.why}</p>

      <ul className="mt-4 space-y-2">
        {concept.executions.map((e, i) => (
          <li key={i} className="text-sm text-foreground">
            <span className="mr-2 inline-block rounded bg-input px-1.5 py-0.5 text-xs font-semibold uppercase text-muted">
              {e.format} · {e.effort}
            </span>
            {e.idea}
          </li>
        ))}
      </ul>

      {cited.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-muted">
            Check the evidence ({cited.length} post{cited.length === 1 ? "" : "s"})
          </summary>
          <ul className="mt-2 space-y-2">
            {cited.map((p) => (
              <PostRef key={p.n} post={p} />
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export function ConceptPreview({
  artists: initialArtists,
  pendingDrafts: initialDrafts,
}: {
  artists: PreviewArtist[];
  pendingDrafts: PendingDraft[];
}) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [notify, setNotify] = useState(false);
  const [artists, setArtists] = useState(initialArtists);
  const [artistId, setArtistId] = useState(initialArtists[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [auditStale, setAuditStale] = useState(false);

  const selected = artists.find((a) => a.id === artistId) ?? null;

  function updateArtist(id: string, patch: Partial<PreviewArtist>) {
    setArtists((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function adminPost(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/publish-concepts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
    return json;
  }

  async function publish() {
    if (!result) return;
    setPublishing(true);
    setError(null);
    try {
      const out = await adminPost({ generation_id: result.generation_id, notify });
      setPublishedId(result.generation_id);
      setDrafts((prev) => prev.filter((d) => d.generationId !== result.generation_id));
      if (notify && !out.emailed) {
        setError("Published, but the Your week email wasn't sent (emails paused, no address, or already sent today).");
      }
      updateArtist(result.context.artistId, {
        boardEnabled: true,
        liveSince: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  async function setBoard(enabled: boolean) {
    if (!selected) return;
    setError(null);
    try {
      await adminPost({ artist_id: selected.id, board_enabled: enabled });
      updateArtist(selected.id, { boardEnabled: enabled });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function run() {
    if (!artistId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPublishedId(null);
    try {
      const res = await fetch("/api/admin/preview-concepts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artist_id: artistId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      const r = json as PreviewResponse;
      setResult(r);
      setNotify(false);
      setAuditStale(
        isAuditStale(r.context)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDraft(d: PendingDraft) {
    setLoading(true);
    setError(null);
    setResult(null);
    setPublishedId(null);
    setArtistId(d.artistId);
    try {
      const res = await fetch(`/api/admin/drafts?generation_id=${d.generationId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      const r = json as PreviewResponse;
      setResult(r);
      // Weekly drafts and first ideas both tell the artist their board is ready.
      setNotify(r.kind === "weekly" || r.kind === "first");
      setAuditStale(
        isAuditStale(r.context)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const ctx = result?.context;

  return (
    <div className="mt-8">
      {drafts.length > 0 && (
        <section className="mb-8 rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            Waiting for review
          </p>
          <ul className="mt-3 space-y-2">
            {drafts.map((d) => (
              <li key={d.generationId} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-foreground">{d.artistName}</span>
                <span className="text-muted">
                  {d.kind === "first" ? "first ideas" : "weekly draft"}, {formatWhen(d.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => loadDraft(d)}
                  className="font-semibold text-brand underline underline-offset-2"
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={artistId}
          onChange={(e) => setArtistId(e.target.value)}
          className="rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground"
        >
          {artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.genre ? ` (${a.genre})` : ""}
              {a.hasAudit ? "" : " — no audit"}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={run}
          disabled={loading || !artistId}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground disabled:opacity-50"
        >
          {loading ? "Generating… (up to a minute)" : "Generate concepts"}
        </button>
      </div>

      {selected && (
        <p className="mt-3 text-xs text-muted">
          Board:{" "}
          {selected.boardEnabled ? (
            <span className="font-semibold text-brand">on</span>
          ) : (
            <span className="font-semibold text-muted-strong">off</span>
          )}
          {selected.liveSince ? ` · live ideas since ${formatWhen(selected.liveSince)}` : " · nothing published yet"}
          {" · "}
          <button
            type="button"
            onClick={() => setBoard(!selected.boardEnabled)}
            className="font-semibold text-muted-strong underline underline-offset-2 hover:text-foreground"
          >
            {selected.boardEnabled ? "switch off (back to weekly plan)" : "switch on"}
          </button>
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {result && ctx && (
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-card-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Focus line
            </p>
            <p className="mt-2 text-xl font-bold text-foreground">
              {result.pool.focus}
            </p>
            {result.pool.focus_why && (
              <p className="mt-2 text-sm text-muted">{result.pool.focus_why}</p>
            )}
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
              <div>
                Posts: {ctx.posts.length} ({ctx.postSource})
                {ctx.coldStart ? " · cold start" : ""}
              </div>
              <div>Last 4 weeks: {ctx.postsLast28Days}</div>
              <div>
                Last post:{" "}
                {ctx.daysSinceLastPost === null
                  ? "unknown"
                  : `${ctx.daysSinceLastPost} days ago`}
              </div>
              <div>Starting target: {ctx.weeklyTarget}/week</div>
              {ctx.postSource === "audit" && ctx.auditCreatedAt && (
                <div>Audit: {formatWhen(ctx.auditCreatedAt)}</div>
              )}
              <div>Key dates: {ctx.keyDates.length}</div>
              <div>
                {result.model} · attempt {result.attempts} ·{" "}
                {(result.ms / 1000).toFixed(1)}s
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {publishedId === result.generation_id ? (
                <span className="text-sm font-semibold text-brand">
                  Published. These are now on {selected?.name ?? "the artist"}&rsquo;s board.
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={publish}
                    disabled={publishing}
                    className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground disabled:opacity-50"
                  >
                    {publishing ? "Publishing…" : "Publish to board"}
                  </button>
                  <label className="flex items-center gap-2 text-xs text-muted-strong">
                    <input
                      type="checkbox"
                      checked={notify}
                      onChange={(e) => setNotify(e.target.checked)}
                    />
                    Send &ldquo;Your week&rdquo; email
                  </label>
                  <span className="text-xs text-muted">
                    {result.kind === "weekly" ? "Weekly draft" : result.kind === "first" ? "First ideas" : "Saved as a draft"}. Publishing replaces the current board; pinned ideas stay.
                  </span>
                </>
              )}
            </div>
            {auditStale && (
                <p className="mt-3 text-sm font-semibold text-amber-300">
                  This audit is over a month old, so recent posts are missing. Refresh the audit before publishing.
                </p>
              )}
            {result.warnings.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-xs text-amber-300">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {result.pool.concepts.map((c, i) => (
              <ConceptCard
                key={i}
                concept={c}
                posts={ctx.posts}
                onBoard={i < BOARD_SLOTS}
              />
            ))}
          </div>

          <details className="rounded-xl border border-card-border bg-card p-5">
            <summary className="cursor-pointer text-sm font-semibold text-muted">
              All {ctx.posts.length} posts the generator saw
            </summary>
            <ul className="mt-3 space-y-2">
              {ctx.posts.map((p) => (
                <PostRef key={p.n} post={p} />
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
