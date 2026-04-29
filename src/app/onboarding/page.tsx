import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Welcome to Roadie
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Tell us about your project so we can tailor your content ideas.
          </p>
        </div>

        <OnboardingForm />

        <p className="text-center">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
