import { Organization } from "../models/Organization.js";
import { ProductCategory } from "../models/ProductCategory.js";
import { Product } from "../models/Product.js";
import { Vehicle } from "../models/Vehicle.js";
import { Service } from "../models/Service.js";
import { SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus } from "../models/SalesOrder.js";
import { Customer } from "../models/Customer.js";
import { CustomerGroup } from "../models/CustomerGroup.js";
import { ApiError } from "../utils/apiError.js";

const DEMO_PREFIX = "DEMO-";

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(8, 0, 0, 0);
  return d;
}

function assertDemoAccess(req) {
  const perms = req.role?.Permissions ?? [];
  if (!req.user?.IsSuperAdmin && !perms.includes("*")) {
    throw new ApiError(403, "Requires super admin or wildcard permission");
  }
}

function getUserOrgId(req) {
  const orgId = req.role?.OrganizationID ?? req.user?.OrganizationIDs?.[0];
  if (!orgId) throw new ApiError(400, "Tài khoản chưa thuộc tổ chức nào");
  return orgId;
}

/* Xóa toàn bộ dữ liệu có prefix DEMO- trong org của user */
async function clearDemoFromOrg(orgId) {
  const filter = { OrganizationID: orgId };
  const re = new RegExp("^" + DEMO_PREFIX);
  await Promise.all([
    SalesOrder.deleteMany({ ...filter, OrderCode: re }),
    Customer.deleteMany({ ...filter, CustomerCode: re }),
    Product.deleteMany({ ...filter, ProductCode: re }),
    ProductCategory.deleteMany({ ...filter, CategoryCode: re }),
    Vehicle.deleteMany({ ...filter, VehicleCode: re }),
    Service.deleteMany({ ...filter, ServiceCode: re }),
    Organization.deleteMany({ Parent: orgId, XCode: re })
  ]);
}

