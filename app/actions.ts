"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { one, resetAllData, run } from "@/lib/db";
import {
  DealError, addComment, approveDeal, clearCatalogueCache, completeJob, createDeal, expireDeal,
  joinDeal, leaveDeal, lockDeal, raiseDispute, rateJob, resolveDispute, scheduleRevisit, simulateJoins, startJob,
  startService, updateSlabs,
} from "@/lib/deals";
import { markAllRead } from "@/lib/notify";
import { track } from "@/lib/analytics";
import { isLang } from "@/lib/i18n";
import { LeadError, createLead, markLead } from "@/lib/leads";
import { assertCan, ForbiddenError } from "@/lib/authz";
import { isDemoMode } from "@/lib/auth-mode";
import { dealReturnHref, dealReturnPath } from "@/lib/deal-return";
import { AccountLinkError } from "@/lib/account-link";
import {
  beginEmailLink, clearEmailSignIn, emailAuthEnabled, findEmailUser, linkVerifiedEmail, normalizeSignInEmail, requireEmailLink,
} from "@/lib/email-auth";
import { clearGoogleSignIn, linkVerifiedGoogle, requireGoogleLink } from "@/lib/google-auth";
import { normalizePhone, SIGN_IN_UNAVAILABLE, smsAuth } from "@/lib/phone-auth";
import {
  ResidencyError, claimResidency, createSession, destroySession, findOrCreateUser, getMe, requireMe, signInDestination,
} from "@/lib/session";
import type { Slab } from "@/lib/types";

export type ActionState = { error?: string; ok?: string };
export type SignInCodeState = ActionState & { phone?: string; sentAt?: number };
export type EmailSignInCodeState = ActionState & { email?: string; sentAt?: number };

function fail(e: unknown): ActionState {
  if (e instanceof DealError || e instanceof ForbiddenError || e instanceof ResidencyError || e instanceof LeadError) {
    return { error: e.message };
  }
  if (e instanceof Error && e.message === "UNAUTHENTICATED") return { error: "Please sign in again." };
  console.error(e);
  return { error: "Something went wrong. Try again." };
}

// ------------------------------------------------------------------- auth

async function clearAlternateSignIns() {
  // Clean up both proofs in order so each cookie mutation is visible to Next.
  await clearGoogleSignIn().catch(() => {});
  await clearEmailSignIn().catch(() => {});
}

async function requireSignInLink(form: FormData) {
  const google = form.get("googleLinkId");
  const email = form.get("emailLinkId");
  if (google !== null && email !== null) throw new AccountLinkError("Choose one sign-in method and try again.");
  if (google !== null) return { id: (await requireGoogleLink(google)).id, verify: linkVerifiedGoogle };
  if (email !== null) return { id: (await requireEmailLink(email)).id, verify: linkVerifiedEmail };
}

function signInLinkError(error: unknown) {
  return { error: error instanceof AccountLinkError ? error.message : SIGN_IN_UNAVAILABLE };
}

function signInCaptcha(form: FormData) {
  const token = form.get("cf-turnstile-response");
  return typeof token === "string" && token.length <= 2048 ? token : undefined;
}

async function completeSignIn(
  phone: string, next: string | undefined, link?: Awaited<ReturnType<typeof requireSignInLink>>,
): Promise<ActionState> {
  let destination: string | null;
  try {
    const user = await findOrCreateUser(phone);
    destination = await signInDestination(user, next);
    if (!destination) return { error: "This guard account has no active access. Contact your society committee." };
    if (link) await link.verify(link.id, user.id);
    if (!isDemoMode()) await clearAlternateSignIns();
    await createSession(user.id);
  } catch (error) {
    if (error instanceof AccountLinkError) return signInLinkError(error);
    console.error("Sign-in could not create a JODO session", error instanceof Error ? error.name : "UnknownError");
    return { error: SIGN_IN_UNAVAILABLE };
  }
  redirect(destination);
}

