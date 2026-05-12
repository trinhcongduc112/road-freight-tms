import * as XLSX from "xlsx";
import { hasPermission, Modules, Actions, RoutePlanActions, p } from "../config/permissions.js";
import { SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus } from "../models/SalesOrder.js";
import { OrderTripAllocation } from "../models/OrderTripAllocation.js";
import { Product } from "../models/Product.js";
import { ApiError } from "../utils/apiError.js";
import { assertOrgInScope, scopeFilter } from "../middlewares/dac.js";

/**
 * Auto-tính TotalPrice = Σ Items × Product.Price (theo từng thùng).
 * Trả về { totalPrice, productMap }: productMap để cấp phát thông tin SP cho client.
 */
async function calcOrderTotalPrice(items, organizationId) {
  if (!Array.isArray(items) || items.length === 0) return { totalPrice: 0, productMap: {} };
  const codes = [...new Set(items.map((it) => String(it.ProductCode || "").toUpperCase()).filter(Boolean))];
  if (codes.length === 0) return { totalPrice: 0, productMap: {} };

  const products = await Product.find(
    { OrganizationID: organizationId, ProductCode: { $in: codes } },
    { ProductCode: 1, XName: 1, Price: 1, WeightPerCase: 1, VolumePerCase: 1, ItemsPerCase: 1, CategoryID: 1 }
  ).lean();
  const productMap = Object.fromEntries(products.map((p) => [p.ProductCode, p]));

  let totalPrice = 0;
  for (const it of items) {
    const code = String(it.ProductCode || "").toUpperCase();
    const product = productMap[code];
    if (!product) continue;
    const cases = Number(it.NumberOfCases || 0);
    const itemsLoose = Number(it.NumberOfItems || 0);
    const itemsPerCase = Math.max(1, Number(product.ItemsPerCase || 1));
    const pricePerItem = Number(product.Price || 0) / itemsPerCase;
    totalPrice += cases * Number(product.Price || 0) + itemsLoose * pricePerItem;
  }
  return { totalPrice: Math.round(totalPrice), productMap };
}

