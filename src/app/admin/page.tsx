import { createClient } from "@/utils/supabase/server";
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

export default async function AdminPage() {
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
      "id, artist_name, genre, instagram_handle, plan, owner_user_id, created_at, similar_artists, sound_description, voice_description, is_admin, stripe_customer_id, is_managed"
    )
    .order("created_at", { ascending: false });

  if (profilesError) {
    return (
      <AdminPageError message={`Could not load profiles: ${profilesError.message}`} />
    );
  }

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
    }
    if (!users.length || users.length < 200) break;
    listPage += 1;
  }

  const rowsUnsorted: AdminArtistDirectoryRow[] = (profiles ?? []).map((p) => {
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
      is_managed: p.is_managed === true,
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

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
              Admin
            </h1>
            <Link
              href="/prep"
              className="text-sm font-semibold text-brand transition-colors hover:text-brand/80"
            >
              Client prep →
            </Link>
          </div>
          <p className="mt-2 text-muted">
            Browse every artist, switch context, create managed clients, or enqueue
            an intake audit (same pipeline as{" "}
            <code className="rounded bg-input px-1 py-0.5 text-xs">POST /api/new-lead</code>
            ).
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNavWrapper />

      <UsageAnalytics totalCounts={totalCounts} recentEvents={recentEvents} />

      <ContentReviewsTable reviews={contentReviewRows} artistNames={artistNames} />

      <AdminCreateClientArtistForm />

      <AdminArtistsTable rows={rows} />
    </div>
  );
}
