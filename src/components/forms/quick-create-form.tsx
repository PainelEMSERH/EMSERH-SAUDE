"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/actions/occupational";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Field =
  | {
      name: string;
      label: string;
      type?: "text" | "date" | "datetime-local" | "number" | "select" | "textarea";
      required?: boolean;
      options?: { value: string; label: string }[];
      placeholder?: string;
      defaultValue?: string;
    };

const initial: ActionState = {};

export function QuickCreateForm({
  action,
  fields,
  submitLabel,
}: {
  action: (
    prev: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  fields: Field[];
  submitLabel: string;
  onSuccessPath?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initial);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div
            key={field.name}
            className={
              field.type === "textarea" ? "space-y-1 sm:col-span-2" : "space-y-1"
            }
          >
            <Label htmlFor={field.name}>{field.label}</Label>
            {field.type === "select" ? (
              <select
                id={field.name}
                name={field.name}
                required={field.required}
                defaultValue={field.defaultValue ?? ""}
                className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
              >
                <option value="">—</option>
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <Textarea
                id={field.name}
                name={field.name}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={field.defaultValue}
              />
            ) : (
              <Input
                id={field.name}
                name={field.name}
                type={field.type ?? "text"}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={field.defaultValue}
              />
            )}
          </div>
        ))}
      </div>
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : state.ok ? (
        <p className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          Registro salvo.
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        className="bg-teal-700 hover:bg-teal-800"
      >
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
