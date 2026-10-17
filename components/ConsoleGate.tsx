import Link from "next/link";
import { signOut } from "@/app/actions";

/**
 * Shown when a signed-in user opens a console they aren't allowed to drive.
 * The consoles used to fall back to a default vendor, which meant any resident
 * could re-price a ladder or close someone else's job.
 */
export default function ConsoleGate({
  console: name,
  phone,
  you,
}: {
  console: "ops" | "vendor";
  phone: string;
  you: string;
}) {
  const label = name === "ops" ? "JODO ops console" : "vendor console";
  return (
    <main className="min-h-screen bg-canvas-alt grid place-items-center px-5">
      <div className="card p-6 max-w-[420px] w-full">
        <p className="eyebrow mb-2">{label}</p>
        <h1 className="text-[22px] font-extrabold leading-snug mb-2">This console isn&apos;t yours</h1>
        <p className="text-sm text-ink-700 mb-4">
          You&apos;re signed in as <strong>{you}</strong>. The {label} is limited to{" "}
          {name === "ops" ? "JODO ops" : "the vendor who owns the work"} — locking groups, re-pricing ladders and
          closing jobs all change what somebody else pays.
        </p>
        <p className="text-sm text-ink-500 mb-5">
          To look around, sign out and use <span className="tnum font-bold">{phone}</span> (code 1234).
        </p>
        <div className="flex gap-2">
          <form action={signOut} className="flex-1">
            <button className="btn btn-primary w-full">Sign out</button>
          </form>
          <Link href="/" className="btn btn-quiet flex-1">
            Back to app
          </Link>
        </div>
      </div>
    </main>
  );
}