export async function seedDemo(req, res) {
  assertDemoAccess(req);
  const orgId = getUserOrgId(req);

  const org = await Organization.findById(orgId).lean();
  if (!org) throw new ApiError(404, "Không tìm thấy tổ chức");

  /* Idempotent: clear any leftover DEMO data trước */
  await clearDemoFromOrg(orgId);

  /* ── Cập nhật / tạo Kho mẫu (DEPOT child) với toạ độ Đốc Ngữ, Hà Nội ──
     Toạ độ chỉ thuộc về Kho (DEPOT), không phải Manufacturer. Nếu user đã tạo
     sẵn 1 DEPOT trong cây con thì bơm toạ độ vào nó; nếu chưa có thì tạo mới. */
  const DEPOT_LAT = 21.0388;   // Đốc Ngữ, Ba Đình, Hà Nội
  const DEPOT_LNG = 105.9052;
  /* Đảm bảo Manufacturer KHÔNG còn toạ độ rác */
  if (org.Latitude != null || org.Longitude != null) {
    await Organization.updateOne({ _id: orgId }, { $set: { Latitude: null, Longitude: null } });
  }
  /* BFS xuống cây con tìm DEPOT */
  let depotOrg = null;
  let frontier = [orgId];
  const seen = new Set([String(orgId)]);
  while (frontier.length && !depotOrg) {
    const children = await Organization.find({ Parent: { $in: frontier } });
    if (!children.length) break;
    depotOrg = children.find((c) => c.OrgType === "DEPOT") ?? null;
    frontier = children.filter((c) => !seen.has(String(c._id))).map((c) => c._id);
    children.forEach((c) => seen.add(String(c._id)));
  }
  if (depotOrg) {
    if (depotOrg.Latitude == null || depotOrg.Longitude == null) {
      depotOrg.Latitude = DEPOT_LAT;
      depotOrg.Longitude = DEPOT_LNG;
      if (!depotOrg.Address) depotOrg.Address = "Đốc Ngữ, Ba Đình, Hà Nội";
      await depotOrg.save();
    }
  } else {
    /* Không có depot — tạo nhanh 1 cái dưới gốc cho demo có thể chạy */
    await Organization.create({
      XCode: `${DEMO_PREFIX}KHO-DN`,
      XName: "Demo · Kho Đốc Ngữ",
      OrgType: "DEPOT",
      Parent: orgId,
      Latitude: DEPOT_LAT,
      Longitude: DEPOT_LNG,
      Address: "Đốc Ngữ, Ba Đình, Hà Nội",
      OpenTime: "06:00",
      CloseTime: "20:00",
      Status: "Active"
    });
  }

  /* ── Product Categories ── */
  const [catBev, catFood, catFmcg] = await ProductCategory.insertMany([
    { CategoryCode: `${DEMO_PREFIX}CAT-BEV`,  XName: "Demo · Đồ uống",        OrganizationID: orgId, CategoryType: "BEVERAGE", UnloadTimePerUnit: 2,   AllowedTopLoad: true,  HandlingClass: "DRY_GOODS", IncompatibleClasses: ["CHEMICAL"],            Status: "Active" },
    { CategoryCode: `${DEMO_PREFIX}CAT-FOOD`, XName: "Demo · Thực phẩm khô",  OrganizationID: orgId, CategoryType: "FOOD",     UnloadTimePerUnit: 3,   AllowedTopLoad: true,  HandlingClass: "FOOD",      IncompatibleClasses: ["CHEMICAL", "HAZMAT"],  Status: "Active" },
    { CategoryCode: `${DEMO_PREFIX}CAT-FMCG`, XName: "Demo · Hàng tiêu dùng", OrganizationID: orgId, CategoryType: "OTHER",    UnloadTimePerUnit: 1.5, AllowedTopLoad: false, HandlingClass: "CHEMICAL",  IncompatibleClasses: ["FOOD"],                Status: "Active" }
  ]);

  /* ── Products ── */
  const products = await Product.insertMany([
    { ProductCode: `${DEMO_PREFIX}P-BEV-001`, XName: "Demo · Nước suối Vĩnh Hảo 500ml (thùng 24)",  OrganizationID: orgId, CategoryID: catBev._id,  Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.012, ItemsPerCase: 24, Price:  84000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-BEV-002`, XName: "Demo · Pepsi 330ml (thùng 24)",                OrganizationID: orgId, CategoryID: catBev._id,  Unit: "Thùng", WeightPerCase:  8.5, VolumePerCase: 0.009, ItemsPerCase: 24, Price: 144000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-BEV-003`, XName: "Demo · Nước tăng lực Sting 330ml (thùng 24)", OrganizationID: orgId, CategoryID: catBev._id,  Unit: "Thùng", WeightPerCase:  8.0, VolumePerCase: 0.009, ItemsPerCase: 24, Price: 168000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FOD-001`, XName: "Demo · Mì Hảo Hảo tôm chua cay (thùng 30)",   OrganizationID: orgId, CategoryID: catFood._id, Unit: "Thùng", WeightPerCase:  7.5, VolumePerCase: 0.025, ItemsPerCase: 30, Price:  75000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FOD-002`, XName: "Demo · Gạo ST25 túi 5kg (thùng 10)",          OrganizationID: orgId, CategoryID: catFood._id, Unit: "Thùng", WeightPerCase: 50.0, VolumePerCase: 0.050, ItemsPerCase: 10, Price: 750000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FOD-003`, XName: "Demo · Dầu ăn Neptune 1L (thùng 12)",         OrganizationID: orgId, CategoryID: catFood._id, Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.014, ItemsPerCase: 12, Price: 360000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FMC-001`, XName: "Demo · Nước rửa chén Sunlight 750ml (thùng 12)", OrganizationID: orgId, CategoryID: catFmcg._id, Unit: "Thùng", WeightPerCase: 9.0, VolumePerCase: 0.012, ItemsPerCase: 12, Price: 216000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FMC-002`, XName: "Demo · Bột giặt OMO 3kg (thùng 6)",           OrganizationID: orgId, CategoryID: catFmcg._id, Unit: "Thùng", WeightPerCase: 18.0, VolumePerCase: 0.030, ItemsPerCase:  6, Price: 486000, Status: "Active" }
  ]);

  /* ── Vehicles ── */
  await Vehicle.insertMany([
    { VehicleCode: `${DEMO_PREFIX}XE-001`, XName: "Demo · Hino 500 5 tấn",   OrganizationID: orgId, LicensePlate: "30F-123.01", VehicleType: "TRUCK", Capabilities: ["DRY", "FOOD"],            MaxWeight: 5000, MaxVolume: 30, MaxCases: 300, FixedCost: 700000, CostPerKm: 14000, Status: "Active" },
    { VehicleCode: `${DEMO_PREFIX}XE-002`, XName: "Demo · Hino 300 3.5 tấn", OrganizationID: orgId, LicensePlate: "30F-234.02", VehicleType: "TRUCK", Capabilities: ["DRY", "FOOD", "CHEMICAL"], MaxWeight: 3500, MaxVolume: 20, MaxCases: 200, FixedCost: 500000, CostPerKm: 11000, Status: "Active" },
    { VehicleCode: `${DEMO_PREFIX}XE-003`, XName: "Demo · JAC X240 2.4 tấn", OrganizationID: orgId, LicensePlate: "30F-345.03", VehicleType: "TRUCK", Capabilities: ["DRY"],                    MaxWeight: 2400, MaxVolume: 14, MaxCases: 140, FixedCost: 380000, CostPerKm:  9000, Status: "Active" }
  ]);

  /* ── 3PL Services ── */
  await Service.insertMany([
    { ServiceCode: `${DEMO_PREFIX}3PL-GHN`, XName: "Demo · Giao Hàng Nhanh — FTL nội thành", OrganizationID: orgId, Carrier: "Giao Hàng Nhanh", ServiceType: "FTL",     FlatRate: 800000, PricePerKm: 0,     MinCharge: 800000, FuelSurchargePercent: 0, Status: "Active" },
    { ServiceCode: `${DEMO_PREFIX}3PL-GHE`, XName: "Demo · Giao Hàng Express — ghép hàng",   OrganizationID: orgId, Carrier: "GHE Logistics",   ServiceType: "EXPRESS", FlatRate: 0,       PricePerKm: 16000, MinCharge: 200000, FuelSurchargePercent: 5, Status: "Active" }
  ]);

  /* ── Customers (12 điểm Hà Nội · Bắc Ninh · Hưng Yên với tọa độ thật) ── */
  const customers = await Customer.insertMany([
    { CustomerCode: `${DEMO_PREFIX}KH-01`, XName: "Demo · AEON Mall Long Biên",        OrganizationID: orgId, CustomerGroup: "Siêu thị", Address: "27 Cổ Linh, Long Biên, Hà Nội",        Latitude: 21.0366, Longitude: 105.9102, Phone: "024 6263 1001", OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 30, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-02`, XName: "Demo · BigC Thăng Long",            OrganizationID: orgId, CustomerGroup: "Siêu thị", Address: "222 Trần Duy Hưng, Cầu Giấy, Hà Nội", Latitude: 21.0063, Longitude: 105.7977, Phone: "024 3784 2002", OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 30, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-03`, XName: "Demo · Vincom Royal City",          OrganizationID: orgId, CustomerGroup: "Siêu thị", Address: "72A Nguyễn Trãi, Thanh Xuân, Hà Nội", Latitude: 20.9986, Longitude: 105.8298, Phone: "024 3974 3003", OpenTime: "09:30", CloseTime: "22:00", ServiceTime: 25, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-04`, XName: "Demo · Go! Gia Lâm",                OrganizationID: orgId, CustomerGroup: "Siêu thị", Address: "QL5, Gia Lâm, Hà Nội",                 Latitude: 21.0437, Longitude: 105.9252, Phone: "024 3827 4004", OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 25, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-05`, XName: "Demo · Lotte Mart Hà Đông",        OrganizationID: orgId, CustomerGroup: "Siêu thị", Address: "Tố Hữu, Hà Đông, Hà Nội",              Latitude: 20.9680, Longitude: 105.7764, Phone: "024 6255 5005", OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 25, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-06`, XName: "Demo · Winmart Tây Hồ",            OrganizationID: orgId, CustomerGroup: "Bán lẻ",   Address: "Xuân La, Tây Hồ, Hà Nội",              Latitude: 21.0721, Longitude: 105.8227, Phone: "024 3718 6006", OpenTime: "07:00", CloseTime: "22:00", ServiceTime: 15, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-07`, XName: "Demo · Đại Lý Hoàng Giang",        OrganizationID: orgId, CustomerGroup: "Đại lý",   Address: "Minh Khai, Nam Từ Liêm, Hà Nội",       Latitude: 21.0185, Longitude: 105.7701, Phone: "024 3561 7007", OpenTime: "07:00", CloseTime: "18:00", ServiceTime: 20, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-08`, XName: "Demo · Đại Lý Sơn Nam",            OrganizationID: orgId, CustomerGroup: "Đại lý",   Address: "Lĩnh Nam, Hoàng Mai, Hà Nội",          Latitude: 20.9712, Longitude: 105.8680, Phone: "024 3641 8008", OpenTime: "07:00", CloseTime: "18:00", ServiceTime: 20, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-09`, XName: "Demo · Co.opmart Hà Đông",         OrganizationID: orgId, CustomerGroup: "Siêu thị", Address: "Quang Trung, Hà Đông, Hà Nội",         Latitude: 20.9630, Longitude: 105.7823, Phone: "024 3382 9009", OpenTime: "08:00", CloseTime: "21:30", ServiceTime: 20, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-10`, XName: "Demo · Kho Tiên Sơn Bắc Ninh",     OrganizationID: orgId, CustomerGroup: "Kho",      Address: "KCN Tiên Sơn, Từ Sơn, Bắc Ninh",       Latitude: 21.1378, Longitude: 106.0762, Phone: "0222 363 1010", OpenTime: "07:00", CloseTime: "17:00", ServiceTime: 35, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-11`, XName: "Demo · Đại Lý Thắng Lợi Bắc Ninh", OrganizationID: orgId, CustomerGroup: "Đại lý",   Address: "QL1, Yên Phong, Bắc Ninh",             Latitude: 21.1002, Longitude: 105.9847, Phone: "0222 377 1111", OpenTime: "07:30", CloseTime: "17:30", ServiceTime: 20, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-12`, XName: "Demo · Kho Phố Nối Hưng Yên",      OrganizationID: orgId, CustomerGroup: "Kho",      Address: "KCN Phố Nối A, Mỹ Hào, Hưng Yên",      Latitude: 20.9622, Longitude: 106.0650, Phone: "0221 394 1212", OpenTime: "06:00", CloseTime: "18:00", ServiceTime: 40, Status: "Active" }
  ]);

  /* ── Orders (20 đơn PENDING — sẵn sàng lập lộ trình) ── */
  const custCodes = customers.map((c) => c.CustomerCode);
  const priceByCode = Object.fromEntries(products.map((p) => [p.ProductCode, p.Price ?? 0]));
  const calcTotal = (items) => items.reduce((s, it) => s + (priceByCode[it.ProductCode] ?? 0) * (it.NumberOfCases ?? 0), 0);
  const today = daysFromNow(0);
  const tomorrow = daysFromNow(1);

  const orders = [];
  const windows = ["07:00-12:00", "08:00-12:00", "09:00-14:00", "10:00-16:00", "13:00-18:00", "08:00-18:00"];
  const itemSets = [
    [{ ProductCode: `${DEMO_PREFIX}P-BEV-001`, NumberOfCases: 20 }, { ProductCode: `${DEMO_PREFIX}P-BEV-002`, NumberOfCases: 10 }],
    [{ ProductCode: `${DEMO_PREFIX}P-FOD-001`, NumberOfCases: 15 }, { ProductCode: `${DEMO_PREFIX}P-FMC-001`, NumberOfCases: 8 }],
    [{ ProductCode: `${DEMO_PREFIX}P-BEV-003`, NumberOfCases: 25 }],
    [{ ProductCode: `${DEMO_PREFIX}P-FOD-002`, NumberOfCases: 5 },  { ProductCode: `${DEMO_PREFIX}P-FOD-003`, NumberOfCases: 10 }],
    [{ ProductCode: `${DEMO_PREFIX}P-FMC-002`, NumberOfCases: 12 }, { ProductCode: `${DEMO_PREFIX}P-BEV-001`, NumberOfCases: 30 }],
    [{ ProductCode: `${DEMO_PREFIX}P-FOD-001`, NumberOfCases: 20 }, { ProductCode: `${DEMO_PREFIX}P-BEV-002`, NumberOfCases: 15 }],
    [{ ProductCode: `${DEMO_PREFIX}P-FMC-001`, NumberOfCases: 20 }],
    [{ ProductCode: `${DEMO_PREFIX}P-BEV-001`, NumberOfCases: 40 }, { ProductCode: `${DEMO_PREFIX}P-FOD-003`, NumberOfCases: 6 }],
    [{ ProductCode: `${DEMO_PREFIX}P-FOD-002`, NumberOfCases: 8 }],
    [{ ProductCode: `${DEMO_PREFIX}P-BEV-003`, NumberOfCases: 18 }, { ProductCode: `${DEMO_PREFIX}P-FMC-002`, NumberOfCases: 6 }]
  ];

  for (let i = 0; i < 10; i++) {
    const cCode = custCodes[i % 12];
    orders.push({
      OrderCode:      `${DEMO_PREFIX}${String(today.getFullYear()).slice(-2)}${String(today.getMonth()+1).padStart(2,"0")}${String(today.getDate()).padStart(2,"0")}-${String(i+1).padStart(3,"0")}`,
      OrganizationID: orgId,
      CustomerCode:   cCode,
      OrderDate:      today,
      TypeWay:        "FIRST_WAY",
      TimeWindow:     windows[i % windows.length],
      ServiceTime:    15 + (i % 3) * 5,
      Items:          itemSets[i],
      TotalPrice:     calcTotal(itemSets[i]),
      OrderStatus:    OrderStatus.OPEN,
      ApprovalStatus: ApprovalStatus.APPROVED,
      PlanningStatus: PlanningStatus.PENDING,
      Source:         "WEB",
      StatusHistory:  [{ FromStatus: null, ToStatus: OrderStatus.OPEN, Note: "Demo", ChangedAt: today }]
    });
  }

  for (let i = 0; i < 10; i++) {
    const cCode = custCodes[(i + 3) % 12];
    orders.push({
      OrderCode:      `${DEMO_PREFIX}${String(tomorrow.getFullYear()).slice(-2)}${String(tomorrow.getMonth()+1).padStart(2,"0")}${String(tomorrow.getDate()).padStart(2,"0")}-${String(i+11).padStart(3,"0")}`,
      OrganizationID: orgId,
      CustomerCode:   cCode,
      OrderDate:      tomorrow,
      TypeWay:        "FIRST_WAY",
      TimeWindow:     windows[(i + 2) % windows.length],
      ServiceTime:    20,
      Items:          itemSets[(i + 3) % itemSets.length],
      TotalPrice:     calcTotal(itemSets[(i + 3) % itemSets.length]),
      OrderStatus:    OrderStatus.OPEN,
      ApprovalStatus: ApprovalStatus.APPROVED,
      PlanningStatus: PlanningStatus.PENDING,
      Source:         "WEB",
      StatusHistory:  [{ FromStatus: null, ToStatus: OrderStatus.OPEN, Note: "Demo", ChangedAt: tomorrow }]
    });
  }

  await SalesOrder.insertMany(orders);

  res.status(201).json({
    success: true,
    message: `Đã thêm dữ liệu mẫu vào tổ chức '${org.XName}'`,
    data: {
      org:    { _id: org._id, XCode: org.XCode, XName: org.XName },
      counts: { categories: 3, customers: 12, products: 8, vehicles: 3, services: 2, orders: 20 }
    }
  });
}

export async function clearDemo(req, res) {
  assertDemoAccess(req);
  const orgId = getUserOrgId(req);
  await clearDemoFromOrg(orgId);
  res.json({ success: true, message: "Đã xóa toàn bộ dữ liệu demo khỏi tổ chức của bạn" });
}

export async function demoStatus(req, res) {
  assertDemoAccess(req);
  const orgId = getUserOrgId(req);
  const re = new RegExp("^" + DEMO_PREFIX);
  const filter = { OrganizationID: orgId };
  const [customers, products, vehicles, orders, services, categories] = await Promise.all([
    Customer.countDocuments({ ...filter, CustomerCode: re }),
    Product.countDocuments({ ...filter, ProductCode: re }),
    Vehicle.countDocuments({ ...filter, VehicleCode: re }),
    SalesOrder.countDocuments({ ...filter, OrderCode: re }),
    Service.countDocuments({ ...filter, ServiceCode: re }),
    ProductCategory.countDocuments({ ...filter, CategoryCode: re })
  ]);
  const exists = customers + products + vehicles + orders + services + categories > 0;
  res.json({
    success: true,
    exists,
    counts: { categories, customers, products, vehicles, services, orders }
  });
}
