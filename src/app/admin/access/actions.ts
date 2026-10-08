"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { sendInvite } from "@/lib/invites";

export type InviteResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user && (await userIsAdmin(supabase, user.id)));
}

/** Invite someone who requested access (or re-send their invite). */
export async function inviteRequest(requestId: string, email: string): Promise<InviteResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Admins only." };
  const result = await sendInvite(createServiceRoleClient(), { email, requestId });
  revalidatePath("/admin/access");
  return result;
}

/** Invite someone directly, without a request. */
export async function inviteByEmail(_prev: InviteResult | null, form: FormData): Promise<InviteResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Admins only." };
  const result = await sendInvite(createServiceRoleClient(), {
    email: String(form.get("email") ?? ""),
    name: String(form.get("name") ?? "") || null,
  });
  revalidatePath("/admin/access");
  return result;
}

export async function declineRequest(requestId: string): Promise<InviteResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Admins only." };
  const { error } = await createServiceRoleClient()
    .from("access_requests")
    .update({ status: "declined", invite_token: null })
    .eq("id", requestId);
  revalidatePath("/admin/access");
  return error ? { ok: false, error: error.message } : { ok: true };
}
