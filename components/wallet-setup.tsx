"use client";

import { useCreateWallet, usePrivy, type User } from "@privy-io/react-auth";
import { createContext, useContext, useEffect, useState } from "react";

const WalletSetupContext = createContext<string | null>(null);

const started = new Set<string>();

export function useWalletSetupError() {
  return useContext(WalletSetupContext);
}

export function WalletSetup({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated || !user || hasEthereumWallet(user) || started.has(user.id)) return;
    started.add(user.id);
    void createWallet().catch((reason: unknown) => {
      const text = reason instanceof Error ? reason.message : "";
      if (/already has an embedded wallet/i.test(text)) return;
      setError(text || "Could not create the wallet.");
    });
  }, [ready, authenticated, user, createWallet]);

  return <WalletSetupContext.Provider value={error}>{children}</WalletSetupContext.Provider>;
}

function hasEthereumWallet(user: User) {
  return user.linkedAccounts.some(
    (account) => account.type === "wallet" && account.chainType === "ethereum",
  );
}
