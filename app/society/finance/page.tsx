import Link from "next/link";
import { AppHeader, Phone, TabBar } from "@/components/ui";
import {
  financeDateLabel, financeMoney, financeMonthLabel, financeSummary, financeToday, isFinanceMonth,
  listFinanceBills, MAX_FINANCE_LINE_ITEMS,
} from "@/lib/society-finance";
import { IssueDuesForm, RemindDuesForm, ReportBalanceForm } from "./FinanceForms";
import { BillStatus, FINANCE_HOME, FinanceMetric, FinanceNav, financePageActor } from "./finance-ui";

export const dynamic = "force-dynamic";

type Filters = { view?: string; status?: string; month?: string };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Filters> }) {
  const { me, residency, canManage } = await financePageActor();
  const filters = await searchParams;
  const view = canManage && filters.view !== "mine" ? "society" : "mine";
  const outstanding = filters.status === "outstanding";
  const month = typeof filters.month === "string" && isFinanceMonth(filters.month) ? filters.month : undefined;
  const allBills = listFinanceBills(me, view);
  const months = [...new Set(allBills.map((bill) => bill.month))];
  const bills = allBills.filter((bill) => (!month || bill.month === month) && (!outstanding || !bill.paidOn));
  const societyTotals = financeSummary(residency.societyId);
  const today = financeToday();
  const myOutstanding = allBills.reduce((sum, bill) => sum + (bill.paidOn ? 0 : bill.totalPaise), 0);

  return (
    <Phone>
      <AppHeader title="Society finance" subtitle={residency.societyName} back={{ href: "/society", label: "Society" }} />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        {canManage && <FinanceNav active={view === "society" ? "bills" : "mine"} />}
        {view === "society" ? (
          <>
            <section className="card p-4" aria-labelledby="finance-overview">
              <h2 id="finance-overview" className="font-extrabold">Dues overview</h2>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <FinanceMetric label="Collected" paise={societyTotals.collectedPaise} />
                <FinanceMetric label="Outstanding" paise={societyTotals.outstandingPaise} />
                <FinanceMetric label="Overdue" paise={societyTotals.overduePaise} />
                <FinanceMetric label="Vendor bills due" paise={societyTotals.vendorDuePaise} />
              </dl>
            </section>
            <details className="card p-4">
              <summary className="cursor-pointer font-extrabold">Issue monthly bills</summary>
              <p className="my-3 text-[13px] text-ink-500">Each verified flat receives one bill for the month with the charges below.</p>
              <IssueDuesForm today={today} maxItems={MAX_FINANCE_LINE_ITEMS} />
            </details>
            <details className="card p-4">
              <summary className="cursor-pointer font-extrabold">Reported bank balance</summary>
              <p className="my-3 text-sm text-ink-500">
                {societyTotals.bankBalancePaise === null || !societyTotals.bankBalanceOn
                  ? "The committee has yet to record a bank balance."
                  : `${financeMoney(societyTotals.bankBalancePaise)} as of ${financeDateLabel(societyTotals.bankBalanceOn)}`}
              </p>
              <ReportBalanceForm today={today} />
            </details>
          </>
        ) : (
          <section className="card p-4">
            <h2 className="font-extrabold">Flat {residency.flat}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              <FinanceMetric label="Your outstanding dues" paise={myOutstanding} />
              <FinanceMetric label="Society expenses paid" paise={societyTotals.expensePaise} />
            </dl>
          </section>
        )}

        <section className="flex flex-col gap-3" aria-labelledby="finance-bills">
          <h2 id="finance-bills" className="font-extrabold">{view === "society" ? "Monthly bills" : "My maintenance bills"}</h2>
          {allBills.length > 0 && (
            <form action={FINANCE_HOME} className="card grid grid-cols-[1fr_1fr_auto] items-end gap-2 p-3">
              {canManage && view === "mine" && <input type="hidden" name="view" value="mine" />}
              <label className="grid min-w-0 gap-1 text-xs font-bold text-ink-700">
                Month
                <select name="month" defaultValue={month ?? ""} className="card min-w-0 p-2 text-sm">
                  <option value="">All months</option>
                  {months.map((value) => <option key={value} value={value}>{financeMonthLabel(value)}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-bold text-ink-700">
                Status
                <select name="status" defaultValue={outstanding ? "outstanding" : ""} className="card min-w-0 p-2 text-sm">
                  <option value="">All bills</option>
                  <option value="outstanding">Outstanding</option>
                </select>
              </label>
              <button className="btn btn-quiet min-h-9 px-2 text-xs">Filter</button>
            </form>
          )}
          {view === "society" && societyTotals.outstandingCount > 0 && <RemindDuesForm />}
          {!bills.length && (
            <p className="card p-4 text-sm text-ink-500">{allBills.length ? "No bills match these filters." : "Monthly bills will appear here once issued."}</p>
          )}
          {bills.map((bill) => (
            <Link key={bill.id} href={`${FINANCE_HOME}/${bill.id}${canManage && view === "mine" ? "?view=mine" : ""}`} className="card grid gap-2 p-4 hover:border-brand-500">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold">{view === "society" ? `Flat ${bill.flat}` : financeMonthLabel(bill.month)}</p>
                  {view === "society" && <p className="text-xs text-ink-500">{financeMonthLabel(bill.month)}</p>}
                </div>
                <p className="tnum text-base font-extrabold">{financeMoney(bill.totalPaise)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-500">{bill.paidOn ? `Paid ${financeDateLabel(bill.paidOn)}` : `Due ${financeDateLabel(bill.dueOn)}`}</p>
                <BillStatus bill={bill} />
              </div>
            </Link>
          ))}
        </section>
      </main>
      <TabBar active="society" />
    </Phone>
  );
}
