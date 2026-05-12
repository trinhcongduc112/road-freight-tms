import mongoose from "mongoose";

export const ServiceType = Object.freeze({
  FTL:         "FTL",
  LTL:         "LTL",
  EXPRESS:     "EXPRESS",
  LAST_MILE:   "LAST_MILE",
  REFRIGERATED:"REFRIGERATED",
  OTHER:       "OTHER"
});

const serviceSchema = new mongoose.Schema(
  {
    ServiceCode: { type: String, required: true, trim: true, uppercase: true },
    XName:       { type: String, required: true, trim: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    Carrier:     { type: String, trim: true, default: "" },
    ServiceType: { type: String, enum: Object.values(ServiceType), default: ServiceType.FTL },
    Description: { type: String, trim: true, default: "" },

    /* Pricing fields — used to compute 3PL hire cost per trip */
    FlatRate:             { type: Number, default: 0, min: 0 },
    PricePerKm:           { type: Number, default: 0, min: 0 },
    PricePerKg:           { type: Number, default: 0, min: 0 },
    PricePerCBM:          { type: Number, default: 0, min: 0 },
    MinCharge:            { type: Number, default: 0, min: 0 },
    FuelSurchargePercent: { type: Number, default: 0, min: 0 },

    Status:    { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    CreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

serviceSchema.index({ OrganizationID: 1, ServiceCode: 1 }, { unique: true });

export const Service = mongoose.model("Service", serviceSchema);
