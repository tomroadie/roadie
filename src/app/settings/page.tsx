import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { LogoutButton } from "@/app/dashboard/logout-button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("artist_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile?.artist_name?.trim()) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-1 flex-col px-4 py-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Account and preferences — coming soon.
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNav />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        This section is a placeholder. More options will land here in a future
        update.
      </p>
    </div>
  );
}
