"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

const INPUT =
  "w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20";

/**
 * Reached from the reset email via /auth/callback, which has already signed
 * the person in with the link's code. Here they choose a new password.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those don't match.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("This reset link has expired or was opened in a different browser. Request a new one from the sign-in page.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }
    router.refresh();
    router.push("/home");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            Choose a new password
          </h1>
        </div>
        <form onSubmit={save} className="space-y-4 rounded-xl border border-card-border bg-card p-6">
          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={INPUT}
            />
          </div>
          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save and sign in"}
          </button>
        </form>
        <p className="text-center">
          <Link href="/login" className="text-sm text-muted hover:text-brand">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
