import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  IG_ACCOUNT_SELECTION_COOKIE,
  parseIgAccountSelectionCookie,
} from "@/lib/instagram-account-selection";
import { AccountPicker } from "./account-picker";

export default async function InstagramAccountSelectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/connect/instagram/select");
  }

  const cookieStore = await cookies();
  const payload = parseIgAccountSelectionCookie(
    cookieStore.get(IG_ACCOUNT_SELECTION_COOKIE)?.value
  );

  if (!payload || payload.accounts.length < 2) {
    redirect("/settings?error=instagram_connect_failed");
  }

  const accounts = payload.accounts.map((a) => ({
    igUserId: a.igUserId,
    username: a.username,
    pageName: a.pageName,
  }));

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">
        Connect Instagram
      </p>
      <h1 className="mt-3 text-2xl font-black uppercase tracking-tight text-foreground">
        Which account is yours?
      </h1>
      <p className="mt-3 text-sm text-muted-strong">
        We found multiple Instagram accounts linked to your Facebook. Pick the
        one you want to connect to Roadie.
      </p>
      <AccountPicker accounts={accounts} />
    </div>
  );
}
