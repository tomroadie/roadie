import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let userId = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid user_id" }, { status: 400 });
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

  if (userId === user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account from here" },
      { status: 400 }
    );
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: profileRows, error: profileLookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("owner_user_id", userId);

  if (profileLookupError) {
    console.error("delete-user: profile lookup failed", profileLookupError.message);
    return NextResponse.json(
      { error: profileLookupError.message },
      { status: 500 }
    );
  }

  const artistIds = (profileRows ?? []).map((row) => String(row.id));

  for (const artistId of artistIds) {
    const steps: Array<{
      label: string;
      run: () => PromiseLike<{ error: { message: string } | null }>;
    }> = [
      {
        label: "email_log",
        run: async () =>
          admin
            .from("email_log")
            .delete()
            .or(`artist_id.eq.${artistId},user_id.eq.${userId}`),
      },
      {
        label: "usage_events",
        run: async () =>
          admin.from("usage_events").delete().eq("user_id", userId),
      },
      {
        label: "plan_revision_requests",
        run: async () =>
          admin
            .from("plan_revision_requests")
            .delete()
            .eq("artist_id", artistId),
      },
      {
        label: "weekly_checkins",
        run: async () =>
          admin.from("weekly_checkins").delete().eq("artist_id", artistId),
      },
      {
        label: "content_reviews",
        run: async () =>
          admin.from("content_reviews").delete().eq("artist_id", artistId),
      },
      {
        label: "saved_ideas",
        run: async () =>
          admin.from("saved_ideas").delete().eq("artist_id", artistId),
      },
      {
        label: "weekly_plans",
        run: async () =>
          admin.from("weekly_plans").delete().eq("artist_id", artistId),
      },
      {
        label: "audits",
        run: async () => admin.from("audits").delete().eq("artist_id", artistId),
      },
      {
        label: "post_performance",
        run: async () =>
          admin.from("post_performance").delete().eq("artist_id", artistId),
      },
      {
        label: "events",
        run: async () => admin.from("events").delete().eq("artist_id", artistId),
      },
      {
        label: "profiles",
        run: async () => admin.from("profiles").delete().eq("id", artistId),
      },
      {
        label: "artists",
        run: async () => admin.from("artists").delete().eq("id", artistId),
      },
    ];

    for (const step of steps) {
      const { error } = await step.run();
      if (error) {
        console.error(
          `delete-user: ${step.label} failed for artist ${artistId}`,
          error.message
        );
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
  if (authDeleteError) {
    console.error("delete-user: auth user delete failed", authDeleteError.message);
    return NextResponse.json({ error: authDeleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_artists: artistIds.length });
}
