import { isAddress } from "viem";
import { requireWallet } from "@/lib/privy-auth";
import { connectMongo } from "@/lib/mongo";
import { parseUsdc } from "@/lib/usdc";
import { productWallet, usdcTransferCall } from "@/lib/usdc-transfer";
import { creditFigures, formatBalance } from "@/lib/credit-balance";
import { CREDIT_WINDOW_MS, Credit } from "@/models/credit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim() ?? "";
  if (!isAddress(wallet)) {
    return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  }
  const user = await requireWallet(request, wallet);
  if (user instanceof Response) return user;

  await connectMongo();
  const normalized = wallet.toLowerCase();
  const [credits, figures] = await Promise.all([
    Credit.find({ wallet: normalized }).sort({ createdAt: -1 }).limit(50).lean(),
    creditFigures(normalized),
  ]);

  return Response.json({
    available: formatBalance(figures.available),
    committed: formatBalance(figures.committed),
    intentions: credits.map((credit) => ({
      id: String(credit._id),
      wallet: credit.wallet,
      amount: credit.amount,
      status: credit.status ?? (credit.txHash ? "paid" : "pending"),
      expiresAt: credit.expiresAt,
      txHash: credit.txHash ?? null,
      createdAt: credit.createdAt,
      updatedAt: credit.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const treasury = productWallet();
  if (!treasury) {
    return Response.json({ message: "The product wallet is not configured." }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const wallet = typeof record.wallet === "string" ? record.wallet.trim() : "";
  const rawAmount = typeof record.amount === "string" ? record.amount : "";
  const amount = parseUsdc(rawAmount);
  if (!isAddress(wallet) || amount === null) {
    return Response.json({ message: "Send the smart wallet and a USDC amount greater than zero." }, { status: 400 });
  }
  const user = await requireWallet(request, wallet);
  if (user instanceof Response) return user;

  await connectMongo();
  const createdAt = new Date();
  const credit = await Credit.create({
    wallet,
    amount: formatRequested(rawAmount),
    status: "pending",
    expiresAt: new Date(createdAt.getTime() + CREDIT_WINDOW_MS),
    createdAt,
  });

  return Response.json({
    id: String(credit._id),
    tx: usdcTransferCall(treasury, amount),
  });
}

function formatRequested(raw: string): string {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  const [whole, fraction = ""] = normalized.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}
