import mongoose from "mongoose";
import { getAddress, isAddress } from "viem";
import { requireCaller, type Caller } from "@/lib/caller";
import { editionFromCalls, renderEdition, type EditionCall, type EditionPlanItem } from "@/lib/edition";
import { connectMongo } from "@/lib/mongo";
import { Research } from "@/models/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ message: "Search not found." }, { status: 404 });
  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;
  await connectMongo();

  const research = await Research.findById(id).lean();
  if (!research || !owns(caller, research.ownerWallet)) return Response.json({ message: "Search not found." }, { status: 404 });

  const when = research.startedAt ?? research.createdAt;
  const editionHtml =
    research.editionHtml ||
    renderEdition(
      editionFromCalls((research.plan ?? []) as EditionPlanItem[], (research.calls ?? []) as EditionCall[], when),
      when,
    );

  return Response.json({
    id: String(research._id),
    status: research.status,
    reserved: research.reserved,
    createdAt: research.createdAt,
    updatedAt: research.updatedAt,
    startedAt: research.startedAt ?? null,
    finishedAt: research.finishedAt ?? null,
    cancelledAt: research.cancelledAt ?? null,
    error: research.error ?? null,
    editionHtml,
    calls: (research.calls ?? []).map((call) => ({
      capabilityId: call.capabilityId,
      request: call.request,
      response: call.response ?? null,
      httpStatus: call.httpStatus,
      amount: call.amount ?? null,
      summary: call.summary ?? null,
      at: call.at,
    })),
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!mongoose.isValidObjectId(id)) return Response.json({ message: "Search not found." }, { status: 404 });
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim() ?? "";
  if (!isAddress(wallet)) return Response.json({ message: "Send the smart wallet." }, { status: 400 });
  const caller = await requireCaller(request);
  if (caller instanceof Response) return caller;
  if (!owns(caller, wallet.toLowerCase())) return Response.json({ message: "Search not found." }, { status: 404 });
  await connectMongo();

  const cancelledAt = new Date();
  const research = await Research.findOneAndUpdate(
    { _id: id, ownerWallet: wallet.toLowerCase(), status: "pending" },
    { $set: { status: "cancelled", cancelledAt, updatedAt: cancelledAt } },
    { new: true },
  );
  if (!research) return Response.json({ message: "Only a search that has not started can be cancelled." }, { status: 409 });
  return Response.json({ id, status: research.status, cancelledAt: research.cancelledAt, updatedAt: research.updatedAt });
}

function owns(caller: Caller, wallet: string): boolean {
  if (caller.kind === "credential") return caller.ownerWallet === wallet;
  return caller.user.wallets.has(getAddress(wallet));
}
