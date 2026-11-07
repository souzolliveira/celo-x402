import { isAddress } from "viem";
import { enqueueDigest } from "@/lib/digest-run";
import { connectMongo } from "@/lib/mongo";
import { requireWallet } from "@/lib/privy-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const wallet = typeof record.wallet === "string" ? record.wallet.trim() : "";
  if (!isAddress(wallet)) return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  const user = await requireWallet(request, wallet);
  if (user instanceof Response) return user;
  await connectMongo();
  const result = await enqueueDigest(wallet);
  return Response.json(result.body, { status: result.status });
}
