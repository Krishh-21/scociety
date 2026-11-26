import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Me } from "@/lib/session";

const cookieJar = vi.hoisted(() => new Map<string, { value: string }>());
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => cookieJar.get(name),
  set: (name: string, value: string) => cookieJar.set(name, { value }),
}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const dbFile = path.join(os.tmpdir(), `jodo-finance-${process.pid}-${Date.now()}.db`);
process.env.JODO_DB = dbFile;

const { getDb, one, resetAllData, run } = await import("@/lib/db");
const { listNotifications } = await import("@/lib/notify");
const { claimResidency, createSession, findOrCreateUser, getMe } = await import("@/lib/session");
const { reviewMembershipRequest, revokeMembership } = await import("@/lib/society-membership");
const { recordDuesAction } = await import("@/app/society/finance/actions");
const { default: BillPage } = await import("@/app/society/finance/[billId]/page");
const { default: ReceiptPage } = await import("@/app/society/finance/[billId]/receipt/page");
const { GET: expenseReceiptRoute } = await import("@/app/society/finance/expenses/[expenseId]/receipt/route");
const {
  addFinanceExpense, financeBill, financeExpenseReceipt, financeExpenses, financeSummary, issueMonthlyDues,
  listFinanceBills, recordDuesPayment, remindOutstandingDues, reportBankBalance, settleFinanceExpense,
} = await import("@/lib/society-finance");

async function actor(userId: string): Promise<Me> {
  const user = (await one<Me["user"]>("SELECT * FROM user WHERE id = ?", userId))!;
  const residency = (await one<NonNullable<Me["residency"]>>(
    `SELECT r.*, s.name AS societyName FROM residency r JOIN society s ON s.id = r.societyId
     WHERE r.userId = ?`, userId,
  ));
  return { user, residency };
}

const issueInput = {
  month: "2026-01", dueOn: "2026-01-15",
  items: [{ label: "Maintenance", rupees: "1500.50" }, { label: "Water", rupees: "240.25" }],
};

beforeEach(() => {
  resetAllData();
  cookieJar.clear();
});
afterEach(() => vi.unstubAllEnvs());
afterAll(() => {
  getDb().close();
  globalThis.__jodoDb = undefined;
  for (const name of [dbFile, `${dbFile}-wal`, `${dbFile}-shm`]) fs.rmSync(name, { force: true });
});