function toOrderDTO(order) {
  return {
    _id: order._id,
    OrderCode: order.OrderCode,
    OrderType: order.OrderType,
    OrganizationID: order.OrganizationID,
    CustomerCode: order.CustomerCode,
    TypeWay: order.TypeWay,
    PickupOrder: order.PickupOrder,
    SplittedOrder: order.SplittedOrder,
    OrderDate: order.OrderDate,
    TimeWindow: order.TimeWindow,
    ServiceTime: order.ServiceTime,
    Items: order.Items,
    TotalPrice: order.TotalPrice,
    TotalServicePrice: order.TotalServicePrice,
    NumberCollected: order.NumberCollected,
    OrderStatus: order.OrderStatus,
    FulfillmentStatus: order.FulfillmentStatus,
    PlanningStatus: order.PlanningStatus,
    ApprovalStatus: order.ApprovalStatus,
    StatusHistory: order.StatusHistory,
    PlanningHistory: order.PlanningHistory,
    IsMobileCreated: order.IsMobileCreated,
    Source: order.Source,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function parseUploadRows(file) {
  if (!file?.buffer) throw new ApiError(400, "Missing upload file");
  const name = file.originalname.toLowerCase();
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls") ||
    file.mimetype.includes("spreadsheetml") || file.mimetype.includes("excel");

  if (isXlsx) {
    const wb = XLSX.read(file.buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (!rows.length) throw new ApiError(400, "File Excel trống hoặc không có dữ liệu");
    return rows;
  }

  // JSON fallback
  const raw = file.buffer.toString("utf8").trim();
  if (!raw) throw new ApiError(400, "File trống");
  if (file.mimetype.includes("json") || name.endsWith(".json")) {
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows)) throw new ApiError(400, "JSON phải là mảng đối tượng");
    return rows;
  }
  throw new ApiError(400, "Chỉ hỗ trợ file .xlsx hoặc .json");
}

function requirePlanningPermission(req, fromPlanningStatus, toPlanningStatus) {
  if (req.user?.IsSuperAdmin) return;
  const granted = req.role?.Permissions ?? [];

  const checks = [];
  if (toPlanningStatus === PlanningStatus.PLANNED) {
    checks.push(p(Modules.ROUTE_PLAN, Actions.UPDATE));
  } else if (toPlanningStatus === PlanningStatus.LOCKED) {
    checks.push(p(Modules.ROUTE_PLAN, RoutePlanActions.LOCK));
  } else if (toPlanningStatus === PlanningStatus.FINALIZED) {
    checks.push(p(Modules.ROUTE_PLAN, RoutePlanActions.FINALIZE));
  }
  if (fromPlanningStatus === PlanningStatus.LOCKED && toPlanningStatus === PlanningStatus.PLANNED) {
    checks.push(p(Modules.ROUTE_PLAN, RoutePlanActions.UNLOCK));
  }
  if (checks.length && !checks.every((perm) => hasPermission(granted, perm))) {
    throw new ApiError(403, `Missing route planning permission: ${checks.join(", ")}`);
  }
}

const planningTransitions = Object.freeze({
  [PlanningStatus.PENDING]: new Set([PlanningStatus.PLANNED]),
  [PlanningStatus.PLANNED]: new Set([PlanningStatus.LOCKED, PlanningStatus.PENDING]),
  [PlanningStatus.LOCKED]: new Set([PlanningStatus.FINALIZED, PlanningStatus.PLANNED]),
  [PlanningStatus.FINALIZED]: new Set([])
});

export async function listOrders(req, res) {
  const filter = scopeFilter(req.orgScope, "OrganizationID");
  if (req.query.organizationId) {
    assertOrgInScope(req.orgScope, req.query.organizationId);
    filter.OrganizationID = req.query.organizationId;
  }
  if (req.query.status) filter.OrderStatus = req.query.status;
  if (req.query.planningStatus) filter.PlanningStatus = req.query.planningStatus;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 100);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    SalesOrder.find(filter).sort({ OrderDate: -1, OrderCode: 1 }).skip(skip).limit(limit).lean(),
    SalesOrder.countDocuments(filter)
  ]);

  res.json({ 
    success: true, 
    data: items.map(toOrderDTO),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
}

export async function getOrder(req, res) {
  const order = await SalesOrder.findById(req.params.id).lean();
  if (!order) throw new ApiError(404, "Order not found");
  assertOrgInScope(req.orgScope, order.OrganizationID);
  res.json({ success: true, data: toOrderDTO(order) });
}

/**
 * POST /api/orders/create
 * POST /api/orders/mobile/create
 */
export async function createOrder(req, res) {
  const {
    OrderCode,
    CustomerCode,
    OrganizationID,
    OrderDate,
    Items = [],
    OrderStatus: orderStatusInput,
    IsMobileCreated,
    Source
  } = req.body ?? {};

  if (!OrderCode || !CustomerCode || !OrganizationID || !OrderDate) {
    throw new ApiError(400, "OrderCode, CustomerCode, OrganizationID, OrderDate are required");
  }
  if (!Array.isArray(Items) || Items.length === 0) {
    throw new ApiError(400, "Items must include at least one SKU line");
  }
  assertOrgInScope(req.orgScope, OrganizationID);

  const toStatus = orderStatusInput ?? OrderStatus.OPEN;
  const { totalPrice } = await calcOrderTotalPrice(Items, OrganizationID);

  const order = await SalesOrder.create({
    ...req.body,
    OrderCode: String(OrderCode).toUpperCase(),
    CustomerCode: String(CustomerCode).toUpperCase(),
    OrganizationID,
    OrderDate: new Date(OrderDate),
    OrderStatus: toStatus,
    TotalPrice: totalPrice,
    IsMobileCreated: req.path.includes("/mobile/") || !!IsMobileCreated,
    Source: req.path.includes("/mobile/") ? "MOBILE" : Source ?? "WEB",
    StatusHistory: [
      {
        FromStatus: null,
        ToStatus: toStatus,
        ChangedBy: req.user?._id ?? null,
        Note: "Order created"
      }
    ]
  });

  res.status(201).json({ success: true, data: toOrderDTO(order) });
}

/**
 * PUT /api/orders/:id
 * Cho phép sửa: Items, OrderDate, TimeWindow, ServiceTime, CustomerCode, TypeWay
 * → Tự tính lại TotalPrice từ Items × Product.Price
 */
export async function updateOrder(req, res) {
  const order = await SalesOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  assertOrgInScope(req.orgScope, order.OrganizationID);

  if (order.PlanningStatus === PlanningStatus.LOCKED || order.PlanningStatus === PlanningStatus.FINALIZED) {
    throw new ApiError(409, `Không thể sửa đơn ở trạng thái ${order.PlanningStatus}`);
  }

  const editable = ["Items", "OrderDate", "TimeWindow", "ServiceTime", "CustomerCode", "TypeWay", "PickupOrder"];
  for (const k of editable) {
    if (req.body[k] !== undefined) {
      if (k === "OrderDate") order[k] = new Date(req.body[k]);
      else if (k === "CustomerCode") order[k] = String(req.body[k]).toUpperCase();
      else order[k] = req.body[k];
    }
  }

  const { totalPrice } = await calcOrderTotalPrice(order.Items, order.OrganizationID);
  order.TotalPrice = totalPrice;
  await order.save();
  res.json({ success: true, data: toOrderDTO(order) });
}

/**
 * DELETE /api/orders/:id — chỉ xóa được khi PlanningStatus = PENDING
 */
export async function deleteOrder(req, res) {
  const order = await SalesOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  assertOrgInScope(req.orgScope, order.OrganizationID);
  if (order.PlanningStatus !== PlanningStatus.PENDING) {
    throw new ApiError(409, `Chỉ có thể xóa đơn ở trạng thái PENDING (hiện: ${order.PlanningStatus})`);
  }
  await order.deleteOne();
  res.json({ success: true });
}

export async function uploadOrders(req, res) {
  const rows = parseUploadRows(req.file);
  const created = [];
  const errors = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    try {
      const payload = {
        ...row,
        OrderCode: row.OrderCode || row.orderCode,
        CustomerCode: row.CustomerCode || row.customerCode,
        OrganizationID: row.OrganizationID || row.organizationId,
        OrderDate: row.OrderDate || row.orderDate,
        Items: Array.isArray(row.Items)
          ? row.Items
          : [{ ProductCode: row.ProductCode || "SKU-DEFAULT", NumberOfCases: Number(row.NumberOfCases || 1) }],
        Source: "IMPORT"
      };

      if (!payload.OrderCode || !payload.CustomerCode || !payload.OrganizationID || !payload.OrderDate) {
        throw new ApiError(400, "Missing required order fields");
      }
      assertOrgInScope(req.orgScope, payload.OrganizationID);

      const toStatus = payload.OrderStatus ?? OrderStatus.OPEN;
      const { totalPrice } = await calcOrderTotalPrice(payload.Items, payload.OrganizationID);
      const order = await SalesOrder.create({
        ...payload,
        OrderCode: String(payload.OrderCode).toUpperCase(),
        CustomerCode: String(payload.CustomerCode).toUpperCase(),
        OrderDate: new Date(payload.OrderDate),
        OrderStatus: toStatus,
        TotalPrice: totalPrice,
        StatusHistory: [
          {
            FromStatus: null,
            ToStatus: toStatus,
            ChangedBy: req.user?._id ?? null,
            Note: "Order imported"
          }
        ],
        PlanningHistory: []
      });
      created.push(toOrderDTO(order));
    } catch (err) {
      errors.push({ row: i + 1, message: err.message });
    }
  }

  res.status(created.length > 0 ? 201 : 400).json({
    success: created.length > 0,
    data: { createdCount: created.length, errorCount: errors.length, created, errors }
  });
}

