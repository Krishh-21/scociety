import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-canvas-alt grid place-items-center px-5">
      <div className="card p-6 max-w-[420px] w-full">
        <p className="eyebrow mb-2">Not found</p>
        <h1 className="text-[22px] font-extrabold leading-snug mb-2">There&apos;s nothing here</h1>
        <p className="text-sm text-ink-700 mb-4">
          Groups are private to the society they belong to, so this page may simply not be yours to open.
        </p>
        <Link href="/" className="btn btn-primary w-full">
          Back to your society
        </Link>
      </div>
    </main>
  );
}
