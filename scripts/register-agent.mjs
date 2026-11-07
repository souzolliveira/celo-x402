import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDefaultAccount, loadSigner } from "@celo/buy-keystore";
import { verifyTx, withAttribution } from "@celo/attribution-tags";
import { createPublicClient, createWalletClient, http, parseEventLogs } from "viem";
import { celo } from "viem/chains";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const USDC_FEE_CURRENCY = "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B";

const registration = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "celo-x402 gateway",
  description: "Product wallet that pays buy services on Celo for credited users.",
  services: [{ name: "web", endpoint: "http://localhost:3001" }],
  x402Support: true,
  active: true,
  supportedTrust: ["reputation"],
};

const abi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string" },
      { name: "owner", type: "address", indexed: true },
    ],
  },
];

const env = readEnv(resolve(import.meta.dirname, "../.env"));
const tag = env.CELO_ATTRIBUTION_TAG;
const expected = env.AGENT_WALLET_ADDRESS?.toLowerCase();
if (!tag || !expected) {
  throw new Error(".env needs CELO_ATTRIBUTION_TAG and AGENT_WALLET_ADDRESS.");
}

const stored = await getDefaultAccount();
if (!stored) throw new Error("The product wallet is not in the buy keychain.");
const account = await loadSigner(stored.name);
if (account.address.toLowerCase() !== expected) {
  throw new Error(`Keychain account ${account.address} does not match AGENT_WALLET_ADDRESS.`);
}

const agentURI = `data:application/json,${encodeURIComponent(JSON.stringify(registration))}`;
const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
const walletClient = createWalletClient({
  account,
  chain: celo,
  transport: http("https://forno.celo.org"),
}).extend(withAttribution(tag));

const { request } = await publicClient.simulateContract({
  account,
  address: IDENTITY_REGISTRY,
  abi,
  functionName: "register",
  args: [agentURI],
});

const hash = await walletClient.writeContract({
  ...request,
  feeCurrency: USDC_FEE_CURRENCY,
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
const [registered] = parseEventLogs({ abi, eventName: "Registered", logs: receipt.logs });
const result = await verifyTx({ client: publicClient, hash });

console.log(
  JSON.stringify(
    {
      address: account.address,
      hash,
      agentId: registered?.args.agentId?.toString() ?? null,
      tag,
      tagged: result?.codes.includes(tag) ?? false,
      status: receipt.status,
    },
    null,
    2,
  ),
);

function readEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) out[match[1]] = match[2];
  }
  return out;
}
