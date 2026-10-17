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
  const { sku } = await searchParams;

  return (
    <Phone>
      <AppHeader title="Start a group" subtitle={me.residency.societyName} />
      <div className="flex-1 px-4 py-4">
        <CreateForm skus={listSkus()} vendors={listVendors()} preselect={sku} />
      </div>
      <TabBar active="home" />
    </Phone>
  );
}
