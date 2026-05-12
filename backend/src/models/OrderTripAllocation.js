import mongoose from "mongoose";

/**
 * Pivot table: Order <-> Trip allocation (N-N).
 * Sprint 1.1: lưu mức phân bổ order vào trip để phục vụ split/consolidate thủ công.
 */
const orderTripAllocationSchema = new mongoose.Schema(
  {
    OrganizationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    OrderID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesOrder",
      required: true,
      index: true
    },
    TripCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    RouteCode: { type: String, trim: true, uppercase: true, default: "" },
    CasesAllocated: { type: Number, default: 0, min: 0 },
    ItemsAllocated: { type: Number, default: 0, min: 0 },
    AllocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    Note: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

orderTripAllocationSchema.index({ OrderID: 1, TripCode: 1 });
orderTripAllocationSchema.index({ OrganizationID: 1, TripCode: 1 });

export const OrderTripAllocation = mongoose.model("OrderTripAllocation", orderTripAllocationSchema);
