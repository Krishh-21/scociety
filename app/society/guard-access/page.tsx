import { notFound, redirect } from "next/navigation";
import { AppHeader, Phone } from "@/components/ui";
import { getMe } from "@/lib/session";
import { listSocietyGuards } from "@/lib/society-access";
import { AddGuardForm, GuardToggleForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function GuardAccessPage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.user.role !== "secretary" || me.residency?.status !== "verified") notFound();
  const guards = listSocietyGuards(me);
  return (
    <Phone>
      <AppHeader title="Guard access" subtitle={me.residency.societyName} back={{ href: "/society" }} />
      <div className="px-4 py-4 grid gap-3">
        <section className="card p-4">
          <h2 className="font-extrabold">Add a guard</h2>
          <p className="mt-1 text-sm text-ink-500">The guard signs in with this number to open your society’s visitor log.</p>
          <AddGuardForm />
        </section>
        <section className="grid gap-2">
          <h2 className="font-extrabold">Guard accounts</h2>
          {!guards.length && <p className="card p-4 text-sm text-ink-500">No guards are assigned.</p>}
          {guards.map((guard) => (
            <article key={guard.userId} className="card p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <div><p className="font-bold">{guard.name}</p><p className="text-sm text-ink-500 tnum">{guard.phone}</p></div>
                <span className="pill bg-canvas-alt text-ink-700">{guard.isActive ? "Active" : "Paused"}</span>
              </div>
              <GuardToggleForm key={guard.isActive} guardId={guard.userId} active={guard.isActive === 1} />
            </article>
          ))}
        </section>
      </div>
    </Phone>
  );
}
