import { isAddress } from "viem";
import { createSecret } from "@/lib/credentials";
import { connectMongo } from "@/lib/mongo";
import { requireWallet } from "@/lib/privy-auth";
import { ApiCredential } from "@/models/api-credential";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim() ?? "";
  if (!isAddress(wallet)) return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  const user = await requireWallet(request, wallet);
  if (user instanceof Response) return user;
  await connectMongo();

  const credentials = await ApiCredential.find({ ownerWallet: wallet.toLowerCase() }).sort({ createdAt: -1 }).lean();
  return Response.json({
    credentials: credentials.map((credential) => ({
      id: String(credential._id),
      clientId: credential.clientId,
      secretPrefix: credential.secretPrefix,
      name: credential.name,
      revokedAt: credential.revokedAt ?? null,
      lastUsedAt: credential.lastUsedAt ?? null,
      createdAt: credential.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const wallet = typeof record.wallet === "string" ? record.wallet.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!isAddress(wallet) || name.length < 1 || name.length > 60) {
    return Response.json({ message: "Send the smart wallet and a name." }, { status: 400 });
  }
  const user = await requireWallet(request, wallet);
  if (user instanceof Response) return user;
  await connectMongo();

  const created = createSecret();
  await ApiCredential.create({
    clientId: created.clientId,
    secretHash: created.secretHash,
    secretPrefix: created.secretPrefix,
    ownerWallet: wallet.toLowerCase(),
    name,
  });

  return Response.json({ clientId: created.clientId, secret: created.secret, name }, { status: 201 });
}
