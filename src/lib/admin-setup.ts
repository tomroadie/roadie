import type { SupabaseClient } from "@supabase/supabase-js";
import { asAccountType, getsWeeklyIdeas, type AccountType } from "@/lib/account-types";

/**
 * Where an account is in setup, for the admin checklist. Every step is
 * worked out from the data itself, so the checklist resumes wherever it
 * was left and never repeats finished work.
 */
export type SetupState = {
  artistId: string;
  artistName: string;
  handle: string | null;
  accountType: AccountType;
  getsIdeas: boolean;
  instagram: boolean;
  posts: { count: number; lastSynced: string | null };
  concepts: { names: string[] };
  images: { described: number; total: number };
  dates: { done: boolean; tourPageUrl: string | null; upcoming: number; waiting: number };
  draft: { generationId: string; createdAt: string; focus: string | null; ideas: { title: string; why: string | null }[] } | null;
  live: boolean;
};

export async function loadSetupState(admin: SupabaseClient, artistId: string): Promise<SetupState> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const [profileRes, postsRes, lastRes, describedRes, themesRes, eventsRes, waitingRes, draftRes] = await Promise.all([
    admin
      .from("profiles")
      .select("artist_name, instagram_handle, account_type, instagram_user_id, instagram_access_token, tour_page_url, board_enabled, setup_dates_done")
      .eq("id", artistId)
      .maybeSingle(),
    admin.from("post_performance").select("id", { count: "exact", head: true }).eq("artist_id", artistId),
    admin
      .from("post_performance")
      .select("scraped_at")
      .eq("artist_id", artistId)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("post_performance")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .not("visual_source", "is", null),
    admin.from("content_themes").select("name").eq("artist_id", artistId).eq("status", "active").order("position"),
    admin.from("events").select("id", { count: "exact", head: true }).eq("artist_id", artistId).gte("event_date", today),
    admin
      .from("date_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("artist_id", artistId)
      .eq("status", "pending")
      .gte("event_date", today),
    admin
      .from("concept_generations")
      .select("id, created_at, focus")
      .eq("artist_id", artistId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (profileRes.error || !profileRes.data) throw new Error(profileRes.error?.message ?? "Account not found");
  const p = profileRes.data;

  let draft: SetupState["draft"] = null;
  if (draftRes.data) {
    const { data: ideas } = await admin
      .from("concepts")
      .select("title, why")
      .eq("generation_id", draftRes.data.id)
      .order("position")
      .limit(12);
    draft = {
      generationId: String(draftRes.data.id),
      createdAt: String(draftRes.data.created_at),
      focus: draftRes.data.focus ? String(draftRes.data.focus) : null,
      ideas: (ideas ?? []).map((i) => ({ title: String(i.title), why: i.why ? String(i.why) : null })),
    };
  }

  const accountType = asAccountType(p.account_type);
  const upcoming = eventsRes.count ?? 0;
  return {
    artistId,
    artistName: String(p.artist_name ?? ""),
    handle: p.instagram_handle ? String(p.instagram_handle).replace(/^@/, "") : null,
    accountType,
    getsIdeas: getsWeeklyIdeas(accountType),
    instagram: Boolean(String(p.instagram_user_id ?? "").trim() && String(p.instagram_access_token ?? "").trim()),
    posts: { count: postsRes.count ?? 0, lastSynced: lastRes.data?.scraped_at ? String(lastRes.data.scraped_at) : null },
    concepts: { names: (themesRes.data ?? []).map((t) => String(t.name)) },
    images: { described: describedRes.count ?? 0, total: postsRes.count ?? 0 },
    dates: {
      done: p.setup_dates_done === true || Boolean(p.tour_page_url) || upcoming > 0,
      tourPageUrl: p.tour_page_url ? String(p.tour_page_url) : null,
      upcoming,
      waiting: waitingRes.count ?? 0,
    },
    draft,
    live: p.board_enabled === true,
  };
}
