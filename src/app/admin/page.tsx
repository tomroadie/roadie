import { createClient } from "@/utils/supabase/server";
import { asAccountType } from "@/lib/account-types";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { AdminCreateClientArtistForm } from "./create-client-artist-form";
import {
  UsageAnalytics,
  type UsageAnalyticsRecentEvent,
} from "./usage-analytics";
import { ContentReviewsTable } from "./content-reviews-table";
import {
  AdminArtistsTable,
  type AdminArtistDirectoryRow,
} from "./admin-artists-table";
import {
  RevisionRequestsSection,
  type RevisionRequestRow,
} from "./revision-requests-section";
import {
  UserAccountsTable,
  type AdminUserAccountRow,
} from "./user-accounts-table";

function AdminPageError({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
        Admin
      </h1>
      <p className="mt-4 text-muted">
        Something went wrong loading this page. If this keeps happening, contact
        support.
      </p>
      <p className="mt-2 font-mono text-sm text-destructive">{message}</p>
    </div>
  );
}

type Tab = "artists" | "users" | "reviews" | "activity";
const TABS: { id: Tab; label: string }[] = [
  { id: "artists", label: "Artists" },
  { id: "users", label: "Users" },
  { id: "reviews", label: "Reviews" },
  { id: "activity", label: "Activity" },
];

