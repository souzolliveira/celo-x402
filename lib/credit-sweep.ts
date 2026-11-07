import { createPublicClient, http, parseAbiItem, type Hex } from "viem";
import { celo } from "viem/chains";
import { connectMongo } from "@/lib/mongo";
import { formatUsdc, parseUsdc } from "@/lib/usdc";
import { CELO_USDC, productWallet } from "@/lib/usdc-transfer";
import { CREDIT_WINDOW_MS, Credit } from "@/models/credit";

const transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

let running = false;

export async function sweepCredits() {
  if (running) return;
  running = true;
  try {
    const treasury = productWallet();
    if (!treasury) return;
    await connectMongo();
    await backfillWindows();
    await expirePending();
    await matchTransfers(treasury);
  } finally {
    running = false;
  }
}

async function backfillWindows() {
  const missing = await Credit.find({
    $or: [{ expiresAt: { $exists: false } }, { status: { $exists: false } }],
  });
  for (const credit of missing) {
    const createdAt = credit.createdAt ?? new Date();
    if (!credit.expiresAt) credit.expiresAt = new Date(createdAt.getTime() + CREDIT_WINDOW_MS);
    if (!credit.status) credit.status = credit.txHash ? "paid" : "pending";
    await credit.save();
  }
}

async function expirePending() {
  const now = new Date();
  const due = await Credit.find({ status: "pending", expiresAt: { $lte: now } });
  for (const credit of due) {
    const previousStatus = credit.status as string;
    credit.changes.push({
      at: now,
      previousAmount: credit.amount,
      amount: credit.amount,
      previousStatus,
      status: "expired",
    });
    credit.status = "expired";
    await credit.save();
  }
}

async function matchTransfers(treasury: Hex) {
  const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
  const latest = await client.getBlockNumber();
  const fromBlock = latest > 800n ? latest - 800n : 0n;
  const logs = await client.getLogs({
    address: CELO_USDC,
    event: transferEvent,
    args: { to: treasury },
    fromBlock,
    toBlock: latest,
  });

  const now = Date.now();
  const seenBlocks = new Map<bigint, number>();
  for (const log of logs) {
    if (!log.transactionHash || !log.args.from || log.args.value === undefined) continue;
    const txHash = log.transactionHash.toLowerCase();
    if (await hashUsed(txHash)) continue;

    let blockTime = seenBlocks.get(log.blockNumber);
    if (blockTime === undefined) {
      const block = await client.getBlock({ blockNumber: log.blockNumber });
      blockTime = Number(block.timestamp) * 1000;
      seenBlocks.set(log.blockNumber, blockTime);
    }
    if (now - blockTime > CREDIT_WINDOW_MS) continue;

    const from = log.args.from.toLowerCase();
    const amount = formatUsdc(log.args.value);
    const atomic = parseUsdc(amount);
    if (atomic === null) continue;

    const open = await Credit.find({ wallet: from, status: "pending", expiresAt: { $gt: new Date(blockTime) } });
    const match = open.find((credit) => {
      const wanted = parseUsdc(String(credit.amount));
      const opened = credit.createdAt ? new Date(credit.createdAt).getTime() : 0;
      return wanted === atomic && opened <= blockTime;
    });

    if (match) {
      match.changes.push({
        at: new Date(),
        previousAmount: match.amount,
        amount,
        txHash,
        previousStatus: "pending",
        status: "paid",
      });
      match.amount = amount;
      match.txHash = txHash;
      match.status = "paid";
      await match.save();
      continue;
    }

    const covered = await Credit.find({ wallet: from, txHash: { $exists: false } });
    const alreadyIntended = covered.some((credit) => {
      const wanted = parseUsdc(String(credit.amount));
      const opened = credit.createdAt ? new Date(credit.createdAt).getTime() : 0;
      const closes = credit.expiresAt ? new Date(credit.expiresAt).getTime() : opened + CREDIT_WINDOW_MS;
      return wanted === atomic && opened <= blockTime && blockTime <= closes;
    });
    if (alreadyIntended) continue;

    const at = new Date(blockTime);
    await Credit.create({
      wallet: from,
      amount,
      status: "paid",
      txHash,
      expiresAt: new Date(blockTime + CREDIT_WINDOW_MS),
      createdAt: at,
      changes: [
        {
          at: new Date(),
          previousAmount: "0",
          amount,
          txHash,
          previousStatus: "pending",
          status: "paid",
        },
      ],
    });
  }
}

async function hashUsed(txHash: string) {
  const existing = await Credit.exists({ $or: [{ txHash }, { "changes.txHash": txHash }] });
  return Boolean(existing);
}
