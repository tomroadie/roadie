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
  const [{ data: profiles }, { data: audits }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, artist_name, genre")
      .not("artist_name", "is", null)
      .order("artist_name"),
    admin.from("audits").select("artist_id").not("artist_id", "is", null),
  ]);

  const withAudit = new Set((audits ?? []).map((a) => String(a.artist_id)));
  const artists: PreviewArtist[] = (profiles ?? [])
    .filter((p) => String(p.artist_name ?? "").trim())
    .map((p) => ({
      id: String(p.id),
      name: String(p.artist_name).trim(),
      genre: p.genre ? String(p.genre) : null,
      hasAudit: withAudit.has(String(p.id)),
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
              Runs the new concept generator for an artist without saving
              anything. Check each &ldquo;why&rdquo; against the posts it cites.
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
