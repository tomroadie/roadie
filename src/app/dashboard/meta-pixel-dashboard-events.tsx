"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trackMeta } from "@/lib/meta-pixel";

export function MetaPixelDashboardEvents() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const upgraded = searchParams.get("upgraded") === "true";
    const registered = searchParams.get("registered") === "true";
    if (!upgraded && !registered) return;

    const dedupeKey = `meta_pixel:${searchParams.toString()}`;
    if (typeof sessionStorage !== "undefined") {
      if (sessionStorage.getItem(dedupeKey)) return;
      sessionStorage.setItem(dedupeKey, "1");
    }

    if (upgraded) trackMeta("Purchase");
    if (registered) trackMeta("CompleteRegistration");

    const url = new URL(window.location.href);
    url.searchParams.delete("upgraded");
    url.searchParams.delete("registered");
    const qs = url.searchParams.toString();
    const next = qs ? `${url.pathname}?${qs}` : url.pathname;
    router.replace(next, { scroll: false });
  }, [searchParams, router]);

  return null;
}
