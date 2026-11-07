import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  formatUnits,
  http,
  isAddress,
  type Hex,
} from "viem";
import { celo } from "viem/chains";

export const CELO_USDC = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";

const transferAbi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const transferEvent = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

export function productWallet(): Hex | null {
  const wallet = process.env.AGENT_WALLET_ADDRESS;
  if (!wallet || !isAddress(wallet)) return null;
  return wallet;
}

export function usdcTransferCall(to: Hex, amount: bigint) {
  return {
    chainId: String(celo.id),
    to: CELO_USDC,
    data: encodeFunctionData({ abi: transferAbi, functionName: "transfer", args: [to, amount] }),
    value: "0",
  };
}

export async function confirmedUsdcTransfer(txHash: Hex, from: Hex, to: Hex): Promise<string | null> {
  const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
  const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
  if (!receipt || receipt.status !== "success") return null;

  let sent = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CELO_USDC.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: [transferEvent], data: log.data, topics: log.topics });
      if (decoded.eventName !== "Transfer") continue;
      const args = decoded.args as { from: Hex; to: Hex; value: bigint };
      if (args.from.toLowerCase() !== from.toLowerCase()) continue;
      if (args.to.toLowerCase() !== to.toLowerCase()) continue;
      sent += args.value;
    } catch {
      continue;
    }
  }
  if (sent <= 0n) return null;
  return formatUnits(sent, 6);
}
