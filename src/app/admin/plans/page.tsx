import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import {
  PlanReviewSection,
  type PlanReviewPlan,
} from "./plan-review-section";

function AdminPlansPageError({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
        Plans to review
      </h1>
      <p className="mt-4 text-muted">
        Something went wrong loading this page. If this keeps happening, contact
        support.
      </p>
      <p className="mt-2 font-mono text-sm text-destructive">{message}</p>
    </div>
  );
}

function formatWeekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatGeneratedAt(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mapPlanRow(
  row: Record<string, unknown>,
  artistNames: Record<string, string>
): PlanReviewPlan | null {
  const id = String(row.id ?? "").trim();
  const artistId = String(row.artist_id ?? "").trim();
  if (!id || !artistId) return null;

  return {
    id,
    artist_id: artistId,
    artist_name: artistNames[artistId]?.trim() || "Unknown artist",
    week_start: String(row.week_start ?? ""),
    concepts: row.concepts ?? null,
    admin_note:
      typeof row.admin_note === "string"
        ? row.admin_note
        : row.admin_note == null
          ? null
          : String(row.admin_note),
    status: String(row.status ?? ""),
  };
}

export default async function AdminPlansPage() {
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
      <AdminPlansPageError
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
      <AdminPlansPageError
        message={`Could not verify admin access: ${adminCheckError.message}`}
      />
    );
  }

  if (!adminRow?.is_admin) {
    redirect("/dashboard");
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: pendingRows, error: pendingError },
    { data: recentRows, error: recentError },
  ] = await Promise.all([
    adminSupabase
      .from("weekly_plans")
      .select("id, artist_id, week_start, created_at, status, concepts, admin_note")
      .eq("status", "pending_review")
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("weekly_plans")
      .select("id, artist_id, week_start, created_at, status")
      .eq("status", "published")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false }),
  ]);

  if (pendingError) {
    return (
      <AdminPlansPageError
        message={`Could not load pending plans: ${pendingError.message}`}
      />
    );
  }

  if (recentError) {
    return (
      <AdminPlansPageError
        message={`Could not load recent plans: ${recentError.message}`}
      />
    );
  }

  const artistIds = Array.from(
    new Set(
      [...(pendingRows ?? []), ...(recentRows ?? [])]
        .map((row) => String(row.artist_id ?? "").trim())
        .filter(Boolean)
    )
  );

  const artistNames: Record<string, string> = {};
  if (artistIds.length > 0) {
    const { data: profileRows, error: profilesError } = await adminSupabase
      .from("profiles")
      .select("id, artist_name")
      .in("id", artistIds);

    if (profilesError) {
      return (
        <AdminPlansPageError
          message={`Could not load artist names: ${profilesError.message}`}
        />
      );
    }

    for (const row of profileRows ?? []) {
      const id = String(row.id ?? "").trim();
      if (!id) continue;
      artistNames[id] = String(row.artist_name ?? "");
    }
  }

  const plans = (pendingRows ?? [])
    .map((row) => mapPlanRow(row as Record<string, unknown>, artistNames))
    .filter((row): row is PlanReviewPlan => row !== null);

  const recentPlans = (recentRows ?? [])
    .map((row) => {
      const plan = mapPlanRow(row as Record<string, unknown>, artistNames);
      if (!plan) return null;
      return {
        ...plan,
        created_at: String(row.created_at ?? ""),
      };
    })
    .filter(
      (row): row is PlanReviewPlan & { created_at: string } => row !== null
    );

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
              PLANS TO REVIEW
            </h1>
            <Link
              href="/admin"
              className="text-sm font-semibold text-brand transition-colors hover:text-brand/80"
            >
              ← Admin
            </Link>
          </div>
          <p className="mt-2 text-muted">
            Review weekly plans before they go live.
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNavWrapper />

      <PlanReviewSection plans={plans} />

      <section className="mt-10 rounded-xl border border-card-border bg-card p-6">
        <h2 className="text-lg font-bold uppercase tracking-tight text-foreground">
          Recently published
        </h2>
        <p className="mt-1 text-sm text-muted">Plans published in the last 7 days.</p>

        {recentPlans.length === 0 ? (
          <p className="mt-5 text-sm text-muted">No recently published plans.</p>
        ) : (
          <ul className="mt-5 divide-y divide-card-border rounded-lg border border-card-border">
            {recentPlans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-foreground">
                    {plan.artist_name}
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    Week of {formatWeekStart(plan.week_start)}
                  </div>
                </div>
                <div className="text-sm text-muted">
                  Published {formatGeneratedAt(plan.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
