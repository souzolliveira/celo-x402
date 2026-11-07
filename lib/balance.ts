import { createPublicClient, formatUnits, http, isAddress } from "viem";
import { celo } from "viem/chains";
import { localAssets } from "@/lib/assets";

const USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

const balanceAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export type WalletBalance = {
  address: string;
  usdc: string | null;
  wars: string | null;
  wbrl: string | null;
};

export async function readWalletBalance(address: string): Promise<WalletBalance> {
  const empty = { address, usdc: null, wars: null, wbrl: null };
  if (!isAddress(address)) return empty;

  const client = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  const wars = localAssets[0];
  const wbrl = localAssets[1];

  try {
    const [usdc, warsBalance, wbrlBalance] = await Promise.race([
      Promise.all([
        client.readContract({
          address: USDC,
          abi: balanceAbi,
          functionName: "balanceOf",
          args: [address],
        }),
        client.readContract({
          address: wars.address,
          abi: balanceAbi,
          functionName: "balanceOf",
          args: [address],
        }),
        client.readContract({
          address: wbrl.address,
          abi: balanceAbi,
          functionName: "balanceOf",
          args: [address],
        }),
      ]),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), 5000);
      }),
    ]);

    return {
      address,
      usdc: formatAmount(usdc, 6),
      wars: formatAmount(warsBalance, wars.decimals),
      wbrl: formatAmount(wbrlBalance, wbrl.decimals),
    };
  } catch {
    return empty;
  }
}

function formatAmount(value: bigint, decimals: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(formatUnits(value, decimals)));
}
