export async function trackUsage({
  supabase,
  userId,
  artistId,
  eventType,
  metadata,
}: {
  supabase: any;
  userId: string;
  artistId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const row: Record<string, unknown> = {
      user_id: userId,
      artist_id: artistId,
      event_type: eventType,
    };
    if (metadata !== undefined) {
      row.metadata = metadata;
    }
    const { error } = await supabase.from("usage_events").insert(row);
    if (error) {
      console.error("[trackUsage]", error.message);
    }
  } catch (e) {
    console.error("[trackUsage]", e instanceof Error ? e.message : e);
  }
}
