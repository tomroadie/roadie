import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  IG_ACCOUNT_SELECTION_COOKIE,
  instagramTokenExpiresAt,
  parseIgAccountSelectionCookie,
} from "@/lib/instagram-account-selection";
import { userIsAdmin } from "@/lib/is-admin";

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function POST(request: Request) {
  const fail = () => redirect(request, "/settings?error=instagram_connect_failed");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect(request, "/login?redirect=/connect/instagram/select");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail();
  }

  const igUserId = (body as { igUserId?: unknown })?.igUserId;
  if (typeof igUserId !== "string" || !igUserId.trim()) {
    return fail();
  }

  const cookieStore = await cookies();
  const payload = parseIgAccountSelectionCookie(
    cookieStore.get(IG_ACCOUNT_SELECTION_COOKIE)?.value
  );

  if (!payload) {
    return fail();
  }

  const account = payload.accounts.find((a) => a.igUserId === igUserId.trim());
  if (!account) {
    return fail();
  }

  const isAdmin = await userIsAdmin(supabase, user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("owner_user_id")
    .eq("id", payload.artistId)
    .maybeSingle();

  if (!profile || (!isAdmin && profile.owner_user_id !== user.id)) {
    return fail();
  }

  const admin = createServiceRoleClient();
  const { data: updated, error: dbError } = await admin
    .from("profiles")
    .update({
      instagram_access_token: account.pageAccessToken,
      instagram_user_id: account.igUserId,
      instagram_token_expires_at: instagramTokenExpiresAt(),
    })
    .eq("id", payload.artistId)
    .select("id");

  if (dbError || !updated?.length) {
    return fail();
  }

  const response = redirect(request, "/home");
  response.cookies.set(IG_ACCOUNT_SELECTION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    maxAge: 0,
    path: "/",
  });

  return response;
}
