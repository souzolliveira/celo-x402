import mongoose, { type InferSchemaType } from "mongoose";

const searchSchema = new mongoose.Schema(
  {
    ownerWallet: { type: String, required: true, lowercase: true, trim: true },
    clientId: { type: String },
    capabilityId: { type: String, required: true },
    platform: { type: String, required: true },
    request: { type: mongoose.Schema.Types.Mixed, required: true },
    response: { type: mongoose.Schema.Types.Mixed },
    httpStatus: { type: Number, required: true },
    amount: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

searchSchema.index({ ownerWallet: 1, createdAt: -1 });
searchSchema.index({ clientId: 1, createdAt: -1 });

export type SearchDocument = InferSchemaType<typeof searchSchema> & { _id: mongoose.Types.ObjectId };

if (mongoose.models.Search) mongoose.deleteModel("Search");

export const Search = mongoose.model("Search", searchSchema);

export const MAX_DOCUMENT_BYTES = 15_000_000;
