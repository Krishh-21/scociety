import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader, Phone, TabBar } from "@/components/ui";
import { financeBill, financeDateLabel, financeMoney, financeMonthLabel, financeToday } from "@/lib/society-finance";
import { RecordDuesForm, RemindDuesForm } from "../FinanceForms";
import { BillStatus, FINANCE_HOME, financePageActor } from "../finance-ui";

export const dynamic = "force-dynamic";

export default async function BillPage({ params, searchParams }: {
  params: Promise<{ billId: string }>; searchParams: Promise<{ view?: string }>;
}) {
  const [{ billId }, { view }, { me, residency, canManage }] = await Promise.all([params, searchParams, financePageActor()]);
  const bill = await financeBill(me, billId);
  if (!bill) notFound();
  const today = financeToday();

  return (
    <Phone>
      <AppHeader
        title="Maintenance bill" subtitle={residency.societyName}
        back={{ href: canManage && view === "mine" ? `${FINANCE_HOME}?view=mine` : FINANCE_HOME, label: "Society finance" }}
      />
      <main className="grid gap-4 px-4 py-4">
        <section className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">{financeMonthLabel(bill.month)}</h2>
              <p className="text-sm text-ink-500">Flat {bill.flat} · Due {financeDateLabel(bill.dueOn)}</p>
            </div>
            <BillStatus bill={bill} />
          </div>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {bill.items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex items-start justify-between gap-3 py-2 text-sm">
                <dt className="break-words text-ink-700">{item.label}</dt>
                <dd className="tnum shrink-0 font-bold">{financeMoney(item.amountPaise)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold">Total</p>
            <p className="tnum text-xl font-extrabold">{financeMoney(bill.totalPaise)}</p>
          </div>
          {bill.payment && (
            <Link href={`${FINANCE_HOME}/${bill.id}/receipt${view === "mine" ? "?view=mine" : ""}`} className="btn btn-save mt-4 w-full">View receipt</Link>
          )}
        </section>

        {!bill.payment && (canManage ? (
          <>
            <section className="card p-4">
              <h2 className="font-extrabold">Record payment</h2>
              <p className="mb-3 mt-1 text-[13px] text-ink-500">Enter the reference after receiving the full payment outside the app.</p>
              <RecordDuesForm billId={bill.id} today={today} />
            </section>
            <section className="card p-4">
              <h2 className="font-extrabold">In-app reminder</h2>
              {bill.lastReminderOn && <p className="mt-1 text-xs text-ink-500">Last sent {financeDateLabel(bill.lastReminderOn)}</p>}
              <div className="mt-3">{bill.lastReminderOn === today ? (
                <p className="text-sm text-ink-700">A reminder was sent today.</p>
              ) : <RemindDuesForm billId={bill.id} />}</div>
            </section>
          </>
        ) : (
          <p className="card p-4 text-sm text-ink-700">Contact your society committee for payment instructions. Your receipt will appear once the committee records payment.</p>
        ))}
      </main>
      <TabBar active="society" mobile={false} />
    </Phone>
  );
}
