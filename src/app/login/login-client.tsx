"use client";

import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "signup") setIsSignup(true);
    else if (mode === "signin") setIsSignup(false);
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (isSignup) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        // Sign in immediately after signup so the session is active before redirecting to onboarding
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }

        router.refresh();
        const redirectParam = searchParams.get("redirect");
        const redirectTo =
          redirectParam && redirectParam.startsWith("/")
            ? redirectParam
            : "/onboarding?new=true";
        router.push(redirectTo);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.refresh();
      const redirectParam = searchParams.get("redirect");
      const redirectTo =
        redirectParam && redirectParam.startsWith("/") ? redirectParam : "/home";
      router.push(redirectTo);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <img src="/logo.png" height={48} alt="Tempo" className="h-12 w-auto" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            {isSignup ? "Create your Tempo account" : "Sign in to Tempo"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Content planning built for music artists
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setIsSignup(false);
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
              !isSignup
                ? "bg-brand text-brand-foreground"
                : "bg-input text-muted"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setIsSignup(true);
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isSignup ? "bg-brand text-brand-foreground" : "bg-input text-muted"
            }`}
          >
            Sign up
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-xl border border-card-border bg-card p-6"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="••••••••"
              />
            </div>
            {isSignup ? (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand"
                >
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-card-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="••••••••"
                />
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-black uppercase tracking-wide text-brand-foreground shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {isSignup ? "Creating account..." : "Signing in..."}
              </span>
            ) : isSignup ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <footer className="space-y-4 border-t border-card-border pt-8">
          <p className="text-center">
            <Link
              href="/"
              className="text-sm text-muted underline-offset-4 hover:text-brand hover:underline"
            >
              Back to home
            </Link>
          </p>
          <p className="text-center">
            <Link
              href="/terms"
              className="text-sm text-muted underline-offset-4 hover:text-brand hover:underline"
            >
              Terms of Service
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
