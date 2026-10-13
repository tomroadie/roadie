import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { readLinkForEvent } from "@/lib/date-links";

export const maxDuration = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * { id }: read the link on one of the artist's dates now and keep a short
 * summary. Access is checked by reading the date with the artist's own client.
 */
export async function POST(request: Request) {
  let id = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    id = typeof body.id === "string" ? body.id.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: ev } = await supabase.from("events").select("id, link_url").eq("id", id).maybeSingle();
  if (!ev) return NextResponse.json({ error: "Date not found" }, { status: 404 });
  if (!ev.link_url) return NextResponse.json({ status: null, context: null });

  const result = await readLinkForEvent(createServiceRoleClient(), id);
  return NextResponse.json(result);
}
