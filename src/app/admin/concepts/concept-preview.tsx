"use client";

import { useState } from "react";
import type { ConceptExecution, ContextPost, GenerateResult } from "@/lib/concepts/types";
import type { DraftConcept, DraftView } from "@/lib/concepts/edit";

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

type PreviewResponse = DraftView;

type ConceptEdit = { title: string; why: string; executions: ConceptExecution[] };

const FORMATS: ConceptExecution["format"][] = ["reel", "carousel", "photo", "story", "text"];
const EFFORTS: ConceptExecution["effort"][] = ["low", "medium", "high"];

const smallBtn =
  "rounded-md border border-card-border px-2.5 py-1 text-xs font-semibold text-muted-strong hover:border-foreground/40 hover:text-foreground disabled:opacity-40";
const inputClass =
  "w-full rounded-lg border border-card-border bg-input px-3 py-2 text-base text-foreground sm:text-sm";

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
          <span className="rounded-full bg-sky-400/15 px-2 py-0.5 font-bold text-sky-800">
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
  isFirst,
  isLast,
  editable,
  busy,
  onSave,
  onMove,
  onReplace,
}: {
  concept: DraftConcept;
  posts: ContextPost[];
  onBoard: boolean;
  isFirst: boolean;
  isLast: boolean;
  editable: boolean;
  /** Any action on the draft is running; this card's own, if it's "replace". */
  busy: string | null;
  onSave: (edit: ConceptEdit) => Promise<boolean>;
  onMove: (direction: "up" | "down") => void;
  onReplace: (note: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "replace">("view");
  const [form, setForm] = useState<ConceptEdit>({
    title: concept.title,
    why: concept.why,
    executions: concept.executions,
  });
  const [note, setNote] = useState("");

  const cited = concept.evidence_posts
    .map((n) => posts.find((p) => p.n === n))
    .filter((p): p is ContextPost => !!p);
  const replacing = busy === `replace:${concept.id}`;

  function startEdit() {
    setForm({ title: concept.title, why: concept.why, executions: concept.executions });
    setMode("edit");
  }

  function setExecution(i: number, patch: Partial<ConceptExecution>) {
    setForm((f) => ({
      ...f,
      executions: f.executions.map((e, j) => (j === i ? { ...e, ...patch } : e)),
    }));
  }

  return (
    <article
      className={`flex min-w-0 flex-col rounded-xl border bg-card p-5 ${replacing ? "border-brand/50 opacity-60" : "border-card-border"}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-widest">
        <span className={onBoard ? "text-brand" : "text-muted"}>
          {onBoard ? "On the board" : "Spare"}
        </span>
        {concept.basis === "starting_point" && (
          <span className="text-amber-800">Starting point</span>
        )}
        {concept.about_news && <span className="text-sky-800">About news</span>}
        {concept.key_date && (
          <span className="text-sky-800">For {concept.key_date}</span>
        )}
      </div>

      {mode === "edit" ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onSave(form)) setMode("view");
          }}
        >
          <label className="block text-xs font-semibold text-muted">
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={80}
              className={`mt-1 ${inputClass} font-bold`}
            />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Why (the artist sees this)
            <textarea
              value={form.why}
              onChange={(e) => setForm({ ...form, why: e.target.value })}
              maxLength={600}
              rows={4}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <p className="text-xs font-semibold text-muted">Ways to do it (clear a box to remove it)</p>
          {form.executions.map((ex, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-card-border p-3">
              <div className="flex gap-2">
                <select
                  value={ex.format}
                  onChange={(e) => setExecution(i, { format: e.target.value as ConceptExecution["format"] })}
                  className="rounded-md border border-card-border bg-input px-2 py-1 text-base text-foreground sm:text-xs"
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <select
                  value={ex.effort}
                  onChange={(e) => setExecution(i, { effort: e.target.value as ConceptExecution["effort"] })}
                  className="rounded-md border border-card-border bg-input px-2 py-1 text-base text-foreground sm:text-xs"
                >
                  {EFFORTS.map((f) => (
                    <option key={f} value={f}>{f} effort</option>
                  ))}
                </select>
              </div>
              <textarea
                value={ex.idea}
                onChange={(e) => setExecution(i, { idea: e.target.value })}
                maxLength={400}
                rows={3}
                className={inputClass}
              />
            </div>
          ))}
          {form.executions.length < 3 && (
            <button
              type="button"
              onClick={() =>
                setForm({ ...form, executions: [...form.executions, { format: "photo", idea: "", effort: "low" }] })
              }
              className={smallBtn}
            >
              Add a way
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!!busy}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-brand-foreground disabled:opacity-50"
            >
              {busy === `save:${concept.id}` ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setMode("view")} className={smallBtn}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="mt-2 text-lg font-bold text-foreground">{concept.title}</h3>
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
        </>
      )}

      {mode === "replace" && (
        <form
          className="mt-4 space-y-2 rounded-lg border border-card-border p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onReplace(note)) {
              setNote("");
              setMode("view");
            }
          }}
        >
          <label className="block text-xs font-semibold text-muted">
            What should the new idea do differently? (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="e.g. something about the new single, no talking to camera"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!!busy}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-brand-foreground disabled:opacity-50"
            >
              {replacing ? "Writing a new idea…" : "Replace this idea"}
            </button>
            <button type="button" onClick={() => setMode("view")} disabled={replacing} className={smallBtn}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {cited.length > 0 && mode !== "edit" && (
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

      {editable && mode === "view" && (
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <button type="button" onClick={startEdit} disabled={!!busy} className={smallBtn}>
            Edit
          </button>
          <button type="button" onClick={() => setMode("replace")} disabled={!!busy} className={smallBtn}>
            Replace
          </button>
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={!!busy || isFirst}
            className={smallBtn}
            aria-label="Move earlier"
            title="Move earlier (the first three go on the board)"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={!!busy || isLast}
            className={smallBtn}
            aria-label="Move later"
            title="Move later"
          >
            →
          </button>
        </div>
      )}
    </article>
  );
}

function FocusEditor({
  focus,
  busy,
  onSave,
  onCancel,
}: {
  focus: string;
  busy: boolean;
  onSave: (focus: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(focus);
  return (
    <form
      className="mt-2 flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={120}
        className={`${inputClass} text-lg font-bold`}
        autoFocus
      />
      <div className="flex shrink-0 gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-brand-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className={smallBtn}>
          Cancel
        </button>
      </div>
    </form>
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
  const [busy, setBusy] = useState<string | null>(null);
  const [editingFocus, setEditingFocus] = useState(false);
  const [redoNote, setRedoNote] = useState("");

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
      // Load the saved draft so it can be edited.
      const r = { ...(await fetchDraft(json.generation_id)), ms: Number(json.ms ?? 0) };
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

  async function fetchDraft(generationId: string): Promise<PreviewResponse> {
    const res = await fetch(`/api/admin/drafts?generation_id=${generationId}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
    return json as PreviewResponse;
  }

  /** Runs an edit on the open draft and shows the updated version. */
  async function draftAction(key: string, body: Record<string, unknown>): Promise<boolean> {
    if (!result) return false;
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ generation_id: result.generation_id, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      setResult({ ...(json as PreviewResponse), ms: result.ms });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function loadDraft(d: PendingDraft) {
    setLoading(true);
    setError(null);
    setResult(null);
    setPublishedId(null);
    setArtistId(d.artistId);
    try {
      const r = await fetchDraft(d.generationId);
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
  const editable =
    !!result && result.status === "draft" && publishedId !== result.generation_id;

  return (
    <div className="mt-8">
      {drafts.length > 0 && (
        <section className="mb-8 rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-800">
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

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {result && ctx && (
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-card-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">
              Focus line
            </p>
            {editingFocus ? (
              <FocusEditor
                focus={result.pool.focus}
                busy={busy === "focus"}
                onCancel={() => setEditingFocus(false)}
                onSave={async (focus) => {
                  if (await draftAction("focus", { action: "focus", focus })) setEditingFocus(false);
                }}
              />
            ) : (
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <p className="text-xl font-bold text-foreground">{result.pool.focus}</p>
                {editable && (
                  <button
                    type="button"
                    onClick={() => setEditingFocus(true)}
                    disabled={!!busy}
                    className={smallBtn}
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
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
                    disabled={publishing || !!busy}
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
                <p className="mt-3 text-sm font-semibold text-amber-800">
                  This audit is over a month old, so recent posts are missing. Refresh the audit before publishing.
                </p>
              )}
            {result.warnings.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-xs text-amber-800">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            {result.notes.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted">
                {result.notes.map((n, i) => (
                  <li key={i}>
                    Your note ({n.action}, {formatWhen(n.at)}): &ldquo;{n.note}&rdquo;
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <details className="mt-4 rounded-lg border border-card-border p-3" open={busy === "regenerate" || undefined}>
                <summary className="cursor-pointer text-sm font-semibold text-muted-strong">
                  Redo the whole draft
                </summary>
                <form
                  className="mt-3 space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await draftAction("regenerate", { action: "regenerate", note: redoNote })) {
                      setRedoNote("");
                      setEditingFocus(false);
                    }
                  }}
                >
                  <label className="block text-xs font-semibold text-muted">
                    What should change? (optional, but it helps)
                    <textarea
                      value={redoNote}
                      onChange={(e) => setRedoNote(e.target.value)}
                      maxLength={1000}
                      rows={2}
                      placeholder="e.g. less about photographers, they've got a single out on the 24th"
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={!!busy}
                      className="rounded-lg border border-brand px-3 py-1.5 text-sm font-bold text-brand disabled:opacity-50"
                    >
                      {busy === "regenerate" ? "Redoing… (up to a minute)" : "Redo with this note"}
                    </button>
                    <span className="text-xs text-muted">Replaces every idea in this draft. Uses the latest posts.</span>
                  </div>
                </form>
              </details>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {result.pool.concepts.map((c, i) => (
              <ConceptCard
                // Remount after a replace or redo so edit forms start from the new text.
                key={`${c.id}:${c.title}:${c.why}`}
                concept={c}
                posts={ctx.posts}
                onBoard={i < BOARD_SLOTS}
                isFirst={i === 0}
                isLast={i === result.pool.concepts.length - 1}
                editable={editable}
                busy={busy}
                onSave={(edit) => draftAction(`save:${c.id}`, { action: "edit", concept_id: c.id, ...edit })}
                onMove={(direction) => draftAction(`move:${c.id}`, { action: "move", concept_id: c.id, direction })}
                onReplace={(note) => draftAction(`replace:${c.id}`, { action: "replace", concept_id: c.id, note })}
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
