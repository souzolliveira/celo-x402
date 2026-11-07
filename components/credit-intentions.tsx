"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useState } from "react";
import { celo } from "viem/chains";
import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";

export const creditsChanged = "credits-changed";

const reloadListeners = new Set<() => void>();

export function notifyCreditsChanged() {
  reloadListeners.forEach((listener) => listener());
  window.dispatchEvent(new Event(creditsChanged));
}

type Intention = {
  id: string;
  amount: string;
  status: "pending" | "paid" | "expired";
  expiresAt: string | null;
  txHash: string | null;
  createdAt: string;
};

type CreditTx = { to: `0x${string}`; data: `0x${string}`; value: string };

export function CreditIntentions() {
  const { client, getClientForChain } = useSmartWallets();
  const address = client?.account?.address;
  const [intentions, setIntentions] = useState<Intention[] | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let controller: AbortController | null = null;

    function load() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      void apiFetch(`/api/credits?wallet=${address}`, { signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("credits");
          return (await response.json()) as { intentions?: unknown };
        })
        .then((payload) => {
          if (signal.aborted) return;
          setIntentions(readIntentions(payload.intentions));
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setIntentions([]);
        });
    }

    load();
    reloadListeners.add(load);
    return () => {
      controller?.abort();
      reloadListeners.delete(load);
    };
  }, [address]);

  async function pay(intention: Intention) {
    setPayError(null);
    setPayingId(intention.id);
    try {
      const prepared = await apiFetch(`/api/credits/${intention.id}`, { method: "POST" });
      const payload: unknown = await prepared.json().catch(() => null);
      if (!prepared.ok) {
        setPayError(readMessage(payload, "This top-up is no longer payable."));
        notifyCreditsChanged();
        return;
      }
      const tx = readTx(payload);
      if (!tx) {
        setPayError("Could not prepare the transfer.");
        return;
      }
      const chainClient = await getClientForChain({ id: celo.id });
      if (!chainClient) {
        setPayError("The Celo wallet is not ready.");
        return;
      }
      const sent = await chainClient.sendTransaction({
        calls: [{ to: tx.to, data: tx.data, value: BigInt(tx.value) }],
      });
      const hash = typeof sent === "string" ? sent : String(sent);
      const confirmed = await apiFetch(`/api/credits/${intention.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash: hash }),
      });
      const confirmedBody: unknown = await confirmed.json().catch(() => null);
      if (!confirmed.ok) {
        setPayError(readMessage(confirmedBody, "The transfer was sent, but the credit was not confirmed."));
      }
      notifyCreditsChanged();
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message.toLowerCase() : "";
      const insufficient = detail.includes("insufficient") || detail.includes("exceeds balance");
      setPayError(insufficient ? "Not enough USDC in your wallet for this top-up." : "The transfer was not signed.");
    } finally {
      setPayingId(null);
    }
  }

  if (!address || intentions === null || intentions.length === 0) return null;

  return (
    <Card className="mt-4">
      <h2 className="font-sans text-lg font-semibold text-foreground">Top-up intentions</h2>
      <ul className="mt-4 grid gap-3">
        {intentions.map((intention) => {
          const payable = intention.status === "pending" && intention.expiresAt !== null && new Date(intention.expiresAt).getTime() > Date.now();
          return (
            <li key={intention.id} className="grid gap-3 border-b border-border pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="text-base font-semibold text-foreground">{intention.amount} USDC</p>
                <p className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusPill intention={intention} />
                  {intention.txHash ? <span className="text-sm text-muted-foreground">{shortHash(intention.txHash)}</span> : null}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <time className="shrink-0 text-sm text-muted-foreground" dateTime={intention.createdAt}>
                  {formatWhen(intention.createdAt)}
                </time>
                {payable ? (
                  <Button className="min-h-10 px-4" disabled={payingId === intention.id} onClick={() => void pay(intention)}>
                    {payingId === intention.id ? "Waiting…" : "Pay"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {payError ? (
        <p className="mt-3 text-sm font-semibold text-destructive" role="alert">
          {payError}
        </p>
      ) : null}
    </Card>
  );
}

function StatusPill({ intention }: { intention: Intention }) {
  const tone = pillTone(intention);
  const styles = {
    pending: "bg-secondary text-foreground",
    paid: "bg-[#e4f0c8] text-[#245016]",
    expired: "bg-destructive/10 text-destructive",
  } as const;
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-semibold ${styles[tone]}`}>
      {tone === "paid" ? "Confirmed" : tone === "expired" ? "Expired" : "Waiting for signature"}
    </span>
  );
}

function pillTone(intention: Intention): "pending" | "paid" | "expired" {
  if (intention.status === "paid" || intention.txHash) return "paid";
  if (intention.status === "expired" || (intention.expiresAt !== null && new Date(intention.expiresAt).getTime() <= Date.now())) {
    return "expired";
  }
  return "pending";
}

function readIntentions(value: unknown): Intention[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as {
      id?: unknown;
      amount?: unknown;
      status?: unknown;
      expiresAt?: unknown;
      txHash?: unknown;
      createdAt?: unknown;
    };
    if (typeof record.id !== "string" || typeof record.amount !== "string" || typeof record.createdAt !== "string") return [];
    const status = record.status === "paid" || record.status === "expired" || record.status === "pending" ? record.status : "pending";
    return [
      {
        id: record.id,
        amount: record.amount,
        status,
        expiresAt: typeof record.expiresAt === "string" ? record.expiresAt : null,
        txHash: typeof record.txHash === "string" ? record.txHash : null,
        createdAt: record.createdAt,
      },
    ];
  });
}

function readTx(payload: unknown): CreditTx | null {
  if (!payload || typeof payload !== "object" || !("tx" in payload)) return null;
  const tx = (payload as { tx?: unknown }).tx;
  if (!tx || typeof tx !== "object") return null;
  const call = tx as { to?: unknown; data?: unknown; value?: unknown };
  if (typeof call.to !== "string" || typeof call.data !== "string" || typeof call.value !== "string") return null;
  return { to: call.to as CreditTx["to"], data: call.data as CreditTx["data"], value: call.value };
}

function readMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
