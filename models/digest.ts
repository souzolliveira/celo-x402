import mongoose, { type InferSchemaType } from "mongoose";
import { DIGEST_SOURCES } from "@/lib/digest";

const digestItemSchema = new mongoose.Schema({
  source: { type: String, required: true, enum: DIGEST_SOURCES },
  value: { type: String, required: true, trim: true, maxlength: 512 },
  comments: { type: Boolean, required: true, default: false },
  captions: { type: Boolean, required: true, default: false },
  summarize: { type: Boolean, required: true, default: false },
  postLimit: { type: Number, required: true, default: 3, min: 0, max: 12 },
});

const digestSchema = new mongoose.Schema(
  {
    ownerWallet: { type: String, required: true, unique: true, lowercase: true, trim: true },
    items: { type: [digestItemSchema], default: [] },
  },
  { timestamps: true },
);

export type DigestDocument = InferSchemaType<typeof digestSchema> & { _id: mongoose.Types.ObjectId };

if (mongoose.models.Digest) mongoose.deleteModel("Digest");

export const Digest = mongoose.model("Digest", digestSchema);
