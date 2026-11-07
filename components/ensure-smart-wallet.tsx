"use client";

import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { createContext, useContext, useEffect, useState } from "react";
import { createPublicClient, http, type Hex } from "viem";
import { celo } from "viem/chains";

type PublishState = {
  ready: boolean;
  failed: boolean;
  pending: boolean;
  retry: () => void;
};

const PublishContext = createContext<PublishState>({
  ready: false,
  failed: false,
  pending: false,
  retry: () => {},
});

export function useSmartWalletPublish() {
  return useContext(PublishContext);
}

export function EnsureSmartWallet({ children }: { children: React.ReactNode }) {
  const { client, getClientForChain } = useSmartWallets();
  const address = client?.account.address;
  const [check, setCheck] = useState<{ address: string; deployed: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const deployed = check && address && check.address === address ? check.deployed : null;

  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    void isDeployed(address).then((next) => {
      if (controller.signal.aborted) return;
      setCheck({ address, deployed: next });
    });
    return () => controller.abort();
  }, [address, attempt]);

  function retry() {
    if (!address || pending || deployed !== false) return;
    setPending(true);
    void deployOnCelo(address, getClientForChain)
      .then(() => waitUntilDeployed(address))
      .catch(() => undefined)
      .finally(() => {
        setPending(false);
        setAttempt((current) => current + 1);
      });
  }

  return (
    <PublishContext.Provider
      value={{ ready: deployed === true, failed: deployed === false, pending, retry }}
    >
      {children}
    </PublishContext.Provider>
  );
}

async function waitUntilDeployed(address: Hex) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await isDeployed(address)) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

async function isDeployed(address: Hex) {
  const publicClient = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });
  const bytecode = await publicClient.getCode({ address });
  return Boolean(bytecode && bytecode !== "0x");
}

async function deployOnCelo(
  address: Hex,
  getClientForChain: ReturnType<typeof useSmartWallets>["getClientForChain"],
) {
  const chainClient = await getClientForChain({ id: celo.id });
  if (!chainClient) return;
  await chainClient.sendTransaction({
    to: address,
    value: BigInt(0),
    data: "0x",
  });
}
