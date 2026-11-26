import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";
import { BrandMark } from "@/components/Brand";

export default function OnboardingShell({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-canvas-alt flex justify-center">
      <div className="w-full max-w-[460px] bg-canvas min-h-screen border-x border-line px-5 py-8">
        <Link href="/" aria-label="JODO home" className="inline-flex items-center gap-2 mb-6 text-[20px] font-extrabold tracking-tight">
          <BrandMark size={30} />
          <span aria-hidden="true">jodo</span>
        </Link>
        <h1 className="text-[26px] font-extrabold leading-tight mb-1">{title}</h1>
        <p className="text-ink-500 text-[15px] mb-6">{description}</p>
        {children}
        <div className="mt-5 flex items-center justify-between gap-3 text-sm font-bold text-brand-700">
          <Link href="/help">Get help with your flat</Link>
          <form action={signOut}>
            <button type="submit" className="cursor-pointer">Sign out</button>
          </form>
        </div>
      </div>
    </main>
  );
}
