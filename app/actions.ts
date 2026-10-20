"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, resetAllData, run } from "@/lib/db";
import {
  DealError, addComment, approveDeal, clearCatalogueCache, completeJob, createDeal, expireDeal,
  joinDeal, leaveDeal, lockDeal, raiseDispute, rateJob, resolveDispute, simulateJoins, startJob,
  startService, updateSlabs,
} from "@/lib/deals";
import { markAllRead } from "@/lib/notify";
import { track } from "@/lib/analytics";
import { isLang } from "@/lib/i18n";
import { LeadError, createLead, markLead } from "@/lib/leads";
import { assertCan, ForbiddenError } from "@/lib/authz";
import {
  ResidencyError, claimResidency, createSession, destroySession, findOrCreateUser, isValidPhone,
  otpAttemptAllowed, otpAttemptsReset, requireMe,
} from "@/lib/session";
import type { Slab } from "@/lib/types";

export type ActionState = { error?: string; ok?: string };

const DEV_OTP = "1234";

function fail(e: unknown): ActionState {
  if (e instanceof DealError || e instanceof ForbiddenError || e instanceof ResidencyError || e instanceof LeadError) {
    return { error: e.message };
  }
  if (e instanceof Error && e.message === "UNAUTHENTICATED") return { error: "Please sign in again." };
  console.error(e);
  return { error: "Something went wrong. Try again." };
}

// ------------------------------------------------------------------- auth

export async function verifyOtp(_prev: ActionState, form: FormData): Promise<ActionState> {
  const phone = String(form.get("phone") ?? "").replace(/\D/g, "");
  const otp = String(form.get("otp") ?? "").trim();
  // Without this a blank number and the right code signed in as a user with no phone.
  if (!isValidPhone(phone)) return { error: "Enter a 10-digit mobile number." };
  if (!otpAttemptAllowed(phone)) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }
  if (otp !== DEV_OTP) return { error: `Wrong code. In this build the code is always ${DEV_OTP}.` };
  otpAttemptsReset(phone);
  const user = findOrCreateUser(phone);
  await createSession(user.id);
  const residency = one("SELECT id FROM residency WHERE userId = ?", user.id);
  if (user.role === "vendor") redirect("/vendor");
  if (user.role === "ops") redirect("/ops");
  redirect(residency ? "/" : "/onboarding");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export async function saveResidency(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    claimResidency({
      userId: me.user.id,
      name: String(form.get("name") ?? ""),
      societyId: String(form.get("societyId") ?? ""),
      flat: String(form.get("flat") ?? ""),
      type: String(form.get("type") ?? "owner") === "tenant" ? "tenant" : "owner",
    });
  } catch (e) {
    return fail(e);
  }
  redirect("/");
}

// ------------------------------------------------------------------ deals

export async function joinAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    if (!me.residency) return { error: "Verify your flat first." };
    const dealId = String(form.get("dealId"));
    assertCan(me, { kind: "deal.join", dealId });
    joinDeal({
      dealId,
      userId: me.user.id,
      flat: me.residency.flat,
      units: Number(form.get("units") ?? 1),
      slot: String(form.get("slot") ?? ""),
      paymentMethod: (String(form.get("paymentMethod") ?? "upi") as "upi" | "card" | "cash"),
      societyId: me.residency.societyId,
    });
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/");
    return { ok: "joined" };
  } catch (e) {
    return fail(e);
  }
}

export async function leaveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const dealId = String(form.get("dealId"));
    leaveDeal(dealId, me.user.id);
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/");
    return { ok: "left" };
  } catch (e) {
    return fail(e);
  }
}

export async function commentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const dealId = String(form.get("dealId"));
    assertCan(me, { kind: "deal.comment", dealId });
    addComment(dealId, me.user.id, String(form.get("body") ?? ""));
    revalidatePath(`/deal/${dealId}`);
    return { ok: "posted" };
  } catch (e) {
    return fail(e);
  }
}

