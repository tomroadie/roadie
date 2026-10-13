import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { loadRoster } from "@/lib/roster";
import { openRosterArtist } from "./actions";
import { RosterEditor, type PickableArtist } from "./roster-editor";

const AVATAR = ["#2F4A3A", "#5A3A2A", "#3A3F5C", "#4A2E3C", "#2A4650", "#454A2C", "#5C4630", "#3E3550"];

function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "")).toUpperCase() || "·";
}

function colour(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR[h % AVATAR.length];
}

function day(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * A manager's roster: this week across their artists, who needs a nudge,
 * what's coming up, and what's working across them. Admins can open any
 * roster (that's the preview); managers will see their own.
 */
export default async function RosterPage({ searchParams }: { searchParams: Promise<{ id?: string; edit?: string }> }) {
  const { id: idParam, edit } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createServiceRoleClient();
  const isAdmin = await userIsAdmin(supabase, user.id);
  const { data: memberships } = await admin.from("roster_members").select("roster_id").eq("user_id", user.id);
  const { data: rosters } = isAdmin
    ? await admin.from("rosters").select("id, name").order("created_at")
    : await admin
        .from("rosters")
        .select("id, name")
        .in("id", (memberships ?? []).map((m) => String(m.roster_id)))
        .order("created_at");
  if (!isAdmin && (rosters ?? []).length === 0) redirect("/home");

  const current = (rosters ?? []).find((r) => String(r.id) === idParam) ?? (rosters ?? [])[0] ?? null;

  // Artists an admin can put on a roster: every account with a name.
  let pickable: PickableArtist[] = [];
  let selected: string[] = [];
  if (isAdmin) {
    const { data: all } = await admin.from("profiles").select("id, artist_name, is_managed, account_type").order("artist_name");
    pickable = (all ?? [])
      .filter((p) => String(p.artist_name ?? "").trim())
      .map((p) => ({ id: String(p.id), name: String(p.artist_name), managed: p.is_managed === true, type: String(p.account_type ?? "artist") }));
    if (current) {
      const { data: links } = await admin.from("roster_artists").select("artist_id").eq("roster_id", current.id);
      selected = (links ?? []).map((l) => String(l.artist_id));
    }
  }

  const view = current ? await loadRoster(admin, String(current.id)) : null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-8">
      <AppNavWrapper />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Roster{view ? ` · ${view.rows.length} ${view.rows.length === 1 ? "artist" : "artists"}` : ""}
            {isAdmin ? " · admin preview" : ""}
          </p>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{view?.name ?? "Rosters"}</h1>
        </div>
        {(rosters ?? []).length > 1 ? (
          <nav aria-label="Rosters" className="flex flex-wrap gap-2">
            {(rosters ?? []).map((r) => (
              <Link
                key={String(r.id)}
                href={`/roster?id=${r.id}`}
                aria-current={current && r.id === current.id ? "page" : undefined}
                className={`min-h-9 rounded-full px-3 pt-1.5 text-sm font-semibold ${
                  current && r.id === current.id ? "bg-ink text-ink-foreground" : "border border-card-border text-foreground"
                }`}
              >
                {String(r.name)}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      {!current ? (
        <div className="mt-6 max-w-2xl">
          <RosterEditor
            mode="create"
            artists={pickable}
            selected={pickable.filter((a) => a.managed).map((a) => a.id)}
            defaultName="Roadie Media"
          />
        </div>
      ) : view ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-ink p-5 text-ink-foreground">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-70">Posts this week</p>
              <p className="mt-2 font-display text-4xl font-bold">
                {view.totals.posted} of {view.totals.target}
              </p>
              <p className="mt-2 text-sm opacity-70">Across live artists, each on their own week</p>
            </div>
            <div className="rounded-2xl border border-card-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">On pace</p>
              <p className="mt-2 font-display text-4xl font-bold text-foreground">
                {view.totals.onPace} of {view.totals.counted}
              </p>
              <p className="mt-2 text-sm text-muted">artists where they should be by today</p>
            </div>
            <div className="rounded-2xl border border-card-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Coming up</p>
              {view.comingUp[0] ? (
                <>
                  <p className="mt-2 text-xl font-bold leading-snug text-foreground">
                    {view.comingUp[0].artist}: {view.comingUp[0].title}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {day(view.comingUp[0].date)}
                    {view.comingUp.length > 1 ? ` · ${view.comingUp.length - 1} more in the next 4 weeks` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">No dates in the next 4 weeks.</p>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-start gap-7">
            <section aria-labelledby="artists-heading" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="artists-heading" className="text-xl font-bold text-foreground">
                  Artists
                </h2>
                <span className="text-sm text-muted">Who needs you first</span>
              </div>
              {view.rows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-card-border bg-card p-5 text-sm text-muted">
                  No artists on this roster yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {view.rows.map((r) => {
                    const pct = r.target ? Math.min(100, Math.round((r.posted / r.target) * 100)) : 0;
                    const bar = r.quiet || !r.live ? "bg-muted/40" : r.onPace ? "bg-brand" : r.attention >= 3 ? "bg-quiet" : "bg-amber-600";
                    return (
                      <li key={r.artistId} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-card-border bg-card px-4 py-3.5">
                        <span
                          aria-hidden="true"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ backgroundColor: colour(r.artistId) }}
                        >
                          {initials(r.name)}
                        </span>
                        <div className="min-w-0 flex-[1_1_220px]">
                          <p className="font-semibold text-foreground">
                            {r.name}
                            {r.typeLabel ? <span className="ml-2 text-xs font-semibold text-muted">{r.typeLabel}</span> : null}
                          </p>
                          <p className="text-sm text-muted">{r.status}</p>
                        </div>
                        <div className="w-40 shrink-0">
                          {r.target && r.live ? (
                            <>
                              <p className="text-sm text-muted">
                                {r.quiet ? "Quiet week" : `${r.posted} of ${r.target} posts`}
                              </p>
                              <div className="mt-1.5 h-2 rounded-full bg-input" role="img" aria-label={`${r.posted} of ${r.target} posts this week`}>
                                <div className={`h-2 rounded-full ${bar}`} style={{ width: `${r.quiet ? 0 : pct}%` }} />
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted">{r.live ? `${r.posted} this week` : "Not live"}</p>
                          )}
                        </div>
                        <div className="w-36 shrink-0 text-sm">
                          <p className="text-muted">Next date</p>
                          <p className="truncate font-semibold text-foreground">
                            {r.nextDate ? `${day(r.nextDate.date)}` : "None yet"}
                          </p>
                        </div>
                        <form action={openRosterArtist} className="ml-auto">
                          <input type="hidden" name="artistId" value={r.artistId} />
                          <input type="hidden" name="rosterId" value={view.id} />
                          <button type="submit" className="min-h-10 px-2 text-sm font-semibold text-brand hover:underline">
                            View
                          </button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
              <h2 className="text-xl font-bold text-foreground">Across the roster</h2>
              {view.learnings.length > 0 ? (
                view.learnings.map((l) => (
                  <div key={l.title} className="rounded-2xl border border-card-border bg-card p-5">
                    <p className="font-semibold text-foreground">{l.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{l.body}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-card-border bg-card p-5 text-sm text-muted">
                  Patterns show here once something works for three or more of these artists.
                </p>
              )}

              {view.comingUp.length > 0 ? (
                <div className="rounded-2xl border border-card-border bg-card p-5">
                  <p className="font-semibold text-foreground">Coming up</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {view.comingUp.map((c, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-24 shrink-0 text-muted">{day(c.date)}</span>
                        <span className="min-w-0">
                          <span className="font-semibold text-foreground">{c.artist}</span>{" "}
                          <span className="text-muted">{c.title}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {isAdmin ? (
                edit ? (
                  <RosterEditor mode="update" rosterId={view.id} artists={pickable} selected={selected} defaultName={view.name} />
                ) : (
                  <Link href={`/roster?id=${view.id}&edit=1`} className="text-sm font-semibold text-brand hover:underline">
                    Edit roster
                  </Link>
                )
              ) : null}
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
