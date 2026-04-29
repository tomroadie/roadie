import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import {
  fetchArtistsForUser,
  getActiveArtistIdForUser,
} from "@/lib/active-artist";
import { AppNav, type AppNavArtist } from "./app-nav";

export async function AppNavWrapper() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const artistsRows = await fetchArtistsForUser(supabase, user.id);
  const cookieStore = await cookies();
  const activeArtistId = await getActiveArtistIdForUser(
    supabase,
    user.id,
    cookieStore
  );

  let artists: AppNavArtist[] = [];
  if (artistsRows.length > 0) {
    const ids = artistsRows.map((a) => a.id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, artist_name")
      .in("id", ids);

    const nameById = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        p.artist_name?.trim() || "Unnamed artist",
      ])
    );

    artists = artistsRows.map((a) => ({
      id: a.id,
      label: nameById.get(a.id) ?? "Artist",
    }));
  }

  return <AppNav artists={artists} activeArtistId={activeArtistId} />;
}