export async function createDealAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let dealId: string;
  try {
    const me = await requireMe();
    if (!me.residency) return { error: "Verify your flat first." };
    dealId = createDeal({
      societyId: me.residency.societyId,
      skuId: String(form.get("skuId")),
      vendorId: String(form.get("vendorId")),
      createdBy: me.user.id,
      serviceDate: String(form.get("serviceDate")),
      targetFlats: Number(form.get("targetFlats") ?? 20),
      deadlineHours: Number(form.get("deadlineHours") ?? 72),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/");
  redirect(`/deal/${dealId}?created=1`);
}

// ------------------------------------------------- ops / vendor / service

export async function simulateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const dealId = String(form.get("dealId"));
    assertCan(me, { kind: "deal.simulate", dealId });
    const n = Number(form.get("count") ?? 1);
    const { added } = simulateJoins(dealId, n);
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/");
    revalidatePath("/ops");
    return { ok: `${added} neighbour${added === 1 ? "" : "s"} joined` };
  } catch (e) {
    return fail(e);
  }
}

export async function resetDemoAction(_prev: ActionState): Promise<ActionState> {
  try {
    const me = await requireMe();
    assertCan(me, { kind: "demo.reset" });
    resetAllData();
    clearCatalogueCache();
    revalidatePath("/", "layout");
    return { ok: "Demo data reset — every group is back where the seed starts it" };
  } catch (e) {
    return fail(e);
  }
}

export async function lockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const dealId = String(form.get("dealId"));
    assertCan(me, { kind: "deal.lock", dealId });
    lockDeal(dealId);
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/ops");
    revalidatePath("/");
    return { ok: "Group locked" };
  } catch (e) {
    return fail(e);
  }
}

export async function expireAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const dealId = String(form.get("dealId"));
    assertCan(me, { kind: "deal.expire", dealId });
    expireDeal(dealId);
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/ops");
    return { ok: "Deal closed without charge" };
  } catch (e) {
    return fail(e);
  }
}

export async function startServiceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const dealId = String(form.get("dealId"));
    assertCan(me, { kind: "deal.start_service", dealId });
    startService(dealId);
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/vendor");
    return { ok: "Crew on the way" };
  } catch (e) {
    return fail(e);
  }
}

export async function completeJobAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const jobId = String(form.get("jobId"));
    assertCan(me, { kind: "job.complete", jobId });
    const dealId = completeJob(jobId, String(form.get("otp") ?? ""));
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/vendor");
    revalidatePath("/bookings");
    return { ok: "Job completed" };
  } catch (e) {
    return fail(e);
  }
}

export async function rateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const jobId = String(form.get("jobId"));
    assertCan(me, { kind: "job.rate", jobId });
    rateJob(jobId, Number(form.get("score") ?? 5), String(form.get("note") ?? ""));
    revalidatePath("/bookings");
    return { ok: "Thanks — rating saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSlabsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const dealId = String(form.get("dealId"));
    assertCan(me, { kind: "deal.update_slabs", dealId });
    const slabs: Slab[] = [];
    for (let i = 0; i < 4; i++) {
      const flats = Number(form.get(`flats${i}`) ?? 0);
      const rupees = Number(form.get(`price${i}`) ?? 0);
      if (flats > 0 && rupees > 0) slabs.push({ minFlats: flats, pricePaise: Math.round(rupees * 100) });
    }
    updateSlabs(dealId, slabs);
    revalidatePath("/vendor");
    revalidatePath(`/deal/${dealId}`);
    return { ok: "Ladder updated" };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------- approvals & issues

export async function approveDealAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const dealId = String(form.get("dealId"));
    assertCan(me, { kind: "deal.approve", dealId });
    approveDeal(dealId, me.user.id);
    revalidatePath("/");
    revalidatePath("/society");
    revalidatePath(`/deal/${dealId}`);
    return { ok: "Group approved and announced" };
  } catch (e) {
    return fail(e);
  }
}

