import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";
import { normalizePlan, type RoadiePlan } from "@/lib/plan-limits";

const PLAN_VALUES: RoadiePlan[] = ["free", "starter", "pro", "label"];
const ACCOUNT_TYPE_VALUES = ["artist", "venue"] as const;
type AccountType = (typeof ACCOUNT_TYPE_VALUES)[number];

const ARTIST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
  let artistId = "";
  let cronActive: boolean | undefined;
  let planOverride: string | null | undefined;
  let plan: string | undefined;
  let isManaged: boolean | undefined;
  let isPrivate: boolean | undefined;
  let accountType: AccountType | undefined;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = typeof body.artist_id === "string" ? body.artist_id.trim() : "";
    if (typeof body.cron_active === "boolean") {
      cronActive = body.cron_active;
    }
    if (typeof body.is_managed === "boolean") {
      isManaged = body.is_managed;
    }
    if (typeof body.is_private === "boolean") {
      isPrivate = body.is_private;
    }
    if (body.plan_override === null) {
      planOverride = null;
    } else if (typeof body.plan_override === "string") {
      planOverride = body.plan_override.trim().toLowerCase();
    }
    if (typeof body.plan === "string") {
      plan = body.plan.trim().toLowerCase();
    }
    if (typeof body.account_type === "string") {
      accountType = body.account_type.trim().toLowerCase() as AccountType;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!artistId || !ARTIST_ID_UUID_RE.test(artistId)) {
    return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });
  }

  const hasUpdate =
    cronActive !== undefined ||
    planOverride !== undefined ||
    plan !== undefined ||
    isManaged !== undefined ||
    isPrivate !== undefined ||
    accountType !== undefined;

  if (!hasUpdate) {
    return NextResponse.json(
      {
        error:
          "Expected cron_active, plan_override, plan, is_managed, is_private, and/or account_type",
      },
      { status: 400 }
    );
  }

  if (
    planOverride !== undefined &&
    planOverride !== null &&
    !PLAN_VALUES.includes(normalizePlan(planOverride))
  ) {
    return NextResponse.json({ error: "Invalid plan_override" }, { status: 400 });
  }

  if (plan !== undefined && !PLAN_VALUES.includes(normalizePlan(plan))) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (
    accountType !== undefined &&
    !ACCOUNT_TYPE_VALUES.includes(accountType)
  ) {
    return NextResponse.json({ error: "Invalid account_type" }, { status: 400 });
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

  const updates: Record<string, boolean | string | null> = {};
  if (cronActive !== undefined) {
    updates.cron_active = cronActive;
  }
  if (planOverride !== undefined) {
    updates.plan_override = planOverride;
  }
  if (plan !== undefined) {
    updates.plan = normalizePlan(plan);
  }
  if (isManaged !== undefined) {
    updates.is_managed = isManaged;
  }
  if (isPrivate !== undefined) {
    updates.is_private = isPrivate;
  }
  if (accountType !== undefined) {
    updates.account_type = accountType;
  }

  let adminSupabase: ReturnType<typeof createServiceRoleClient>;
  try {
    adminSupabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { error } = await adminSupabase
    .from("profiles")
    .update(updates)
    .eq("id", artistId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update artist", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
