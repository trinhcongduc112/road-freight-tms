import mongoose from "mongoose";

export const SupportArticleStatus = Object.freeze({
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED"
});

const supportArticleSchema = new mongoose.Schema(
  {
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    Title: { type: String, required: true, trim: true },
    Module: { type: String, trim: true, default: "GENERAL", uppercase: true },
    Keywords: [{ type: String, trim: true }],
    Question: { type: String, trim: true, default: "" },
    Answer: { type: String, required: true, trim: true },
    Status: { type: String, enum: Object.values(SupportArticleStatus), default: SupportArticleStatus.DRAFT, index: true }
  },
  { timestamps: true }
);

supportArticleSchema.index({ Status: 1, Module: 1 });
supportArticleSchema.index({ Title: "text", Question: "text", Answer: "text", Keywords: "text" });

export const SupportArticle = mongoose.model("SupportArticle", supportArticleSchema);
