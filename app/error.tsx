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
      <div className="card w-full max-w-md border-t-4 border-t-brand-600 p-6 sm:p-8">
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight">This page couldn&apos;t load</h1>
        <p className="text-sm text-ink-700 mb-4">
          Try again. If the problem continues, contact support{error.digest ? " with the reference below" : ""}.
        </p>
        {error.digest && (
          <p className="tnum text-[12px] text-ink-500 mb-4">
            Reference: <strong>{error.digest}</strong>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary flex-1" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn btn-quiet flex-1">
            Back to JODO
          </Link>
        </div>
      </div>
    </main>
  );
}
