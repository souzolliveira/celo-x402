"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useState } from "react";
import { CreditBalance } from "@/components/credit-balance";
import { CreditForm } from "@/components/credit-form";
import { creditsChanged } from "@/components/credit-intentions";
import { apiFetch } from "@/lib/api";
import { formatUsdc, parseUsdc } from "@/lib/usdc";

type CreditTab = "balance" | "topup";

const tabs: { id: CreditTab; label: string }[] = [
  { id: "balance", label: "Balance" },
  { id: "topup", label: "Top-up" },
];

export function UsageBalance() {
  const { available, committed } = useCreditBalance();
  return <CreditBalance balance={available} committed={committed} />;
}

export function CreditTabs() {
  const [tab, setTab] = useState<CreditTab>("balance");
  const { available, committed } = useCreditBalance();

  return (
    <div className="grid gap-4">
      <fieldset>
        <legend className="sr-only">Credit view</legend>
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((item) => (
            <div key={item.id}>
              <input
                type="radio"
                id={`credit-${item.id}`}
                name="credit-tab"
                value={item.id}
                checked={tab === item.id}
                onChange={() => setTab(item.id)}
                className="peer sr-only"
              />
              <label
                htmlFor={`credit-${item.id}`}
                className="flex min-h-16 cursor-pointer items-center justify-center rounded-2xl border border-border bg-card px-3 text-base font-semibold text-foreground transition-colors duration-200 peer-checked:border-transparent peer-checked:bg-accent peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
              >
                {item.label}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      {tab === "balance" ? <CreditBalance balance={available} committed={committed} /> : <CreditForm />}
    </div>
  );
}

function useCreditBalance(): { available: string | null; committed: string | null } {
  const { client } = useSmartWallets();
  const address = client?.account?.address;
  const [balance, setBalance] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);

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
          return (await response.json()) as { intentions?: unknown; available?: unknown; committed?: unknown };
        })
        .then((payload) => {
          if (signal.aborted) return;
          setBalance(typeof payload.available === "string" ? payload.available : sumPaid(payload.intentions));
          setCommitted(typeof payload.committed === "string" ? payload.committed : "0");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setBalance(null);
        });
    }

    load();
    window.addEventListener(creditsChanged, load);
    return () => {
      controller?.abort();
      window.removeEventListener(creditsChanged, load);
    };
  }, [address]);

  return { available: balance, committed };
}

function sumPaid(value: unknown): string {
  if (!Array.isArray(value)) return "0";
  let total = 0n;
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { amount?: unknown; status?: unknown; txHash?: unknown };
    const paid = record.status === "paid" || typeof record.txHash === "string";
    if (!paid || typeof record.amount !== "string") continue;
    const atomic = parseUsdc(record.amount);
    if (atomic !== null) total += atomic;
  }
  return formatUsdc(total);
}
