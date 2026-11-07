"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { celo } from "viem/chains";
import { notifyCreditsChanged } from "@/components/credit-intentions";
import { useSmartWalletPublish } from "@/components/ensure-smart-wallet";
import { apiFetch } from "@/lib/api";
import { parseUsdc } from "@/lib/usdc";
import { freshWalletUsdc, rememberWalletUsdc, subscribeWalletUsdc } from "@/lib/wallet-usdc-cache";
import { Button, Card, TextField } from "@/components/ui";
import { useWalletSetupError } from "@/components/wallet-setup";

type CreditTx = { chainId: string; to: `0x${string}`; data: `0x${string}`; value: string };

export function CreditForm() {
  const { client, getClientForChain } = useSmartWallets();
  const setupError = useWalletSetupError();
  const { ready, failed, pending, retry } = useSmartWalletPublish();
  const address = client?.account?.address;
  const walletUsdc = useSyncExternalStore(
    subscribeWalletUsdc,
    () => (address ? freshWalletUsdc(address) : undefined),
    () => undefined,
  );

  useEffect(() => {
    if (!address || walletUsdc !== undefined) return;
    const controller = new AbortController();
    void apiFetch(`/api/balance?address=${address}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("balance");
        return (await response.json()) as { usdc?: string | null };
      })
      .then((body) => {
        rememberWalletUsdc(address, typeof body.usdc === "string" ? body.usdc : null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        rememberWalletUsdc(address, null);
      });
    return () => controller.abort();
  }, [address, walletUsdc]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const status = failed
    ? pending
      ? "loading"
      : "failed"
    : !address && setupError
      ? "setup-error"
      : (!address && !setupError) || (address && !ready)
        ? "loading"
        : null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address) return;
    const value = amount;
    startSubmit(async () => {
      setError(null);
      setTxHash(null);
      const requested = parseUsdc(value);
      if (requested === null) {
        setError("Enter a USDC amount greater than zero.");
        return;
      }
      const balanceResponse = await apiFetch(`/api/balance?address=${address}`);
      const balanceBody: unknown = await balanceResponse.json().catch(() => null);
      const available = readBalanceAtomic(balanceBody);
      if (available === null) {
        setError("Could not read the USDC balance in your wallet.");
        return;
      }
      if (available < requested) {
        setError("Not enough USDC in your wallet for this top-up.");
        return;
      }

      const created = await apiFetch("/api/credits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address, amount: value }),
      });
      const payload: unknown = await created.json().catch(() => null);
      if (!created.ok) {
        setError(readMessage(payload, "Could not open the credit."));
        return;
      }
      const intention = readIntention(payload);
      if (!intention) {
        setError("Could not open the credit.");
        return;
      }
      notifyCreditsChanged();

      const chainClient = await getClientForChain({ id: celo.id });
      if (!chainClient) {
        setError("The Celo wallet is not ready.");
        return;
      }

      let hash: string;
      try {
        const sent = await chainClient.sendTransaction({
          calls: [{ to: intention.tx.to, data: intention.tx.data, value: BigInt(intention.tx.value) }],
        });
        hash = typeof sent === "string" ? sent : String(sent);
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message.toLowerCase() : "";
        const insufficient = detail.includes("insufficient") || detail.includes("exceeds balance");
        setError(insufficient ? "Not enough USDC in your wallet for this top-up." : "The transfer was not signed.");
        return;
      }

      const confirmed = await apiFetch(`/api/credits/${intention.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: hash }),
      });
      const confirmedBody: unknown = await confirmed.json().catch(() => null);
      if (!confirmed.ok) {
        setTxHash(hash);
        setError(readMessage(confirmedBody, "The transfer was sent, but the credit was not confirmed."));
        return;
      }
      setTxHash(hash);
      notifyCreditsChanged();
    });
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
    <Card>
      <h2 className="font-sans text-lg font-semibold text-foreground">Buy credits with your USDC</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        This spends USDC already in your wallet. Privy asks you to sign the transfer to the product wallet.
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4" noValidate>
        <TextField
          id="credit-amount"
          label="Amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="10.00"
          hint={
            walletUsdc === undefined
              ? "Reading available USDC…"
              : walletUsdc === null
                ? "Wallet USDC is unavailable."
                : `Available ${walletUsdc} USDC`
          }
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Waiting for the signature…" : "Buy credits"}
        </Button>
      </form>
      <p className={`mt-3 min-h-6 text-sm font-semibold ${error ? "text-destructive" : "text-foreground"}`} aria-live="polite">
        {error ?? (txHash ? "Credit confirmed." : "")}
      </p>
    </Card>
  );
}

function readBalanceAtomic(payload: unknown): bigint | null {
  if (!payload || typeof payload !== "object" || !("usdc" in payload) || typeof payload.usdc !== "string") return null;
  const normalized = payload.usdc.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.slice(0, 6).padEnd(6, "0"));
}

function readIntention(payload: unknown): { id: string; tx: CreditTx } | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { id?: unknown; tx?: unknown };
  if (typeof record.id !== "string" || !record.tx || typeof record.tx !== "object") return null;
  const tx = record.tx as { chainId?: unknown; to?: unknown; data?: unknown; value?: unknown };
  if (typeof tx.chainId !== "string" || typeof tx.to !== "string" || typeof tx.data !== "string" || typeof tx.value !== "string") {
    return null;
  }
  return { id: record.id, tx: { chainId: tx.chainId, to: tx.to as CreditTx["to"], data: tx.data as CreditTx["data"], value: tx.value } };
}

function readMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
}
