import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";
import { cleanInstagramHandle } from "@/lib/new-lead-pipeline";
import { escapeHtml, notifyAdminEmail } from "@/lib/admin-notify";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function turnstileOk(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured (e.g. local); the form still works
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token }),
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
  return res.ok && data?.success === true;
}

/** "Request access" from the holding page. Stores the request and tells the admin. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const email = str("email", 200).toLowerCase();
  const artistName = str("artist_name", 120);
  const handle = cleanInstagramHandle(str("instagram", 120)) ?? null;
  const note = str("note", 500);

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!(await turnstileOk(str("turnstile_token", 4000)))) {
    return NextResponse.json({ error: "Couldn't verify you're human. Please try again." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: existing } = await admin.from("access_requests").select("id").ilike("email", email).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, already: true });

  const { error } = await admin.from("access_requests").insert({
    email,
    artist_name: artistName || null,
    instagram_handle: handle,
    note: note || null,
  });
  if (error) {
    console.error("request-access insert failed", error.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  await notifyAdminEmail(
    `Tempo: access request from ${artistName || email}`,
    `<p><strong>${escapeHtml(artistName || "(no name)")}</strong>${handle ? ` · @${escapeHtml(handle)}` : ""}<br/>${escapeHtml(email)}</p>${
      note ? `<p>${escapeHtml(note)}</p>` : ""
    }`
  );
  return NextResponse.json({ ok: true });
}
