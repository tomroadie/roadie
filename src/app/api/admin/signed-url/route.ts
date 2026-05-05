import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { userIsAdmin } from "@/lib/is-admin";
import { createServiceRoleClient } from "@/utils/supabase/admin";

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPath = asTrimmedString(url.searchParams.get("path"));
  const path = rawPath.replace(/^\/+/, "").trim();

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await userIsAdmin(supabase, user.id);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let adminSupabase: ReturnType<typeof createServiceRoleClient>;
  try {
    adminSupabase = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuration error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data, error } = await adminSupabase.storage
    .from("content-reviews")
    .createSignedUrl(path, 3600);

  if (error) {
    return NextResponse.json(
      { error: "Failed to create signed URL", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ signedUrl: data?.signedUrl ?? null });
}

