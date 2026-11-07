"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useEffect, useState, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";
import { freshWalletUsdc, rememberWalletUsdc, subscribeWalletUsdc } from "@/lib/wallet-usdc-cache";
import type { WalletBalance } from "@/lib/balance";
import { useSmartWalletPublish } from "@/components/ensure-smart-wallet";
import { RefreshIcon } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { useWalletSetupError } from "@/components/wallet-setup";

export function WalletSummary({ identity }: { identity: string | null }) {
  const { client } = useSmartWallets();
  const setupError = useWalletSetupError();
  const { ready, failed, pending, retry } = useSmartWalletPublish();
  const address = client?.account?.address;
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const cachedUsdc = useSyncExternalStore(
    subscribeWalletUsdc,
    () => (address ? freshWalletUsdc(address) : undefined),
    () => undefined,
  );

  useEffect(() => {
    if (!address || !ready) return;
    if (reload === 0 && freshWalletUsdc(address) !== undefined) return;
    const controller = new AbortController();
    void apiFetch(`/api/balance?address=${address}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("balance");
        return (await response.json()) as WalletBalance;
      })
      .then((next) => {
        rememberWalletUsdc(address, next.usdc);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        rememberWalletUsdc(address, null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
    return () => controller.abort();
  }, [address, ready, reload]);

  const status = failed
    ? pending
      ? "loading"
      : "failed"
    : !address && setupError
      ? "setup-error"
      : (!address && !setupError) || (address && !ready)
        ? "loading"
        : null;

  return (
    <div className="grid content-start gap-3">
      {status === "loading" ? (
        <Card>
          <p className="text-2xl text-foreground" role="status">
            Setting up your wallet…
          </p>
        </Card>
      ) : null}

      {status === "failed" ? (
        <Card>
          <p className="text-2xl text-foreground" role="alert">
            The wallet failed to start.
          </p>
          <Button className="mt-4" onClick={retry}>
            Try again
          </Button>
        </Card>
      ) : null}

      {status === "setup-error" ? (
        <Card>
          <p className="text-lg text-foreground" role="alert">
            {setupError}
          </p>
        </Card>
      ) : null}

      {ready ? (
        <>
          <BalanceTile
            label="USDC"
            hint="Still in your wallet. A top-up turns it into credits."
            amount={cachedUsdc === undefined ? null : cachedUsdc}
            pending={Boolean(address) && cachedUsdc === undefined}
            refreshing={refreshing}
            onRefresh={
              address
                ? () => {
                    setRefreshing(true);
                    setReload((current) => current + 1);
                  }
                : undefined
            }
            featured
          />
          {identity ? <p className="text-sm font-semibold text-foreground">Identity: {identity}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function BalanceTile({
  label,
  hint,
  amount,
  pending,
  refreshing = false,
  onRefresh,
  featured = false,
}: {
  label: string;
  hint: string;
  amount: string | null;
  pending: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  featured?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          {pending ? (
            <p className={`text-foreground ${featured ? "text-3xl" : "text-2xl"}`} role="status">
              Reading balance…
            </p>
          ) : amount == null ? (
            <p className="text-2xl text-foreground">Unavailable</p>
          ) : (
            <p className={`tracking-tight text-foreground tabular-nums ${featured ? "text-4xl sm:text-5xl" : "text-3xl"}`}>
              {amount} <span className="text-[0.45em] font-semibold text-muted-foreground">{label}</span>
            </p>
          )}
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">{hint}</p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            aria-label="Refresh balance"
            disabled={refreshing}
            onClick={onRefresh}
            className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshIcon className={refreshing ? "animate-spin" : undefined} />
          </button>
        ) : null}
      </div>
    </Card>
  );
}
