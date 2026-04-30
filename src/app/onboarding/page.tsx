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
        <div className="flex justify-center">
          <img src="/logo.png" height={48} alt="Roadie" className="h-12 w-auto" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
            Welcome to Roadie
          </h1>
          <p className="mt-2 text-sm text-muted">
            Tell us about your project so we can tailor your content ideas.
          </p>
        </div>

        <OnboardingForm />

        <p className="text-center">
          <Link
            href="/dashboard"
            className="text-sm text-muted underline-offset-4 hover:text-brand hover:underline"
          >
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
