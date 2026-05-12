import mongoose from "mongoose";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const customerSchema = new mongoose.Schema(
  {
    CustomerCode: { type: String, required: true, trim: true, uppercase: true },
    XName: { type: String, required: true, trim: true },
    OrganizationID: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    CustomerGroup: { type: String, trim: true, default: "" },
    Address: { type: String, trim: true, default: "" },
    Latitude: { type: Number, default: null, min: -90, max: 90 },
    Longitude: { type: Number, default: null, min: -180, max: 180 },
    OpenTime: { type: String, default: null, validate: (v) => v == null || TIME_REGEX.test(v) },
    CloseTime: { type: String, default: null, validate: (v) => v == null || TIME_REGEX.test(v) },
    ServiceTime: { type: Number, default: 0, min: 0 },
    Phone: { type: String, trim: true, default: "" },
    Email: { type: String, trim: true, lowercase: true, default: "" },
    Status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    CreatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

customerSchema.index({ OrganizationID: 1, CustomerCode: 1 }, { unique: true });
customerSchema.index({ OrganizationID: 1, Status: 1 });

export const Customer = mongoose.model("Customer", customerSchema);
