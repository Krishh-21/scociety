"use server";

import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/session";
import { SocietyAccessError } from "@/lib/society-access";
import { createGuestPass, decideVisit, GateError, logVisit, recordVisitMovement, redeemGuestPass } from "@/lib/society-gate";

export type VisitorActionState = { error?: string; ok?: string; code?: string; expiresAt?: string; visitId?: string };

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function errorState(error: unknown): VisitorActionState {
  if (error instanceof GateError || error instanceof SocietyAccessError) return { error: error.message };
  console.error(error);
  return { error: "Something went wrong. Try again." };
}

export async function logVisitAction(_prev: VisitorActionState, form: FormData): Promise<VisitorActionState> {
  try {
    const visitId = await logVisit(await getMe(), { residencyId: field(form, "residencyId"), name: field(form, "name"), kind: field(form, "kind") });
    revalidatePath("/society/visitors");
    revalidatePath("/notifications");
    revalidatePath("/");
    return { ok: "Entry ticket sent to the resident.", visitId };
  } catch (error) {
    return errorState(error);
  }
}

export async function decideVisitAction(_prev: VisitorActionState, form: FormData): Promise<VisitorActionState> {
  try {
    const decision = field(form, "decision");
    await decideVisit(await getMe(), field(form, "visitId"), decision);
    revalidatePath("/society/visitors");
    revalidatePath("/notifications");
    revalidatePath("/");
    return { ok: decision === "approved" ? "Entry approved." : "Entry denied." };
  } catch (error) {
    return errorState(error);
  }
}

export async function recordVisitMovementAction(_prev: VisitorActionState, form: FormData): Promise<VisitorActionState> {
  try {
    const direction = field(form, "direction");
    await recordVisitMovement(await getMe(), field(form, "visitId"), direction);
    revalidatePath("/society/visitors");
    revalidatePath("/society");
    return { ok: direction === "in" ? "Visitor checked in." : "Visitor checked out." };
  } catch (error) {
    return errorState(error);
  }
}

export async function createGuestPassAction(_prev: VisitorActionState, form: FormData): Promise<VisitorActionState> {
  try {
    const { code, expiresAt } = await createGuestPass(await getMe(), field(form, "name"));
    revalidatePath("/society/visitors");
    return { code, expiresAt };
  } catch (error) {
    return errorState(error);
  }
}

export async function redeemGuestPassAction(_prev: VisitorActionState, form: FormData): Promise<VisitorActionState> {
  try {
    await redeemGuestPass(await getMe(), field(form, "code"));
    revalidatePath("/society/visitors");
    return { ok: "Pass accepted. Confirm the guest’s name and check them in from the gate log." };
  } catch (error) {
    return errorState(error);
  }
}
