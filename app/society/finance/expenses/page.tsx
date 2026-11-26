import { AppHeader, Phone, TabBar } from "@/components/ui";
import { financeDateLabel, financeExpenses, financeMoney, financeSummary, financeToday } from "@/lib/society-finance";
import { AddExpenseForm, SettleExpenseForm } from "../FinanceForms";
import { FINANCE_HOME, FinanceMetric, FinanceNav, financePageActor } from "../finance-ui";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { me, residency } = await financePageActor(true);
  const [{ expensePaise, vendorDuePaise }, expenses] = await Promise.all([
    financeSummary(residency.societyId),
    financeExpenses(me),
  ]);
  const today = financeToday();

  return (
    <Phone>
      <AppHeader title="Society expenses" subtitle={residency.societyName} back={{ href: FINANCE_HOME, label: "Society finance" }} />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <FinanceNav active="expenses" />
        <dl className="card grid grid-cols-2 gap-2 p-3">
          <FinanceMetric label="Expenses paid" paise={expensePaise} />
          <FinanceMetric label="Vendor bills due" paise={vendorDuePaise} />
        </dl>
        <details className="card p-4">
          <summary className="cursor-pointer font-extrabold">Add expense or vendor bill</summary>
          <div className="mt-3"><AddExpenseForm today={today} /></div>
        </details>
        <section className="flex flex-col gap-3" aria-labelledby="expense-ledger">
          <h2 id="expense-ledger" className="font-extrabold">Expense ledger</h2>
          {!expenses.length && <p className="card p-4 text-sm text-ink-500">Expenses and vendor bills will appear here once recorded.</p>}
          {expenses.map((expense) => (
            <article key={expense.id} className="card grid gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words font-extrabold">{expense.label}</h3>
                  <p className="break-words text-xs text-ink-500">{expense.vendor} · {expense.category}</p>
                </div>
                <p className="tnum shrink-0 font-extrabold">{financeMoney(expense.amountPaise)}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-500">
                  {expense.paidOn ? `Paid ${financeDateLabel(expense.paidOn)}`
                    : expense.dueOn ? `Due ${financeDateLabel(expense.dueOn)}` : "Payment pending"}
                </p>
                {expense.paidOn ? <span className="pill bg-save-50 text-save-700">Paid</span> : (
                  <span className="pill bg-warn-50 text-warn-600">{expense.dueOn && expense.dueOn < today ? "Overdue" : "Unpaid"}</span>
                )}
              </div>
              {expense.invoiceReference && <p className="break-words text-xs text-ink-700">Invoice {expense.invoiceReference} · {financeDateLabel(expense.incurredOn)}</p>}
              {expense.paymentReference && <p className="break-words text-xs text-ink-700">Payment ref. {expense.paymentReference}</p>}
              {expense.hasReceipt === 1 && (
                <a href={`${FINANCE_HOME}/expenses/${expense.id}/receipt`} target="_blank" rel="noreferrer" className="text-sm font-bold text-brand-700">View receipt photo</a>
              )}
              {!expense.paidOn && (
                <details className="mt-1 border-t border-line pt-2">
                  <summary className="cursor-pointer text-sm font-bold text-brand-700">Record payment</summary>
                  <div className="mt-3"><SettleExpenseForm expenseId={expense.id} today={today} incurredOn={expense.incurredOn} /></div>
                </details>
              )}
            </article>
          ))}
        </section>
      </main>
      <TabBar active="finance" />
    </Phone>
  );
}
