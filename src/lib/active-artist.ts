import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVE_ARTIST_COOKIE = "active_artist_id";

export type ArtistRow = {
  id: string;
  owner_user_id: string;
  created_at: string;
};

export async function fetchArtistsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<ArtistRow[]> {
  const { data, error } = await supabase
    .from("artists")
    .select("id, owner_user_id, created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ArtistRow[];
}

export function resolveActiveArtistId(
  artists: ArtistRow[],
  cookieValue: string | undefined
): string | null {
  if (artists.length === 0) return null;
  if (cookieValue && artists.some((a) => a.id === cookieValue)) {
    return cookieValue;
  }
  return artists[0]?.id ?? null;
}

export async function getActiveArtistIdForUser(
  supabase: SupabaseClient,
  userId: string,
  cookieStore: { get: (name: string) => { value: string } | undefined }
): Promise<string | null> {
  const artists = await fetchArtistsForUser(supabase, userId);
  const raw = cookieStore.get(ACTIVE_ARTIST_COOKIE)?.value;
  return resolveActiveArtistId(artists, raw);
}
