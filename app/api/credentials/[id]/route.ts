import mongoose from "mongoose";
import { isAddress } from "viem";
import { connectMongo } from "@/lib/mongo";
import { requireWallet } from "@/lib/privy-auth";
import { ApiCredential } from "@/models/api-credential";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ message: "Credential not found." }, { status: 404 });
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim() ?? "";
  if (!isAddress(wallet)) return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  const user = await requireWallet(request, wallet);
  if (user instanceof Response) return user;
  await connectMongo();

  const credential = await ApiCredential.findOne({ _id: id, ownerWallet: wallet.toLowerCase() });
  if (!credential) return Response.json({ message: "Credential not found." }, { status: 404 });
  if (!credential.revokedAt) {
    credential.revokedAt = new Date();
    await credential.save();
  }
  return Response.json({ id, revokedAt: credential.revokedAt });
}
