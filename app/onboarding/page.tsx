import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/auth-mode";
import { dealReturnHref, dealReturnPath } from "@/lib/deal-return";
import { getMe, societies } from "@/lib/session";
import OnboardingForm from "./OnboardingForm";
import OnboardingShell from "./OnboardingShell";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const me = await getMe();
  const next = dealReturnPath((await searchParams).next);
  if (!me) redirect(dealReturnHref("/login", next));
  if (me.user.role === "vendor") redirect("/vendor");
  if (me.user.role === "ops") redirect("/ops");
  if (me.user.role === "guard") redirect("/society/visitors");
  if (me.residency?.status === "verified") redirect(next ?? "/");
  if (me.residency?.status === "pending") {
    return (
      <OnboardingShell title="Waiting for committee approval" description="Your society committee will review your request before you can access private society tools.">
        <section className="card p-4 mb-4" aria-label="Flat request">
          <p className="font-bold">{me.residency.societyName} · Flat {me.residency.flat}</p>
          <p className="text-sm text-ink-500 capitalize mt-1">{me.residency.type}</p>
        </section>
        <form action="/onboarding" method="get">
          {next && <input type="hidden" name="next" value={next} />}
          <button type="submit" className="btn btn-primary w-full">Check status</button>
        </form>
      </OnboardingShell>
    );
  }
  return (
    <OnboardingForm
      societies={await societies()} name={me.user.name} next={next} demo={isDemoMode()}
      rejected={me.residency?.status === "rejected" ? me.residency : undefined}
    />
  );
}
