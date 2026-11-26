"use server";

import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/session";
import { SocietyAccessError } from "@/lib/society-access";
import { MembershipError, reviewMembershipRequest, revokeMembership } from "@/lib/society-membership";

export type MembershipFormState = { error?: string };

export async function reviewFlatRequest(_: MembershipFormState, form: FormData): Promise<MembershipFormState> {
  try {
    await reviewMembershipRequest(await getMe(), String(form.get("requestId") ?? ""), String(form.get("decision") ?? ""));
    revalidatePath("/society/membership");
    return {};
  } catch (error) {
    if (error instanceof MembershipError || error instanceof SocietyAccessError) return { error: error.message };
    console.error(error);
    return { error: "The decision could not be saved. Try again." };
  }
}

export async function revokeFlatMembership(_: MembershipFormState, form: FormData): Promise<MembershipFormState> {
  if (form.get("confirm") !== "yes") return { error: "Confirm that this resident’s society access should end." };
  try {
    await revokeMembership(await getMe(), String(form.get("residencyId") ?? ""));
    revalidatePath("/society/membership");
    return {};
  } catch (error) {
    if (error instanceof MembershipError || error instanceof SocietyAccessError) return { error: error.message };
    console.error(error);
    return { error: "Access could not be revoked. Try again." };
  }
}