/**
 * POST /api/orders/change/status
 * Body: { OrderID, ToStatus, Note? }
 */
export async function changeOrderStatus(req, res) {
  const { OrderID, ToStatus, Note = "" } = req.body ?? {};
  if (!OrderID || !ToStatus) throw new ApiError(400, "OrderID and ToStatus are required");
  if (!Object.values(OrderStatus).includes(ToStatus)) {
    throw new ApiError(400, "Invalid ToStatus");
  }

  const order = await SalesOrder.findById(OrderID);
  if (!order) throw new ApiError(404, "Order not found");
  assertOrgInScope(req.orgScope, order.OrganizationID);

  const fromStatus = order.OrderStatus;
  if (fromStatus === ToStatus) {
    return res.json({ success: true, message: "No status change", data: toOrderDTO(order) });
  }

  order.OrderStatus = ToStatus;
  order.StatusHistory.push({
    FromStatus: fromStatus,
    ToStatus,
    ChangedBy: req.user?._id ?? null,
    Note
  });

  if (ToStatus === OrderStatus.DELIVERED) {
    order.FulfillmentStatus = "FULFILLED";
  }
  if (ToStatus === OrderStatus.CANCELLED || ToStatus === OrderStatus.REJECTED) {
    order.PlanningStatus = "PENDING";
  }

  await order.save();
  res.json({ success: true, data: toOrderDTO(order) });
}

/**
 * POST /api/orders/change/planning-status
 * Body: { OrderIDs: string[], ToPlanningStatus, Note? }
 */
