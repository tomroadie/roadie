import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { InviteForm, RequestActions } from "./access-controls";

type Row = {
  id: string;
  email: string;
  artist_name: string | null;
  instagram_handle: string | null;
  status: "new" | "invited" | "declined";
  source: string;
  created_at: string;
  invited_at: string | null;
  joined_at: string | null;
};

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

export default async function AccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await userIsAdmin(supabase, user.id))) redirect("/home");

  const { data } = await createServiceRoleClient()
    .from("access_requests")
    .select("id, email, artist_name, instagram_handle, status, source, created_at, invited_at, joined_at")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const groups: { title: string; rows: Row[] }[] = [
    { title: "Waiting", rows: rows.filter((r) => r.status === "new") },
    { title: "Invited, not signed up yet", rows: rows.filter((r) => r.status === "invited" && !r.joined_at) },
    { title: "Signed up", rows: rows.filter((r) => r.joined_at) },
    { title: "Declined", rows: rows.filter((r) => r.status === "declined") },
  ];

  return (
    <>
      <AppNavWrapper />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">Beta access</h1>
          <Link href="/admin" className="text-sm font-semibold text-brand">
            Back to admin
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted">
          Sign-up needs an invite link. Inviting sends them a one-time link to create their account.
          Until Meta approves the app, also add their Instagram as a tester in the Meta app.
        </p>

        <section className="mt-8 rounded-xl border border-card-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-brand">Invite someone</h2>
          <div className="mt-3">
            <InviteForm />
          </div>
        </section>

        {groups.map((g) =>
          g.rows.length ? (
            <section key={g.title} className="mt-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
                {g.title} ({g.rows.length})
              </h2>
              <ul className="mt-3 divide-y divide-card-border rounded-xl border border-card-border bg-card">
                {g.rows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {r.artist_name || r.email}
                        {r.instagram_handle ? <span className="font-normal text-muted"> · @{r.instagram_handle}</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {r.email} · {r.source === "admin" ? "added by you" : `asked ${when(r.created_at)}`}
                        {r.invited_at ? ` · invited ${when(r.invited_at)}` : ""}
                        {r.joined_at ? ` · joined ${when(r.joined_at)}` : ""}
                      </p>
                    </div>
                    {r.joined_at ? null : <RequestActions id={r.id} email={r.email} status={r.status} />}
                  </li>
                ))}
              </ul>
            </section>
          ) : null
        )}
        {rows.length === 0 ? <p className="mt-8 text-sm text-muted">No requests yet.</p> : null}
      </div>
    </>
  );
}