export async function sendSignInCode(_previous: SignInCodeState, form: FormData): Promise<SignInCodeState> {
  const phone = normalizePhone(form.get("phone"));
  if (!phone) return { error: "Enter a valid 10-digit Indian mobile number." };
  const auth = isDemoMode() ? null : smsAuth();
  if (!auth) return { error: SIGN_IN_UNAVAILABLE };
  try { await requireSignInLink(form); }
  catch (error) { return signInLinkError(error); }
  const captchaToken = signInCaptcha(form);
  if (process.env.JODO_TURNSTILE_SITE_KEY?.trim() && !captchaToken) {
    return { error: "Complete the security check to request a code." };
  }
  const { error } = await auth.signInWithOtp({ phone: "+91" + phone, options: { captchaToken } });
  if (!error) return { phone, sentAt: Date.now() };
  if (error.status === 429) return { error: "Wait a minute before requesting another code." };
  if (error.code === "captcha_failed") return { error: "The security check expired. Complete it again to request a code." };
  return { error: "We couldn’t send a code. Check your number or try again in a moment." };
}

export async function verifyOtp(_previous: ActionState, form: FormData): Promise<ActionState> {
  const phone = normalizePhone(form.get("phone"));
  const code = form.get("otp");
  if (!phone) return { error: "Enter a valid 10-digit Indian mobile number." };
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) return { error: "Enter the 6-digit code from your SMS." };
  const auth = isDemoMode() ? null : smsAuth();
  if (!auth) return { error: SIGN_IN_UNAVAILABLE };
  let link;
  try { link = await requireSignInLink(form); }
  catch (error) { return signInLinkError(error); }
  const { data, error } = await auth.verifyOtp({ phone: "+91" + phone, token: code.trim(), type: "sms" });
  if (error?.status === 429) return { error: "Too many attempts. Wait a few minutes, then request a new code." };
  if (error && (!error.status || error.status >= 500)) return { error: SIGN_IN_UNAVAILABLE };
  if (error || !data.session || !data.user?.phone_confirmed_at || normalizePhone(data.user.phone) !== phone) {
    return { error: "That code is invalid or expired. Check the SMS or request a new one." };
  }
  return completeSignIn(phone, dealReturnPath(form.get("next")), link);
}

export async function sendEmailSignInCode(
  _previous: EmailSignInCodeState, form: FormData,
): Promise<EmailSignInCodeState> {
  const email = normalizeSignInEmail(form.get("email"));
  if (!email) return { error: "Enter a valid email address." };
  const auth = emailAuthEnabled() ? smsAuth() : null;
  if (!auth) return { error: SIGN_IN_UNAVAILABLE };
  const captchaToken = signInCaptcha(form);
  if (process.env.JODO_TURNSTILE_SITE_KEY?.trim() && !captchaToken) {
    return { error: "Complete the security check to request a code." };
  }
  const { error } = await auth.signInWithOtp({ email, options: { captchaToken } });
  if (!error) return { email, sentAt: Date.now() };
  if (error.status === 429) return { error: "Wait a minute before requesting another code." };
  if (error.code === "captcha_failed") return { error: "The security check expired. Complete it again to request a code." };
  return { error: "We couldn’t send a code. Check your email address or try again in a moment." };
}

export async function verifyEmailSignInCode(_previous: ActionState, form: FormData): Promise<ActionState> {
  const email = normalizeSignInEmail(form.get("email"));
  const code = form.get("otp");
  if (!email) return { error: "Enter a valid email address." };
  if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) return { error: "Enter the 6-digit code from your email." };
  const auth = emailAuthEnabled() ? smsAuth() : null;
  if (!auth) return { error: SIGN_IN_UNAVAILABLE };
  if (await getMe()) redirect("/");

  const { data, error } = await auth.verifyOtp({ email, token: code.trim(), type: "email" });
  if (error?.status === 429) return { error: "Too many attempts. Wait a few minutes, then request a new code." };
  if (error && (!error.status || error.status >= 500)) return { error: SIGN_IN_UNAVAILABLE };
  if (error || !data.session || !data.user?.email_confirmed_at || normalizeSignInEmail(data.user.email) !== email) {
    return { error: "That code is invalid or expired. Check the email or request a new one." };
  }
  let destination: string;
  try {
    const user = await findEmailUser(email);
    await clearAlternateSignIns();
    if (user) {
      const target = await signInDestination(user);
      if (!target) return { error: "This account has no active access. Contact your society committee." };
      await createSession(user.id);
      destination = target;
    } else {
      await beginEmailLink(email);
      destination = "/login";
    }
  } catch (error) {
    console.error("Email sign-in could not complete", error instanceof Error ? error.name : "UnknownError");
    return { error: SIGN_IN_UNAVAILABLE };
  }
  redirect(destination);
}

