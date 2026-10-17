import { redirect } from "next/navigation";
import { getMe, societies } from "@/lib/session";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.residency) redirect("/");
  return <OnboardingForm societies={societies()} name={me.user.name} />;
}
