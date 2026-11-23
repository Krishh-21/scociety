import { AppHeader } from "@/components/ui";
import {
  financeDateLabel, financeExpenses, financeMoney, financeMonthLabel, financeToday, isFinanceMonth, listFinanceBills,
} from "@/lib/society-finance";
import { PrintFinanceButton } from "../FinanceForms";
import { FINANCE_HOME, FinanceMetric, FinanceNav, financePageActor } from "../finance-ui";

export const dynamic = "force-dynamic";

const header = "border-b border-line p-2 print:border-neutral-300";
const cell = "border-b border-line p-2 print:border-neutral-300";

export default async function StatementPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { me, residency } = await financePageActor(true);
  const { month: selected } = await searchParams;
  const today = financeToday();
  const month = typeof selected === "string" && isFinanceMonth(selected) ? selected : today.slice(0, 7);
  const bills = listFinanceBills(me, "society", { month });
  const expenses = financeExpenses(me, month);
  const billed = bills.reduce((sum, bill) => sum + bill.totalPaise, 0);
  const collected = bills.reduce((sum, bill) => sum + (bill.paidOn ? bill.totalPaise : 0), 0);
  const spent = expenses.reduce((sum, expense) => sum + (expense.paidOn ? expense.amountPaise : 0), 0);

  return (
    <main className="mx-auto min-h-screen max-w-[760px] border-x border-line bg-canvas print:min-h-0 print:max-w-none print:border-0 print:bg-white print:text-black">
      <div className="print:hidden">
        <AppHeader title="Finance statement" subtitle={residency.societyName} back={{ href: FINANCE_HOME, label: "Society finance" }} />
      </div>
      <div className="grid gap-4 p-4">
        <FinanceNav active="statement" />
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <form action={`${FINANCE_HOME}/statement`} className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-bold text-ink-700">
              Statement month
              <input name="month" type="month" defaultValue={month} className="card px-3 py-2.5 text-base" required />
            </label>
            <button className="btn btn-quiet min-h-10">Show month</button>
          </form>
          <PrintFinanceButton>Print or save as PDF</PrintFinanceButton>
        </div>

        <article className="card grid gap-5 p-4 print:border-0 print:bg-white print:p-0">
          <header>
            <p className="text-sm font-bold">{residency.societyName}</p>
            <h1 className="mt-1 text-2xl font-extrabold">{financeMonthLabel(month)} statement</h1>
            <p className="mt-1 text-xs text-ink-500 print:text-neutral-700">Payment status as of {financeDateLabel(today)}. Includes dues billed and expenses incurred during the selected month.</p>
          </header>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
            <FinanceMetric label="Billed" paise={billed} />
            <FinanceMetric label="Collected on these bills" paise={collected} />
            <FinanceMetric label="Outstanding" paise={billed - collected} />
            <FinanceMetric label="Expenses paid" paise={spent} />
          </dl>

          <section className="grid gap-2" aria-labelledby="statement-dues">
            <h2 id="statement-dues" className="font-extrabold">Maintenance dues</h2>
            {!bills.length ? <p className="text-sm text-ink-500 print:text-neutral-700">No maintenance bills for this month.</p> : (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse text-left text-xs">
                  <thead><tr>{["Flat", "Due date", "Amount", "Status"].map((label) => <th key={label} scope="col" className={header}>{label}</th>)}</tr></thead>
                  <tbody>
                    {bills.map((bill) => (
                      <tr key={bill.id} className="print:break-inside-avoid">
                        <th scope="row" className={cell}>{bill.flat}</th>
                        <td className={cell}>{financeDateLabel(bill.dueOn)}</td>
                        <td className={`${cell} tnum`}>{financeMoney(bill.totalPaise)}</td>
                        <td className={cell}>{bill.paidOn ? `Paid ${financeDateLabel(bill.paidOn)}` : "Outstanding"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid gap-2" aria-labelledby="statement-expenses">
            <h2 id="statement-expenses" className="font-extrabold">Expenses and vendor bills</h2>
            {!expenses.length ? <p className="text-sm text-ink-500 print:text-neutral-700">No expenses for this month.</p> : (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full border-collapse text-left text-xs">
                  <thead><tr>{["Expense", "Incurred", "Amount", "Status"].map((label) => <th key={label} scope="col" className={header}>{label}</th>)}</tr></thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="print:break-inside-avoid">
                        <th scope="row" className={`${cell} break-words`}>{expense.label}</th>
                        <td className={cell}>{financeDateLabel(expense.incurredOn)}</td>
                        <td className={`${cell} tnum`}>{financeMoney(expense.amountPaise)}</td>
                        <td className={cell}>{expense.paidOn ? `Paid ${financeDateLabel(expense.paidOn)}` : "Unpaid"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </article>
      </div>
    </main>
  );
}