export async function openDemoAccount(_previous: ActionState, form: FormData): Promise<ActionState> {
  if (!isDemoMode()) return { error: "Demo accounts are unavailable here." };
  const phone = normalizePhone(form.get("phone"));
  if (!phone) return { error: "Choose a test account or enter a valid 10-digit test number." };
  return completeSignIn(phone, dealReturnPath(form.get("next")));
}

export async function signOut() {
  await destroySession();
  await clearAlternateSignIns();
  redirect("/login");
}

export async function saveResidency(_prev: ActionState, form: FormData): Promise<ActionState> {
  let status: "pending" | "verified";
  try {
    const me = await requireMe();
    if (me.user.role !== "resident" && me.user.role !== "secretary") {
      return { error: "Sign in with a resident account to request flat verification." };
    }
    ({ status } = await claimResidency({
      userId: me.user.id,
      name: String(form.get("name") ?? ""),
      societyId: String(form.get("societyId") ?? ""),
      flat: String(form.get("flat") ?? ""),
      type: String(form.get("type") ?? "owner") === "tenant" ? "tenant" : "owner",
    }));
  } catch (e) {
    return fail(e);
  }
  const next = dealReturnPath(form.get("next"));
  redirect(status === "verified" ? next ?? "/" : dealReturnHref("/onboarding", next));
}

// ------------------------------------------------------------------ deals

export async function joinAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    if (!me.residency) return { error: "Verify your flat first." };
    const dealId = String(form.get("dealId"));
    await assertCan(me, { kind: "deal.join", dealId });
    await joinDeal({
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
    await leaveDeal(dealId, me.user.id);
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
    await assertCan(me, { kind: "deal.comment", dealId });
    await addComment(dealId, me.user.id, String(form.get("body") ?? ""));
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
    if (me.residency?.status !== "verified") return { error: "Verify your flat first." };
    dealId = await createDeal({
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
    await assertCan(me, { kind: "deal.simulate", dealId });
    const n = Number(form.get("count") ?? 1);
    const { added } = await simulateJoins(dealId, n);
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
    await assertCan(me, { kind: "demo.reset" });
    await resetAllData();
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
    await assertCan(me, { kind: "deal.lock", dealId });
    await lockDeal(dealId);
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
    await assertCan(me, { kind: "deal.expire", dealId });
    await expireDeal(dealId);
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
    await assertCan(me, { kind: "deal.start_service", dealId });
    await startService(dealId);
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/vendor");
    revalidatePath("/bookings");
    return { ok: "Crew on the way" };
  } catch (e) {
    return fail(e);
  }
}

export async function completeJobAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const jobId = String(form.get("jobId"));
    await assertCan(me, { kind: "job.complete", jobId });
    const dealId = await completeJob(jobId, String(form.get("otp") ?? ""));
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/vendor");
    revalidatePath("/bookings");
    revalidatePath("/ops");
    revalidatePath("/notifications");
    return { ok: "Job completed" };
  } catch (e) {
    return fail(e);
  }
}

