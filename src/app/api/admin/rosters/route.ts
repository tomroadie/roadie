import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { userIsAdmin } from "@/lib/is-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Admin-only. Body:
 *   { action: "create", name, artist_ids }       -> { id }
 *   { action: "update", roster_id, name?, artist_ids? }
 * artist_ids replaces the roster's artists.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await userIsAdmin(supabase, user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined;
  const ids = Array.isArray(body.artist_ids)
    ? [...new Set(body.artist_ids.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)))]
    : undefined;
  const admin = createServiceRoleClient();

  let rosterId = typeof body.roster_id === "string" ? body.roster_id : "";
  if (body.action === "create") {
    if (!name) return NextResponse.json({ error: "Give the roster a name" }, { status: 400 });
    const { data, error } = await admin.from("rosters").insert({ name, created_by: user.id }).select("id").single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Couldn't create it" }, { status: 500 });
    rosterId = String(data.id);
    await admin.from("roster_members").insert({ roster_id: rosterId, user_id: user.id, role: "owner" });
  } else if (body.action === "update") {
    if (!UUID_RE.test(rosterId)) return NextResponse.json({ error: "Invalid roster_id" }, { status: 400 });
    if (name) {
      const { error } = await admin.from("rosters").update({ name }).eq("id", rosterId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (ids) {
    const { error: delErr } = await admin.from("roster_artists").delete().eq("roster_id", rosterId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    if (ids.length) {
      const { error: insErr } = await admin.from("roster_artists").insert(ids.map((artist_id) => ({ roster_id: rosterId, artist_id })));
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, id: rosterId });
}
