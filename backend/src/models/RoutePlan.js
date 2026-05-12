import mongoose from "mongoose";

export const RoutePlanStatus = Object.freeze({
  DRAFT: "DRAFT",
  LOCKED: "LOCKED",
  FINALIZED: "FINALIZED"
});

const routePlanSchema = new mongoose.Schema(
  {
    PlanCode: { type: String, required: true, trim: true, uppercase: true },
    PlanName: { type: String, trim: true, default: "" },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    PlanDate: { type: Date, required: true, index: true },
    Status: { type: String, enum: Object.values(RoutePlanStatus), default: RoutePlanStatus.DRAFT, index: true },
    Shift: { type: String, enum: ["MORNING", "AFTERNOON", "FULL_DAY"], default: "FULL_DAY" },
    Notes: { type: String, trim: true, default: "" },
    CreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

routePlanSchema.index({ OrganizationID: 1, PlanDate: 1 }); // non-unique: multiple plans per day allowed

export const RoutePlan = mongoose.model("RoutePlan", routePlanSchema);