export async function rateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const jobId = String(form.get("jobId"));
    await assertCan(me, { kind: "job.rate", jobId });
    await rateJob(jobId, Number(form.get("score") ?? 5), String(form.get("note") ?? ""));
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
    await assertCan(me, { kind: "deal.update_slabs", dealId });
    const slabs: Slab[] = [];
    for (let i = 0; i < 4; i++) {
      const flats = Number(form.get(`flats${i}`) ?? 0);
      const rupees = Number(form.get(`price${i}`) ?? 0);
      if (flats > 0 && rupees > 0) slabs.push({ minFlats: flats, pricePaise: Math.round(rupees * 100) });
    }
    await updateSlabs(dealId, slabs);
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
    await assertCan(me, { kind: "deal.approve", dealId });
    await approveDeal(dealId, me.user.id);
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
    await assertCan(me, { kind: "job.start", jobId });
    const dealId = await startJob(jobId, String(form.get("otp") ?? ""));
    revalidatePath("/vendor");
    revalidatePath(`/deal/${dealId}`);
    revalidatePath("/bookings");
    revalidatePath("/ops");
    revalidatePath("/notifications");
    return { ok: "Job started" };
  } catch (e) {
    return fail(e);
  }
}

export async function scheduleRevisitAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const jobId = String(form.get("jobId") ?? "");
    await assertCan(me, { kind: "job.schedule_revisit", jobId });
    await scheduleRevisit(jobId, String(form.get("serviceDate") ?? ""), String(form.get("slot") ?? ""));
    revalidatePath("/vendor");
    revalidatePath("/ops");
    revalidatePath("/bookings");
    revalidatePath("/notifications");
    return { ok: "Revisit scheduled" };
  } catch (e) {
    return fail(e);
  }
}

export async function raiseDisputeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const jobId = String(form.get("jobId"));
    await assertCan(me, { kind: "dispute.raise", jobId });
    await raiseDispute({
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
    await assertCan(me, { kind: "dispute.resolve" });
    const resolution = String(form.get("resolution") ?? "rejected");
    if (!["refund", "revisit", "rejected"].includes(resolution)) return { error: "Pick an outcome." };
    await resolveDispute(
      String(form.get("disputeId")),
      resolution as "refund" | "revisit" | "rejected",
      String(form.get("note") ?? ""),
    );
    revalidatePath("/ops");
    revalidatePath("/bookings");
    revalidatePath("/notifications");
    if (resolution === "revisit") {
      revalidatePath("/vendor");
      return { ok: "Revisit approved. The vendor can now schedule it." };
    }
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
    const { duplicate } = await createLead({
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
    await track(null, "lead_society", { duplicate });
    revalidatePath("/ops");
    return { ok: duplicate ? "Your request is already on file." : "Your society setup request was received." };
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
    const { duplicate } = await createLead({
      kind: "vendor",
      name: form.get("name"),
      phone: form.get("phone"),
      org: form.get("business"),
      city: form.get("city"),
      detail: { services, crew: Number.isFinite(crew) && crew > 0 ? Math.min(crew, 500) : null },
    });
    await track(null, "lead_vendor", { duplicate, services });
    revalidatePath("/ops");
    return { ok: duplicate ? "Your application is already on file." : "Your service partner application was received." };
  } catch (e) {
    return fail(e);
  }
}

export async function markLeadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    await assertCan(me, { kind: "console.ops" });
    const status = String(form.get("status"));
    if (status !== "contacted" && status !== "won" && status !== "lost") return { error: "Unknown status." };
    await markLead(String(form.get("leadId")), status);
    revalidatePath("/ops");
    return { ok: status };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------ preferences

export async function markNotificationsRead() {
  const me = await requireMe();
  await markAllRead(me.user.id);
  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function setLanguage(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireMe();
    const lang = String(form.get("lang") ?? "en");
    if (!isLang(lang)) return { error: "Unknown language." };
    await run("UPDATE user SET lang = ? WHERE id = ?", lang, me.user.id);
    revalidatePath("/", "layout");
    return { ok: lang };
  } catch (e) {
    return fail(e);
  }
}

export async function trackEvent(name: string, props: Record<string, unknown> = {}) {
  const me = await getMeSafe();
  await track(me?.user.id ?? null, name, props);
}

async function getMeSafe() {
  try {
    return await requireMe();
  } catch {
    return null;
  }
}
