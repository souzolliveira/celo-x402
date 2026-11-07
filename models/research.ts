import mongoose, { type InferSchemaType } from "mongoose";

const callSchema = new mongoose.Schema(
  {
    capabilityId: { type: String, required: true },
    request: { type: mongoose.Schema.Types.Mixed, required: true },
    response: { type: mongoose.Schema.Types.Mixed },
    httpStatus: { type: Number, required: true },
    amount: { type: String },
    summary: { type: String },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const researchSchema = new mongoose.Schema(
  {
    ownerWallet: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, required: true, enum: ["pending", "running", "done", "failed", "cancelled"], default: "pending" },
    reserved: { type: String, required: true },
    plan: { type: [mongoose.Schema.Types.Mixed], default: [] },
    calls: { type: [callSchema], default: [] },
    editionHtml: { type: String, default: "" },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    cancelledAt: { type: Date },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: true } },
);

researchSchema.index({ status: 1, createdAt: 1 });
researchSchema.index({ ownerWallet: 1, createdAt: -1 });

export type ResearchDocument = InferSchemaType<typeof researchSchema> & { _id: mongoose.Types.ObjectId };

if (mongoose.models.Research) mongoose.deleteModel("Research");

export const Research = mongoose.model("Research", researchSchema);
