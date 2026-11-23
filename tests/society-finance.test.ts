import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Me } from "@/lib/session";

const dbFile = path.join(os.tmpdir(), `jodo-finance-${process.pid}-${Date.now()}.db`);
process.env.JODO_DB = dbFile;

const { getDb, one, resetAllData, run } = await import("@/lib/db");
const { listNotifications } = await import("@/lib/notify");
const {
  addFinanceExpense, financeBill, financeExpenseReceipt, financeExpenses, financeSummary, issueMonthlyDues,
  listFinanceBills, recordDuesPayment, remindOutstandingDues, reportBankBalance, settleFinanceExpense,
} = await import("@/lib/society-finance");

function actor(userId: string): Me {
  const user = one<Me["user"]>("SELECT * FROM user WHERE id = ?", userId)!;
  const residency = one<NonNullable<Me["residency"]>>(
    `SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId
     WHERE r.userId = ?`, userId,
  );
  return { user, residency };
}

const issueInput = {
  month: "2026-01", dueOn: "2026-01-15",
  items: [{ label: "Maintenance", rupees: "1500.50" }, { label: "Water", rupees: "240.25" }],
};

beforeEach(() => resetAllData());
afterAll(() => {
  getDb().close();
  globalThis.__jodoDb = undefined;
  for (const name of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) fs.rmSync(name, { force: true });
});

