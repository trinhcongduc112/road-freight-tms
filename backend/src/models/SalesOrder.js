import mongoose from "mongoose";

/**
 * BA + vRoute-aligned Order aggregate (MVP for Sprint 1).
 *
 * Scope hiện tại:
 * - Tạo đơn (web/mobile/import)
 * - Quản lý trạng thái order + history
 * - Cờ planning/approval để nối sang router/trip sprint kế tiếp
 */
export const OrderType = Object.freeze({
  SALES: "SALES"
});

export const TypeWay = Object.freeze({
  FIRST_WAY: "FIRST_WAY",
  SECOND_WAY: "SECOND_WAY"
});

export const OrderStatus = Object.freeze({
  OPEN: "OPEN",
  PICKED_PACKED: "PICKED_PACKED",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  REJECTED: "REJECTED"
});

export const FulfillmentStatus = Object.freeze({
  NOT_FULFILLED: "NOT_FULFILLED",
  FULFILLED: "FULFILLED",
  PARTIALLY_FULFILLED: "PARTIALLY_FULFILLED",
  UNFULFILLED: "UNFULFILLED"
});

export const PlanningStatus = Object.freeze({
  PENDING: "PENDING",
  PLANNED: "PLANNED",
  LOCKED: "LOCKED",
  FINALIZED: "FINALIZED"
});

export const ApprovalStatus = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
});

const orderItemSchema = new mongoose.Schema(
  {
    ProductCode: { type: String, required: true, trim: true, uppercase: true },
    NumberOfCases: { type: Number, default: 0, min: 0 },
    NumberOfItems: { type: Number, default: 0, min: 0 },
    NumberOfCasesDelivered: { type: Number, default: 0, min: 0 },
    NumberOfItemsDelivered: { type: Number, default: 0, min: 0 }
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    FromStatus: { type: String, default: null },
    ToStatus: { type: String, required: true },
    ChangedAt: { type: Date, default: Date.now },
    ChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    Note: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const planningHistorySchema = new mongoose.Schema(
  {
    FromStatus: { type: String, default: null },
    ToStatus: { type: String, required: true },
    ChangedAt: { type: Date, default: Date.now },
    ChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    Note: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const salesOrderSchema = new mongoose.Schema(
  {
    OrderCode: { type: String, required: true, trim: true, uppercase: true },
    OrderType: { type: String, enum: Object.values(OrderType), default: OrderType.SALES },

    OrganizationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    CustomerCode: { type: String, required: true, trim: true, uppercase: true },

    TypeWay: { type: String, enum: Object.values(TypeWay), default: TypeWay.FIRST_WAY },
    PickupOrder: { type: Boolean, default: false },
    SplittedOrder: { type: Boolean, default: false },

    OrderDate: { type: Date, required: true },
    TimeWindow: { type: String, trim: true, default: "" },
    ServiceTime: { type: Number, default: 0, min: 0 },

    Items: { type: [orderItemSchema], default: [] },
    TotalPrice: { type: Number, default: 0, min: 0 },
    TotalServicePrice: { type: Number, default: 0, min: 0 },
    NumberCollected: { type: Number, default: 0, min: 0 },

    OrderStatus: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.OPEN,
      index: true
    },
    FulfillmentStatus: {
      type: String,
      enum: Object.values(FulfillmentStatus),
      default: FulfillmentStatus.NOT_FULFILLED,
      index: true
    },
    PlanningStatus: {
      type: String,
      enum: Object.values(PlanningStatus),
      default: PlanningStatus.PENDING,
      index: true
    },
    ApprovalStatus: {
      type: String,
      enum: Object.values(ApprovalStatus),
      default: ApprovalStatus.PENDING,
      index: true
    },

    StatusHistory: { type: [statusHistorySchema], default: [] },
    PlanningHistory: { type: [planningHistorySchema], default: [] },

    IsMobileCreated: { type: Boolean, default: false },
    Source: {
      type: String,
      enum: ["WEB", "MOBILE", "IMPORT", "INTEGRATION"],
      default: "WEB",
      index: true
    }
  },
  { timestamps: true }
);

salesOrderSchema.index({ OrganizationID: 1, OrderCode: 1 }, { unique: true });
salesOrderSchema.index({ OrganizationID: 1, OrderDate: -1 });
salesOrderSchema.index({ OrganizationID: 1, PlanningStatus: 1, OrderStatus: 1 });

export const SalesOrder = mongoose.model("SalesOrder", salesOrderSchema);
