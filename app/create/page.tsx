import { redirect } from "next/navigation";
import { listSkus, listVendors } from "@/lib/deals";
import { getMe } from "@/lib/session";
import { AppHeader, Phone, TabBar } from "@/components/ui";
import CreateForm from "./CreateForm";

export const dynamic = "force-dynamic";

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ sku?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (!me.residency) redirect("/onboarding");
  const [{ sku }, skus, vendors] = await Promise.all([searchParams, listSkus(), listVendors()]);

  return (
    <Phone>
      <AppHeader back={{ href: "/" }} title="Start a group" subtitle={me.residency.societyName} />
      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8">
        <CreateForm skus={skus} vendors={vendors} preselect={sku} />
      </div>
      <TabBar active="home" mobile={false} />
    </Phone>
  );
}
