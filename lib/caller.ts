import { getAddress } from "viem";
import { authenticateBasic } from "@/lib/credentials";
import { requireUser, type SignedInUser } from "@/lib/privy-auth";

export type Caller =
  | { kind: "credential"; clientId: string; ownerWallet: string }
  | { kind: "session"; user: SignedInUser };

export async function requireCaller(request: Request): Promise<Caller | Response> {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const credential = await authenticateBasic(header);
    if (!credential) return Response.json({ message: "Invalid client credentials." }, { status: 401 });
    return { kind: "credential", clientId: credential.clientId, ownerWallet: getAddress(credential.ownerWallet).toLowerCase() };
  }
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return { kind: "session", user };
}

export function callerWallet(caller: Caller, requested?: string): string | Response {
  if (caller.kind === "credential") return caller.ownerWallet;
  if (requested) {
    const match = [...caller.user.wallets].find((wallet) => wallet.toLowerCase() === requested.toLowerCase());
    if (!match) return Response.json({ message: "This wallet is not on the signed-in account." }, { status: 403 });
    return match.toLowerCase();
  }
  const smart = [...caller.user.wallets][0];
  if (!smart) return Response.json({ message: "Sign in with a wallet to continue." }, { status: 401 });
  return smart.toLowerCase();
}

export function seesSearch(caller: Caller, search: { ownerWallet: string; clientId?: string | null }): boolean {
  if (caller.kind === "credential") return search.clientId === caller.clientId;
  return caller.user.wallets.has(getAddress(search.ownerWallet));
}
