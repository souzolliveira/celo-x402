import { readWalletBalance } from "@/lib/balance";
import { requireWallet } from "@/lib/privy-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address") ?? "";
  const user = await requireWallet(request, address);
  if (user instanceof Response) return user;
  const balance = await readWalletBalance(address);
  return Response.json(balance);
}
