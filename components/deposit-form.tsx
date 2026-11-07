"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useRef, useState, useTransition } from "react";
import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";
import { highlightAddress } from "@/lib/address";
import { useSmartWalletPublish } from "@/components/ensure-smart-wallet";
import { CopyIcon } from "@/components/icons";
import { Button, Card, TextField } from "@/components/ui";
import { useWalletSetupError } from "@/components/wallet-setup";

type DepositMethod = "onchain" | "pix";

const methods: { id: DepositMethod; label: string }[] = [
  { id: "onchain", label: "Onchain" },
  { id: "pix", label: "Pix" },
];

type PixResult = {
  ping: "pong";
  label: string;
  qrDataUrl: string;
};

export function DepositForm({ registered }: { registered: boolean }) {
  const [method, setMethod] = useState<DepositMethod>("onchain");

  return (
    <div className="grid gap-4">
      <fieldset>
        <legend className="sr-only">Deposit method</legend>
        <div className="grid grid-cols-2 gap-2">
          {methods.map((item) => (
            <div key={item.id}>
              <input
                type="radio"
                id={`deposit-${item.id}`}
                name="deposit-method"
                value={item.id}
                checked={method === item.id}
                onChange={() => setMethod(item.id)}
                className="peer sr-only"
              />
              <label
                htmlFor={`deposit-${item.id}`}
                className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl border border-border bg-card px-3 text-base font-semibold text-foreground transition-colors duration-200 peer-checked:border-transparent peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
              >
                {item.label}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      {method === "onchain" ? <OnchainDeposit /> : registered ? <PixDeposit /> : <RegistrationRequired />}
    </div>
  );
}

function OnchainDeposit() {
  const { client } = useSmartWallets();
  const setupError = useWalletSetupError();
  const { ready, failed, pending, retry } = useSmartWalletPublish();
  const address = client?.account?.address;
  const parts = address ? highlightAddress(address) : null;
  const shown = parts ? `${parts.prefix}${parts.middle}${parts.suffix}` : (address ?? null);
  const [qr, setQr] = useState<{ address: string; url: string } | null>(null);
  const [qrError, setQrError] = useState(false);
  const qrDataUrl = qr?.address === shown ? qr.url : null;
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const resetCopy = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetCopy.current != null) window.clearTimeout(resetCopy.current);
    };
  }, []);

  useEffect(() => {
    if (!shown || !ready) return;
    const current = shown;
    let cancelled = false;
    void QRCode.toDataURL(current, { margin: 1, width: 280, errorCorrectionLevel: "M" })
      .then((url) => {
        if (cancelled) return;
        setQrError(false);
        setQr({ address: current, url });
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [shown, ready]);
  const status = failed
    ? pending
      ? "loading"
      : "failed"
    : !address && setupError
      ? "setup-error"
      : (!address && !setupError) || (address && !ready)
        ? "loading"
        : null;

  function copyAddress() {
    if (!shown) return;
    setCopyError(null);
    void navigator.clipboard.writeText(shown).then(
      () => {
        setCopied(true);
        if (resetCopy.current != null) window.clearTimeout(resetCopy.current);
        resetCopy.current = window.setTimeout(() => setCopied(false), 2000);
      },
      () => setCopyError("Could not copy the address."),
    );
  }

  if (status === "loading") {
    return (
      <Card>
        <p className="text-2xl text-foreground" role="status">
          Setting up your wallet…
        </p>
      </Card>
    );
  }

  if (status === "failed") {
    return (
      <Card>
        <p className="text-2xl text-foreground" role="alert">
          The wallet failed to start.
        </p>
        <Button className="mt-4" onClick={retry}>
          Try again
        </Button>
      </Card>
    );
  }

  if (status === "setup-error") {
    return (
      <Card>
        <p className="text-lg text-foreground" role="alert">
          {setupError}
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-center text-center">
      <h2 className="font-sans text-lg font-semibold text-foreground">USDC on this address</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        Send USDC on Celo to your wallet. Credits are a separate step, after this balance arrives.
      </p>
      <div className="mt-4 grid size-[280px] place-items-center overflow-hidden rounded-2xl border border-border bg-card">
        {qrError ? (
          <p className="px-4 text-sm text-destructive" role="alert">
            Could not build the QR code.
          </p>
        ) : qrDataUrl ? (
          // The QR is a data URL of this wallet address.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="QR code of the wallet address" width={280} height={280} />
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            Building QR code…
          </p>
        )}
      </div>
      {parts ? (
        <p className="mt-4 max-w-full break-all text-center font-mono text-sm leading-7 text-muted-foreground sm:text-base">
          <span className="whitespace-nowrap font-bold">{parts.prefix}</span>
          {parts.middle}
          <span className="whitespace-nowrap font-bold">{parts.suffix}</span>
        </p>
      ) : shown ? (
        <p className="mt-4 max-w-full break-all text-center font-mono text-sm leading-6 text-foreground">{shown}</p>
      ) : null}
      <Button variant="quiet" onClick={copyAddress} className="mt-4 w-full sm:w-auto">
        <CopyIcon />
        Copy address
      </Button>
      <p
        className={`mt-3 min-h-6 text-sm font-semibold ${copyError && !copied ? "text-destructive" : "text-foreground"}`}
        aria-live="polite"
      >
        {copied ? "Address copied." : copyError}
      </p>
    </Card>
  );
}

function RegistrationRequired() {
  return (
    <Card className="border-accent">
      <h2 className="text-3xl text-foreground">Finish your account</h2>
      <p className="mt-2 max-w-prose text-muted-foreground">
        Finish the account to open the Pix stub. It does not credit USDC yet.
      </p>
      <Button href="/account" className="mt-4">
        Finish account
      </Button>
    </Card>
  );
}

function PixDeposit() {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PixResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = amount;
    startTransition(async () => {
      setError(null);
      const response = await apiFetch("/api/deposit/pix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: value }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setResult(null);
        setError(readMessage(payload, "Could not build the QR code."));
        return;
      }
      const next = readPix(payload);
      if (!next) {
        setResult(null);
        setError("Could not build the QR code.");
        return;
      }
      setResult(next);
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Card>
        <p className="text-sm text-muted-foreground">Pix credits USDC on Celo.</p>
        <div className="mt-4">
          <TextField
            id="amount"
            label="Amount to receive"
            hint="In Brazilian reais. The test QR shows this amount, and the credit lands as USDC."
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            error={error ?? undefined}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending} className="mt-5 w-full sm:w-auto">
          {pending ? "Building QR…" : "Build QR code"}
        </Button>
      </Card>
      {result ? (
        <Card>
          <h2 className="font-sans text-lg font-semibold text-foreground">Test QR, Pix, USDC, {result.label}</h2>
          {/* The QR is a data URL built for this test charge. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.qrDataUrl}
            alt={`Test QR code to receive ${result.label} via Pix`}
            width={280}
            height={280}
            className="mt-4 size-[280px] rounded-2xl border border-border bg-card"
          />
          <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
            Service response: {result.ping}
          </p>
        </Card>
      ) : null}
    </form>
  );
}

function readMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
}

function readPix(payload: unknown): PixResult | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.ping !== "pong" || record.channel !== "pix") return null;
  if (typeof record.label !== "string" || typeof record.qrDataUrl !== "string") return null;
  if (!record.qrDataUrl.startsWith("data:image/")) return null;
  return { ping: "pong", label: record.label, qrDataUrl: record.qrDataUrl };
}
