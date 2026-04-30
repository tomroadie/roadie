"use client";

import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    }

    router.refresh();
    router.push("/dashboard");
    setLoading(false);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isSignUp ? "Create your Roadie account" : "Sign in to Roadie"}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            AI-powered content planning for music artists
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-foreground"
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
                className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-zinc-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 dark:border-zinc-800 dark:focus:border-[#7C3AED] dark:focus:ring-[#7C3AED]/20"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-[#7C3AED] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>

        <p className="text-center">
          <Link
            href="/"
            className="text-sm text-zinc-500 underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
