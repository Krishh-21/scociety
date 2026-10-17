"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

/**
 * Dark mode follows the device by default (the tokens are defined under
 * prefers-color-scheme); this only exists for people who want to override it.
 * Stored per browser, never on the server.
 */
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jodo-theme") as Mode | null;
      if (saved) setMode(saved);
    } catch {
      /* private window */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
    try {
      localStorage.setItem("jodo-theme", mode);
    } catch {
      /* private window */
    }
  }, [mode]);

  return (
    <div className="flex gap-1.5" role="group" aria-label="Theme">
      {(["system", "light", "dark"] as Mode[]).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={`pill capitalize ${mode === m ? "bg-brand-600 text-white" : "bg-canvas-alt text-ink-700"}`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
