"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, type AccountType } from "@/lib/account-types";
import type { SetupState } from "@/lib/admin-setup";

type StepId = "type" | "instagram" | "posts" | "concepts" | "images" | "dates" | "ideas" | "live";
type StepStatus = "done" | "todo" | "running" | "blocked" | "failed";

async function call(artistId: string, action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch("/api/admin/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ artist_id: artistId, action, ...extra }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; note?: string | null; state?: SetupState | null };
  return { ok: res.ok, ...json };
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Mark({ status }: { status: StepStatus }) {
  const base = "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold";
  if (status === "done") return <span className={`${base} bg-brand text-white`} aria-label="Done">✓</span>;
  if (status === "running")
    return <span className={`${base} animate-pulse border-2 border-brand`} aria-label="Running" />;
  if (status === "failed") return <span className={`${base} bg-red-800 text-white`} aria-label="Failed">!</span>;
  return <span className={`${base} border-2 border-card-border`} aria-label={status === "blocked" ? "Waiting" : "To do"} />;
}

/**
 * One account's setup as a checklist. "Run setup" works through the steps
 * that need no input, pauses at Dates, then writes the first week of ideas
 * for review. Publishing is always a deliberate click.
 */
export function SetupPanel({ artistId, onTypeChange }: { artistId: string; onTypeChange?: (t: AccountType) => void }) {
  const [state, setState] = useState<SetupState | null>(null);
  const [running, setRunning] = useState<StepId | null>(null);
  const [notes, setNotes] = useState<Partial<Record<StepId, string>>>({});
  const [failed, setFailed] = useState<Partial<Record<StepId, string>>>({});
  const [tourUrl, setTourUrl] = useState("");
  const [autoRun, setAutoRun] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void call(artistId, "status").then((r) => {
      if (!alive.current) return;
      if (r.state) {
        setState(r.state);
        setTourUrl(r.state.dates.tourPageUrl ?? "");
      } else setFailed({ type: r.error ?? "Couldn't load" });
    });
    return () => {
      alive.current = false;
    };
  }, [artistId]);

  const run = useCallback(
    async (step: StepId, action: string, extra: Record<string, unknown> = {}): Promise<SetupState | null> => {
      setRunning(step);
      setFailed((f) => ({ ...f, [step]: undefined }));
      const r = await call(artistId, action, extra);
      if (!alive.current) return null;
      setRunning(null);
      if (r.state) setState(r.state);
      if (!r.ok) {
        setFailed((f) => ({ ...f, [step]: r.error ?? "Something went wrong" }));
        return null;
      }
      if (r.note) setNotes((n) => ({ ...n, [step]: r.note ?? undefined }));
      return r.state ?? null;
    },
    [artistId]
  );

  /** Works through every step that needs no input, stopping at Dates. */
  const runSetup = useCallback(
    async (from: SetupState) => {
      setAutoRun(true);
      let s: SetupState | null = from;
      if (s && s.instagram && s.posts.count === 0) s = await run("posts", "posts");
      if (s && s.posts.count > 0 && s.concepts.names.length === 0) s = await run("concepts", "concepts");
      // Two batches of images is enough to go on; the sync does the rest.
      for (let i = 0; s && i < 2 && s.images.described < Math.min(s.images.total, 16); i++) {
        s = await run("images", "images");
      }
      if (s && s.dates.done && s.getsIdeas && !s.draft && !s.live) s = await run("ideas", "ideas");
      if (alive.current) setAutoRun(false);
    },
    [run]
  );

  if (!state) {
    return (
      <div className="rounded-xl bg-background p-4 text-sm text-muted">
        {failed.type ? <span className="font-semibold text-red-800">{failed.type}</span> : "Checking where they are…"}
      </div>
    );
  }

  const s = state;
  const status = (id: StepId, done: boolean, needs: boolean): StepStatus =>
    running === id ? "running" : failed[id] ? "failed" : done ? "done" : needs ? "todo" : "blocked";

  const steps: { id: StepId; title: string; st: StepStatus; body: React.ReactNode }[] = [
    {
      id: "type",
      title: "Account type",
      st: "done",
      body: (
        <select
          aria-label="Account type"
          value={s.accountType}
          onChange={async (e) => {
            const next = e.target.value as AccountType;
            const res = await fetch("/api/admin/update-artist", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ artist_id: artistId, account_type: next }),
            });
            if (res.ok) {
              onTypeChange?.(next);
              const r = await call(artistId, "status");
              if (r.state) setState(r.state);
            }
          }}
          className="min-h-9 rounded-lg border border-card-border bg-card px-2 text-sm"
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      ),
    },
    {
      id: "instagram",
      title: "Instagram connected",
      st: s.instagram ? "done" : "todo",
      body: s.instagram ? (
        <span className="text-muted">@{s.handle ?? "connected"}</span>
      ) : (
        <span className="text-muted">
          Not connected. Add them through{" "}
          <Link href="/accounts/import" className="font-semibold text-brand hover:underline">
            Facebook Business
          </Link>
          , or ask them to connect in Settings.
        </span>
      ),
    },
    {
      id: "posts",
      title: "Pull their posts",
      st: status("posts", s.posts.count > 0, s.instagram),
      body: (
        <span className="text-muted">
          {s.posts.count > 0 ? `${s.posts.count} posts, last synced ${ago(s.posts.lastSynced)}` : "Last 60 posts and their results."}
          {notes.posts ? ` · ${notes.posts}` : ""}
          {s.posts.count > 0 && running !== "posts" ? (
            <button type="button" onClick={() => void run("posts", "posts")} className="ml-2 font-semibold text-brand hover:underline">
              Sync again
            </button>
          ) : null}
        </span>
      ),
    },
    {
      id: "concepts",
      title: "Sort into concepts",
      st: status("concepts", s.concepts.names.length > 0, s.posts.count > 0),
      body: (
        <span className="text-muted">
          {s.concepts.names.length > 0 ? s.concepts.names.join(" · ") : "Suggests their starting concepts from what they post."}
        </span>
      ),
    },
    {
      id: "images",
      title: "Read post images",
      st: status("images", s.images.described > 0, s.posts.count > 0),
      body: (
        <span className="text-muted">
          {s.images.described > 0
            ? `${s.images.described} of ${s.images.total} described${s.images.described < s.images.total ? ", the rest carry on with each sync" : ""}`
            : "Short descriptions of each post, used for shot lists and ideas."}
        </span>
      ),
    },
    {
      id: "dates",
      title: "Dates",
      st: status("dates", s.dates.done, s.posts.count > 0),
      body: (
        <div className="flex flex-col gap-2">
          <span className="text-muted">
            {s.dates.done
              ? `${s.dates.upcoming} upcoming${s.dates.waiting ? `, ${s.dates.waiting} waiting to add` : ""}${
                  s.dates.tourPageUrl ? " · tour page set" : ""
                }`
              : "Reads their recent captions for dates, plus their tour or events page if they have one."}
            {notes.dates ? ` · ${notes.dates}` : ""}
            {s.dates.done && running !== "dates" ? (
              <button type="button" onClick={() => void run("dates", "dates")} className="ml-2 font-semibold text-brand hover:underline">
                Look again
              </button>
            ) : null}
          </span>
          {s.dates.waiting > 0 ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-card-border bg-card p-3">
              <ul className="flex flex-col gap-0.5">
                {s.dates.waitingList.map((w, n) => (
                  <li key={n}>
                    <span className="text-muted">
                      {new Date(w.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    </span>{" "}
                    <span className="font-semibold text-foreground">{w.title}</span>
                  </li>
                ))}
                {s.dates.waiting > s.dates.waitingList.length ? (
                  <li className="text-muted">and {s.dates.waiting - s.dates.waitingList.length} more</li>
                ) : null}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={running !== null}
                  onClick={() => void run("dates", "add_dates")}
                  className="min-h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-ink-foreground disabled:opacity-50"
                >
                  Add all {s.dates.waiting}
                </button>
                <span className="self-center text-xs text-muted">Or pick them one by one on their Dates page.</span>
              </div>
            </div>
          ) : null}
          {!s.dates.done || s.dates.tourPageUrl ? (
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const next = await run("dates", "dates", { tour_page_url: tourUrl });
                if (next && autoRun === false && next.getsIdeas && !next.draft && !next.live) void runSetup(next);
              }}
            >
              <input
                value={tourUrl}
                onChange={(e) => setTourUrl(e.target.value)}
                aria-label="Tour page link"
                placeholder="e.g. maxcooper.net/event"
                className="min-h-9 min-w-0 flex-[1_1_200px] rounded-lg border border-card-border bg-card px-2 text-sm"
              />
              <button type="submit" disabled={running !== null} className="min-h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-ink-foreground disabled:opacity-50">
                {s.dates.tourPageUrl ? "Read again" : "Read it"}
              </button>
              {!s.dates.done ? (
                <button
                  type="button"
                  disabled={running !== null}
                  onClick={async () => {
                    const next = await run("dates", "dates");
                    if (next && next.getsIdeas && !next.draft && !next.live) void runSetup(next);
                  }}
                  className="min-h-9 px-2 text-sm font-semibold text-muted hover:text-foreground disabled:opacity-50"
                >
                  Skip
                </button>
              ) : null}
            </form>
          ) : null}
        </div>
      ),
    },
  ];

  if (s.getsIdeas) {
    steps.push({
      id: "ideas",
      title: "First week of ideas",
      st: status("ideas", Boolean(s.draft) || s.live, s.concepts.names.length > 0 && s.dates.done),
      body: (
        <span className="text-muted">
          {s.live
            ? "Their board is running."
            : s.draft
              ? `Draft written ${ago(s.draft.createdAt)}.`
              : "Writes their first week from their posts, concepts and dates."}
          {s.draft && !s.live && running !== "ideas" ? (
            <button type="button" onClick={() => void run("ideas", "ideas")} className="ml-2 font-semibold text-brand hover:underline">
              Write again
            </button>
          ) : null}
        </span>
      ),
    });
    steps.push({
      id: "live",
      title: "Go live",
      st: s.live ? "done" : s.draft ? "todo" : "blocked",
      body: s.live ? (
        <span className="text-muted">{published ?? "Live. New weeks arrive every Monday."}</span>
      ) : s.draft ? (
        <div className="flex flex-col gap-3">
          {s.draft.focus ? <p className="text-foreground">Focus: {s.draft.focus}</p> : null}
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            {s.draft.ideas.map((i, n) => (
              <li key={n}>
                <span className="font-semibold text-foreground">{i.title}</span>
                {i.why ? <span className="block text-muted">{i.why}</span> : null}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted">The first three go on their board; the rest wait in the pool.</p>
          <div className="flex flex-wrap gap-2">
            {[
              { notify: false, label: "Publish" },
              { notify: true, label: "Publish and email them" },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                disabled={publishing}
                onClick={async () => {
                  setPublishing(true);
                  setFailed((f) => ({ ...f, live: undefined }));
                  const res = await fetch("/api/admin/publish-concepts", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ generation_id: s.draft!.generationId, notify: b.notify }),
                  });
                  const json = (await res.json().catch(() => ({}))) as { error?: string; emailed?: boolean };
                  setPublishing(false);
                  if (!res.ok) {
                    setFailed((f) => ({ ...f, live: json.error ?? "Couldn't publish" }));
                    return;
                  }
                  setPublished(json.emailed ? "Live, and the “Your week” email has gone." : "Live. No email sent.");
                  const r = await call(artistId, "status");
                  if (r.state) setState(r.state);
                }}
                className={
                  b.notify
                    ? "min-h-10 rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:bg-card disabled:opacity-50"
                    : "min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground disabled:opacity-50"
                }
              >
                {publishing ? "Publishing…" : b.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <span className="text-muted">Once the first week is written you can read it here before it goes out.</span>
      ),
    });
  }

  const pending =
    s.instagram &&
    (s.posts.count === 0 ||
      s.concepts.names.length === 0 ||
      s.images.described === 0 ||
      (s.getsIdeas && s.dates.done && !s.draft && !s.live));

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {s.getsIdeas
            ? "Runs every step it can, stops at Dates, then writes the first week for you to read."
            : `${ACCOUNT_TYPE_LABEL[s.accountType]} accounts are watched: posts, concepts and learnings, no weekly ideas.`}
        </p>
        {pending ? (
          <button
            type="button"
            disabled={running !== null || autoRun}
            onClick={() => void runSetup(s)}
            className="min-h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground disabled:opacity-50"
          >
            {autoRun ? "Running…" : "Run setup"}
          </button>
        ) : null}
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.id} className="flex gap-3 text-sm">
            <Mark status={step.st} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">{step.title}</p>
              <div className="mt-0.5">{step.body}</div>
              {failed[step.id] ? (
                <p role="alert" className="mt-1 font-semibold text-red-800">
                  {failed[step.id]}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
