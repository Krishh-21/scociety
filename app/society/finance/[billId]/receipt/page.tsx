import { notFound } from "next/navigation";
import { AppHeader } from "@/components/ui";
import { financeBill, financeDateLabel, financeMoney, financeMonthLabel, financePaymentMethodLabel } from "@/lib/society-finance";
import { PrintFinanceButton } from "../../FinanceForms";
import { FINANCE_HOME, financePageActor } from "../../finance-ui";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params, searchParams }: {
  params: Promise<{ billId: string }>; searchParams: Promise<{ view?: string }>;
}) {
  const [{ billId }, { view }, { me, residency }] = await Promise.all([params, searchParams, financePageActor()]);
  const bill = financeBill(me, billId);
  if (!bill?.payment) notFound();
  const { payment } = bill;

  return (
    <main className="mx-auto min-h-screen max-w-[460px] border-x border-line bg-canvas print:min-h-0 print:max-w-none print:border-0 print:bg-white print:text-black">
      <div className="print:hidden">
        <AppHeader title="Payment receipt" back={{ href: `${FINANCE_HOME}/${bill.id}${view === "mine" ? "?view=mine" : ""}`, label: "Maintenance bill" }} />
      </div>
      <div className="grid gap-4 p-4">
        <article className="card grid gap-4 p-5 print:border-neutral-300 print:bg-white print:text-black">
          <header>
            <p className="text-sm font-bold">{residency.societyName}</p>
            <h1 className="mt-1 text-2xl font-extrabold">Maintenance receipt</h1>
            <p className="mt-1 break-all text-xs text-ink-500 print:text-neutral-700">Receipt {payment.id}</p>
          </header>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:gap-4">
            {[
              ["Flat", bill.flat], ["Billing month", financeMonthLabel(bill.month)],
              ["Paid on", financeDateLabel(payment.paidOn)], ["Method", financePaymentMethodLabel(payment.method)],
              ["Payment reference", payment.reference],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-ink-500 print:text-neutral-700">{label}</dt>
                <dd className="break-words font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <dl className="divide-y divide-line border-y border-line print:divide-neutral-300 print:border-neutral-300">
            {bill.items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex justify-between gap-3 py-2 text-sm">
                <dt className="break-words">{item.label}</dt>
                <dd className="tnum shrink-0 font-bold">{financeMoney(item.amountPaise)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold">Amount received</p>
            <p className="tnum text-xl font-extrabold text-save-700 print:text-black">{financeMoney(payment.amountPaise)}</p>
          </div>
        </article>
        <PrintFinanceButton>Print or save as PDF</PrintFinanceButton>
      </div>
    </main>
  );
}
