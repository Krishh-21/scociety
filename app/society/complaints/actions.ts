"use server";

import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/session";
import { SocietyAccessError } from "@/lib/society-access";
import { ComplaintError, createComplaint, updateComplaint } from "@/lib/society-complaints";

export type ComplaintFormState = { error?: string; ok?: string };

function refreshComplaints() {
  revalidatePath("/society/complaints");
  revalidatePath("/society");
  revalidatePath("/notifications");
}

function errorState(error: unknown): ComplaintFormState {
  if (error instanceof ComplaintError || error instanceof SocietyAccessError) return { error: error.message };
  console.error(error);
  return { error: "The complaint could not be saved. Try again." };
}

export async function reportComplaintAction(_: ComplaintFormState, form: FormData): Promise<ComplaintFormState> {
  try {
    createComplaint(await getMe(), String(form.get("category") ?? ""), String(form.get("title") ?? ""), String(form.get("detail") ?? ""));
    refreshComplaints();
    return { ok: "Complaint sent to your committee." };
  } catch (error) {
    return errorState(error);
  }
}

export async function updateComplaintAction(_: ComplaintFormState, form: FormData): Promise<ComplaintFormState> {
  try {
    updateComplaint(
      await getMe(), String(form.get("complaintId") ?? ""), String(form.get("status") ?? ""),
      String(form.get("assignee") ?? ""), String(form.get("note") ?? ""),
    );
    refreshComplaints();
    return { ok: "Complaint updated." };
  } catch (error) {
    return errorState(error);
  }
}
