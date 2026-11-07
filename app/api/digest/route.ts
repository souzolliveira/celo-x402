import { isAddress } from "viem";
import { clampPostLimit, parseDigestItem } from "@/lib/digest";
import { connectMongo } from "@/lib/mongo";
import { requireWallet } from "@/lib/privy-auth";
import { Digest } from "@/models/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim() ?? "";
  if (!isAddress(wallet)) return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  const user = await requireWallet(request, wallet);
  if (user instanceof Response) return user;
  await connectMongo();

  const digest = await Digest.findOne({ ownerWallet: wallet.toLowerCase() }).lean();
  return Response.json({ items: (digest?.items ?? []).map(present) });
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (body instanceof Response) return body;
  const item = parseDigestItem(body.record);
  if (!item) return Response.json({ message: "Send a source and a value." }, { status: 400 });
  const user = await requireWallet(request, body.wallet);
  if (user instanceof Response) return user;
  await connectMongo();

  const digest = await Digest.findOneAndUpdate(
    { ownerWallet: body.wallet.toLowerCase() },
    { $push: { items: item }, $setOnInsert: { ownerWallet: body.wallet.toLowerCase() } },
    { upsert: true, new: true },
  );
  const created = digest.items[digest.items.length - 1];
  return Response.json(present(created), { status: 201 });
}

export async function PUT(request: Request) {
  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (!Array.isArray(body.record.items)) return Response.json({ message: "Send the digest items." }, { status: 400 });
  const items = [];
  for (const entry of body.record.items) {
    const item = parseDigestItem(entry);
    if (!item) return Response.json({ message: "Each item needs a source and a value." }, { status: 400 });
    items.push(item);
  }
  const user = await requireWallet(request, body.wallet);
  if (user instanceof Response) return user;
  await connectMongo();

  const digest = await Digest.findOneAndUpdate(
    { ownerWallet: body.wallet.toLowerCase() },
    { $set: { items, ownerWallet: body.wallet.toLowerCase() } },
    { upsert: true, new: true },
  );
  return Response.json({ items: digest.items.map(present) });
}

function present(item: { _id?: unknown; source: string; value: string; comments?: boolean; captions?: boolean; summarize?: boolean; postLimit?: number }) {
  return {
    id: String(item._id),
    source: item.source,
    value: item.value,
    comments: item.comments === true,
    captions: item.captions === true,
    summarize: item.summarize === true,
    postLimit: clampPostLimit(item.postLimit),
  };
}

async function readBody(request: Request): Promise<{ wallet: string; record: Record<string, unknown> } | Response> {
  const body: unknown = await request.json().catch(() => null);
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const wallet = typeof record.wallet === "string" ? record.wallet.trim() : "";
  if (!isAddress(wallet)) return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  return { wallet, record };
}
