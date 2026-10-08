import type { SupabaseClient } from "@supabase/supabase-js";
import { generateConceptPool } from "./generate";
import { saveDraftGeneration } from "./store";
import { appBaseUrl } from "@/lib/email";
import { escapeHtml, notifyAdminEmail } from "@/lib/admin-notify";

export type FirstBoardOutcome =
  | { drafted: true; generationId: string }
  | { drafted: false; reason: string };

/**
 * A new artist's first set of ideas, saved as a draft for review (boards are
 * published by hand during the beta). Skips artists who already have any
 * generation, so it's safe to call more than once.
 */
export async function draftFirstBoard(admin: SupabaseClient, artistId: string): Promise<FirstBoardOutcome> {
  const { count } = await admin
    .from("concept_generations")
    .select("id", { count: "exact", head: true })
    .eq("artist_id", artistId);
  if ((count ?? 0) > 0) return { drafted: false, reason: "already has ideas" };

  const result = await generateConceptPool(admin, artistId);
  const generationId = await saveDraftGeneration(admin, result, null, { kind: "first" });

  const name = escapeHtml(result.context.artistName);
  await notifyAdminEmail(
    `Tempo: first ideas ready to review for ${result.context.artistName}`,
    `<p><strong>${name}</strong>'s first ideas are ready (${result.context.postSource === "none" ? "no posts yet, starting points only" : `${result.context.posts.length} posts from ${result.context.postSource}`}).</p>
<p>Focus: ${escapeHtml(result.pool.focus)}</p>
${result.warnings.length ? `<p>${result.warnings.length} warning(s) to check.</p>` : ""}
<p><a href="${appBaseUrl()}/admin/concepts">Review and publish</a></p>`
  );
  return { drafted: true, generationId };
}

/**
 * Asks the app to draft a first board in its own request, so it gets its
 * own time limit. Fire and forget; failures are only logged.
 */
export async function requestFirstBoard(artistId: string): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  try {
    await fetch(`${appBaseUrl()}/api/cron/first-board?artist_id=${encodeURIComponent(artistId)}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
  } catch (e) {
    console.error("requestFirstBoard failed", artistId, e);
  }
}
