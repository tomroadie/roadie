import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { AppNavWrapper } from "@/components/app-nav-wrapper";
import { ConceptPreview, type PreviewArtist } from "./concept-preview";

export default async function AdminConceptsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await userIsAdmin(supabase, user.id))) redirect("/dashboard");

  const admin = createServiceRoleClient();
  const [{ data: profiles }, { data: audits }, { data: live }] = await Promise.all([
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
        <ConceptPreview artists={artists} />
      </div>
    </>
  );
}
