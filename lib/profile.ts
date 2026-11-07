import { getDb } from "@/lib/db";

export type KycStatus = "pending" | "verified";

export type Profile = {
  fullName: string;
  email: string;
  document: string;
  phone: string;
  kycStatus: KycStatus;
  updatedAt: string;
};

export type ProfileInput = {
  fullName: string;
  email: string;
  document: string;
  phone: string;
};

export type ProfileField = keyof ProfileInput;

type ProfileRow = {
  full_name: string;
  email: string;
  document: string;
  phone: string;
  kyc_status: string;
  updated_at: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getProfile(): Profile | null {
  let row: ProfileRow | undefined;
  try {
    row = getDb()
      .prepare(
        "SELECT full_name, email, document, phone, kyc_status, updated_at FROM profile WHERE id = 1",
      )
      .get() as ProfileRow | undefined;
  } catch {
    return null;
  }

  if (!row) return null;
  return {
    fullName: row.full_name,
    email: row.email,
    document: row.document,
    phone: row.phone,
    kycStatus: row.kyc_status === "verified" ? "verified" : "pending",
    updatedAt: row.updated_at,
  };
}

export function profileFieldErrors(input: ProfileInput): Partial<Record<ProfileField, string>> {
  const errors: Partial<Record<ProfileField, string>> = {};
  if (input.fullName.trim().length < 2) errors.fullName = "Enter your full name.";
  if (!EMAIL.test(input.email.trim())) errors.email = "Enter a valid email.";
  if (input.document.trim().length < 5) errors.document = "Enter a document number.";
  if (input.phone.replace(/\D/g, "").length < 8) errors.phone = "Enter a phone number with an area code.";
  return errors;
}

export function saveProfile(input: ProfileInput): Profile {
  const fullName = input.fullName.trim();
  const email = input.email.trim();
  const document = input.document.trim();
  const phone = input.phone.trim();
  const updatedAt = new Date().toISOString();
  const current = getProfile();
  const kycStatus: KycStatus = current?.kycStatus === "verified" ? "verified" : "pending";

  getDb()
    .prepare(
      `INSERT INTO profile (id, full_name, email, document, phone, kyc_status, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         full_name = excluded.full_name,
         email = excluded.email,
         document = excluded.document,
         phone = excluded.phone,
         kyc_status = excluded.kyc_status,
         updated_at = excluded.updated_at`,
    )
    .run(fullName, email, document, phone, kycStatus, updatedAt);

  return { fullName, email, document, phone, kycStatus, updatedAt };
}

export function kycLabel(status: KycStatus): string {
  return status === "verified" ? "Verified" : "Waiting for verification";
}