export async function startJobAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const jobId = String(form.get("jobId"));
    assertCan(me, { kind: "job.start", jobId });
    const dealId = startJob(jobId, String(form.get("otp") ?? ""));
    revalidatePath("/vendor");
    revalidatePath(`/deal/${dealId}`);
    return { ok: "Job started" };
  } catch (e) {
    return fail(e);
  }
}

export async function raiseDisputeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const jobId = String(form.get("jobId"));
    assertCan(me, { kind: "dispute.raise", jobId });
    raiseDispute({
      jobId,
      userId: me.user.id,
      reason: String(form.get("reason") ?? "Something went wrong"),
      detail: String(form.get("detail") ?? ""),
    });
    revalidatePath("/bookings");
    revalidatePath("/ops");
    return { ok: "Issue raised — ops will come back to you within 48 hours" };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveDisputeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    assertCan(me, { kind: "dispute.resolve" });
    const resolution = String(form.get("resolution") ?? "rejected");
    if (!["refund", "revisit", "rejected"].includes(resolution)) return { error: "Pick an outcome." };
    resolveDispute(
      String(form.get("disputeId")),
      resolution as "refund" | "revisit" | "rejected",
      String(form.get("note") ?? ""),
    );
    revalidatePath("/ops");
    revalidatePath("/bookings");
    return { ok: "Issue closed" };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------- public sign-ups

/** "Bring JODO to my society" — no account needed; ops calls the secretary. */
export async function submitSocietyLead(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const flats = Number(form.get("flats") ?? 0);
    const { duplicate } = createLead({
      kind: "society",
      name: form.get("name"),
      phone: form.get("phone"),
      org: form.get("society"),
      city: form.get("city"),
      detail: {
        role: String(form.get("role") ?? "resident").slice(0, 20),
        flats: Number.isFinite(flats) && flats > 0 ? Math.min(flats, 5000) : null,
      },
    });
    track(null, "lead_society", { duplicate });
    revalidatePath("/ops");
    return { ok: duplicate ? "We already have your request — we'll call you soon." : "Thanks — we'll call you within two working days." };
  } catch (e) {
    return fail(e);
  }
}

/** Vendor partner application. */
export async function submitVendorLead(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const services = form.getAll("services").map((v) => String(v).slice(0, 40)).slice(0, 8);
    if (!services.length) return { error: "Pick at least one service you offer." };
    const crew = Number(form.get("crew") ?? 0);
    const { duplicate } = createLead({
      kind: "vendor",
      name: form.get("name"),
      phone: form.get("phone"),
      org: form.get("business"),
      city: form.get("city"),
      detail: { services, crew: Number.isFinite(crew) && crew > 0 ? Math.min(crew, 500) : null },
    });
    track(null, "lead_vendor", { duplicate, services });
    revalidatePath("/ops");
    return { ok: duplicate ? "We already have your application — we'll be in touch." : "Application received — our supply team will call you within two working days." };
  } catch (e) {
    return fail(e);
  }
}

export async function markLeadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    assertCan(me, { kind: "console.ops" });
    const status = String(form.get("status"));
    if (status !== "contacted" && status !== "won" && status !== "lost") return { error: "Unknown status." };
    markLead(String(form.get("leadId")), status);
    revalidatePath("/ops");
    return { ok: status };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------ preferences

export async function markNotificationsRead() {
  const me = await requireMe();
  markAllRead(me.user.id);
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function setLanguage(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const lang = String(form.get("lang") ?? "en");
    if (!isLang(lang)) return { error: "Unknown language." };
    run("UPDATE user SET lang = ? WHERE id = ?", lang, me.user.id);
    revalidatePath("/", "layout");
    return { ok: lang };
  } catch (e) {
    return fail(e);
  }
}

export async function trackEvent(name: string, props: Record<string, unknown> = {}) {
  const me = await getMeSafe();
  track(me?.user.id ?? null, name, props);
}

async function getMeSafe() {
  try {
    return await requireMe();
  } catch {
    return null;
  }
}
