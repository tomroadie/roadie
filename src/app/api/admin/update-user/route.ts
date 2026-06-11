import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  let userId = "";
  let allEmailsPaused: boolean | undefined;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    if (typeof body.all_emails_paused === "boolean") {
      allEmailsPaused = body.all_emails_paused;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid user_id" }, { status: 400 });
  }

  if (allEmailsPaused === undefined) {
    return NextResponse.json(
      { error: "Expected all_emails_paused" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await userIsAdmin(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ all_emails_paused: allEmailsPaused })
    .eq("owner_user_id", userId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update user", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
