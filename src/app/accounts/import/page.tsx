import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { userIsAdmin } from "@/lib/is-admin";
import { GENRES } from "@/app/onboarding/genres";
import { listBusinessInstagramAccounts } from "@/lib/facebook-business";
import { ImportPicker, type PickerAccount } from "./import-picker";

const ERRORS: Record<string, string> = {
  not_configured: "The Facebook app isn't set up yet: FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are missing.",
  cancelled: "Facebook connection was cancelled.",
  connect_failed: "Couldn't connect to Facebook. Try again, and check the logs if it keeps failing.",
};

export default async function ImportAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await userIsAdmin(supabase, user.id))) redirect("/home");

  const admin = createServiceRoleClient();
  const { data: conn } = await admin
    .from("facebook_connections")
    .select("fb_name, user_access_token, token_expires_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  let accounts: PickerAccount[] = [];
  let listError: string | null = null;
  if (conn?.user_access_token) {
    try {
      const found = await listBusinessInstagramAccounts(String(conn.user_access_token));
      const { data: existing } = found.length
        ? await admin
            .from("profiles")
            .select("instagram_user_id, artist_name, owner_user_id, instagram_auth")
            .in("instagram_user_id", found.map((a) => a.igUserId))
        : { data: [] };
      const byIg = new Map((existing ?? []).map((p) => [String(p.instagram_user_id), p]));
      accounts = found.map((a) => {
        const e = byIg.get(a.igUserId);
        return {
          pageId: a.pageId,
          pageName: a.pageName,
          username: a.username,
          name: a.name,
          profilePictureUrl: a.profilePictureUrl,
          followers: a.followers,
          existing: e
            ? {
                artistName: String(e.artist_name ?? "an artist"),
                mine: e.owner_user_id === user.id,
                viaFacebook: e.instagram_auth === "facebook",
              }
            : null,
        };
      });
    } catch (e) {
      listError = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-8">
      <AppNavWrapper />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Add accounts from Facebook</h1>
          <p className="max-w-2xl text-muted">
            Connect once with Facebook and add any Instagram account your Business Manager can reach. Each one becomes
            an artist in Tempo with its posts synced, no Instagram login needed.
          </p>
        </div>
        {/* A plain link: this starts an OAuth redirect, not a page. */}
        <a
          href="/api/auth/facebook"
          className="inline-flex min-h-11 items-center rounded-xl border border-ink bg-card px-4 text-sm font-semibold text-foreground hover:bg-input"
        >
          {conn ? "Reconnect Facebook" : "Connect Facebook Business"}
        </a>
      </div>

      {error && ERRORS[error] ? (
        <p role="alert" className="mt-6 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-800">
          {ERRORS[error]}
        </p>
      ) : null}

      <div className="mt-8">
        {!conn ? (
          <div className="rounded-2xl border border-dashed border-card-border bg-card p-6 text-muted">
            Not connected yet. Until the Teams app passes Meta review, this works for businesses you manage and people
            with a role on the app.
          </div>
        ) : listError ? (
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <p className="font-semibold text-foreground">Couldn&rsquo;t load your accounts from Facebook.</p>
            <p className="mt-1 text-sm text-muted">{listError}</p>
            <p className="mt-1 text-sm text-muted">Reconnecting usually fixes it.</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-2xl border border-card-border bg-card p-6 text-muted">
            Connected as {conn.fb_name ?? "you"}, but no Pages with a linked Instagram account came back. Check the
            Instagram accounts are linked to Facebook Pages, and that you picked those Pages when connecting.
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              Connected as {conn.fb_name ?? "you"} · {accounts.length} Instagram{" "}
              {accounts.length === 1 ? "account" : "accounts"}
            </p>
            <ImportPicker accounts={accounts} genres={GENRES} />
          </>
        )}
      </div>
    </div>
  );
}
