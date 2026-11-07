import mongoose, { type InferSchemaType } from "mongoose";

const apiCredentialSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true },
    secretHash: { type: Buffer, required: true },
    secretPrefix: { type: String, required: true },
    ownerWallet: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    revokedAt: { type: Date },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

export type ApiCredentialDocument = InferSchemaType<typeof apiCredentialSchema> & { _id: mongoose.Types.ObjectId };

if (mongoose.models.ApiCredential) mongoose.deleteModel("ApiCredential");

export const ApiCredential = mongoose.model("ApiCredential", apiCredentialSchema);
