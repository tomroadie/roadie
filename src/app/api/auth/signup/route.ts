import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/admin";

export async function POST(request: Request) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing TURNSTILE_SECRET_KEY" },
      { status: 500 }
    );
  }

  let email = "";
  let password = "";
  let token = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    email = typeof body.email === "string" ? body.email.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
    token =
      typeof body.turnstile_token === "string" ? body.turnstile_token : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }
  if (!token) {
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 400 }
    );
  }

  const verifyRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    }
  );

  const verifyData = (await verifyRes.json().catch(() => null)) as {
    success?: boolean;
  } | null;

  if (!verifyRes.ok || verifyData?.success !== true) {
    return NextResponse.json(
      { error: "Verification failed" },
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

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    const isDuplicate =
      createError.message.toLowerCase().includes("already") ||
      createError.status === 422;
    return NextResponse.json(
      {
        error: isDuplicate
          ? "An account with this email already exists. Try signing in instead."
          : createError.message,
      },
      { status: isDuplicate ? 409 : 500 }
    );
  }

  return NextResponse.json({ success: true });
}
