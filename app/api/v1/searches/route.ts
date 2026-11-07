import { getAddress } from "viem";
import { requireCaller, type Caller } from "@/lib/caller";
import { connectMongo } from "@/lib/mongo";
import { formatUsdc, parseUsdc } from "@/lib/usdc";
import { Research } from "@/models/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;
  await connectMongo();

  const researches = await Research.find(walletFilter(caller)).sort({ createdAt: -1 }).limit(50).select("-calls.response -plan").lean();
  return Response.json({
    searches: researches.map((research) => ({
      id: String(research._id),
      status: research.status,
      reserved: research.reserved,
      amount: charged(research.calls ?? []),
      calls: research.calls?.length ?? 0,
      createdAt: research.createdAt,
      updatedAt: research.updatedAt,
      startedAt: research.startedAt ?? null,
      finishedAt: research.finishedAt ?? null,
      cancelledAt: research.cancelledAt ?? null,
    })),
  });
}

function walletFilter(caller: Caller) {
  if (caller.kind === "credential") return { ownerWallet: caller.ownerWallet };
  return { ownerWallet: { $in: [...caller.user.wallets].map((wallet) => getAddress(wallet).toLowerCase()) } };
}

function charged(calls: Iterable<{ amount?: string | null }>): string | null {
  let total = 0n;
  for (const call of calls ?? []) {
    if (typeof call.amount !== "string") continue;
    const atomic = parseUsdc(call.amount);
    if (atomic !== null) total += atomic;
  }
  return total > 0n ? formatUsdc(total) : null;
}
