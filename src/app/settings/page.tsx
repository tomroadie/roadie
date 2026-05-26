import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { AddArtistForm } from "./add-artist-form";
import { InstagramHandleForm } from "./instagram-handle-form";
import { InstagramConnectSection } from "./instagram-connect-section";
import { VoiceForm } from "./voice-form";
import { PostingGoalForm } from "./posting-goal-form";
import { getActiveArtistIdForUser } from "@/lib/active-artist";
import { canDo, normalizePlan } from "@/lib/plan-limits";
import { userIsAdmin } from "@/lib/is-admin";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  if (!activeArtistId) {
    redirect("/onboarding");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "artist_name, instagram_handle, instagram_user_id, voice_description, posting_frequency, plan"
    )
    .eq("id", activeArtistId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile?.artist_name?.trim()) {
    redirect("/onboarding");
  }

  const isAdmin = await userIsAdmin(supabase, user.id);
  const plan = normalizePlan(profile?.plan);
  const canConnectLiveStats = canDo(plan, "canViewLiveSocialData", isAdmin);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-2 text-muted">
            Artists you manage and account preferences.
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNavWrapper />

      <InstagramHandleForm initialHandle={profile.instagram_handle ?? null} />

      <InstagramConnectSection
        instagramUserId={profile.instagram_user_id ?? null}
        canConnectLiveStats={canConnectLiveStats}
      />

      <VoiceForm initialVoice={profile.voice_description ?? null} />

      <PostingGoalForm
        initialPostingFrequency={
          (profile.posting_frequency as "weekly" | "regular" | "active" | null) ??
          null
        }
      />

      <AddArtistForm />
    </div>
  );
}
