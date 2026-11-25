"use server";

import { revalidatePath } from "next/cache";
import { getMe, type Me } from "@/lib/session";
import { requireSocietyCommittee, SocietyAccessError } from "@/lib/society-access";
import {
  addFinanceExpense, FinanceError, issueMonthlyDues, recordDuesPayment, remindOutstandingDues,
  reportBankBalance, settleFinanceExpense,
} from "@/lib/society-finance";
import { MAX_EXPENSE_RECEIPT_BYTES } from "@/lib/society-finance-image";

export type FinanceActionState = { error?: string; ok?: string };

const get = (form: FormData, name: string) => String(form.get(name) ?? "");
const countFlats = (count: number) => `${count} flat${count === 1 ? "" : "s"}`;

async function financeAction(work: (me: Me | null) => Promise<string>): Promise<FinanceActionState> {
  try {
    const ok = await work(await getMe());
    revalidatePath("/society");
    revalidatePath("/society/finance", "layout");
    return { ok };
  } catch (error) {
    if (error instanceof FinanceError || error instanceof SocietyAccessError) return { error: error.message };
    console.error(error);
    return { error: "The finance update couldn't be completed. Try again." };
  }
}

export async function issueDuesAction(_state: FinanceActionState, form: FormData) {
  return financeAction(async (me) => {
    const labels = form.getAll("label");
    const amounts = form.getAll("rupees");
    if (labels.length !== amounts.length) throw new FinanceError("Enter an amount for each charge.");
    const { issued, existing } = await issueMonthlyDues(me, {
      month: get(form, "month"), dueOn: get(form, "dueOn"),
      items: labels.map((label, i) => ({ label: String(label), rupees: String(amounts[i]) })),
    });
    if (!issued) return `All ${existing} verified flats already have bills for this month.`;
    return `Issued bills to ${countFlats(issued)}.`;
  });
}

export async function recordDuesAction(_state: FinanceActionState, form: FormData) {
  return financeAction(async (me) => {
    await recordDuesPayment(me, {
      billId: get(form, "billId"), method: get(form, "method"),
      reference: get(form, "reference"), paidOn: get(form, "paidOn"),
    });
    return "Payment recorded. The receipt is ready.";
  });
}

export async function remindDuesAction(_state: FinanceActionState, form: FormData) {
  return financeAction(async (me) => {
    const reminded = await remindOutstandingDues(me, get(form, "billId") || undefined);
    revalidatePath("/notifications");
    return reminded ? `Sent in-app reminders for ${countFlats(reminded)}.` : "No new reminders to send today.";
  });
}

export async function addExpenseAction(_state: FinanceActionState, form: FormData) {
  return financeAction(async (me) => {
    requireSocietyCommittee(me);
    const kind = get(form, "kind");
    const photo = form.get("receipt");
    const file = photo && typeof photo !== "string" && photo.size ? photo : null;
    if (file && file.size > MAX_EXPENSE_RECEIPT_BYTES) throw new FinanceError("Choose a receipt photo of up to 750 KB.");
    const receipt = file ? { contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) } : undefined;
    await addFinanceExpense(me, {
      kind, label: get(form, "label"), category: get(form, "category"), vendor: get(form, "vendor"),
      invoiceReference: get(form, "invoiceReference"), rupees: get(form, "rupees"),
      incurredOn: get(form, "incurredOn"), dueOn: get(form, "dueOn"), paymentReference: get(form, "paymentReference"),
      receipt,
    });
    return kind === "vendor_bill" ? "Vendor bill added." : "Expense recorded.";
  });
}

export async function settleExpenseAction(_state: FinanceActionState, form: FormData) {
  return financeAction(async (me) => {
    await settleFinanceExpense(me, {
      expenseId: get(form, "expenseId"), paidOn: get(form, "paidOn"), paymentReference: get(form, "paymentReference"),
    });
    return "Vendor payment recorded.";
  });
}

export async function reportBalanceAction(_state: FinanceActionState, form: FormData) {
  return financeAction(async (me) => {
    await reportBankBalance(me, { rupees: get(form, "rupees"), reportedOn: get(form, "reportedOn") });
    return "Bank balance report saved.";
  });
}
