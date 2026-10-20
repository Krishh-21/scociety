"use client";

import { useEffect } from "react";
import { trackEvent } from "@/app/actions";

/**
 * Records a view once per visit. Tracking from the server component counted every
 * 30-second auto-refresh as another view, which inflated the ops funnel.
 */
export default function TrackView({ name, props }: { name: string; props: Record<string, unknown> }) {
  const key = JSON.stringify(props);
  useEffect(() => {
    trackEvent(name, JSON.parse(key)).catch(() => {});
  }, [name, key]);
  return null;
}
