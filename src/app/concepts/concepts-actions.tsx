"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/themes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? "Something went wrong");
  }
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await post(body);
      after?.();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm font-semibold text-red-800">
      {error}
    </p>
  ) : null;
}

/** "Suggested by Tempo": add it or say no. */
export function SuggestedThemeActions({ themeId }: { themeId: string }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run({ action: "accept", theme_id: themeId })}
          className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90 disabled:opacity-50"
        >
          Add it
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run({ action: "dismiss", theme_id: themeId })}
          className="min-h-11 rounded-xl border border-card-border bg-card px-4 text-sm font-semibold text-foreground hover:border-muted disabled:opacity-50"
        >
          Not for me
        </button>
      </div>
      <ErrorLine error={error} />
    </div>
  );
}

/** Let a theme go. Its posts and ideas keep their history. */
export function ArchiveThemeButton({ themeId, name }: { themeId: string; name: string }) {
  const { busy, error, run } = useAction();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-10 px-2 text-sm font-semibold text-muted hover:text-foreground"
      >
        Let this one go
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-strong">Stop using &ldquo;{name}&rdquo;?</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => run({ action: "archive", theme_id: themeId }, () => router.push("/concepts"))}
        className="min-h-10 rounded-lg border border-card-border px-3 text-sm font-semibold text-foreground hover:border-muted disabled:opacity-50"
      >
        Yes, let it go
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-10 px-2 text-sm text-muted hover:text-foreground"
      >
        Keep it
      </button>
      <ErrorLine error={error} />
    </div>
  );
}

/** "Add a concept": the artist's own theme. */
export function AddThemeForm({ artistId }: { artistId: string }) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-xl border border-ink bg-card px-4 text-sm font-semibold text-foreground hover:bg-input"
      >
        Add a concept
      </button>
    );
  }

  return (
    <form
      className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-card-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        void run({ action: "add", artist_id: artistId, name, description }, () => {
          setName("");
          setDescription("");
          setOpen(false);
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          placeholder="e.g. Writing sessions"
          className="min-h-11 rounded-lg border border-card-border bg-background px-3 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
        What goes in it <span className="font-normal text-muted">(optional)</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          className="min-h-11 rounded-lg border border-card-border bg-background px-3 font-normal"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90 disabled:opacity-50"
        >
          Add concept
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 px-3 text-sm font-semibold text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      <ErrorLine error={error} />
    </form>
  );
}

export type ReviewPost = {
  id: string;
  thumbnailUrl: string | null;
  caption: string;
  dateLabel: string;
  themeId: string | null;
};

/** Confirm or change the concept Tempo picked for a recent post. */
export function PostThemeReview({
  posts,
  themes,
}: {
  posts: ReviewPost[];
  themes: { id: string; name: string }[];
}) {
  const { busy, error, run } = useAction();
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(posts.map((p) => [p.id, p.themeId ?? ""]))
  );

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {posts.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-card-border p-3">
            {p.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumbnailUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="h-14 w-14 shrink-0 rounded-lg bg-input" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-[1_1_180px]">
              <p className="text-xs text-muted">{p.dateLabel}</p>
              <p className="truncate text-sm text-foreground">{p.caption || "No caption"}</p>
            </div>
            <label className="sr-only" htmlFor={`theme-${p.id}`}>
              Concept for this post
            </label>
            <select
              id={`theme-${p.id}`}
              value={choice[p.id] ?? ""}
              onChange={(e) => setChoice((c) => ({ ...c, [p.id]: e.target.value }))}
              className="min-h-11 rounded-lg border border-card-border bg-background px-3 text-sm"
            >
              <option value="">None of these</option>
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run({ action: "tag_post", instagram_post_id: p.id, theme_id: choice[p.id] || null })
              }
              className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90 disabled:opacity-50"
            >
              {choice[p.id] === (p.themeId ?? "") ? "Looks right" : "Save"}
            </button>
          </li>
        ))}
      </ul>
      <ErrorLine error={error} />
    </div>
  );
}
