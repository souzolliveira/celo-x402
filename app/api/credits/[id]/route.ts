import mongoose from "mongoose";
import { isHash, type Hex } from "viem";
import { connectMongo } from "@/lib/mongo";
import { ownsWallet, requireUser } from "@/lib/privy-auth";
import { parseUsdc } from "@/lib/usdc";
import { confirmedUsdcTransfer, productWallet, usdcTransferCall } from "@/lib/usdc-transfer";
import { Credit } from "@/models/credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ message: "Unknown credit." }, { status: 404 });
  }
  const treasury = productWallet();
  if (!treasury) {
    return Response.json({ message: "The product wallet is not configured." }, { status: 500 });
  }

  await connectMongo();
  const credit = await Credit.findById(id);
  if (!credit || !ownsWallet(user, String(credit.wallet))) {
    return Response.json({ message: "Unknown credit." }, { status: 404 });
  }
  if (credit.status !== "pending" || new Date(credit.expiresAt).getTime() <= Date.now()) {
    return Response.json({ message: "This top-up is no longer payable." }, { status: 409 });
  }
  const amount = parseUsdc(String(credit.amount));
  if (amount === null) {
    return Response.json({ message: "This top-up amount is not payable." }, { status: 422 });
  }

  return Response.json({ id: String(credit._id), tx: usdcTransferCall(treasury, amount) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) {
    return Response.json({ message: "Unknown credit." }, { status: 404 });
  }

  const treasury = productWallet();
  if (!treasury) {
    return Response.json({ message: "The product wallet is not configured." }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const txHash = typeof record.txHash === "string" ? record.txHash.trim().toLowerCase() : "";
  if (!isHash(txHash)) {
    return Response.json({ message: "Send the transaction hash." }, { status: 400 });
  }

  await connectMongo();
  const credit = await Credit.findById(id);
  if (!credit || !ownsWallet(user, String(credit.wallet))) {
    return Response.json({ message: "Unknown credit." }, { status: 404 });
  }
  if (credit.status === "expired" || (credit.status === "pending" && new Date(credit.expiresAt).getTime() <= Date.now())) {
    return Response.json({ message: "This top-up has expired." }, { status: 409 });
  }
  if (credit.status === "paid" && credit.txHash && credit.txHash !== txHash) {
    return Response.json({ message: "This credit already has a transaction." }, { status: 409 });
  }

  const reused = await Credit.exists({
    _id: { $ne: credit._id },
    $or: [{ txHash }, { "changes.txHash": txHash }],
  });
  if (reused) {
    return Response.json({ message: "This transaction was already used to credit a payment." }, { status: 409 });
  }

  const amount = await confirmedUsdcTransfer(txHash as Hex, credit.wallet as Hex, treasury);
  if (!amount) {
    return Response.json({ message: "That transaction is not a confirmed USDC transfer to the product wallet." }, { status: 422 });
  }

  const previousAmount = credit.amount as string;
  if (credit.txHash !== txHash) {
    credit.changes.push({
      at: new Date(),
      previousAmount,
      amount,
      txHash,
      previousStatus: credit.status,
      status: "paid",
    });
    credit.amount = amount;
    credit.txHash = txHash;
    credit.status = "paid";
    await credit.save();
  }

  return Response.json({
    id: String(credit._id),
    wallet: credit.wallet,
    amount: credit.amount,
    txHash: credit.txHash,
    updatedAt: credit.updatedAt,
  });
}
