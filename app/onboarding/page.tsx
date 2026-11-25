import { redirect } from "next/navigation";
import { dealReturnHref, dealReturnPath } from "@/lib/deal-return";
import { getMe, societies } from "@/lib/session";
import OnboardingForm from "./OnboardingForm";

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
  if (me.residency) redirect(next ?? "/");
  return <OnboardingForm societies={await societies()} name={me.user.name} next={next} />;
}
