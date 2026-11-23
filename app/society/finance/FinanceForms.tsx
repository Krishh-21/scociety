"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  addExpenseAction, issueDuesAction, recordDuesAction, remindDuesAction, reportBalanceAction, settleExpenseAction,
  type FinanceActionState,
} from "./actions";

type Action = (state: FinanceActionState, form: FormData) => Promise<FinanceActionState>;
const control = "card min-w-0 w-full px-3 py-2.5 text-base font-normal text-ink-900";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1 text-[13px] font-bold text-ink-700">{label}{children}</label>;
}

function Input({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return <Field label={label}><input className={control} {...props} /></Field>;
}

function FinanceForm({ action, submit, children, quiet = false }: {
  action: Action; submit: string; children?: ReactNode; quiet?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, submitAction, pending] = useActionState(action, {});
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form
      ref={form}
      action={submitAction}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => submitAction(data));
      }}
      aria-busy={pending}
      className="flex flex-col gap-3"
    >
      {children}
      <button className={`btn ${quiet ? "btn-quiet" : "btn-primary"} w-full`} disabled={pending}>
        {pending ? "Saving…" : submit}
      </button>
      {state.error && <p role="alert" className="text-[13px] text-danger-600">{state.error}</p>}
      {state.ok && <p role="status" className="text-[13px] text-save-700">{state.ok}</p>}
    </form>
  );
}

export function IssueDuesForm({ today, maxItems }: { today: string; maxItems: number }) {
  const [rows, setRows] = useState([0]);
  const nextRowId = useRef(1);
  return (
    <FinanceForm action={issueDuesAction} submit="Issue monthly bills">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Billing month" type="month" name="month" defaultValue={today.slice(0, 7)} required />
        <Input label="Due date" type="date" name="dueOn" required />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-bold">Charges per flat</legend>
        {rows.map((row, index) => (
          <div key={row} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] items-start gap-2">
            <Input label={`Charge ${index + 1}`} name="label" defaultValue={row === 0 ? "Maintenance" : ""} maxLength={80} required />
            <Input label="Amount (₹)" name="rupees" inputMode="decimal" placeholder="0.00" maxLength={11} required />
            {row !== 0 && (
              <button
                type="button"
                className="mt-6 min-h-10 px-2 text-xs font-bold text-danger-600"
                aria-label={`Remove charge ${index + 1}`}
                onClick={() => setRows((current) => current.filter((item) => item !== row))}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </fieldset>
      {rows.length < maxItems && (
        <button
          type="button"
          className="self-start text-sm font-bold text-brand-700"
          onClick={() => {
            const id = nextRowId.current++;
            setRows((current) => [...current, id]);
          }}
        >
          + Add charge
        </button>
      )}
    </FinanceForm>
  );
}

export function RecordDuesForm({ billId, today }: { billId: string; today: string }) {
  return (
    <FinanceForm action={recordDuesAction} submit="Record full payment">
      <input type="hidden" name="billId" value={billId} />
      <Field label="Payment method">
        <select className={control} name="method" required>
          <option value="upi">UPI</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="cash">Cash</option>
          <option value="cheque">Cheque</option>
        </select>
      </Field>
      <Input label="Payment reference" name="reference" maxLength={100} placeholder="UTR or receipt number" required />
      <Input label="Payment date" type="date" name="paidOn" defaultValue={today} max={today} required />
    </FinanceForm>
  );
}

export function RemindDuesForm({ billId }: { billId?: string }) {
  return (
    <FinanceForm action={remindDuesAction} submit={billId ? "Send reminder" : "Remind outstanding flats"} quiet>
      {billId && <input type="hidden" name="billId" value={billId} />}
    </FinanceForm>
  );
}

export function AddExpenseForm({ today }: { today: string }) {
  const [kind, setKind] = useState("expense");
  const vendorBill = kind === "vendor_bill";
  return (
    <FinanceForm action={addExpenseAction} submit={vendorBill ? "Add vendor bill" : "Record expense"}>
      <Field label="Entry type">
        <select className={control} name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="expense">Paid expense</option>
          <option value="vendor_bill">Unpaid vendor bill</option>
        </select>
      </Field>
      <Input label="Description" name="label" maxLength={80} placeholder="Lift servicing" required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Category" name="category" maxLength={60} placeholder="Repairs" required />
        <Input label="Amount (₹)" name="rupees" inputMode="decimal" placeholder="0.00" maxLength={11} required />
      </div>
      <Input label={vendorBill ? "Vendor" : "Payee"} name="vendor" maxLength={80} required />
      <Input label={vendorBill ? "Invoice reference" : "Invoice reference (optional)"} name="invoiceReference" maxLength={100} required={vendorBill} />
      <Input label={vendorBill ? "Invoice date" : "Expense date"} name="incurredOn" type="date" defaultValue={today} max={today} required />
      {vendorBill
        ? <Input key="dueOn" label="Vendor due date" name="dueOn" type="date" required />
        : <Input key="paymentReference" label="Payment reference" name="paymentReference" maxLength={100} required />}
      <Input label="Receipt photo (optional, JPEG or PNG up to 750 KB)" name="receipt" type="file" accept="image/jpeg,image/png" />
    </FinanceForm>
  );
}

export function SettleExpenseForm({ expenseId, today, incurredOn }: { expenseId: string; today: string; incurredOn: string }) {
  return (
    <FinanceForm action={settleExpenseAction} submit="Record vendor payment">
      <input type="hidden" name="expenseId" value={expenseId} />
      <Input label="Payment reference" name="paymentReference" maxLength={100} required />
      <Input label="Payment date" name="paidOn" type="date" defaultValue={today} min={incurredOn} max={today} required />
    </FinanceForm>
  );
}

export function ReportBalanceForm({ today }: { today: string }) {
  return (
    <FinanceForm action={reportBalanceAction} submit="Save reported balance">
      <Input label="Bank balance (₹)" name="rupees" inputMode="text" maxLength={12} required />
      <Input label="Balance as of" name="reportedOn" type="date" defaultValue={today} max={today} required />
    </FinanceForm>
  );
}

export function PrintFinanceButton({ children }: { children: ReactNode }) {
  return <button type="button" className="btn btn-primary print:hidden" onClick={() => window.print()}>{children}</button>;
}
