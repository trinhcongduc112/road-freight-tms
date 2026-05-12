import mongoose from "mongoose";

export const CategoryType = Object.freeze({
  FOOD:        "FOOD",
  BEVERAGE:    "BEVERAGE",
  ELECTRONICS: "ELECTRONICS",
  APPAREL:     "APPAREL",
  PHARMA:      "PHARMA",
  CHEMICALS:   "CHEMICALS",
  OTHER:       "OTHER"
});

const productCategorySchema = new mongoose.Schema(
  {
    CategoryCode:      { type: String, required: true, trim: true, uppercase: true },
    XName:             { type: String, required: true, trim: true },
    OrganizationID:    { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    ParentID:          { type: mongoose.Schema.Types.ObjectId, ref: "ProductCategory", default: null },
    CategoryType:      { type: String, enum: Object.values(CategoryType), default: "OTHER" },
    UnloadTimePerUnit: { type: Number, default: 0, min: 0 },
    AllowedTopLoad:    { type: Boolean, default: true },
    RequiredCapability:{ type: String, trim: true, default: "" },
    HandlingClass:     { type: String, trim: true, default: "" },
    IncompatibleClasses:{ type: [String], default: [] },
    Status:            { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    CreatedBy:         { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

productCategorySchema.index({ OrganizationID: 1, CategoryCode: 1 }, { unique: true });

export const ProductCategory = mongoose.model("ProductCategory", productCategorySchema);
