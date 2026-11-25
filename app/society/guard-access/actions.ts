"use server";

import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/session";
import { registerGuard, setGuardActive, SocietyAccessError } from "@/lib/society-access";

export type GuardFormState = { error?: string; ok?: string };

export async function changeGuardAccess(_: GuardFormState, form: FormData): Promise<GuardFormState> {
  try {
    const me = await getMe();
    const mode = form.get("mode");
    if (mode === "add") {
      await registerGuard(me, String(form.get("phone") ?? ""), String(form.get("name") ?? ""));
    } else if (mode === "enable" || mode === "disable") {
      await setGuardActive(me, String(form.get("guardId") ?? ""), mode === "enable");
    } else {
      return { error: "Choose a guard access action." };
    }
    revalidatePath("/society/guard-access");
    return { ok: mode === "disable" ? "Guard access paused." : "Guard access is active." };
  } catch (error) {
    if (error instanceof SocietyAccessError) return { error: error.message };
    console.error(error);
    return { error: "Guard access could not be saved. Try again." };
  }
}
