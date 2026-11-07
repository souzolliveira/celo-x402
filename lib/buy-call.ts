import { payingFetch, type OnPaymentInfo } from "@celo/buy-core/x402";
import { getDefaultAccount, loadSigner } from "@celo/buy-keystore";
import { findCapability, isBuyUrl, type CatalogItem } from "@/lib/catalog";
import { creditBalance } from "@/lib/credit-balance";
import { formatUsdc, parseUsdc } from "@/lib/usdc";
import { MAX_DOCUMENT_BYTES, Search } from "@/models/search";

export type CallInput = {
  capabilityId: string;
  ownerWallet: string;
  clientId?: string;
  body: unknown;
  /** Digest runs store the call on the research instead of a standalone search. */
  record?: boolean;
};

export async function runBuyCall(input: CallInput): Promise<{ status: number; searchId: string; body: unknown; amount: string | null }> {
  const capability = await findCapability(input.capabilityId);
  if (!capability || !capability.allowed || !isBuyUrl(capability.url)) {
    return refused(404, "This capability is not available.");
  }
  if (!input.body || typeof input.body !== "object" || Array.isArray(input.body)) {
    return refused(400, "Send a JSON object.");
  }

  const balance = await creditBalance(input.ownerWallet);
  const cap = callCap();
  let charged: bigint | null = null;
  let httpStatus = 502;
  let responseBody: unknown = { message: "The buy call did not finish." };

  try {
    const response = await payingFetch(
      {
        account: () => signer(),
        network: "celo",
      },
      capability.url,
      {
        method: capability.method,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(input.body),
        maxAmount: cap,
        onChallenge: (requirements) => {
          const price = BigInt(requirements.maxAmountRequired);
          if (price > cap) throw new Error("This call costs more than the per-call cap.");
          if (price > balance) throw new Error("Not enough credits for this call.");
        },
        onPayment: (info: OnPaymentInfo) => {
          charged = BigInt(info.amount);
        },
      },
    );
    httpStatus = response.status;
    responseBody = await readBody(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The buy call failed.";
    httpStatus = /credits|cap/i.test(message) ? 402 : 502;
    responseBody = { message };
  }

  const amount = charged === null ? null : formatUsdc(charged);
  const stored = fitDocument(responseBody);
  if (input.record === false) {
    return { status: stored.tooLarge ? 413 : httpStatus, searchId: "", body: stored.body, amount };
  }
  const search = await Search.create({
    ownerWallet: input.ownerWallet,
    clientId: input.clientId,
    capabilityId: capability.id,
    platform: capability.platform,
    request: input.body,
    response: stored.body,
    httpStatus: stored.tooLarge ? 413 : httpStatus,
    amount: amount ?? undefined,
  });

  return {
    status: stored.tooLarge ? 413 : httpStatus,
    searchId: String(search._id),
    body: stored.body,
    amount,
  };
}

async function signer() {
  const account = await getDefaultAccount();
  if (!account) throw new Error("The product wallet is not in the buy keychain.");
  return loadSigner(account.name);
}

function callCap(): bigint {
  return parseUsdc(process.env.CALL_MAX_USD ?? "2") ?? 2_000_000n;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { text };
  }
}

function fitDocument(body: unknown): { body: unknown; tooLarge: boolean } {
  const encoded = Buffer.byteLength(JSON.stringify(body ?? null));
  if (encoded <= MAX_DOCUMENT_BYTES) return { body, tooLarge: false };
  return {
    tooLarge: true,
    body: { message: "Buy response exceeds the 16 MB document limit.", bytes: encoded },
  };
}

export function publicCapability(item: CatalogItem) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    platform: item.platform,
    method: item.method,
    allowed: item.allowed,
    minUsd: item.minUsd,
    example: item.example,
  };
}

async function refused(status: number, message: string) {
  return { status, searchId: "", body: { message }, amount: null };
}
