"use client";

import { Suspense } from "react";
import { MetaPixelScript } from "@/components/meta-pixel-script";
import { MetaPixelDashboardEvents } from "./meta-pixel-dashboard-events";

export function DashboardTracking() {
  return (
    <>
      <MetaPixelScript />
      <Suspense fallback={null}>
        <MetaPixelDashboardEvents />
      </Suspense>
    </>
  );
}
