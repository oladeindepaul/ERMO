"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions";

// A form wired to a server action that returns { error } or { ok }. Shows the message under the fields.
export function ActionForm({
  action,
  children,
  submit,
  submitClass = "btn",
  className = "space-y-4",
  confirm,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submit: string;
  submitClass?: string;
  className?: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div>
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? "Please wait…" : submit}
        </button>
        {state?.error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="mt-2 text-sm text-ok">
            {state.ok}
          </p>
        )}
      </div>
    </form>
  );
}
