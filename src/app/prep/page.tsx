import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { userIsAdmin } from "@/lib/is-admin";
import { PrepSection, type PrepArtist } from "./prep-section";

export default async function PrepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = await userIsAdmin(supabase, user.id);
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, artist_name, genre, instagram_handle, created_at")
    .order("created_at", { ascending: false });

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const { data: audits, error: auditsError } = await supabase
    .from("audits")
    .select("artist_id, followers, created_at")
    .not("artist_id", "is", null)
    .order("created_at", { ascending: false });

  if (auditsError) {
    throw new Error(auditsError.message);
  }

  const latestAuditByArtistId = new Map<string, { followers: number }>();
  for (const row of audits ?? []) {
    const artistId = typeof row.artist_id === "string" ? row.artist_id : "";
    if (!artistId || latestAuditByArtistId.has(artistId)) continue;
    latestAuditByArtistId.set(artistId, {
      followers: Number(row.followers ?? 0),
    });
  }

  const artists: PrepArtist[] = (profiles ?? []).map((profile) => {
    const id = String(profile.id ?? "");
    const latestAudit = latestAuditByArtistId.get(id);
    const hasAudit = !!latestAudit;

    return {
      id,
      artist_name: String(profile.artist_name ?? "").trim() || "Unnamed artist",
      genre: String(profile.genre ?? "").trim(),
      instagram_handle: (profile.instagram_handle ?? "").trim().replace(/^@/, ""),
      followers: hasAudit ? latestAudit.followers : null,
      has_audit: hasAudit,
    };
  });

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            CLIENT PREP
          </h1>
          <p className="mt-2 text-muted">
            Prepare for client calls using Roadie&apos;s analysis
          </p>
        </div>
        <LogoutButton />
      </header>

      <AppNavWrapper />

      <PrepSection artists={artists} />
    </div>
  );
}
