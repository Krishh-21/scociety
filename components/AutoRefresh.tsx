"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The counter is the product, so the screen it lives on has to move on its own.
 * Polls while the tab is visible and refreshes immediately when it comes back.
 */
export default function AutoRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<number>(() => Date.now());

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      // A refresh cancels an in-flight server action, which would leave a join
      // spinning forever. Anything mid-submit marks itself aria-busy.
      if (document.querySelector('[aria-busy="true"]')) return;
      router.refresh();
      setUpdatedAt(Date.now());
    };
    const timer = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);

  const secondsAgo = Math.round((Date.now() - updatedAt) / 1000);
  return (
    <span className="text-[11px] text-ink-300" aria-live="polite">
      {secondsAgo < 30 ? "Live" : "Updating…"}
    </span>
  );
}
