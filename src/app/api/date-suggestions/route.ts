import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * { id, action: "accept" | "dismiss", date? } for a date spotted in a caption.
 * Accepting adds it to the artist's dates; date (YYYY-MM-DD) is needed when
 * the post didn't give one. The database function checks access.
 */
export async function POST(request: Request) {
  let id = "";
  let action = "";
  let date: string | null = null;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    id = typeof body.id === "string" ? body.id.trim() : "";
    action = typeof body.action === "string" ? body.action : "";
    if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) date = body.date;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!UUID_RE.test(id) || (action !== "accept" && action !== "dismiss")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.rpc("resolve_date_suggestion", {
    p_suggestion_id: id,
    p_action: action,
    p_date: date,
  });
  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "22023" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
