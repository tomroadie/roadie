import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import { userIsAdmin } from "@/lib/is-admin";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { AdminCreateClientArtistForm } from "./create-client-artist-form";
import {
  AdminArtistsTable,
  type AdminArtistDirectoryRow,
} from "./admin-artists-table";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await userIsAdmin(supabase, user.id))) {
    redirect("/dashboard");
  }

  const { data: rawRows, error } = await supabase
    .from("artists")
    .select(
      `id, created_at, owner_user_id, profiles!inner (artist_name, genre, instagram_handle, plan, client_managed)`
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const svc = createServiceRoleClient();
  const emailById = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data: bundle, error: listErr } = await svc.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) {
      throw new Error(listErr.message);
    }
    for (const u of bundle.users) {
      if (u.email) emailById.set(u.id, u.email);
    }
    if (bundle.users.length < 200) break;
    page += 1;
  }

  const rows: AdminArtistDirectoryRow[] = (rawRows ?? []).map((row) => {
    const rawProf = row.profiles as
      | {
          artist_name: string | null;
          genre: string | null;
          instagram_handle: string | null;
          plan: string | null;
          client_managed: boolean | null;
        }
      | Array<{
          artist_name: string | null;
          genre: string | null;
          instagram_handle: string | null;
          plan: string | null;
          client_managed: boolean | null;
        }>;
    const prof = Array.isArray(rawProf) ? rawProf[0] : rawProf;
    return {
      id: row.id,
      created_at: row.created_at,
      owner_user_id: row.owner_user_id,
      owner_email: emailById.get(row.owner_user_id) ?? "—",
      artist_name: prof?.artist_name ?? "",
      genre: prof?.genre ?? "",
      instagram_handle: (prof?.instagram_handle ?? "").replace(/^@/, ""),
      plan: prof?.plan ?? "free",
      client_managed: !!prof?.client_managed,
    };
  });

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            Admin
          </h1>
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

      <AdminCreateClientArtistForm />

      <AdminArtistsTable rows={rows} />
    </div>
  );
}
