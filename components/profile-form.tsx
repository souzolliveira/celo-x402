"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorSummary, TextField } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import type { KycStatus } from "@/lib/profile";

type FieldName = "fullName" | "email" | "document" | "phone";

type InitialProfile = {
  fullName: string;
  email: string;
  document: string;
  phone: string;
  kycStatus: KycStatus;
};

const empty: InitialProfile = {
  fullName: "",
  email: "",
  document: "",
  phone: "",
  kycStatus: "pending",
};

export function ProfileForm({ initial }: { initial: InitialProfile | null }) {
  const router = useRouter();
  const starting = initial ?? empty;
  const [values, setValues] = useState(starting);
  const [saved, setSaved] = useState(initial !== null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [pending, startTransition] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);
  const activated = saved;

  function setField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      fullName: values.fullName,
      email: values.email,
      document: values.document,
      phone: values.phone,
    };
    startTransition(async () => {
      const response = await apiFetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const next = readFieldErrors(payload);
        setErrors(next);
        if (Object.keys(next).length > 0) summaryRef.current?.focus();
        return;
      }
      setErrors({});
      setSaved(true);
      if (payload && typeof payload === "object" && "kycStatus" in payload) {
        const status = payload.kycStatus === "verified" ? "verified" : "pending";
        setValues((current) => ({ ...current, kycStatus: status }));
      }
      router.refresh();
    });
  }

  const summary = (Object.entries(errors) as [FieldName, string][]).map(([field, message]) => ({
    href: `#${field}`,
    message,
  }));
  const kycText = values.kycStatus === "verified" ? "Verified" : "Waiting for verification";

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <ErrorSummary title="Check your details" errors={summary} summaryRef={summaryRef} />
      {activated ? (
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-foreground">
          Account active. Identity: {kycText}.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Fill in your details to activate the wallet. Identity verification itself is not running yet.
        </p>
      )}
      <Card>
        <div className="grid gap-4">
          <TextField
            id="fullName"
            label="Full name"
            autoComplete="name"
            value={values.fullName}
            error={errors.fullName}
            onChange={(event) => setField("fullName", event.target.value)}
          />
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            error={errors.email}
            onChange={(event) => setField("email", event.target.value)}
          />
          <TextField
            id="document"
            label="Document"
            hint="Passport or national ID."
            autoComplete="off"
            value={values.document}
            error={errors.document}
            onChange={(event) => setField("document", event.target.value)}
          />
          <TextField
            id="phone"
            label="Phone"
            type="tel"
            autoComplete="tel"
            hint="Include the area code."
            value={values.phone}
            error={errors.phone}
            onChange={(event) => setField("phone", event.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending} className="mt-5 w-full sm:w-auto">
          {pending ? "Saving…" : activated ? "Save details" : "Finish account"}
        </Button>
      </Card>
    </form>
  );
}

function readFieldErrors(payload: unknown): Partial<Record<FieldName, string>> {
  if (!payload || typeof payload !== "object" || !("errors" in payload) || !Array.isArray(payload.errors)) {
    return { fullName: "Could not save." };
  }
  const errors: Partial<Record<FieldName, string>> = {};
  for (const item of payload.errors) {
    const field = readString(item, "field");
    const message = readString(item, "message");
    if (
      (field === "fullName" || field === "email" || field === "document" || field === "phone") &&
      message
    ) {
      errors[field] = message;
    }
  }
  return errors;
}

function readString(item: unknown, key: string): string | null {
  if (!item || typeof item !== "object" || !(key in item)) return null;
  const value = (item as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}
