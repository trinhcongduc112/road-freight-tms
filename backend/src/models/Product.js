import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    ProductCode: { type: String, required: true, trim: true, uppercase: true },
    XName: { type: String, required: true, trim: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    CategoryID: { type: mongoose.Schema.Types.ObjectId, ref: "ProductCategory", default: null },
    Category:   { type: String, trim: true, default: "" },
    Unit: { type: String, trim: true, default: "pcs" },
    WeightPerCase: { type: Number, default: 0, min: 0 },
    VolumePerCase: { type: Number, default: 0, min: 0 },
    ItemsPerCase: { type: Number, default: 1, min: 1 },
    Price: { type: Number, default: 0, min: 0 },
    Status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    CreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

productSchema.index({ OrganizationID: 1, ProductCode: 1 }, { unique: true });

export const Product = mongoose.model("Product", productSchema);
