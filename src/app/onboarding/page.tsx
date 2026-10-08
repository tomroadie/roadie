import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OnboardingForm } from "./onboarding-form";
import { OnboardingConversionTracking } from "./onboarding-conversion-tracking";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ artist?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Set when "Add artist" sends someone here to finish a new artist. RLS
  // means we only get a row back for an artist they can see.
  const { artist: artistParam } = await searchParams;
  let target: { id: string; artistName: string; genre: string; instagramHandle: string } | null = null;
  if (artistParam) {
    const { data } = await supabase
      .from("profiles")
      .select("id, artist_name, genre, instagram_handle")
      .eq("id", artistParam)
      .maybeSingle();
    if (data) {
      target = {
        id: String(data.id),
        artistName: data.artist_name ?? "",
        genre: data.genre ?? "",
        instagramHandle: data.instagram_handle ?? "",
      };
    }
  }

  return (
    <>
      <Suspense fallback={null}>
        <OnboardingConversionTracking />
      </Suspense>
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <img src="/logo.png" height={48} alt="Tempo" className="h-12 w-auto" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            Welcome to Tempo
          </h1>
          <p className="mt-2 text-sm text-muted">
            Takes 2 minutes. We use this to tailor your weekly ideas and match
            your voice.
          </p>
        </div>

        <OnboardingForm target={target} />
      </div>
    </div>
    </>
  );
}
