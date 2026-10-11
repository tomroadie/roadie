import { createServiceRoleClient } from "@/utils/supabase/admin";

export type CronJob =
  | "sync-post-performance"
  | "weekly-board"
  | "refresh-instagram-tokens"
  | "email-sequences"
  | "health";

/** Records that a scheduled job ran. Never throws: logging must not break the job. */
export async function recordCronRun(job: CronJob, ok: boolean, summary?: Record<string, unknown>): Promise<void> {
  try {
    await createServiceRoleClient().from("cron_runs").insert({ job, ok, summary: summary ?? null });
  } catch (e) {
    console.error("recordCronRun failed", job, e);
  }
}