describe("society finance", () => {
  it("issues a single itemized monthly bill per verified flat and preserves the cycle on retry", async () => {
    const committee = (await actor("usr_kulkarni"));
    const resident = (await actor("usr_rahul"));
    (await run("UPDATE residency SET status = 'pending' WHERE userId = ?", "usr_n1"));

    const { issued, existing } = (await issueMonthlyDues(committee, issueInput));
    expect(issued).toBeGreaterThan(0);
    expect(existing).toBe(0);
    expect((await issueMonthlyDues(committee, issueInput))).toEqual({ issued: 0, existing: issued });
    await expect((async () => (await issueMonthlyDues(committee, { ...issueInput, dueOn: "2026-01-20" })))()).rejects.toThrow(/already issued/i);
    await expect((async () => (await issueMonthlyDues(committee, { ...issueInput, month: "2026-02", dueOn: "2026-02-29" })))()).rejects.toThrow();
    expect((await listFinanceBills(committee, "society"))).toHaveLength(issued);
    await expect((async () => (await listFinanceBills((await actor("usr_n1")), "mine")))()).rejects.toThrow();
    await expect((async () => (await issueMonthlyDues(resident, issueInput)))()).rejects.toThrow();

    const bills = (await listFinanceBills(resident, "mine"));
    expect(bills).toHaveLength(1);
    expect(bills[0]).toMatchObject({ flat: "A-402", totalPaise: 174075 });
    expect((await financeBill(resident, bills[0].id))?.items).toEqual([
      { label: "Maintenance", amountPaise: 150050 },
      { label: "Water", amountPaise: 24025 },
    ]);
  });

  it("restricts bill access and settles a full payment only once", async () => {
    const committee = (await actor("usr_kulkarni"));
    const resident = (await actor("usr_rahul"));
    (await issueMonthlyDues(committee, issueInput));
    const [bill] = (await listFinanceBills(resident, "mine"));
    const payment = {
      billId: bill.id, method: "bank_transfer", reference: "UTR-42", paidOn: "2026-01-15",
      payerResidencyId: resident.residency!.id,
    };
    (await run("UPDATE residency SET societyId = ? WHERE userId = ?", "soc_palm_grove", "usr_n2"));
    (await run("UPDATE user SET role = 'secretary' WHERE id = ?", "usr_n2"));
    const otherCommittee = (await actor("usr_n2"));

    expect((await financeBill((await actor("usr_n1")), bill.id))).toBeNull();
    expect((await financeBill(otherCommittee, bill.id))).toBeNull();
    await expect((async () => (await recordDuesPayment(otherCommittee, payment)))()).rejects.toThrow();
    await expect((async () => (await recordDuesPayment(resident, payment)))()).rejects.toThrow();
    expect((await financeBill(resident, bill.id))?.payment).toBeNull();

    (await recordDuesPayment(committee, payment));
    await expect((async () => (await recordDuesPayment(committee, payment)))()).rejects.toThrow(/already paid/i);
    expect((await financeBill(resident, bill.id))?.payment).toMatchObject({ reference: "UTR-42", amountPaise: 174075 });
    expect((await financeSummary(committee.residency!.societyId)).collectedPaise).toBe(174075);
  });

  it("keeps a prior payer's receipt private after an approved new occupant moves in", async () => {
    vi.stubEnv("JODO_AUTH_MODE", "sms");
    const committee = await actor("usr_kulkarni");
    const payer = await actor("usr_rahul");
    const { id: payerResidencyId, societyId, flat } = payer.residency!;
    await issueMonthlyDues(committee, issueInput);
    await issueMonthlyDues(committee, { ...issueInput, month: "2026-02", dueOn: "2026-02-15" });
    const [outstanding, paid] = await listFinanceBills(payer, "mine");
    const payment = { method: "bank_transfer", reference: "UTR-PRIVATE", paidOn: "2026-01-15" };
    const form = new FormData();
    for (const [key, value] of Object.entries({ ...payment, billId: paid.id, payerResidencyId })) form.set(key, value);
    const paidBillPageParams = { params: Promise.resolve({ billId: paid.id }), searchParams: Promise.resolve({}) };
    await createSession(committee.user.id);
    expect(renderToStaticMarkup(await BillPage(paidBillPageParams))).toContain("Share receipt with Rahul Mehta");
    await expect(recordDuesAction({}, form)).resolves.toMatchObject({ ok: expect.any(String) });

    await createSession(payer.user.id);
    const authorizedReceipt = (await financeBill(await getMe(), paid.id))?.payment;
    expect(authorizedReceipt).toMatchObject({ id: expect.any(String), reference: "UTR-PRIVATE" });
    expect(renderToStaticMarkup(await ReceiptPage(paidBillPageParams))).toContain("UTR-PRIVATE");
    const successor = await findOrCreateUser("9876500196", "New occupant");
    const request = await claimResidency({ userId: successor.id, name: successor.name, societyId, flat, type: "tenant" });
    expect(request.status).toBe("pending");
    await revokeMembership(committee, payerResidencyId);
    expect(await getMe()).toBeNull();
    await reviewMembershipRequest(committee, request.id, "approve");
    await createSession(successor.id);
    const resident = await getMe();

    expect((await listFinanceBills(resident, "mine")).map(({ id }) => id)).toEqual([outstanding.id, paid.id]);
    expect((await listFinanceBills(resident, "mine", { outstanding: true })).map(({ id }) => id)).toEqual([outstanding.id]);
    await expect(ReceiptPage(paidBillPageParams)).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    const newOccupantBill = renderToStaticMarkup(await BillPage(paidBillPageParams));
    expect(newOccupantBill).toContain("Paid");
    expect(newOccupantBill).not.toContain(`/${paid.id}/receipt`);
    expect(await financeBill(resident, paid.id)).toMatchObject({ flat, totalPaise: 174075, paidOn: "2026-01-15", payment: null });
    expect((await financeBill(payer, paid.id))?.payment).toBeFalsy();
    expect((await financeBill(committee, paid.id))?.payment).toEqual(authorizedReceipt);

    const latePayment = { ...payment, billId: outstanding.id, reference: "UTR-LATE" };
    await expect(recordDuesPayment(committee, { ...latePayment, payerResidencyId })).rejects.toThrow(/verified.*flat/i);
    expect(await financeBill(resident, outstanding.id)).toMatchObject({ paidOn: null, payment: null });
    await recordDuesPayment(committee, latePayment);
    expect(await financeBill(resident, outstanding.id)).toMatchObject({ paidOn: "2026-01-15", payment: null });
    expect((await financeBill(committee, outstanding.id))?.payment).toMatchObject({ reference: "UTR-LATE" });
  });

  it("keeps a legacy receipt available to the committee without sharing it with the verified flat", async () => {
    const committee = await actor("usr_kulkarni");
    const resident = await actor("usr_rahul");
    await issueMonthlyDues(committee, issueInput);
    const [bill] = await listFinanceBills(resident, "mine");
    await run(`INSERT INTO society_finance_payments (id, billId, amountPaise, method, reference, paidOn, recordedBy, recordedAt)
      VALUES ('legacy-receipt', ?, 174075, 'cash', 'LEGACY-PRIVATE', '2026-01-15', ?, '2026-01-15T09:30:00.000Z')`,
    bill.id, committee.user.id);

    expect(await financeBill(resident, bill.id)).toMatchObject({ paidOn: "2026-01-15", payment: null });
    expect((await financeBill(committee, bill.id))?.payment).toMatchObject({ id: "legacy-receipt", reference: "LEGACY-PRIVATE" });
  });

  it("limits reminders to outstanding flats and suppresses repeated reminders on the same day", async () => {
    const committee = (await actor("usr_kulkarni"));
    const rahul = (await actor("usr_rahul"));
    (await issueMonthlyDues(committee, issueInput));
    const [bill] = (await listFinanceBills(rahul, "mine"));
    expect((await remindOutstandingDues(committee, bill.id))).toBe(1);
    expect((await remindOutstandingDues(committee, bill.id))).toBe(0);
    expect((await listNotifications(rahul.user.id)).filter((n) => n.type === "society_dues_reminder")).toEqual([
      expect.objectContaining({ dealId: null }),
    ]);
    expect((await listNotifications("usr_n1")).some((n) => n.type === "society_dues_reminder")).toBe(false);
    (await recordDuesPayment(committee, { billId: bill.id, method: "cash", reference: "CASH-42", paidOn: "2026-01-15" }));
    expect((await remindOutstandingDues(committee, bill.id))).toBe(0);
  });

  it("combines outstanding months into one bulk reminder per flat", async () => {
    const committee = (await actor("usr_kulkarni"));
    const { issued } = (await issueMonthlyDues(committee, issueInput));
    (await issueMonthlyDues(committee, { ...issueInput, month: "2026-02", dueOn: "2026-02-15" }));
    expect((await remindOutstandingDues(committee))).toBe(issued);
    const reminders = (await listNotifications("usr_rahul")).filter((n) => n.type === "society_dues_reminder");
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).toContain("2 outstanding maintenance bills");
    expect((await remindOutstandingDues(committee))).toBe(0);
  });

  it("keeps vendor invoices private and separates payable amounts from money spent", async () => {
    const committee = (await actor("usr_kulkarni"));
    const expenseId = (await addFinanceExpense(committee, {
      label: "Lift service", category: "Repairs", vendor: "Lift Co", invoiceReference: "INV-77",
      rupees: "1750.50", incurredOn: "2026-01-10", dueOn: "2026-01-16", kind: "vendor_bill", paymentReference: "",
    }));
    await expect((async () => (await financeExpenses((await actor("usr_rahul")))))()).rejects.toThrow();
    expect((await financeSummary(committee.residency!.societyId))).toMatchObject({ expensePaise: 0, vendorDuePaise: 175050 });
    (await settleFinanceExpense(committee, { expenseId, paidOn: "2026-01-16", paymentReference: "NEFT-77" }));
    expect((await financeExpenses(committee))[0]).toMatchObject({ paidOn: "2026-01-16", paymentReference: "NEFT-77" });
    expect((await financeSummary(committee.residency!.societyId))).toMatchObject({ expensePaise: 175050, vendorDuePaise: 0 });
  });

  it("stores receipt photos privately and rejects files with mismatched content", async () => {
    const committee = (await actor("usr_kulkarni"));
    const input = {
      label: "Lift service", category: "Repairs", vendor: "Lift Co", invoiceReference: "INV-77",
      rupees: "1750.50", incurredOn: "2026-01-10", dueOn: "2026-01-16", kind: "vendor_bill", paymentReference: "",
    };
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64");
    await expect((async () => (await addFinanceExpense(committee, {
      ...input, receipt: { contentType: "image/jpeg", bytes: png },
    })))()).rejects.toThrow(/JPEG or PNG/);
    expect((await financeExpenses(committee))).toHaveLength(0);

    const expenseId = (await addFinanceExpense(committee, { ...input, receipt: { contentType: "image/png", bytes: png } }));
    expect((await financeExpenses(committee))[0].hasReceipt).toBe(1);
    expect((await financeExpenseReceipt(committee, expenseId))?.contentType).toBe("image/png");
    expect(Buffer.from((await financeExpenseReceipt(committee, expenseId))!.bytes)).toEqual(png);
    await expect((async () => (await financeExpenseReceipt((await actor("usr_rahul")), expenseId)))()).rejects.toThrow();
    const receiptRoute = () => expenseReceiptRoute(new Request(`http://localhost/society/finance/expenses/${expenseId}/receipt`), {
      params: Promise.resolve({ expenseId }),
    });
    await createSession(committee.user.id);
    const image = await receiptRoute();
    expect(image.status).toBe(200);
    expect(image.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await image.arrayBuffer())).toEqual(png);
    await createSession("usr_rahul");
    expect((await receiptRoute()).status).toBe(404);
    (await run("UPDATE residency SET societyId = ? WHERE userId = ?", "soc_palm_grove", committee.user.id));
    expect((await financeExpenseReceipt((await actor(committee.user.id)), expenseId))).toBeNull();
  });

  it("uses the latest dated committee report as the bank balance", async () => {
    const committee = (await actor("usr_kulkarni"));
    const societyId = committee.residency!.societyId;
    expect((await financeSummary(societyId)).bankBalancePaise).toBeNull();
    await expect((async () => (await reportBankBalance((await actor("usr_rahul")), { rupees: "800", reportedOn: "2026-01-20" })))()).rejects.toThrow();
    (await reportBankBalance(committee, { rupees: "0.00", reportedOn: "2026-01-20" }));
    (await reportBankBalance(committee, { rupees: "800", reportedOn: "2026-01-19" }));
    expect((await financeSummary(societyId))).toMatchObject({ bankBalancePaise: 0, bankBalanceOn: "2026-01-20" });
    expect((await financeSummary("soc_palm_grove")).bankBalancePaise).toBeNull();
  });
});
