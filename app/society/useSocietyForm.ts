"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

type FormState = { error?: string; ok?: string };

export function useSocietyForm(submit: (state: FormState, data: FormData) => Promise<FormState>) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(submit, {});

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return {
    state,
    pending,
    formProps: {
      ref: form,
      action,
      "aria-busy": pending,
      onSubmit(event: FormEvent<HTMLFormElement>) {
        // Keep the draft when a server action returns a validation error.
        event.preventDefault();
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        startTransition(() => action(data));
      },
    },
  };
}
