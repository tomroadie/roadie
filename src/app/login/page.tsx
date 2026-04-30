import { Suspense } from "react";
import LoginClient from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="px-4 py-10 sm:px-6">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
