import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/auth-mode";
import { myBookings } from "@/lib/deals";
import { rupees } from "@/lib/pricing";
import { getMe } from "@/lib/session";
import { signOut } from "@/app/actions";
import { AppHeader, type IconName, ModuleLink, Phone, TabBar } from "@/components/ui";
import { LanguageToggle } from "@/components/forms";
import ThemeToggle from "@/components/ThemeToggle";
import { translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  resident: "Resident",
  secretary: "Committee member",
};

export default async function ProfilePage() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.user.role === "guard") redirect("/society/visitors");
  if (me.user.role === "ops") redirect("/ops");
  if (me.user.role === "vendor") redirect("/vendor");
  if (me.residency?.status !== "verified") redirect("/onboarding");
  const demo = isDemoMode();
  const t = translator(me.user.lang);
  const bookings = await myBookings(me.user.id);
  const saved = bookings.reduce((sum, d) => {
    const units = d.joinedByMe?.units ?? 1;
    const paid = d.joinedByMe?.finalPricePaise ?? d.currentPricePaise;
    return sum + Math.max(0, d.listPricePaise - paid) * units;
  }, 0);
  const links: { href: string; label: string; description: string; icon: IconName }[] = [
    { href: "/notifications", label: t("nav.notifications", "Notifications"), description: "Gate, notice and dues updates", icon: "bell" },
    ...(demo ? [{
      href: "/bookings", label: t("bookings.title", "My bookings"),
      description: bookings.length ? `${bookings.length} group ${bookings.length === 1 ? "booking" : "bookings"} · codes and receipts` : "Visit codes, receipts and revisits",
      icon: "bookings" as const,
    }] : []),
    { href: "/society/finance", label: "Dues & receipts", description: `Maintenance bills for flat ${me.residency.flat}`, icon: "wallet" },
    { href: "/society/visitors#invite-guest", label: "Guest passes", description: "Invite a guest with a one-time code", icon: "key" },
    { href: "/help", label: t("nav.help", "Help & support"), description: "Sign-in and society help", icon: "help" },
  ];

  return (
    <Phone>
      <AppHeader title={t("nav.account", "Account")} />
      <div className="flex-1 px-4 py-4 sm:px-6 lg:px-8 grid gap-4 content-start md:grid-cols-2 md:items-start">
        <section className="jd-panel md:col-span-2 flex-row items-center gap-4" aria-label="Your account">
          <span aria-hidden="true" className="w-16 h-16 shrink-0 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center text-[26px] font-extrabold">
            {me.user.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="font-extrabold text-[20px] leading-tight break-words">{me.user.name}</p>
            <p className="text-[13px] text-ink-500 mt-0.5">
              +91 <span className="tnum">{me.user.phone}</span> · {ROLE_LABEL[me.user.role] ?? me.user.role}
            </p>
            <p className="text-[13px] text-ink-700 break-words mt-0.5">
              {me.residency.societyName} · Flat {me.residency.flat} · <span className="font-bold text-save-700">Verified</span>
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <ul className="jd-modules" role="list" aria-label="Your things">
            {links.map((l) => (
              <li key={l.href}>
                <ModuleLink href={l.href} label={l.label} description={l.description} icon={l.icon} />
              </li>
            ))}
          </ul>

          {bookings.length > 0 && (
            <section className="jd-panel" aria-labelledby="profile-saved">
              <h2 id="profile-saved" className="eyebrow">You have saved</h2>
              <p>
                <span className="jd-figure text-save-700 block">{rupees(saved)}</span>
                <span className="text-[13px] text-ink-500">across {bookings.length} group {bookings.length === 1 ? "booking" : "bookings"}.</span>
              </p>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <section className="jd-panel" aria-labelledby="profile-preferences">
            <h2 id="profile-preferences" className="jd-panel__title">Preferences</h2>
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

          <form action={signOut}>
            <button className="btn btn-quiet w-full">{t("common.signOut", "Sign out")}</button>
          </form>
        </div>
        <div className="h-2 md:col-span-2" />
      </div>
      <TabBar
        active="profile"
        t={t}
        context={me.residency ? { society: me.residency.societyName, flat: me.residency.flat } : undefined}
      />
    </Phone>
  );
}
