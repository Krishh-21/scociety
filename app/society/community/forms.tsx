"use client";

import type { ReactNode } from "react";
import type { ActionState } from "@/app/actions";
import { useSocietyForm } from "../useSocietyForm";

export function CommunityForm({ action, children, submit, quiet = false }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submit: string;
  quiet?: boolean;
}) {
  const { state, pending, formProps } = useSocietyForm(action);
  return (
    <form {...formProps} className="flex min-w-0 flex-col items-start gap-2.5">
      {children}
      <button type="submit" disabled={pending} className={`btn ${quiet ? "btn-quiet" : "btn-primary"}`}>
        {pending ? "Saving…" : submit}
      </button>
      {state.error && <p role="alert" className="text-sm text-danger-600">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-save-700">{state.ok}</p>}
    </form>
  );
}

export function PrintMinutesButton() {
  return <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print / save PDF</button>;
}
