"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";

export function SaveForm({ action, children, className }: {
  action: (data: FormData) => Promise<{ error: string; id?: string } | void>;
  children: ReactNode;
  className: string;
}) {
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string>();
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  return <form className={className} aria-busy={pending} onSubmit={(event) => {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    if (savedId) data.set("id", savedId);
    submitting.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await action(data);
        if (result?.error) setError(result.error);
        if (result?.id) setSavedId(result.id);
      } catch {
        setError("Não foi possível salvar. Seus dados foram mantidos; tente novamente.");
      } finally {
        submitting.current = false;
      }
    });
  }}>
    <fieldset className="save-form-fields" disabled={pending}>{children}</fieldset>
    {pending && <p role="status">Salvando…</p>}
    {error && <p className="alert alert-error" role="alert">{error}</p>}
  </form>;
}
