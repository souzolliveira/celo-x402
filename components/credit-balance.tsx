"use client";

import { Card } from "@/components/ui";

export function CreditBalance({ balance, committed = null }: { balance: string | null; committed?: string | null }) {
  return (
    <Card>
      <p className="text-sm font-semibold text-muted-foreground">Credit balance</p>
      {balance === null ? (
        <p className="mt-3 text-3xl text-foreground" role="status">
          Reading credits…
        </p>
      ) : (
        <p className="mt-3 text-4xl tracking-tight text-foreground tabular-nums sm:text-5xl">{balance} USDC</p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">Confirmed top-ups, minus digests already run. USDC still in your wallet is not included.</p>
      {committed && committed !== "0" ? (
        <p className="mt-2 text-sm font-semibold text-foreground">{committed} USDC committed to digests still running.</p>
      ) : null}
    </Card>
  );
}

