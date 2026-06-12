import { createServiceRoleClient } from "@/utils/supabase/admin";

export function cleanInstagramHandle(instagramUrlOrHandle: string): string | null {
  const trimmed = instagramUrlOrHandle.trim();
  if (!trimmed) return null;

  const withoutAt = trimmed.replace(/^@/, "");

  let candidate = withoutAt;
  if (/instagram\.com/i.test(withoutAt)) {
    const beforeQueryOrHash = withoutAt.split(/[?#]/)[0] ?? "";
    const withoutTrailingSlash = beforeQueryOrHash.replace(/\/+$/, "");
    const lastSlash = withoutTrailingSlash.lastIndexOf("/");
    candidate =
      lastSlash === -1 ? "" : withoutTrailingSlash.slice(lastSlash + 1);
  }

  const cleaned = candidate.replace(/^@/, "").replace(/\//g, "").toLowerCase();
  const sanitized = cleaned.replace(/[^a-z0-9._]/g, "");
  return sanitized || null;
}

async function apifyRun(
  actId: string,
  token: string,
  input: Record<string, unknown>,
  runOptions?: { memoryMbytes?: number; timeoutSecs?: number }
): Promise<string> {
  const qs = new URLSearchParams({
    token,
    waitForFinish: "0",
  });
  if (typeof runOptions?.memoryMbytes === "number") {
    qs.set("memoryMbytes", String(runOptions.memoryMbytes));
  }
  if (typeof runOptions?.timeoutSecs === "number") {
    qs.set("timeoutSecs", String(runOptions.timeoutSecs));
  }

  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(
    actId
  )}/runs?${qs.toString()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify run error ${res.status}: ${text || res.statusText}`);
  }

  const json = (await res.json()) as { data?: { id?: unknown } };
  const id = json.data?.id;
  if (typeof id !== "string" || !id.trim()) throw new Error("Apify run missing id");
  return id;
}

export type EnqueueNewLeadInput = {
  email: string;
  artist_name: string;
  instagram_input: string;
  is_research?: boolean;
};

export async function enqueueNewLead(input: EnqueueNewLeadInput): Promise<void> {
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    throw new Error("Server misconfiguration: missing APIFY_API_TOKEN");
  }

  const handle = cleanInstagramHandle(input.instagram_input);
  if (!handle) {
    throw new Error("Could not extract Instagram handle");
  }

  let apify_posts_run_id: string;
  let apify_profile_run_id: string;
  apify_posts_run_id = await apifyRun(
    "apify~instagram-post-scraper",
    apifyToken,
    {
      username: [handle],
      resultsLimit: 30,
    },
    {
      memoryMbytes: 2048,
      timeoutSecs: 480,
    }
  );
  apify_profile_run_id = await apifyRun("apify~instagram-profile-scraper", apifyToken, {
    usernames: [handle],
  });

  const supabase = createServiceRoleClient();

  const { error: insertError } = await supabase.from("pending_leads").insert({
    email: input.email.trim().toLowerCase(),
    instagram_handle: handle,
    artist_name: input.artist_name.trim(),
    apify_posts_run_id,
    apify_profile_run_id,
    status: "processing",
    is_research: input.is_research === true,
  });

  if (insertError) {
    throw new Error(insertError.message || "Failed to save pending lead");
  }
}
