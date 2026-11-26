import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isDemoMode } from "@/lib/auth-mode";
import { dealReturnPath } from "@/lib/deal-return";
import { getMe } from "@/lib/session";
import DemoSignIn from "./DemoSignIn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demo sign-in", robots: { index: false, follow: false } };

export default async function DemoSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  // Live SMS deployments have no demo accounts; the action refuses them too.
  if (!isDemoMode()) notFound();
  const { next } = await searchParams;
  if (await getMe()) redirect("/");
  return <DemoSignIn next={dealReturnPath(next)} />;
}
