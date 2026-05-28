import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";

const ARTIST_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let artistId = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    artistId = typeof body.artist_id === "string" ? body.artist_id.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!artistId || !ARTIST_ID_UUID_RE.test(artistId)) {
    return NextResponse.json({ error: "Invalid artist_id" }, { status: 400 });
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

  const { data: profile, error: profileLookupError } = await admin
    .from("profiles")
    .select("id, owner_user_id")
    .eq("id", artistId)
    .maybeSingle();

  if (profileLookupError) {
    console.error("delete-artist: profile lookup failed", profileLookupError.message);
    return NextResponse.json(
      { error: profileLookupError.message },
      { status: 500 }
    );
  }

  if (!profile?.owner_user_id) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  const ownerUserId = profile.owner_user_id;

  const { data: artistRows, error: artistLookupError } = await admin
    .from("artists")
    .select("id")
    .eq("owner_user_id", ownerUserId);

  if (artistLookupError) {
    console.error("delete-artist: artists lookup failed", artistLookupError.message);
    return NextResponse.json(
      { error: artistLookupError.message },
      { status: 500 }
    );
  }

  if (!artistRows?.some((row) => row.id === artistId)) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

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
          .or(`artist_id.eq.${artistId},user_id.eq.${ownerUserId}`),
    },
    {
      label: "usage_events",
      run: async () =>
        admin.from("usage_events").delete().eq("user_id", ownerUserId),
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
      console.error(`delete-artist: ${step.label} failed`, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { count, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", ownerUserId);

  if (countError) {
    console.error("delete-artist: profile count failed", countError.message);
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) === 0) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(
      ownerUserId
    );
    if (authDeleteError) {
      console.error("delete-artist: auth user delete failed", authDeleteError.message);
      return NextResponse.json({ error: authDeleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
