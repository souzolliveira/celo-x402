import mongoose from "mongoose";
import { isAddress } from "viem";
import { clampPostLimit, parseDigestItem } from "@/lib/digest";
import { connectMongo } from "@/lib/mongo";
import { requireWallet } from "@/lib/privy-auth";
import { Digest } from "@/models/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ message: "Item not found." }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const wallet = typeof record.wallet === "string" ? record.wallet.trim() : "";
  if (!isAddress(wallet)) return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  const item = parseDigestItem(record);
  if (!item) return Response.json({ message: "Send a source and a value." }, { status: 400 });
  const user = await requireWallet(request, wallet);
  if (user instanceof Response) return user;
  await connectMongo();

  const digest = await Digest.findOneAndUpdate(
    { ownerWallet: wallet.toLowerCase(), "items._id": id },
    { $set: { "items.$.source": item.source, "items.$.value": item.value, "items.$.comments": item.comments, "items.$.captions": item.captions, "items.$.summarize": item.summarize, "items.$.postLimit": item.postLimit } },
    { new: true },
  );
  const saved = digest?.items.find((entry) => String(entry._id) === id);
  if (!saved) return Response.json({ message: "Item not found." }, { status: 404 });
  return Response.json({
    id: String(saved._id),
    source: saved.source,
    value: saved.value,
    comments: saved.comments === true,
    captions: saved.captions === true,
    summarize: saved.summarize === true,
    postLimit: clampPostLimit(saved.postLimit),
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ message: "Item not found." }, { status: 404 });
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim() ?? "";
  if (!isAddress(wallet)) return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  const user = await requireWallet(request, wallet);
  if (user instanceof Response) return user;
  await connectMongo();

  const digest = await Digest.findOneAndUpdate(
    { ownerWallet: wallet.toLowerCase() },
    { $pull: { items: { _id: id } } },
    { new: true },
  );
  if (!digest) return Response.json({ message: "Item not found." }, { status: 404 });
  return Response.json({ id });
}
