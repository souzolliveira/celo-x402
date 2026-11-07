import { Credit } from "@/models/credit";
import { Research } from "@/models/research";
import { Search } from "@/models/search";
import { formatUsdc, parseUsdc } from "@/lib/usdc";

export async function creditFigures(wallet: string): Promise<{ available: bigint; committed: bigint }> {
  const normalized = wallet.toLowerCase();
  const [credits, searches, researches] = await Promise.all([
    Credit.find({ wallet: normalized }).select("amount status txHash").lean(),
    Search.find({ ownerWallet: normalized, amount: { $exists: true } }).select("amount").lean(),
    Research.find({ ownerWallet: normalized }).select("status reserved calls.amount").lean(),
  ]);

  let available = 0n;
  for (const credit of credits) {
    const paid = credit.status === "paid" || typeof credit.txHash === "string";
    if (!paid) continue;
    const atomic = parseUsdc(String(credit.amount));
    if (atomic !== null) available += atomic;
  }
  for (const search of searches) {
    if (typeof search.amount !== "string") continue;
    const atomic = parseUsdc(search.amount);
    if (atomic !== null) available -= atomic;
  }

  let committed = 0n;
  for (const research of researches) {
    let spent = 0n;
    for (const call of research.calls ?? []) {
      if (typeof call.amount !== "string") continue;
      const atomic = parseUsdc(call.amount);
      if (atomic !== null) spent += atomic;
    }
    const open = research.status === "pending" || research.status === "running";
    const reserved = parseUsdc(research.reserved) ?? 0n;
    const hold = open && reserved > spent ? reserved : spent;
    if (open) committed += hold;
    available -= hold;
  }
  return { available: available > 0n ? available : 0n, committed };
}

export async function creditBalance(wallet: string): Promise<bigint> {
  return (await creditFigures(wallet)).available;
}

export function formatBalance(atomic: bigint): string {
  return formatUsdc(atomic);
}
