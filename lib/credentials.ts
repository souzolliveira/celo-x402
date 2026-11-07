import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiCredential } from "@/models/api-credential";

export type CredentialCaller = {
  clientId: string;
  ownerWallet: string;
};

export function createSecret(): { clientId: string; secret: string; secretHash: Buffer; secretPrefix: string } {
  const clientId = `cli_${randomBytes(12).toString("hex")}`;
  const secret = `sk_${randomBytes(32).toString("base64url")}`;
  return { clientId, secret, secretHash: hashSecret(secret), secretPrefix: prefix(secret) };
}

export async function authenticateBasic(header: string): Promise<CredentialCaller | null> {
  const encoded = header.slice("Basic ".length).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
  const split = decoded.indexOf(":");
  if (split <= 0) return null;
  const clientId = decoded.slice(0, split);
  const secret = decoded.slice(split + 1);
  if (!clientId || !secret) return null;

  const credential = await ApiCredential.findOne({ clientId }).select("secretHash ownerWallet revokedAt").lean();
  if (!credential || credential.revokedAt) return null;
  const stored = asBuffer(credential.secretHash);
  const actual = hashSecret(secret);
  if (stored.length !== actual.length || !timingSafeEqual(stored, actual)) return null;

  await ApiCredential.updateOne({ clientId }, { $set: { lastUsedAt: new Date() } });
  return { clientId, ownerWallet: credential.ownerWallet };
}

function hashSecret(secret: string): Buffer {
  const pepper = process.env.API_KEY_PEPPER ?? "";
  if (!pepper) throw new Error("API_KEY_PEPPER is not configured.");
  return createHmac("sha256", pepper).update(secret).digest();
}

function asBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.alloc(0);
}

function prefix(secret: string): string {
  return `${secret.slice(0, 7)}…${secret.slice(-4)}`;
}
