import Link from "next/link";
import { redirect } from "next/navigation";
import { myBookings } from "@/lib/deals";
import { rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { signOut } from "@/app/actions";
import { AppHeader, Phone, TabBar } from "@/components/ui";
import { LanguageToggle } from "@/components/forms";
import ThemeToggle from "@/components/ThemeToggle";
import { translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await getMe();
  if (!me) redirect("/login");
  const t = translator(me.user.lang);
  const bookings = myBookings(me.user.id);
  const saved = bookings.reduce((sum, d) => {
    const units = d.joinedByMe?.units ?? 1;
    const paid = d.joinedByMe?.finalPricePaise ?? d.currentPricePaise;
    return sum + Math.max(0, d.listPricePaise - paid) * units;
  }, 0);

  return (
    <Phone>
      <AppHeader title="Profile" />
      <div className="flex-1 px-4 py-4 flex flex-col gap-3">
        <section className="card p-4 flex items-center gap-3">
          <span className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center text-[22px] font-extrabold">
            {me.user.name.slice(0, 1)}
          </span>
          <div>
            <p className="font-extrabold text-[17px]">{me.user.name}</p>
            <p className="text-[13px] text-ink-500">
              +91 {me.user.phone} · {me.user.role}
            </p>
            {me.residency && (
              <p className="text-[13px] text-ink-500">
                {me.residency.societyName} · {me.residency.flat} ·{" "}
                <span className="text-save-700 font-bold">verified</span>
              </p>
            )}
          </div>
        </section>

        <section className="card p-4">
          <p className="eyebrow mb-1">You have saved</p>
          <p className="tnum text-[26px] font-extrabold text-save-700">{rupees(saved)}</p>
          <p className="text-[13px] text-ink-500">across {bookings.length} group bookings.</p>
        </section>

        <section className="card p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Language</p>
              <p className="text-[12px] text-ink-500">App labels switch instantly</p>
            </div>
            <LanguageToggle current={me.user.lang} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Appearance</p>
              <p className="text-[12px] text-ink-500">Follows your device by default</p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        <section className="card divide-y divide-[var(--color-line)]">
          <Link href="/notifications" className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Notifications</p>
              <p className="text-[12px] text-ink-500">Price drops, deadlines, service day</p>
            </div>
            <span className="text-ink-300">›</span>
          </Link>
          {[
            ["Payment methods", "UPI AutoPay · HDFC ••4411"],
            ["Refer your society", "₹500 credit when a neighbouring society books"],
            ["Help & support", "Chat with JODO ops"],
          ].map(([label, note]) => (
            <div key={label} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{label}</p>
                <p className="text-[12px] text-ink-500">{note}</p>
              </div>
              <span className="text-ink-300">›</span>
            </div>
          ))}
        </section>

        <section className="card p-4">
          <p className="eyebrow mb-2">Other consoles in this build</p>
          <div className="flex gap-2">
            <Link href="/vendor" className="btn btn-quiet flex-1 h-10 min-h-10 text-[13px]">
              Vendor
            </Link>
            <Link href="/ops" className="btn btn-quiet flex-1 h-10 min-h-10 text-[13px]">
              Ops
            </Link>
          </div>
        </section>

        <form action={signOut}>
          <button className="btn btn-quiet w-full">Sign out</button>
        </form>
        <div className="h-4" />
      </div>
      <TabBar active="profile" t={t} />
    </Phone>
  );
}
