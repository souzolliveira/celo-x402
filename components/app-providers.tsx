"use client";

import { PrivyProvider, dataSuffix as attributionSuffix } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { celo } from "viem/chains";
import { EnsureSmartWallet } from "@/components/ensure-smart-wallet";
import { WalletSetup } from "@/components/wallet-setup";
import { Card } from "@/components/ui";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

function isHexSuffix(value: string | null): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);
}

export function AppProviders({
  children,
  dataSuffix,
}: {
  children: React.ReactNode;
  dataSuffix: string | null;
}) {
  if (!appId) {
    return (
      <main id="content" className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <Card>
          <h1 className="text-4xl text-foreground">The Privy app is missing</h1>
          <p className="mt-3 text-muted-foreground">
            Set NEXT_PUBLIC_PRIVY_APP_ID and restart the server. In the Privy dashboard, keep email as the only login and Celo as the network.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        defaultChain: celo,
        supportedChains: [celo],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: false,
        },
        plugins: isHexSuffix(dataSuffix) ? [attributionSuffix(dataSuffix)] : undefined,
      }}
    >
      <WalletSetup>
        <SmartWalletsProvider>
          <EnsureSmartWallet>{children}</EnsureSmartWallet>
        </SmartWalletsProvider>
      </WalletSetup>
    </PrivyProvider>
  );
}
