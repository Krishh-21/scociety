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
  const bookings = await myBookings(me.user.id);
  const saved = bookings.reduce((sum, d) => {
    const units = d.joinedByMe?.units ?? 1;
    const paid = d.joinedByMe?.finalPricePaise ?? d.currentPricePaise;
    return sum + Math.max(0, d.listPricePaise - paid) * units;
  }, 0);

  return (
    <Phone>
      <AppHeader title="Profile" />
      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 grid gap-4 content-start md:grid-cols-2 md:items-start">
        <section className="jd-band p-5 sm:p-6 flex items-center gap-4 md:col-span-2" aria-label="Your account">
          <span aria-hidden="true" className="w-16 h-16 shrink-0 rounded-2xl bg-[#dce99e] text-[#132c24] grid place-items-center text-[26px] font-extrabold">
            {me.user.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-[20px] leading-tight break-words">{me.user.name}</p>
            <p className="text-[13px] jd-band__muted mt-0.5">
              +91 <span className="tnum">{me.user.phone}</span> · <span className="capitalize">{me.user.role}</span>
            </p>
            {me.residency && (
              <p className="text-[13px] jd-band__muted break-words">
                {me.residency.societyName} · {me.residency.flat} ·{" "}
                <span className="text-[#dce99e] font-bold">verified</span>
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="card p-4 sm:p-5">
            <p className="eyebrow mb-1">You have saved</p>
            <p className="tnum text-[30px] font-extrabold tracking-tight text-save-700">{rupees(saved)}</p>
            <p className="text-[13px] text-ink-500">across {bookings.length} group bookings.</p>
          </section>

          <section className="card p-4 sm:p-5 flex flex-col gap-4" aria-labelledby="profile-preferences">
            <h2 id="profile-preferences" className="jd-section-title">Preferences</h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Language</p>
                <p className="text-[12px] text-ink-500">App labels switch instantly</p>
              </div>
              <LanguageToggle current={me.user.lang} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Appearance</p>
                <p className="text-[12px] text-ink-500">Follows your device by default</p>
              </div>
              <ThemeToggle />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card divide-y divide-line overflow-hidden">
            <Link href="/notifications" className="p-4 flex items-center justify-between gap-3 hover:bg-canvas-alt">
              <div>
                <p className="text-sm font-bold">Notifications</p>
                <p className="text-[12px] text-ink-500">Price drops, deadlines, service day</p>
              </div>
              <span aria-hidden="true" className="text-ink-500 rtl:-scale-x-100">›</span>
            </Link>
            {[
              ["Payment methods", "UPI AutoPay · HDFC ••4411"],
              ["Refer your society", "₹500 credit when a neighbouring society books"],
              ["Help & support", "Chat with JODO ops"],
            ].map(([label, note]) => (
              <div key={label} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">{label}</p>
                  <p className="text-[12px] text-ink-500">{note}</p>
                </div>
                <span aria-hidden="true" className="text-ink-300">›</span>
              </div>
            ))}
          </section>

          <section className="card p-4 sm:p-5">
            <h2 className="eyebrow mb-2">Other consoles in this build</h2>
            <div className="flex gap-2">
              <Link href="/vendor" className="btn btn-quiet flex-1 min-h-10 text-[13px]">
                Vendor
              </Link>
              <Link href="/ops" className="btn btn-quiet flex-1 min-h-10 text-[13px]">
                Ops
              </Link>
            </div>
          </section>

          <form action={signOut}>
            <button className="btn btn-quiet w-full">Sign out</button>
          </form>
        </div>
        <div className="h-2 md:col-span-2" />
      </div>
      <TabBar active="profile" t={t} />
    </Phone>
  );
}
