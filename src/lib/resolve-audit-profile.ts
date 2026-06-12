import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanInstagramHandle } from "@/lib/new-lead-pipeline";

export type AuditProfileMatch = {
  id: string;
  owner_user_id: string;
  account_type: string | null;
  genre: string | null;
};

const PROFILE_SELECT = "id, owner_user_id, account_type, genre, instagram_handle";

function profileHandleMatches(
  stored: string | null | undefined,
  normalizedHandle: string
): boolean {
  const storedNorm = cleanInstagramHandle(stored ?? "");
  if (storedNorm && storedNorm === normalizedHandle) return true;
  return (stored ?? "").trim().toLowerCase() === normalizedHandle;
}

async function getUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

function toProfileMatch(row: {
  id: unknown;
  owner_user_id: unknown;
  account_type: unknown;
  genre: unknown;
}): AuditProfileMatch {
  return {
    id: String(row.id),
    owner_user_id: String(row.owner_user_id),
    account_type:
      typeof row.account_type === "string" ? row.account_type : null,
    genre: typeof row.genre === "string" ? row.genre : null,
  };
}

/**
 * Links a completed audit to the correct artist profile.
 * Prefers email + handle; falls back to handle only when unambiguous.
 */
export async function resolveProfileForAudit(
  supabase: SupabaseClient,
  args: { instagramHandle: string; email: string }
): Promise<AuditProfileMatch | null> {
  const normalizedHandle =
    cleanInstagramHandle(args.instagramHandle) ??
    args.instagramHandle.trim().toLowerCase();
  const email = args.email.trim().toLowerCase();

  if (!normalizedHandle || !email) return null;

  let ownerUserId: string | null = null;
  try {
    ownerUserId = await getUserIdByEmail(supabase, email);
  } catch (authError) {
    console.error("resolveProfileForAudit: auth lookup failed", {
      email,
      error: authError instanceof Error ? authError.message : authError,
    });
  }

  if (ownerUserId) {
    const { data: ownedProfiles, error: ownedError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("owner_user_id", ownerUserId);

    if (ownedError) {
      console.error("resolveProfileForAudit: profile lookup failed", {
        ownerUserId,
        error: ownedError.message,
      });
    } else {
      const match = (ownedProfiles ?? []).find((p) =>
        profileHandleMatches(
          typeof p.instagram_handle === "string" ? p.instagram_handle : null,
          normalizedHandle
        )
      );
      if (match) return toProfileMatch(match);
    }
  }

  const { data: byHandle, error: handleError } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .ilike("instagram_handle", normalizedHandle);

  if (handleError) {
    console.error("resolveProfileForAudit: handle lookup failed", {
      handle: normalizedHandle,
      error: handleError.message,
    });
    return null;
  }

  const candidates = (byHandle ?? []).filter((p) =>
    profileHandleMatches(
      typeof p.instagram_handle === "string" ? p.instagram_handle : null,
      normalizedHandle
    )
  );

  if (candidates.length === 1) {
    return toProfileMatch(candidates[0]);
  }

  if (candidates.length > 1) {
    console.warn("resolveProfileForAudit: ambiguous instagram handle", {
      handle: normalizedHandle,
      email,
      profileIds: candidates.map((p) => p.id),
    });
  }

  return null;
}
