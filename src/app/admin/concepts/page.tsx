import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import {
  ConceptPreview,
  type PendingDraft,
  type PreviewArtist,
} from "./concept-preview";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export default async function AdminConceptsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await userIsAdmin(supabase, user.id))) redirect("/dashboard");

  const admin = createServiceRoleClient();
  const tenDaysAgo = daysAgoIso(10);
  const [{ data: profiles }, { data: audits }, { data: live }, { data: drafts }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, artist_name, genre, board_enabled")
      .not("artist_name", "is", null)
      .order("artist_name"),
    admin.from("audits").select("artist_id").not("artist_id", "is", null),
    admin
      .from("concept_generations")
      .select("artist_id, published_at")
      .eq("status", "live"),
    admin
      .from("concept_generations")
      .select("id, artist_id, created_at")
      .eq("status", "draft")
      .eq("context_summary->>kind", "weekly")
      .gte("created_at", tenDaysAgo)
      .order("created_at", { ascending: false }),
  ]);

  const liveSince = new Map(
    (live ?? []).map((g) => [String(g.artist_id), String(g.published_at ?? "")])
  );

  const withAudit = new Set((audits ?? []).map((a) => String(a.artist_id)));
  const artists: PreviewArtist[] = (profiles ?? [])
    .filter((p) => String(p.artist_name ?? "").trim())
    .map((p) => ({
      id: String(p.id),
      name: String(p.artist_name).trim(),
      genre: p.genre ? String(p.genre) : null,
      hasAudit: withAudit.has(String(p.id)),
      boardEnabled: p.board_enabled === true,
      liveSince: liveSince.get(String(p.id)) || null,
    }))
    .sort((a, b) => Number(b.hasAudit) - Number(a.hasAudit));

  // Newest weekly draft per artist that hasn't been published yet.
  const names = new Map(artists.map((a) => [a.id, a.name]));
  const seen = new Set<string>();
  const pendingDrafts: PendingDraft[] = [];
  for (const d of drafts ?? []) {
    const artistId = String(d.artist_id);
    if (seen.has(artistId)) continue;
    const liveAt = liveSince.get(artistId);
    if (liveAt && liveAt > String(d.created_at)) continue;
    seen.add(artistId);
    pendingDrafts.push({
      generationId: String(d.id),
      artistId,
      artistName: names.get(artistId) ?? "Unknown artist",
      createdAt: String(d.created_at),
    });
  }

  return (
    <>
      <AppNavWrapper />
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
              Concept preview
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Runs the concept generator and saves the result as a draft.
              Check each &ldquo;why&rdquo; against the posts it cites, then
              publish it to the artist&rsquo;s board.
            </p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-brand">
            Back to admin
          </Link>
        </header>
        <ConceptPreview artists={artists} pendingDrafts={pendingDrafts} />
      </div>
    </>
  );
}
