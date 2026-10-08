"use client";

import { Suspense } from "react";
import { MetaPixelDashboardEvents } from "./meta-pixel-dashboard-events";

export function DashboardTracking() {
  return (
    <>
      <Suspense fallback={null}>
        <MetaPixelDashboardEvents />
      </Suspense>
    </>
  );
}
