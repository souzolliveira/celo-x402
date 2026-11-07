import mongoose, { type InferSchemaType } from "mongoose";

const changeSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    previousAmount: { type: String, required: true },
    amount: { type: String, required: true },
    txHash: { type: String },
    previousStatus: { type: String },
    status: { type: String },
  },
  { _id: false },
);

const creditSchema = new mongoose.Schema(
  {
    wallet: { type: String, required: true, lowercase: true, trim: true },
    amount: { type: String, required: true },
    status: { type: String, required: true, enum: ["pending", "paid", "expired"], default: "pending" },
    expiresAt: { type: Date, required: true },
    txHash: { type: String },
    changes: { type: [changeSchema], default: [] },
  },
  { timestamps: true },
);

creditSchema.index({ txHash: 1 }, { unique: true, sparse: true });

export type CreditDocument = InferSchemaType<typeof creditSchema> & { _id: mongoose.Types.ObjectId };

if (mongoose.models.Credit) mongoose.deleteModel("Credit");

export const Credit = mongoose.model("Credit", creditSchema);

export const CREDIT_WINDOW_MS = 10 * 60 * 1000;
