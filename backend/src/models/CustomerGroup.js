import mongoose from "mongoose";

const customerGroupSchema = new mongoose.Schema(
  {
    GroupCode:      { type: String, required: true, trim: true, uppercase: true },
    XName:          { type: String, required: true, trim: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    Description:    { type: String, trim: true, default: "" },
    Status:         { type: String, enum: ["Active", "Inactive"], default: "Active" }
  },
  { timestamps: true }
);

customerGroupSchema.index({ OrganizationID: 1, GroupCode: 1 }, { unique: true });

export const CustomerGroup = mongoose.model("CustomerGroup", customerGroupSchema);
