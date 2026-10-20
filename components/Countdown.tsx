"use client";

import { useEffect, useState } from "react";
import { countdown } from "@/lib/pricing";

export default function Countdown({ to, prefix = "Closes in " }: { to: string; prefix?: string }) {
  const target = new Date(to).getTime();
  const [ms, setMs] = useState(() => target - Date.now());

  useEffect(() => {
    const t = setInterval(() => setMs(target - Date.now()), 30_000);
    return () => clearInterval(t);
  }, [target]);

  const urgent = ms > 0 && ms < 24 * 3_600_000;
  return (
    <span className={`pill tnum whitespace-nowrap ${urgent ? "bg-warn-50 text-warn-600" : "bg-canvas-alt text-ink-500"}`}>
      {ms <= 0 ? "Closed" : prefix + countdown(ms)}
    </span>
  );
}
