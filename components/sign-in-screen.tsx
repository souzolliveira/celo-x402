"use client";

import { useLoginWithEmail } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { Button, Card, TextField } from "@/components/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInScreen({ embedded = false }: { embedded?: boolean }) {
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [emailError, setEmailError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const sending = state.status === "sending-code";
  const submitting = state.status === "submitting-code";
  const flowError = state.status === "error" ? loginErrorMessage(state.error, step) : null;

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function onSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!EMAIL.test(nextEmail)) {
      setEmailError("Enter a valid email.");
      return;
    }
    setEmailError(null);
    try {
      await sendCode({ email: nextEmail });
      setStep("code");
    } catch {
      setEmailError("Could not send the code. Check the email and try again.");
    }
  }

  async function onConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCode = code.trim();
    if (nextCode.length < 4) {
      return;
    }
    try {
      await loginWithCode({ code: nextCode });
    } catch {
      return;
    }
  }

  const card = (
      <Card className="w-full">
        <p className="text-sm font-semibold text-muted-foreground">Brief</p>
        {embedded ? (
          <h2 className="mt-2 text-4xl text-foreground">Sign in or create an account</h2>
        ) : (
          <h1 className="mt-2 text-4xl text-foreground">Sign in or create an account</h1>
        )}
        <p className="mt-3 text-muted-foreground">
          The first sign-in creates your wallet on Celo. We will email you a code.
        </p>

        {step === "email" ? (
          <form onSubmit={onSend} className="mt-6 grid gap-4" noValidate>
            <TextField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={emailError ?? (state.status === "error" ? flowError ?? undefined : undefined)}
              hint="You can paste the address."
            />
            <Button type="submit" disabled={sending} className="w-full">
              {sending ? "Sending code…" : "Send code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onConfirm} className="mt-6 grid gap-4" noValidate>
            <TextField
              id="code"
              label="Code"
              inputRef={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={state.status === "error" ? flowError ?? undefined : undefined}
              hint={`Sent to ${email.trim()}. You can paste the code.`}
            />
            <Button type="submit" disabled={submitting || code.trim().length < 4} className="w-full">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="quiet"
                disabled={sending}
                onClick={() => {
                  void sendCode({ email: email.trim() });
                }}
              >
                {sending ? "Sending…" : "Send another code"}
              </Button>
              <Button
                type="button"
                variant="quiet"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
              >
                Change email
              </Button>
            </div>
          </form>
        )}
      </Card>
  );

  if (embedded) return card;

  return (
    <main id="content" className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      {card}
    </main>
  );
}

function loginErrorMessage(error: Error | null, step: "email" | "code"): string {
  const raw = error?.message.toLowerCase() ?? "";
  if (raw.includes("expired")) return "That code expired. Ask for another one.";
  if (raw.includes("rate") || raw.includes("too many")) {
    return "Too many attempts. Wait a moment and ask for another code.";
  }
  if (step === "code") return "Invalid code. Check the email or ask for another code.";
  return "Could not send the code. Check the email and try again.";
}