export async function changePlanningStatus(req, res) {
  const { OrderIDs = [], ToPlanningStatus, Note = "" } = req.body ?? {};
  if (!Array.isArray(OrderIDs) || OrderIDs.length === 0) {
    throw new ApiError(400, "OrderIDs must be a non-empty array");
  }
  if (!Object.values(PlanningStatus).includes(ToPlanningStatus)) {
    throw new ApiError(400, "Invalid ToPlanningStatus");
  }

  const orders = await SalesOrder.find({ _id: { $in: OrderIDs } });
  if (orders.length !== OrderIDs.length) {
    throw new ApiError(404, "One or more orders not found");
  }

  const updated = [];
  for (const order of orders) {
    assertOrgInScope(req.orgScope, order.OrganizationID);
    const fromPlanningStatus = order.PlanningStatus;
    if (fromPlanningStatus === ToPlanningStatus) {
      updated.push(order);
      // eslint-disable-next-line no-continue
      continue;
    }
    if (!planningTransitions[fromPlanningStatus]?.has(ToPlanningStatus)) {
      throw new ApiError(
        409,
        `Invalid planning transition ${fromPlanningStatus} -> ${ToPlanningStatus} for order ${order.OrderCode}`
      );
    }

    requirePlanningPermission(req, fromPlanningStatus, ToPlanningStatus);

    order.PlanningStatus = ToPlanningStatus;
    order.PlanningHistory.push({
      FromStatus: fromPlanningStatus,
      ToStatus: ToPlanningStatus,
      ChangedBy: req.user?._id ?? null,
      Note
    });
    await order.save();
    updated.push(order);
  }

  res.json({ success: true, data: updated.map(toOrderDTO) });
}

/**
 * POST /api/orders/allocate
 * Body: { OrderID, TripCode, RouteCode?, CasesAllocated?, ItemsAllocated?, Note? }
 */
export async function allocateOrderToTrip(req, res) {
  const {
    OrderID,
    TripCode,
    RouteCode = "",
    CasesAllocated = 0,
    ItemsAllocated = 0,
    Note = ""
  } = req.body ?? {};
  if (!OrderID || !TripCode) throw new ApiError(400, "OrderID and TripCode are required");

  const order = await SalesOrder.findById(OrderID);
  if (!order) throw new ApiError(404, "Order not found");
  assertOrgInScope(req.orgScope, order.OrganizationID);

  const granted = req.role?.Permissions ?? [];
  if (
    !req.user?.IsSuperAdmin &&
    !hasPermission(granted, p(Modules.ROUTE_PLAN, Actions.UPDATE)) &&
    !hasPermission(granted, p(Modules.ROUTE_PLAN, RoutePlanActions.MOVE_ORDER))
  ) {
    throw new ApiError(
      403,
      `Missing route planning permission: ${p(Modules.ROUTE_PLAN, Actions.UPDATE)} or ${p(Modules.ROUTE_PLAN, RoutePlanActions.MOVE_ORDER)}`
    );
  }

  const allocation = await OrderTripAllocation.create({
    OrganizationID: order.OrganizationID,
    OrderID: order._id,
    TripCode: String(TripCode).toUpperCase(),
    RouteCode: String(RouteCode).toUpperCase(),
    CasesAllocated: Number(CasesAllocated) || 0,
    ItemsAllocated: Number(ItemsAllocated) || 0,
    AllocatedBy: req.user?._id ?? null,
    Note
  });

  if (order.PlanningStatus === PlanningStatus.PENDING) {
    order.PlanningStatus = PlanningStatus.PLANNED;
    order.PlanningHistory.push({
      FromStatus: PlanningStatus.PENDING,
      ToStatus: PlanningStatus.PLANNED,
      ChangedBy: req.user?._id ?? null,
      Note: "Auto updated by allocation"
    });
    await order.save();
  }

  res.status(201).json({ success: true, data: allocation });
}

export async function listOrderAllocations(req, res) {
  const order = await SalesOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, "Order not found");
  assertOrgInScope(req.orgScope, order.OrganizationID);

  const items = await OrderTripAllocation.find({ OrderID: order._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: items });
}

/**
 * POST /api/orders/change/approval-status
 * Body: { OrderID, ToApprovalStatus: "APPROVED"|"REJECTED", Note? }
 */
export async function approveOrder(req, res) {
  const { OrderID, ToApprovalStatus, Note = "" } = req.body ?? {};
  if (!OrderID || !ToApprovalStatus) throw new ApiError(400, "OrderID and ToApprovalStatus are required");
  if (!Object.values(ApprovalStatus).includes(ToApprovalStatus)) {
    throw new ApiError(400, "ToApprovalStatus must be PENDING, APPROVED or REJECTED");
  }

  const order = await SalesOrder.findById(OrderID);
  if (!order) throw new ApiError(404, "Order not found");
  assertOrgInScope(req.orgScope, order.OrganizationID);

  const from = order.ApprovalStatus;
  order.ApprovalStatus = ToApprovalStatus;
  order.StatusHistory.push({
    FromStatus: `APPROVAL:${from}`,
    ToStatus: `APPROVAL:${ToApprovalStatus}`,
    ChangedBy: req.user?._id ?? null,
    Note
  });

  if (ToApprovalStatus === ApprovalStatus.REJECTED) {
    order.OrderStatus = OrderStatus.REJECTED;
    order.PlanningStatus = PlanningStatus.PENDING;
  }

  await order.save();
  res.json({ success: true, data: toOrderDTO(order) });
}
