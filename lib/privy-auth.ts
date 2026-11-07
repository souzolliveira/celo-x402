import { PrivyClient, type User } from "@privy-io/node";
import { getAddress, isAddress } from "viem";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const appSecret = process.env.PRIVY_APP_SECRET ?? "";
const jwtVerificationKey = process.env.PRIVY_JWT_VERIFICATION_KEY;

const client =
  appId && appSecret
    ? new PrivyClient({
        appId,
        appSecret,
        ...(jwtVerificationKey ? { jwtVerificationKey } : {}),
      })
    : null;

export type SignedInUser = {
  userId: string;
  wallets: Set<string>;
};

export async function requireUser(request: Request): Promise<SignedInUser | Response> {
  if (!client) {
    return Response.json({ message: "Privy server credentials are not configured." }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) {
    return Response.json({ message: "Sign in to continue." }, { status: 401 });
  }

  let userId: string;
  try {
    const claims = await client.utils().auth().verifyAccessToken(token);
    userId = claims.user_id;
  } catch {
    return Response.json({ message: "Sign in to continue." }, { status: 401 });
  }

  let user: User;
  try {
    user = await client.users()._get(userId);
  } catch {
    return Response.json({ message: "Could not load the signed-in account." }, { status: 401 });
  }

  return { userId, wallets: walletAddresses(user) };
}

export async function requireWallet(request: Request, wallet: string): Promise<SignedInUser | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!ownsWallet(user, wallet)) {
    return Response.json({ message: "This wallet is not on the signed-in account." }, { status: 403 });
  }
  return user;
}

export function ownsWallet(user: SignedInUser, wallet: string): boolean {
  if (!isAddress(wallet)) return false;
  return user.wallets.has(getAddress(wallet));
}

function walletAddresses(user: User): Set<string> {
  const wallets = new Set<string>();
  for (const account of user.linked_accounts) {
    if (account.type !== "wallet" && account.type !== "smart_wallet") continue;
    if (!isAddress(account.address)) continue;
    wallets.add(getAddress(account.address));
  }
  return wallets;
}
