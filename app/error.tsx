"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Where Sentry would take it; the digest is what ties this screen to the server log.
    console.error("jodo_error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="min-h-screen bg-canvas-alt grid place-items-center px-5">
      <div className="card p-6 max-w-[420px] w-full">
        <p className="eyebrow mb-2">Something broke</p>
        <h1 className="text-[22px] font-extrabold leading-snug mb-2">That didn&apos;t load</h1>
        <p className="text-sm text-ink-700 mb-4">
          Nothing was charged and no group changed — this is a display error. Try again, and if it keeps happening send
          ops the code below.
        </p>
        {error.digest && (
          <p className="tnum text-[12px] text-ink-500 mb-4">
            Reference: <strong>{error.digest}</strong>
          </p>
        )}
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn btn-quiet flex-1">
            Back to app
          </Link>
        </div>
      </div>
    </main>
  );
}
