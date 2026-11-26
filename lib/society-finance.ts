import { randomUUID } from "node:crypto";
import { all, inTransaction, one, run, usesPostgres } from "./db";
import { notify } from "./notify";
import type { Me } from "./session";
import { requireSocietyCommittee, requireSocietyMember } from "./society-access";
import { receiptImageType } from "./society-finance-image";

export class FinanceError extends Error {}

export const MAX_FINANCE_LINE_ITEMS = 12;
const paymentMethods = { upi: "UPI", bank_transfer: "Bank transfer", cash: "Cash", cheque: "Cheque" };
type PaymentMethod = keyof typeof paymentMethods;

type FinanceItem = { label: string; amountPaise: number };
export type FinanceBill = {
  id: string; flat: string; month: string; dueOn: string; issuedAt: string;
  totalPaise: number; paidOn: string | null; lastReminderOn: string | null; daysOverdue: number;
};
type FinancePayment = {
  id: string; amountPaise: number; method: PaymentMethod; reference: string; paidOn: string;
};
export type FinanceExpense = {
  id: string; kind: "expense" | "vendor_bill"; label: string; category: string; vendor: string;
  invoiceReference: string | null; amountPaise: number; incurredOn: string; dueOn: string | null;
  paidOn: string | null; paymentReference: string | null; hasReceipt: 0 | 1;
};
type FinanceReceipt = { contentType: string; bytes: Uint8Array };

const indiaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
});
const dateLabel = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
});
const monthLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });
const amountLabel = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 2,
});

export const financeToday = () => indiaDate.format(new Date());
export const financeMoney = (paise: number) => amountLabel.format(paise / 100);
export const financeDateLabel = (date: string) => dateLabel.format(new Date(date));
export const financeMonthLabel = (month: string) => monthLabel.format(new Date(`${month}-01`));
export const financePaymentMethodLabel = (method: PaymentMethod) => paymentMethods[method];

export function isFinanceMonth(value: string) {
  return /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
}

function checkDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isFinanceMonth(value.slice(0, 7))) {
    throw new FinanceError(`Enter a valid ${label}.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new FinanceError(`Enter a valid ${label}.`);
  }
  return value;
}

function checkPastOrToday(value: string, label: string) {
  const date = checkDate(value, label);
  if (date > financeToday()) throw new FinanceError(`The ${label} cannot be in the future.`);
  return date;
}

function checkText(value: string, label: string, maxLength = 80) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new FinanceError(`Enter a ${label} of 1–${maxLength} characters.`);
  }
  return trimmed;
}

function parsePaise(rupees: string, positive = true) {
  const amount = rupees.trim().match(/^(\d{1,8})(?:\.(\d{1,2}))?$/);
  if (!amount) throw new FinanceError("Enter a rupee amount with up to two decimal places.");
  const paise = Number(amount[1]) * 100 + Number((amount[2] ?? "").padEnd(2, "0"));
  if (positive && !paise) throw new FinanceError("Enter an amount greater than zero.");
  return paise;
}

async function billItems(billId: string) {
  return all<FinanceItem>(
    "SELECT label, amountPaise FROM society_finance_bill_items WHERE billId = ? ORDER BY position", billId,
  );
}

export async function issueMonthlyDues(me: Me | null, input: {
  month: string; dueOn: string; items: { label: string; rupees: string }[];
}) {
  const { societyId, userId: issuedBy } = requireSocietyCommittee(me);
  const { month } = input;
  const dueOn = checkDate(input.dueOn, "due date");
  if (!isFinanceMonth(month)) throw new FinanceError("Choose a valid billing month.");
  const items = input.items.filter((item) => item.label.trim() || item.rupees.trim());
  if (!items.length || items.length > MAX_FINANCE_LINE_ITEMS) {
    throw new FinanceError(`Enter between 1 and ${MAX_FINANCE_LINE_ITEMS} charge items.`);
  }
  const charges = items.map((item) => ({
    label: checkText(item.label, "charge name"), amountPaise: parsePaise(item.rupees),
  }));
  const totalPaise = charges.reduce((sum, charge) => sum + charge.amountPaise, 0);

  return inTransaction(async () => {
    const existingCycle = await one<{ id: string; dueOn: string }>(
      "SELECT id, dueOn FROM society_finance_bills WHERE societyId = ? AND month = ? LIMIT 1", societyId, month,
    );
    if (existingCycle && (existingCycle.dueOn !== dueOn ||
      JSON.stringify(await billItems(existingCycle.id)) !== JSON.stringify(charges))) {
      throw new FinanceError("Bills were already issued for this month. Use the same due date and charges to bill newly verified flats.");
    }

    const flats = await all<{ flat: string }>(
      "SELECT DISTINCT flat FROM residency WHERE societyId = ? AND status = 'verified' ORDER BY flat", societyId,
    );
    if (!flats.length) throw new FinanceError("There are no verified flats to bill.");
    const issuedAt = new Date().toISOString();
    let issued = 0;
    for (const { flat } of flats) {
      const billId = randomUUID();
      const result = await run(`INSERT INTO society_finance_bills (id, societyId, flat, month, dueOn, totalPaise, issuedBy, issuedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(societyId, flat, month) DO NOTHING`,
      billId, societyId, flat, month, dueOn, totalPaise, issuedBy, issuedAt);
      if (!result.changes) continue;
      for (const [position, charge] of charges.entries()) {
        await run("INSERT INTO society_finance_bill_items (billId, position, label, amountPaise) VALUES (?, ?, ?, ?)",
          billId, position, charge.label, charge.amountPaise);
      }
      issued++;
    }
    return { issued, existing: flats.length - issued };
  });
}

function billFields() {
  const daysOverdue = usesPostgres()
    ? "GREATEST(0, CAST(? AS DATE) - CAST(b.dueOn AS DATE))"
    : "max(0, CAST(julianday(?) - julianday(b.dueOn) AS INTEGER))";
  return `b.id, b.flat, b.month, b.dueOn, b.issuedAt, b.totalPaise, p.paidOn, b.lastReminderOn,
    CASE WHEN p.id IS NULL THEN ${daysOverdue} ELSE 0 END AS daysOverdue`;
}
const billFrom = "FROM society_finance_bills b LEFT JOIN society_finance_payments p ON p.billId = b.id";

export async function listFinanceBills(me: Me | null, view: "mine" | "society", options: {
  month?: string; outstanding?: boolean;
} = {}) {
  const residency = view === "society" ? requireSocietyCommittee(me) : requireSocietyMember(me);
  const flat = view === "society" ? null : residency.flat;
  const month = options.month ?? null;
  return all<FinanceBill>(`SELECT ${billFields()} ${billFrom}
    WHERE b.societyId = ? AND (CAST(? AS TEXT) IS NULL OR b.flat = ?) AND (CAST(? AS TEXT) IS NULL OR b.month = ?) AND (? = 0 OR p.id IS NULL)
    ORDER BY b.month DESC, b.flat`, financeToday(), residency.societyId, flat, flat, month, month, options.outstanding ? 1 : 0);
}

function verifiedDuesPayer(societyId: string, flat: string, residencyId?: string) {
  return one<{ id: string; userId: string; name: string }>(
    `SELECT r.id, r.userId, u.name FROM residency r JOIN user u ON u.id = r.userId
     WHERE r.societyId = ? AND r.flat = ? AND r.status = 'verified' AND u.role IN ('resident', 'secretary')
       AND (CAST(? AS TEXT) IS NULL OR r.id = ?)`, societyId, flat, residencyId ?? null, residencyId ?? null,
  );
}

export async function financeBill(me: Me | null, billId: string) {
  const { id: residencyId, userId, societyId, flat } = requireSocietyMember(me);
  const canManage = me?.user.role === "secretary";
  const permittedFlat = canManage ? null : flat;
  const bill = await one<FinanceBill>(`SELECT ${billFields()} ${billFrom}
    WHERE b.id = ? AND b.societyId = ? AND (CAST(? AS TEXT) IS NULL OR b.flat = ?)`,
  financeToday(), billId, societyId, permittedFlat, permittedFlat);
  if (!bill) return null;
  const payer = canManage && !bill.paidOn ? await verifiedDuesPayer(societyId, bill.flat) : null;
  return {
    ...bill,
    items: await billItems(bill.id),
    receiptRecipient: payer && { id: payer.id, name: payer.name },
    payment: bill.paidOn ? await one<FinancePayment>(
      `SELECT p.id, p.amountPaise, p.method, p.reference, p.paidOn
       FROM society_finance_payments p WHERE p.billId = ? AND (? = 1 OR EXISTS (
         SELECT 1 FROM society_finance_receipt_access a JOIN residency r ON r.id = a.residencyId AND r.userId = a.payerId
         WHERE a.paymentId = p.id AND r.id = ? AND r.userId = ? AND r.societyId = ? AND r.flat = ? AND r.status = 'verified'
       ))`, bill.id, canManage ? 1 : 0, residencyId, userId, societyId, flat,
    ) : null,
  };
}

async function committeeBill(societyId: string, billId: string) {
  const bill = await one<FinanceBill>(`SELECT ${billFields()} ${billFrom} WHERE b.id = ? AND b.societyId = ?`,
    financeToday(), billId, societyId);
  if (!bill) throw new FinanceError("Bill unavailable.");
  return bill;
}

export async function recordDuesPayment(me: Me | null, input: {
  billId: string; method: string; reference: string; paidOn: string; payerResidencyId?: string;
}) {
  const { societyId, userId } = requireSocietyCommittee(me);
  if (!Object.hasOwn(paymentMethods, input.method)) throw new FinanceError("Choose a payment method.");
  const reference = checkText(input.reference, "payment reference", 100);
  const paidOn = checkPastOrToday(input.paidOn, "payment date");
  return inTransaction(async () => {
    const bill = await committeeBill(societyId, input.billId);
    if (bill.paidOn) throw new FinanceError("This bill is already paid.");
    const payer = input.payerResidencyId ? await verifiedDuesPayer(societyId, bill.flat, input.payerResidencyId) : null;
    if (input.payerResidencyId && !payer) throw new FinanceError("Choose a verified resident of this flat to share the receipt.");
    const paymentId = randomUUID();
    const result = await run(`INSERT INTO society_finance_payments (id, billId, amountPaise, method, reference, paidOn, recordedBy, recordedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(billId) DO NOTHING`, paymentId, bill.id, bill.totalPaise, input.method, reference, paidOn,
    userId, new Date().toISOString());
    if (!result.changes) throw new FinanceError("This bill is already paid.");
    if (payer) {
      await run("INSERT INTO society_finance_receipt_access (paymentId, residencyId, payerId) VALUES (?, ?, ?)",
        paymentId, payer.id, payer.userId);
    }
    return paymentId;
  });
}

export async function remindOutstandingDues(me: Me | null, billId?: string) {
  const { societyId, societyName } = requireSocietyCommittee(me);
  const today = financeToday();
  return inTransaction(async () => {
    const bills = billId ? [await committeeBill(societyId, billId)] : await listFinanceBills(me, "society", { outstanding: true });
    const byFlat = new Map<string, FinanceBill[]>();
    for (const bill of bills) {
      if (bill.paidOn || bill.lastReminderOn === today) continue;
      const group = byFlat.get(bill.flat) ?? [];
      group.push(bill);
      byFlat.set(bill.flat, group);
    }
    let reminded = 0;
    for (const [flat, flatBills] of byFlat) {
      const recipients = await all<{ userId: string }>(
        "SELECT userId FROM residency WHERE societyId = ? AND flat = ? AND status = 'verified'", societyId, flat,
      );
      if (!recipients.length) continue;
      const [bill] = flatBills;
      const title = flatBills.length === 1 ? `${financeMonthLabel(bill.month)} maintenance dues` : "Outstanding maintenance dues";
      const body = flatBills.length === 1
        ? `${financeMoney(bill.totalPaise)} for flat ${flat} at ${societyName} is due ${financeDateLabel(bill.dueOn)}.`
        : `Flat ${flat} at ${societyName} has ${flatBills.length} outstanding maintenance bills totalling ${financeMoney(flatBills.reduce((sum, entry) => sum + entry.totalPaise, 0))}.`;
      await notify(recipients.map((row) => row.userId), {
        type: "society_dues_reminder", societyId, title, body: `${body} Open Society Finance to view your dues.`,
      });
      for (const entry of flatBills) {
        await run("UPDATE society_finance_bills SET lastReminderOn = ? WHERE id = ?", today, entry.id);
      }
      reminded++;
    }
    return reminded;
  });
}

export async function financeExpenses(me: Me | null, month?: string) {
  const { societyId } = requireSocietyCommittee(me);
  return all<FinanceExpense>(`SELECT e.id, e.kind, e.label, e.category, e.vendor, e.invoiceReference, e.amountPaise,
    e.incurredOn, e.dueOn, e.paidOn, e.paymentReference, CASE WHEN r.expenseId IS NOT NULL THEN 1 ELSE 0 END AS hasReceipt
    FROM society_finance_expenses e LEFT JOIN society_finance_expense_receipts r ON r.expenseId = e.id
    WHERE e.societyId = ? AND (CAST(? AS TEXT) IS NULL OR substr(e.incurredOn, 1, 7) = ?)
    ORDER BY e.incurredOn DESC, e.createdAt DESC`, societyId, month ?? null, month ?? null);
}

export async function financeExpenseReceipt(me: Me | null, expenseId: string) {
  const { societyId } = requireSocietyCommittee(me);
  return one<FinanceReceipt>(`SELECT r.contentType, r.bytes FROM society_finance_expense_receipts r
    JOIN society_finance_expenses e ON e.id = r.expenseId WHERE e.societyId = ? AND e.id = ?`, societyId, expenseId);
}

export async function addFinanceExpense(me: Me | null, input: {
  kind: string; label: string; category: string; vendor: string; invoiceReference: string;
  rupees: string; incurredOn: string; dueOn: string; paymentReference: string; receipt?: FinanceReceipt;
}) {
  const { societyId, userId } = requireSocietyCommittee(me);
  const { kind } = input;
  if (kind !== "expense" && kind !== "vendor_bill") throw new FinanceError("Choose an expense type.");
  const label = checkText(input.label, "description");
  const category = checkText(input.category, "category", 60);
  const vendor = checkText(input.vendor, "payee");
  const amountPaise = parsePaise(input.rupees);
  const incurredOn = checkPastOrToday(input.incurredOn, kind === "vendor_bill" ? "invoice date" : "expense date");
  const invoiceReference = kind === "vendor_bill" || input.invoiceReference.trim()
    ? checkText(input.invoiceReference, "invoice reference", 100) : null;
  const dueOn = kind === "vendor_bill" ? checkDate(input.dueOn, "vendor due date") : null;
  if (dueOn && dueOn < incurredOn) throw new FinanceError("The vendor due date must be on or after the invoice date.");
  const paidOn = kind === "expense" ? incurredOn : null;
  const paymentReference = paidOn ? checkText(input.paymentReference, "payment reference", 100) : null;
  const receipt = input.receipt;
  const contentType = receipt && receiptImageType(receipt.contentType, receipt.bytes);
  if (receipt && !contentType) throw new FinanceError("Choose a JPEG or PNG receipt photo of up to 750 KB.");
  const expenseId = randomUUID();
  return inTransaction(async () => {
    const result = await run(`INSERT INTO society_finance_expenses (id, societyId, kind, label, category, vendor,
      invoiceReference, amountPaise, incurredOn, dueOn, paidOn, paymentReference, createdBy, createdAt, paidBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`, expenseId, societyId,
    kind, label, category, vendor, invoiceReference, amountPaise, incurredOn, dueOn, paidOn, paymentReference,
    userId, new Date().toISOString(), paidOn ? userId : null);
    if (!result.changes) throw new FinanceError("This invoice or expense is already recorded.");
    if (receipt) {
      await run("INSERT INTO society_finance_expense_receipts (expenseId, contentType, bytes) VALUES (?, ?, ?)",
        expenseId, contentType, receipt.bytes);
    }
    return expenseId;
  });
}

export async function settleFinanceExpense(me: Me | null, input: {
  expenseId: string; paidOn: string; paymentReference: string;
}) {
  const { societyId, userId } = requireSocietyCommittee(me);
  const paidOn = checkPastOrToday(input.paidOn, "payment date");
  const paymentReference = checkText(input.paymentReference, "payment reference", 100);
  const result = await run(`UPDATE society_finance_expenses SET paidOn = ?, paymentReference = ?, paidBy = ?
    WHERE id = ? AND societyId = ? AND kind = 'vendor_bill' AND paidOn IS NULL AND incurredOn <= ?`,
  paidOn, paymentReference, userId, input.expenseId, societyId, paidOn);
  if (!result.changes) throw new FinanceError("Check that this invoice is unpaid and the payment date is on or after the invoice date.");
}

export async function reportBankBalance(me: Me | null, input: { rupees: string; reportedOn: string }) {
  const { societyId, userId } = requireSocietyCommittee(me);
  const reportedOn = checkPastOrToday(input.reportedOn, "balance date");
  const amount = input.rupees.trim();
  const amountPaise = amount.startsWith("-") ? -parsePaise(amount.slice(1), false) : parsePaise(amount, false);
  await run(`INSERT INTO society_finance_bank_balances (societyId, reportedOn, amountPaise, reportedBy, recordedAt)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(societyId, reportedOn) DO UPDATE
    SET amountPaise = excluded.amountPaise, reportedBy = excluded.reportedBy, recordedAt = excluded.recordedAt`,
  societyId, reportedOn, amountPaise, userId, new Date().toISOString());
}

export async function financeSummary(societyId: string, month?: string) {
  const period = month ?? null;
  const dues = await one<{
    billedPaise: number; collectedPaise: number; outstandingPaise: number; overduePaise: number;
    billCount: number; outstandingCount: number;
  }>(`SELECT CAST(coalesce(sum(b.totalPaise), 0) AS BIGINT) AS billedPaise,
    CAST(coalesce(sum(p.amountPaise), 0) AS BIGINT) AS collectedPaise,
    CAST(coalesce(sum(b.totalPaise) FILTER (WHERE p.id IS NULL), 0) AS BIGINT) AS outstandingPaise,
    CAST(coalesce(sum(b.totalPaise) FILTER (WHERE p.id IS NULL AND b.dueOn < ?), 0) AS BIGINT) AS overduePaise,
    count(*) AS billCount, count(*) FILTER (WHERE p.id IS NULL) AS outstandingCount
    ${billFrom} WHERE b.societyId = ? AND (CAST(? AS TEXT) IS NULL OR b.month = ?)`, financeToday(), societyId, period, period);
  const expenses = await one<{ expensePaise: number; vendorDuePaise: number }>(`
    SELECT CAST(coalesce(sum(amountPaise) FILTER (WHERE paidOn IS NOT NULL), 0) AS BIGINT) AS expensePaise,
           CAST(coalesce(sum(amountPaise) FILTER (WHERE paidOn IS NULL), 0) AS BIGINT) AS vendorDuePaise
    FROM society_finance_expenses WHERE societyId = ? AND (CAST(? AS TEXT) IS NULL OR substr(incurredOn, 1, 7) = ?)`,
  societyId, period, period);
  const balance = await one<{ amountPaise: number; reportedOn: string }>(`SELECT amountPaise, reportedOn
    FROM society_finance_bank_balances WHERE societyId = ? ORDER BY reportedOn DESC LIMIT 1`, societyId);
  return { ...dues!, ...expenses!, bankBalancePaise: balance?.amountPaise ?? null, bankBalanceOn: balance?.reportedOn ?? null };
}
