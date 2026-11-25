import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-canvas-alt grid place-items-center px-5">
      <div className="card w-full max-w-md border-t-4 border-t-brand-600 p-6 sm:p-8">
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight">Page unavailable</h1>
        <p className="text-sm text-ink-700 mb-4">
          The link may be out of date, or the page may be private to another society.
        </p>
        <Link href="/" className="btn btn-primary w-full">
          Back to JODO
        </Link>
      </div>
    </main>
  );
}