describe("society finance", () => {
  it("issues a single itemized monthly bill per verified flat and preserves the cycle on retry", () => {
    const committee = actor("usr_kulkarni");
    const resident = actor("usr_rahul");
    run("UPDATE residency SET status = 'pending' WHERE userId = ?", "usr_n1");

    const { issued, existing } = issueMonthlyDues(committee, issueInput);
    expect(issued).toBeGreaterThan(0);
    expect(existing).toBe(0);
    expect(issueMonthlyDues(committee, issueInput)).toEqual({ issued: 0, existing: issued });
    expect(() => issueMonthlyDues(committee, { ...issueInput, dueOn: "2026-01-20" })).toThrow(/already issued/i);
    expect(() => issueMonthlyDues(committee, { ...issueInput, month: "2026-02", dueOn: "2026-02-29" })).toThrow();
    expect(listFinanceBills(committee, "society")).toHaveLength(issued);
    expect(() => listFinanceBills(actor("usr_n1"), "mine")).toThrow();
    expect(() => issueMonthlyDues(resident, issueInput)).toThrow();

    const bills = listFinanceBills(resident, "mine");
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({ flat: "A-402", totalPaise: 174075 });
    expect(financeBill(resident, bills[0].id)?.items).toEqual([
      { label: "Maintenance", amountPaise: 150050 },
      { label: "Water", amountPaise: 24025 },
    ]);
  });

  it("restricts bill access and settles a full payment only once", () => {
    const committee = actor("usr_kulkarni");
    const resident = actor("usr_rahul");
    issueMonthlyDues(committee, issueInput);
    const [bill] = listFinanceBills(resident, "mine");
    const payment = { billId: bill.id, method: "bank_transfer", reference: "UTR-42", paidOn: "2026-01-15" };
    run("UPDATE residency SET societyId = ? WHERE userId = ?", "soc_palm_grove", "usr_n2");
    run("UPDATE user SET role = 'secretary' WHERE id = ?", "usr_n2");
    const otherCommittee = actor("usr_n2");

    expect(financeBill(actor("usr_n1"), bill.id)).toBeNull();
    expect(financeBill(otherCommittee, bill.id)).toBeNull();
    expect(() => recordDuesPayment(otherCommittee, payment)).toThrow();
    expect(() => recordDuesPayment(resident, payment)).toThrow();
    expect(financeBill(resident, bill.id)?.payment).toBeNull();

    recordDuesPayment(committee, payment);
    expect(() => recordDuesPayment(committee, payment)).toThrow(/already paid/i);
    expect(financeBill(resident, bill.id)?.payment).toMatchObject({ reference: "UTR-42", amountPaise: 174075 });
    expect(financeSummary(committee.residency!.societyId).collectedPaise).toBe(174075);
  });

  it("limits reminders to outstanding flats and suppresses repeated reminders on the same day", () => {
    const committee = actor("usr_kulkarni");
    const rahul = actor("usr_rahul");
    issueMonthlyDues(committee, issueInput);
    const [bill] = listFinanceBills(rahul, "mine");
    expect(remindOutstandingDues(committee, bill.id)).toBe(1);
    expect(remindOutstandingDues(committee, bill.id)).toBe(0);
    expect(listNotifications(rahul.user.id).filter((n) => n.type === "society_dues_reminder")).toEqual([
      expect.objectContaining({ dealId: null }),
    ]);
    expect(listNotifications("usr_n1").some((n) => n.type === "society_dues_reminder")).toBe(false);
    recordDuesPayment(committee, { billId: bill.id, method: "cash", reference: "CASH-42", paidOn: "2026-01-15" });
    expect(remindOutstandingDues(committee, bill.id)).toBe(0);
  });

  it("combines outstanding months into one bulk reminder per flat", () => {
    const committee = actor("usr_kulkarni");
    const { issued } = issueMonthlyDues(committee, issueInput);
    issueMonthlyDues(committee, { ...issueInput, month: "2026-02", dueOn: "2026-02-15" });
    expect(remindOutstandingDues(committee)).toBe(issued);
    const reminders = listNotifications("usr_rahul").filter((n) => n.type === "society_dues_reminder");
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).toContain("2 outstanding maintenance bills");
    expect(remindOutstandingDues(committee)).toBe(0);
  });

  it("keeps vendor invoices private and separates payable amounts from money spent", () => {
    const committee = actor("usr_kulkarni");
    const expenseId = addFinanceExpense(committee, {
      label: "Lift service", category: "Repairs", vendor: "Lift Co", invoiceReference: "INV-77",
      rupees: "1750.50", incurredOn: "2026-01-10", dueOn: "2026-01-16", kind: "vendor_bill", paymentReference: "",
    });
    expect(() => financeExpenses(actor("usr_rahul"))).toThrow();
    expect(financeSummary(committee.residency!.societyId)).toMatchObject({ expensePaise: 0, vendorDuePaise: 175050 });
    settleFinanceExpense(committee, { expenseId, paidOn: "2026-01-16", paymentReference: "NEFT-77" });
    expect(financeExpenses(committee)[0]).toMatchObject({ paidOn: "2026-01-16", paymentReference: "NEFT-77" });
    expect(financeSummary(committee.residency!.societyId)).toMatchObject({ expensePaise: 175050, vendorDuePaise: 0 });
  });

  it("stores receipt photos privately and rejects files with mismatched content", () => {
    const committee = actor("usr_kulkarni");
    const input = {
      label: "Lift service", category: "Repairs", vendor: "Lift Co", invoiceReference: "INV-77",
      rupees: "1750.50", incurredOn: "2026-01-10", dueOn: "2026-01-16", kind: "vendor_bill", paymentReference: "",
    };
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64");
    expect(() => addFinanceExpense(committee, {
      ...input, receipt: { contentType: "image/jpeg", bytes: png },
    })).toThrow(/JPEG or PNG/);
    expect(financeExpenses(committee)).toHaveLength(0);

    const expenseId = addFinanceExpense(committee, { ...input, receipt: { contentType: "image/png", bytes: png } });
    expect(financeExpenses(committee)[0].hasReceipt).toBe(1);
    expect(financeExpenseReceipt(committee, expenseId)?.contentType).toBe("image/png");
    expect(Buffer.from(financeExpenseReceipt(committee, expenseId)!.bytes)).toEqual(png);
    expect(() => financeExpenseReceipt(actor("usr_rahul"), expenseId)).toThrow();
    run("UPDATE residency SET societyId = ? WHERE userId = ?", "soc_palm_grove", committee.user.id);
    expect(financeExpenseReceipt(actor(committee.user.id), expenseId)).toBeNull();
  });

  it("uses the latest dated committee report as the bank balance", () => {
    const committee = actor("usr_kulkarni");
    const societyId = committee.residency!.societyId;
    expect(financeSummary(societyId).bankBalancePaise).toBeNull();
    expect(() => reportBankBalance(actor("usr_rahul"), { rupees: "800", reportedOn: "2026-01-20" })).toThrow();
    reportBankBalance(committee, { rupees: "0.00", reportedOn: "2026-01-20" });
    reportBankBalance(committee, { rupees: "800", reportedOn: "2026-01-19" });
    expect(financeSummary(societyId)).toMatchObject({ bankBalancePaise: 0, bankBalanceOn: "2026-01-20" });
    expect(financeSummary("soc_palm_grove").bankBalancePaise).toBeNull();
  });
});