/** Monday of this week in London, as YYYY-MM-DD. Outside render for lint. */
function londonMonday(): string {
  const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date()) + "T12:00:00Z");
  const back = (today.getUTCDay() + 6) % 7;
  today.setUTCDate(today.getUTCDate() - back);
  return today.toISOString().slice(0, 10);
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "artists";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let adminSupabase: ReturnType<typeof createServiceRoleClient>;
  try {
    adminSupabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <AdminPageError
        message={`Server configuration: ${msg}. Ensure SUPABASE_SERVICE_ROLE_KEY is set.`}
      />
    );
  }

  const { data: adminRow, error: adminCheckError } = await adminSupabase
    .from("profiles")
    .select("is_admin")
    .or(`owner_user_id.eq.${user.id},id.eq.${user.id}`)
    .eq("is_admin", true)
    .limit(1)
    .maybeSingle();

  if (adminCheckError) {
    return (
      <AdminPageError message={`Could not verify admin access: ${adminCheckError.message}`} />
    );
  }

  if (!adminRow?.is_admin) {
    redirect("/dashboard");
  }

  const { data: profiles, error: profilesError } = await adminSupabase
    .from("profiles")
    .select(
      "id, artist_name, genre, instagram_handle, plan, plan_override, cron_active, is_private, owner_user_id, created_at, is_managed, is_admin, stripe_customer_id, tiktok_waitlist, account_type, all_emails_paused, instagram_user_id, board_enabled, weekly_target"
    )
    .order("created_at", { ascending: false });

  if (profilesError) {
    return (
      <AdminPageError message={`Could not load profiles: ${profilesError.message}`} />
    );
  }

  const tiktokWaitlistCount = (profiles ?? []).filter(
    (p) => p.tiktok_waitlist === true
  ).length;

  const { data: artistsRows, error: artistsError } = await adminSupabase
    .from("artists")
    .select("id, created_at");

  if (artistsError) {
    return (
      <AdminPageError message={`Could not load artists: ${artistsError.message}`} />
    );
  }

  const createdAtByArtistId = new Map(
    (artistsRows ?? []).map((a) => [a.id, a.created_at as string])
  );

  const emailByUserId = new Map<string, string>();
  const authUsers: Array<{
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
  }> = [];
  let listPage = 1;
  for (;;) {
    const {
      data: listData,
      error: listErr,
    } = await adminSupabase.auth.admin.listUsers({
      page: listPage,
      perPage: 200,
    });
    if (listErr) {
      return (
        <AdminPageError message={`Could not load user emails: ${listErr.message}`} />
      );
    }
    const users = listData?.users ?? [];
    for (const u of users) {
      if (u.email) emailByUserId.set(u.id, u.email);
      authUsers.push({
        id: u.id,
        email: u.email ?? "(no email)",
        created_at: u.created_at ?? new Date(0).toISOString(),
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (!users.length || users.length < 200) break;
    listPage += 1;
  }

  const profilesByOwner = new Map<string, NonNullable<typeof profiles>>();
  for (const p of profiles ?? []) {
    const ownerId = String(p.owner_user_id ?? "");
    if (!ownerId) continue;
    const list = profilesByOwner.get(ownerId);
    if (list) {
      list.push(p);
    } else {
      profilesByOwner.set(ownerId, [p]);
    }
  }

  const userAccountRows: AdminUserAccountRow[] = authUsers
    .map((u) => {
      const ownedProfiles = profilesByOwner.get(u.id) ?? [];
      return {
        user_id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        is_admin: ownedProfiles.some((p) => p.is_admin === true),
        all_emails_paused:
          ownedProfiles.length > 0 &&
          ownedProfiles.every((p) => p.all_emails_paused === true),
        artists: ownedProfiles.map((p) => ({
          id: String(p.id),
          artist_name: String(p.artist_name ?? "").trim(),
          instagram_handle: String(p.instagram_handle ?? "").replace(/^@/, ""),
          plan: String(p.plan ?? "free"),
          is_managed: p.is_managed === true,
          is_private: p.is_private === true,
          account_type: asAccountType(p.account_type),
        })),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const { data: weeklyPlanRows, error: weeklyPlansError } = await adminSupabase
    .from("weekly_plans")
    .select("artist_id, created_at")
    .order("created_at", { ascending: false });

  if (weeklyPlansError) {
    return (
      <AdminPageError
        message={`Could not load weekly plans: ${weeklyPlansError.message}`}
      />
    );
  }

  const lastPlanByArtistId = new Map<string, string>();
  for (const row of weeklyPlanRows ?? []) {
    const artistId = String(row.artist_id ?? "").trim();
    if (!artistId || lastPlanByArtistId.has(artistId)) continue;
    const createdAt =
      typeof row.created_at === "string"
        ? row.created_at
        : row.created_at != null
          ? String(row.created_at)
          : "";
    if (createdAt) lastPlanByArtistId.set(artistId, createdAt);
  }

  // Per account: posts synced, last sync, posts this week, and whether a
  // drafted week is waiting.
  const monday = londonMonday();
  const [{ data: perfRows }, { data: draftRows }] = await Promise.all([
    adminSupabase.from("post_performance").select("artist_id, scraped_at, post_date"),
    adminSupabase.from("concept_generations").select("artist_id").eq("status", "draft"),
  ]);
  const perfByArtist = new Map<string, { count: number; last: string | null; week: number }>();
  for (const r of perfRows ?? []) {
    const id = String(r.artist_id);
    const cur = perfByArtist.get(id) ?? { count: 0, last: null, week: 0 };
    cur.count++;
    const scraped = r.scraped_at ? String(r.scraped_at) : null;
    if (scraped && (!cur.last || scraped > cur.last)) cur.last = scraped;
    if (r.post_date && String(r.post_date).slice(0, 10) >= monday) cur.week++;
    perfByArtist.set(id, cur);
  }
  const hasDraft = new Set((draftRows ?? []).map((r) => String(r.artist_id)));

  const rowsUnsorted: AdminArtistDirectoryRow[] = (profiles ?? [])
    .filter((p) => String(p.artist_name ?? "").trim().length > 0)
    .map((p) => {
    const profileCreated =
      typeof p.created_at === "string" ? p.created_at : null;
    const createdAt =
      createdAtByArtistId.get(p.id) ??
      profileCreated ??
      new Date(0).toISOString();
    return {
      id: p.id,
      created_at: createdAt,
      owner_user_id: p.owner_user_id,
      owner_email: emailByUserId.get(p.owner_user_id) ?? "—",
      artist_name: p.artist_name ?? "",
      genre: p.genre ?? "",
      instagram_handle: (p.instagram_handle ?? "").replace(/^@/, ""),
      plan: p.plan ?? "free",
      plan_override:
        typeof p.plan_override === "string" && p.plan_override.trim()
          ? p.plan_override.trim().toLowerCase()
          : null,
      cron_active: p.cron_active !== false,
      is_managed: p.is_managed === true,
      is_private: p.is_private === true,
      account_type: asAccountType(p.account_type),
      instagram_connected: Boolean(String(p.instagram_user_id ?? "").trim()),
      last_plan_at: lastPlanByArtistId.get(p.id) ?? null,
      board_enabled: p.board_enabled === true,
      has_draft: hasDraft.has(String(p.id)),
      post_count: perfByArtist.get(String(p.id))?.count ?? 0,
      last_synced: perfByArtist.get(String(p.id))?.last ?? null,
      weekly_target: typeof p.weekly_target === "number" ? p.weekly_target : null,
      posted_this_week: perfByArtist.get(String(p.id))?.week ?? 0,
    };
    });

  const rows = rowsUnsorted.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const { data: usageTypeRows, error: usageTypesError } = await adminSupabase
    .from("usage_events")
    .select("event_type");

  if (usageTypesError) {
    return (
      <AdminPageError message={`Could not load usage totals: ${usageTypesError.message}`} />
    );
  }

  const totalCounts: Record<string, number> = {};
  for (const row of usageTypeRows ?? []) {
    const et =
      typeof row.event_type === "string" && row.event_type.trim()
        ? row.event_type.trim()
        : "(empty)";
    totalCounts[et] = (totalCounts[et] ?? 0) + 1;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentUsageRows, error: recentUsageError } = await adminSupabase
    .from("usage_events")
    .select("event_type, created_at, artist_id")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(50);

  if (recentUsageError) {
    return (
      <AdminPageError message={`Could not load recent usage: ${recentUsageError.message}`} />
    );
  }

  const recentEvents: UsageAnalyticsRecentEvent[] = (recentUsageRows ?? []).map((r) => ({
    event_type: String(r.event_type ?? ""),
    created_at:
      typeof r.created_at === "string"
        ? r.created_at
        : r.created_at != null
          ? String(r.created_at)
          : "",
    artist_id: String(r.artist_id ?? ""),
  }));

  const { data: contentReviewsRows, error: contentReviewsError } =
    await adminSupabase
      .from("content_reviews")
      .select(
        "id, artist_id, owner_user_id, idea_hook, idea_format, idea_caption, idea_why, idea_timing, notes, status, feedback, created_at, file_urls"
      )
      .order("created_at", { ascending: false })
      .limit(20);

  if (contentReviewsError) {
    return (
      <AdminPageError
        message={`Could not load content reviews: ${contentReviewsError.message}`}
      />
    );
  }

  const contentReviewRows = (contentReviewsRows ?? []).map((r) => ({
    id: String(r.id ?? ""),
    artist_id: String(r.artist_id ?? ""),
    owner_user_id: String(r.owner_user_id ?? ""),
    idea_hook: String(r.idea_hook ?? ""),
    idea_format: String(r.idea_format ?? ""),
    idea_caption: String(r.idea_caption ?? ""),
    idea_why: typeof r.idea_why === "string" ? r.idea_why : null,
    idea_timing: typeof r.idea_timing === "string" ? r.idea_timing : null,
    notes: String(r.notes ?? ""),
    status: String(r.status ?? "pending"),
    feedback: String(r.feedback ?? ""),
    created_at:
      typeof r.created_at === "string"
        ? r.created_at
        : r.created_at != null
          ? String(r.created_at)
          : "",
    file_urls: Array.isArray(r.file_urls)
      ? (r.file_urls
          .map((v) => (typeof v === "string" ? v : ""))
          .map((v) => v.trim())
          .filter(Boolean) as string[])
      : null,
  }));

  const uniqueArtistIds = Array.from(
    new Set(contentReviewRows.map((r) => r.artist_id).filter(Boolean))
  );

  const artistNames: Record<string, string> = {};
  if (uniqueArtistIds.length) {
    const { data: artistRows, error: artistNamesError } = await adminSupabase
      .from("profiles")
      .select("id, artist_name")
      .in("id", uniqueArtistIds);

    if (artistNamesError) {
      return (
        <AdminPageError
          message={`Could not load artist names: ${artistNamesError.message}`}
        />
      );
    }

    for (const row of artistRows ?? []) {
      const id = String(row.id ?? "");
      if (!id) continue;
      artistNames[id] = String(row.artist_name ?? "");
    }
  }

  const { data: revisionRows, error: revisionError } = await adminSupabase
    .from("plan_revision_requests")
    .select(
      "id, artist_id, week_start, artist_note, created_at, weekly_plan_id, weekly_plans ( ideas )"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (revisionError) {
    return (
      <AdminPageError
        message={`Could not load revision requests: ${revisionError.message}`}
      />
    );
  }

  const revisionRequests: RevisionRequestRow[] = (revisionRows ?? []).map((r) => {
    const planJoin = r.weekly_plans as { ideas?: unknown } | null;
    return {
      id: String(r.id ?? ""),
      artist_id: String(r.artist_id ?? ""),
      week_start: String(r.week_start ?? ""),
      artist_note: String(r.artist_note ?? ""),
      created_at:
        typeof r.created_at === "string"
          ? r.created_at
          : r.created_at != null
            ? String(r.created_at)
            : "",
      weekly_plan_id:
        typeof r.weekly_plan_id === "string" ? r.weekly_plan_id : null,
      plan_ideas: planJoin?.ideas ?? null,
    };
  });

  const revisionArtistIds = Array.from(
    new Set(revisionRequests.map((r) => r.artist_id).filter(Boolean))
  );

  const revisionArtistNames: Record<string, string> = { ...artistNames };
  const missingRevisionArtistIds = revisionArtistIds.filter(
    (id) => !revisionArtistNames[id]
  );

  if (missingRevisionArtistIds.length) {
    const { data: revisionArtistRows, error: revisionArtistNamesError } =
      await adminSupabase
        .from("profiles")
        .select("id, artist_name")
        .in("id", missingRevisionArtistIds);

    if (revisionArtistNamesError) {
      return (
        <AdminPageError
          message={`Could not load revision artist names: ${revisionArtistNamesError.message}`}
        />
      );
    }

    for (const row of revisionArtistRows ?? []) {
      const id = String(row.id ?? "");
      if (!id) continue;
      revisionArtistNames[id] = String(row.artist_name ?? "");
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-8">
      <AppNavWrapper />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Admin</h1>
          <p className="flex flex-wrap gap-x-4 text-sm">
            <Link href="/prep" className="font-semibold text-brand hover:underline">
              Client prep
            </Link>
            <Link href="/admin/access" className="font-semibold text-brand hover:underline">
              Beta access
            </Link>
            <Link href="/admin/concepts" className="font-semibold text-muted hover:text-foreground">
              Concept preview
            </Link>
            <Link href="/admin/plans" className="font-semibold text-muted hover:text-foreground">
              Old plans
            </Link>
          </p>
        </div>
        <LogoutButton />
      </div>

      <nav aria-label="Admin sections" className="mt-6 flex gap-1 overflow-x-auto border-b border-card-border">
        {TABS.map((t) => {
          const count = t.id === "reviews" ? revisionRequests.length : 0;
          return (
            <Link
              key={t.id}
              href={t.id === "artists" ? "/admin" : `/admin?tab=${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 pt-2.5 text-sm font-semibold ${
                tab === t.id ? "border-ink text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {count > 0 ? <span className="ml-1.5 rounded-full bg-ink px-1.5 text-xs text-ink-foreground">{count}</span> : null}
            </Link>
          );
        })}
      </nav>

      {tab === "artists" ? (
        <div className="mt-6 flex flex-col gap-6">
          <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-card-border bg-card p-5">
            <div className="min-w-0 flex-[1_1_280px]">
              <h2 className="text-lg font-bold text-foreground">Add an account</h2>
              <p className="text-sm text-muted">
                Bring them in from Facebook Business, or create one by hand. Then press Set up on their row.
              </p>
            </div>
            <Link
              href="/accounts/import"
              className="inline-flex min-h-10 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground hover:opacity-90"
            >
              From Facebook Business
            </Link>
            <details className="w-full [&_summary::-webkit-details-marker]:hidden">
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-lg border border-card-border px-4 text-sm font-semibold text-foreground hover:bg-background">
                Create by hand
              </summary>
              <div className="mt-2">
                <AdminCreateClientArtistForm />
              </div>
            </details>
          </section>
          <AdminArtistsTable rows={rows} tiktokWaitlistCount={tiktokWaitlistCount} />
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="mt-2">
          <UserAccountsTable rows={userAccountRows} />
        </div>
      ) : null}

      {tab === "reviews" ? (
        <div className="mt-2">
          <RevisionRequestsSection requests={revisionRequests} artistNames={revisionArtistNames} />
          <ContentReviewsTable reviews={contentReviewRows} artistNames={artistNames} />
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="mt-2">
          <UsageAnalytics totalCounts={totalCounts} recentEvents={recentEvents} />
        </div>
      ) : null}
    </div>
  );
}
