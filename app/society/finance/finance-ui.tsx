import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/session";
import { requireSocietyMember, SocietyAccessError } from "@/lib/society-access";
import { financeMoney, type FinanceBill } from "@/lib/society-finance";

export const FINANCE_HOME = "/society/finance";

export async function financePageActor(committeeOnly = false) {
  const me = await getMe();
  if (!me) redirect("/login");
  if ((me.user.role === "resident" || me.user.role === "secretary") && me.residency?.status !== "verified") redirect("/onboarding");
  try {
    const residency = requireSocietyMember(me);
    const canManage = me.user.role === "secretary";
    if (committeeOnly && !canManage) notFound();
    return { me, residency, canManage };
  } catch (error) {
    if (error instanceof SocietyAccessError) redirect("/society");
    throw error;
  }
}

export function FinanceNav({ active }: { active: "bills" | "mine" | "expenses" | "statement" }) {
  const links = [
    { key: "bills", label: "All bills", path: FINANCE_HOME },
    { key: "mine", label: "My flat", path: `${FINANCE_HOME}?view=mine` },
    { key: "expenses", label: "Expenses", path: `${FINANCE_HOME}/expenses` },
    { key: "statement", label: "Statement", path: `${FINANCE_HOME}/statement` },
  ];
  return (
    <nav aria-label="Finance" className="grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-1 print:hidden">
      {links.map(({ key, label, path }) => (
        <Link
          key={key} href={path} aria-current={key === active ? "page" : undefined}
          className={`rounded-xl px-1 py-2.5 text-center text-xs font-bold ${key === active ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-canvas-alt"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BillStatus({ bill }: { bill: FinanceBill }) {
  if (bill.paidOn) return <span className="pill bg-save-50 text-save-700">Paid</span>;
  if (bill.daysOverdue) {
    return <span className="pill bg-warn-50 text-warn-600">{bill.daysOverdue} {bill.daysOverdue === 1 ? "day" : "days"} overdue</span>;
  }
  return <span className="pill bg-canvas-alt text-ink-700">Due</span>;
}

export function FinanceMetric({ label, paise }: { label: string; paise: number }) {
  return (
    <div className="min-w-0 rounded-xl bg-canvas-alt px-3 py-2.5 print:border print:border-neutral-300 print:bg-white">
      <dt className="text-xs text-ink-500 print:text-neutral-700">{label}</dt>
      <dd className="tnum text-base font-extrabold break-words print:text-black">{financeMoney(paise)}</dd>
    </div>
  );
}
