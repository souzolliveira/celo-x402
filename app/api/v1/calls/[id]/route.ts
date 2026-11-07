import { getAddress, isAddress } from "viem";
import { callerWallet, requireCaller } from "@/lib/caller";
import { runBuyCall } from "@/lib/buy-call";
import { connectMongo } from "@/lib/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;

  const body: unknown = await request.json().catch(() => null);
  const record = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!record) return Response.json({ message: "Send a JSON object." }, { status: 400 });

  const requested = typeof record.wallet === "string" ? record.wallet : undefined;
  const wallet = callerWallet(caller, caller.kind === "session" ? requested : undefined);
  if (wallet instanceof Response) return wallet;
  if (caller.kind === "session" && (!requested || !isAddress(requested))) {
    return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  }

  const { wallet: _wallet, ...payload } = record;
  await connectMongo();
  const result = await runBuyCall({
    capabilityId: decodeURIComponent(id),
    ownerWallet: getAddress(wallet).toLowerCase(),
    clientId: caller.kind === "credential" ? caller.clientId : undefined,
    body: caller.kind === "credential" ? record : payload,
  });

  if (!result.searchId) return Response.json(result.body, { status: result.status });
  return Response.json({ id: result.searchId, amount: result.amount, body: result.body }, { status: result.status });
}
