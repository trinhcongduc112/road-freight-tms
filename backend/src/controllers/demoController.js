import { Organization } from "../models/Organization.js";
import { ProductCategory } from "../models/ProductCategory.js";
import { Product } from "../models/Product.js";
import { Vehicle } from "../models/Vehicle.js";
import { Service } from "../models/Service.js";
import { SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus } from "../models/SalesOrder.js";
import { Customer } from "../models/Customer.js";
import { CustomerGroup } from "../models/CustomerGroup.js";
import { Driver } from "../models/Driver.js";
import { RoleGroup, RoleGroupKind } from "../models/RoleGroup.js";
import { User, UserStatus, FunctionRole } from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import {
  DELIVERER_TEMPLATE_PERMISSIONS,
  DISPATCHER_TEMPLATE_PERMISSIONS,
  p,
  Modules,
  Actions
} from "../config/permissions.js";

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

async function collectOrgSubtreeIds(orgId) {
  const ids = [orgId];
  let frontier = [orgId];
  const seen = new Set([String(orgId)]);
  while (frontier.length) {
    const children = await Organization.find({ Parent: { $in: frontier } }, { _id: 1 }).lean();
    const next = [];
    for (const child of children) {
      const key = String(child._id);
      if (seen.has(key)) continue;
      seen.add(key);
      ids.push(child._id);
      next.push(child._id);
    }
    frontier = next;
  }
  return ids;
}

/* Xóa toàn bộ dữ liệu có prefix DEMO- trong cây tổ chức của user */
async function clearDemoFromOrg(orgId) {
  const orgIds = await collectOrgSubtreeIds(orgId);
  const filter = { OrganizationID: { $in: orgIds } };
  const re = new RegExp("^" + DEMO_PREFIX);
  const demoUserRe = /^demo\./;
  const demoEmailRe = /^demo\..+@road-freight\.io$/;
  const [
    salesOrders,
    customers,
    customerGroups,
    drivers,
    products,
    productCategories,
    vehicles,
    services,
    roleGroups,
    users
  ] = await Promise.all([
    SalesOrder.deleteMany({ ...filter, OrderCode: re }),
    Customer.deleteMany({ ...filter, CustomerCode: re }),
    CustomerGroup.deleteMany({ ...filter, GroupCode: re }),
    Driver.deleteMany({ ...filter, DriverCode: re }),
    Product.deleteMany({ ...filter, ProductCode: re }),
    ProductCategory.deleteMany({ ...filter, CategoryCode: re }),
    Vehicle.deleteMany({ ...filter, VehicleCode: re }),
    Service.deleteMany({ ...filter, ServiceCode: re }),
    RoleGroup.deleteMany({ XCode: re }),
    User.deleteMany({
      $or: [
        { XCode: re },
        { UserName: demoUserRe },
        { Email: demoEmailRe }
      ]
    })
  ]);

  const organizations = await Organization.deleteMany({ _id: { $in: orgIds.slice(1) }, XCode: re });
  return {
    salesOrders: salesOrders.deletedCount ?? 0,
    customers: customers.deletedCount ?? 0,
    customerGroups: customerGroups.deletedCount ?? 0,
    drivers: drivers.deletedCount ?? 0,
    products: products.deletedCount ?? 0,
    productCategories: productCategories.deletedCount ?? 0,
    vehicles: vehicles.deletedCount ?? 0,
    services: services.deletedCount ?? 0,
    roleGroups: roleGroups.deletedCount ?? 0,
    users: users.deletedCount ?? 0,
    organizations: organizations.deletedCount ?? 0
  };
}

export async function seedDemo(req, res) {
  assertDemoAccess(req);
  const orgId = getUserOrgId(req);

  const org = await Organization.findById(orgId).lean();
  if (!org) throw new ApiError(404, "Không tìm thấy tổ chức");

  /* Idempotent: clear any leftover DEMO data trước */
  await clearDemoFromOrg(orgId);

  /* ── Tạo đúng cây mẫu: Tổ chức -> Chi nhánh -> Kho ──
     Toạ độ chỉ thuộc về Kho (DEPOT), không phải Manufacturer/Branch. */
  const DEPOT_LAT = 21.0388;   // Đốc Ngữ, Ba Đình, Hà Nội
  const DEPOT_LNG = 105.9052;
  if (org.Latitude != null || org.Longitude != null) {
    await Organization.updateOne({ _id: orgId }, { $set: { Latitude: null, Longitude: null } });
  }

  const branchOrg = await Organization.create({
    XCode: `${DEMO_PREFIX}CN-HN`,
    XName: "Demo · Chi nhánh Hà Nội",
    OrgType: "BRANCH",
    Parent: orgId,
    Path: [orgId],
    Address: "Ba Đình, Hà Nội",
    Status: "Active"
  });

  const depotOrg = await Organization.create({
    XCode: `${DEMO_PREFIX}KHO-DN`,
    XName: "Demo · Kho Đốc Ngữ",
    OrgType: "DEPOT",
    Parent: branchOrg._id,
    Path: [orgId, branchOrg._id],
    Latitude: DEPOT_LAT,
    Longitude: DEPOT_LNG,
    Address: "Đốc Ngữ, Ba Đình, Hà Nội",
    OpenTime: "06:00",
    CloseTime: "20:00",
    Status: "Active"
  });
  const dataOrgId = depotOrg._id;

  /* ── Role groups + demo users
     Driver users are linked to Driver master data for mobile app login.
     Planner/Dispatcher and Accountant users work on the web app. */
  const [plannerDispatcherGroup, accountantGroup, deliveryGroup] = await RoleGroup.insertMany([
    {
      XCode: `${DEMO_PREFIX}RG-PLANNER-DISPATCHER`,
      XName: "Demo · Planner & Dispatcher",
      Kind: RoleGroupKind.NORMAL,
      Permissions: [...DISPATCHER_TEMPLATE_PERMISSIONS],
      OrganizationID: dataOrgId,
      Configurations: { SeeChildren: true }
    },
    {
      XCode: `${DEMO_PREFIX}RG-ACCOUNTANT`,
      XName: "Demo · Accountant",
      Kind: RoleGroupKind.NORMAL,
      Permissions: [
        p(Modules.ORGANIZATION, Actions.READ),
        p(Modules.CUSTOMER, Actions.READ),
        p(Modules.PRODUCT, Actions.READ),
        p(Modules.VEHICLE, Actions.READ),
        p(Modules.DRIVER, Actions.READ),
        p(Modules.SERVICE, Actions.READ),
        p(Modules.ORDER, Actions.READ),
        p(Modules.ORDER, Actions.EXPORT),
        p(Modules.ROUTE_PLAN, Actions.READ),
        p(Modules.TRIP, Actions.READ),
        p(Modules.REPORT, Actions.READ),
        p(Modules.REPORT, Actions.EXPORT)
      ],
      OrganizationID: dataOrgId,
      Configurations: { SeeChildren: true }
    },
    {
      XCode: `${DEMO_PREFIX}RG-DELIVERY`,
      XName: "Demo · Delivery",
      Kind: RoleGroupKind.NORMAL,
      Permissions: [...DELIVERER_TEMPLATE_PERMISSIONS],
      OrganizationID: dataOrgId,
      Configurations: { SeeChildren: false }
    }
  ]);

  const demoPasswordHash = await User.hashPassword("Demo@123");
  const [plannerUser, dispatcherUser, accountantUser, driverUser01, driverUser02, driverUser03] = await User.insertMany([
    {
      XCode: `${DEMO_PREFIX}USR-PLN-01`,
      UserName: "demo.planner",
      FullName: "Demo Planner - Nguyễn Minh Anh",
      Email: "demo.planner@road-freight.io",
      Phone: "0988 200 101",
      PasswordHash: demoPasswordHash,
      OrganizationIDs: [dataOrgId],
      RoleGroupID: plannerDispatcherGroup._id,
      FunctionRoles: [FunctionRole.PLANNER, FunctionRole.PLANNER_DISPATCHER],
      IsActive: true,
      Status: UserStatus.ACTIVE,
      EmailVerifiedAt: new Date()
    },
    {
      XCode: `${DEMO_PREFIX}USR-DSP-01`,
      UserName: "demo.dispatcher",
      FullName: "Demo Dispatcher - Trần Quang Huy",
      Email: "demo.dispatcher@road-freight.io",
      Phone: "0988 200 102",
      PasswordHash: demoPasswordHash,
      OrganizationIDs: [dataOrgId],
      RoleGroupID: plannerDispatcherGroup._id,
      FunctionRoles: [FunctionRole.DISPATCHER, FunctionRole.PLANNER_DISPATCHER],
      IsActive: true,
      Status: UserStatus.ACTIVE,
      EmailVerifiedAt: new Date()
    },
    {
      XCode: `${DEMO_PREFIX}USR-ACC-01`,
      UserName: "demo.accountant",
      FullName: "Demo Accountant - Phạm Thu Hà",
      Email: "demo.accountant@road-freight.io",
      Phone: "0988 200 201",
      PasswordHash: demoPasswordHash,
      OrganizationIDs: [dataOrgId],
      RoleGroupID: accountantGroup._id,
      FunctionRoles: [FunctionRole.ACCOUNTANT],
      IsActive: true,
      Status: UserStatus.ACTIVE,
      EmailVerifiedAt: new Date()
    },
    {
      XCode: `${DEMO_PREFIX}USR-DRV-01`,
      UserName: "demo.driver01",
      FullName: "Demo Driver - Lê Văn Nam",
      Email: "demo.driver01@road-freight.io",
      Phone: "0988 300 001",
      PasswordHash: demoPasswordHash,
      OrganizationIDs: [dataOrgId],
      RoleGroupID: deliveryGroup._id,
      FunctionRoles: [FunctionRole.DRIVER],
      AllowedVehicleTypes: ["TRUCK"],
      IsActive: true,
      Status: UserStatus.ACTIVE,
      EmailVerifiedAt: new Date()
    },
    {
      XCode: `${DEMO_PREFIX}USR-DRV-02`,
      UserName: "demo.driver02",
      FullName: "Demo Driver - Nguyễn Văn Phúc",
      Email: "demo.driver02@road-freight.io",
      Phone: "0988 300 002",
      PasswordHash: demoPasswordHash,
      OrganizationIDs: [dataOrgId],
      RoleGroupID: deliveryGroup._id,
      FunctionRoles: [FunctionRole.DRIVER],
      AllowedVehicleTypes: ["TRUCK"],
      IsActive: true,
      Status: UserStatus.ACTIVE,
      EmailVerifiedAt: new Date()
    },
    {
      XCode: `${DEMO_PREFIX}USR-DRV-03`,
      UserName: "demo.driver03",
      FullName: "Demo Driver - Đỗ Đức Long",
      Email: "demo.driver03@road-freight.io",
      Phone: "0988 300 003",
      PasswordHash: demoPasswordHash,
      OrganizationIDs: [dataOrgId],
      RoleGroupID: deliveryGroup._id,
      FunctionRoles: [FunctionRole.DRIVER],
      AllowedVehicleTypes: ["TRUCK"],
      IsActive: true,
      Status: UserStatus.ACTIVE,
      EmailVerifiedAt: new Date()
    }
  ]);

  /* ── Product Categories ── */
  const [catBev, catFood, catFmcg] = await ProductCategory.insertMany([
    { CategoryCode: `${DEMO_PREFIX}CAT-BEV`,  XName: "Demo · Đồ uống",        OrganizationID: dataOrgId, CategoryType: "BEVERAGE", UnloadTimePerUnit: 2,   AllowedTopLoad: true,  HandlingClass: "DRY_GOODS", IncompatibleClasses: [], Status: "Active" },
    { CategoryCode: `${DEMO_PREFIX}CAT-FOOD`, XName: "Demo · Thực phẩm khô",  OrganizationID: dataOrgId, CategoryType: "FOOD",     UnloadTimePerUnit: 3,   AllowedTopLoad: true,  HandlingClass: "DRY_GOODS", IncompatibleClasses: [], Status: "Active" },
    { CategoryCode: `${DEMO_PREFIX}CAT-FMCG`, XName: "Demo · Hàng tiêu dùng", OrganizationID: dataOrgId, CategoryType: "OTHER",    UnloadTimePerUnit: 1.5, AllowedTopLoad: false, HandlingClass: "DRY_GOODS", IncompatibleClasses: [], Status: "Active" }
  ]);

  /* ── Products ── */
  const products = await Product.insertMany([
    { ProductCode: `${DEMO_PREFIX}P-BEV-001`, XName: "Demo · Nước suối Vĩnh Hảo 500ml (thùng 24)",  OrganizationID: dataOrgId, CategoryID: catBev._id,  Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.012, ItemsPerCase: 24, Price:  84000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-BEV-002`, XName: "Demo · Pepsi 330ml (thùng 24)",                OrganizationID: dataOrgId, CategoryID: catBev._id,  Unit: "Thùng", WeightPerCase:  8.5, VolumePerCase: 0.009, ItemsPerCase: 24, Price: 144000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-BEV-003`, XName: "Demo · Nước tăng lực Sting 330ml (thùng 24)", OrganizationID: dataOrgId, CategoryID: catBev._id,  Unit: "Thùng", WeightPerCase:  8.0, VolumePerCase: 0.009, ItemsPerCase: 24, Price: 168000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FOD-001`, XName: "Demo · Mì Hảo Hảo tôm chua cay (thùng 30)",   OrganizationID: dataOrgId, CategoryID: catFood._id, Unit: "Thùng", WeightPerCase:  7.5, VolumePerCase: 0.025, ItemsPerCase: 30, Price:  75000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FOD-002`, XName: "Demo · Gạo ST25 túi 5kg (thùng 10)",          OrganizationID: dataOrgId, CategoryID: catFood._id, Unit: "Thùng", WeightPerCase: 50.0, VolumePerCase: 0.050, ItemsPerCase: 10, Price: 750000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FOD-003`, XName: "Demo · Dầu ăn Neptune 1L (thùng 12)",         OrganizationID: dataOrgId, CategoryID: catFood._id, Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.014, ItemsPerCase: 12, Price: 360000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FMC-001`, XName: "Demo · Nước rửa chén Sunlight 750ml (thùng 12)", OrganizationID: dataOrgId, CategoryID: catFmcg._id, Unit: "Thùng", WeightPerCase: 9.0, VolumePerCase: 0.012, ItemsPerCase: 12, Price: 216000, Status: "Active" },
    { ProductCode: `${DEMO_PREFIX}P-FMC-002`, XName: "Demo · Bột giặt OMO 3kg (thùng 6)",           OrganizationID: dataOrgId, CategoryID: catFmcg._id, Unit: "Thùng", WeightPerCase: 18.0, VolumePerCase: 0.030, ItemsPerCase:  6, Price: 486000, Status: "Active" }
  ]);

  /* ── Vehicles ── */
  await Vehicle.insertMany([
    { VehicleCode: `${DEMO_PREFIX}XE-001`, XName: "Demo · Hino 500 5 tấn",   OrganizationID: dataOrgId, LicensePlate: "30F-123.01", VehicleType: "TRUCK", Capabilities: ["DRY", "FOOD"],            MaxWeight: 5000, MaxVolume: 30, MaxCases: 300, FixedCost: 700000, CostPerKm: 14000, AvgSpeedKmh: 28, LoadingTime: 40, UnloadingTimePerStop: 30, Status: "Active" },
    { VehicleCode: `${DEMO_PREFIX}XE-002`, XName: "Demo · Hino 300 3.5 tấn", OrganizationID: dataOrgId, LicensePlate: "30F-234.02", VehicleType: "TRUCK", Capabilities: ["DRY", "FOOD", "CHEMICAL"], MaxWeight: 3500, MaxVolume: 20, MaxCases: 200, FixedCost: 500000, CostPerKm: 11000, AvgSpeedKmh: 30, LoadingTime: 35, UnloadingTimePerStop: 25, Status: "Active" },
    { VehicleCode: `${DEMO_PREFIX}XE-003`, XName: "Demo · JAC X240 2.4 tấn", OrganizationID: dataOrgId, LicensePlate: "30F-345.03", VehicleType: "TRUCK", Capabilities: ["DRY"],                    MaxWeight: 2400, MaxVolume: 14, MaxCases: 140, FixedCost: 380000, CostPerKm:  9000, AvgSpeedKmh: 30, LoadingTime: 30, UnloadingTimePerStop: 25, Status: "Active" }
  ]);

  await Driver.insertMany([
    { DriverCode: `${DEMO_PREFIX}TX-001`, XName: "Demo · Lê Văn Nam",       OrganizationID: dataOrgId, Phone: "0988 300 001", Email: "demo.driver01@road-freight.io", LicenseNumber: "030C-DEMO001", LicenseType: "C",  LicenseExpiry: new Date("2028-09-30"), LinkedUserID: driverUser01._id, Status: "Active" },
    { DriverCode: `${DEMO_PREFIX}TX-002`, XName: "Demo · Nguyễn Văn Phúc",  OrganizationID: dataOrgId, Phone: "0988 300 002", Email: "demo.driver02@road-freight.io", LicenseNumber: "030C-DEMO002", LicenseType: "C",  LicenseExpiry: new Date("2028-11-15"), LinkedUserID: driverUser02._id, Status: "Active" },
    { DriverCode: `${DEMO_PREFIX}TX-003`, XName: "Demo · Đỗ Đức Long",      OrganizationID: dataOrgId, Phone: "0988 300 003", Email: "demo.driver03@road-freight.io", LicenseNumber: "030B2-DEMO003", LicenseType: "B2", LicenseExpiry: new Date("2027-12-20"), LinkedUserID: driverUser03._id, Status: "Active" }
  ]);

  /* ── 3PL Services ── */
  await Service.insertMany([
    { ServiceCode: `${DEMO_PREFIX}3PL-GHN`, XName: "Demo · Giao Hàng Nhanh — FTL nội thành", OrganizationID: dataOrgId, Carrier: "Giao Hàng Nhanh", ServiceType: "FTL",     FlatRate: 800000, PricePerKm: 0,     MinCharge: 800000, FuelSurchargePercent: 0, Status: "Active" },
    { ServiceCode: `${DEMO_PREFIX}3PL-GHE`, XName: "Demo · Giao Hàng Express — ghép hàng",   OrganizationID: dataOrgId, Carrier: "GHE Logistics",   ServiceType: "EXPRESS", FlatRate: 0,       PricePerKm: 16000, MinCharge: 200000, FuelSurchargePercent: 5, Status: "Active" }
  ]);

  /* ── Customers (12 điểm Hà Nội · Bắc Ninh · Hưng Yên với tọa độ thật) ── */
  await CustomerGroup.insertMany([
    { GroupCode: `${DEMO_PREFIX}CG-SMT`, XName: "Demo · Siêu thị", OrganizationID: dataOrgId, Description: "Chuỗi siêu thị, trung tâm thương mại", Status: "Active" },
    { GroupCode: `${DEMO_PREFIX}CG-RTL`, XName: "Demo · Bán lẻ",   OrganizationID: dataOrgId, Description: "Cửa hàng bán lẻ", Status: "Active" },
    { GroupCode: `${DEMO_PREFIX}CG-DLY`, XName: "Demo · Đại lý",   OrganizationID: dataOrgId, Description: "Đại lý và nhà phân phối", Status: "Active" },
    { GroupCode: `${DEMO_PREFIX}CG-WH`,  XName: "Demo · Kho",      OrganizationID: dataOrgId, Description: "Điểm giao nhận dạng kho", Status: "Active" }
  ]);

  const customers = await Customer.insertMany([
    { CustomerCode: `${DEMO_PREFIX}KH-01`, XName: "Demo · AEON Mall Long Biên",        OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-SMT`, Address: "27 Cổ Linh, Long Biên, Hà Nội",        Latitude: 21.0366, Longitude: 105.9102, Phone: "024 6263 1001", OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 30, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-02`, XName: "Demo · BigC Thăng Long",            OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-SMT`, Address: "222 Trần Duy Hưng, Cầu Giấy, Hà Nội", Latitude: 21.0063, Longitude: 105.7977, Phone: "024 3784 2002", OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 30, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-03`, XName: "Demo · Vincom Royal City",          OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-SMT`, Address: "72A Nguyễn Trãi, Thanh Xuân, Hà Nội", Latitude: 20.9986, Longitude: 105.8298, Phone: "024 3974 3003", OpenTime: "09:30", CloseTime: "22:00", ServiceTime: 25, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-04`, XName: "Demo · Go! Gia Lâm",                OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-SMT`, Address: "QL5, Gia Lâm, Hà Nội",                 Latitude: 21.0437, Longitude: 105.9252, Phone: "024 3827 4004", OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 25, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-05`, XName: "Demo · Lotte Mart Hà Đông",        OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-SMT`, Address: "Tố Hữu, Hà Đông, Hà Nội",              Latitude: 20.9680, Longitude: 105.7764, Phone: "024 6255 5005", OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 25, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-06`, XName: "Demo · Winmart Tây Hồ",            OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-RTL`, Address: "Xuân La, Tây Hồ, Hà Nội",              Latitude: 21.0721, Longitude: 105.8227, Phone: "024 3718 6006", OpenTime: "07:00", CloseTime: "22:00", ServiceTime: 15, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-07`, XName: "Demo · Đại Lý Hoàng Giang",        OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-DLY`, Address: "Minh Khai, Nam Từ Liêm, Hà Nội",       Latitude: 21.0185, Longitude: 105.7701, Phone: "024 3561 7007", OpenTime: "07:00", CloseTime: "18:00", ServiceTime: 20, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-08`, XName: "Demo · Đại Lý Sơn Nam",            OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-DLY`, Address: "Lĩnh Nam, Hoàng Mai, Hà Nội",          Latitude: 20.9712, Longitude: 105.8680, Phone: "024 3641 8008", OpenTime: "07:00", CloseTime: "18:00", ServiceTime: 20, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-09`, XName: "Demo · Co.opmart Hà Đông",         OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-SMT`, Address: "Quang Trung, Hà Đông, Hà Nội",         Latitude: 20.9630, Longitude: 105.7823, Phone: "024 3382 9009", OpenTime: "08:00", CloseTime: "21:30", ServiceTime: 20, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-10`, XName: "Demo · Kho Tiên Sơn Bắc Ninh",     OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-WH`, Address: "KCN Tiên Sơn, Từ Sơn, Bắc Ninh",       Latitude: 21.1378, Longitude: 106.0762, Phone: "0222 363 1010", OpenTime: "07:00", CloseTime: "17:00", ServiceTime: 35, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-11`, XName: "Demo · Đại Lý Thắng Lợi Bắc Ninh", OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-DLY`, Address: "QL1, Yên Phong, Bắc Ninh",             Latitude: 21.1002, Longitude: 105.9847, Phone: "0222 377 1111", OpenTime: "07:30", CloseTime: "17:30", ServiceTime: 20, Status: "Active" },
    { CustomerCode: `${DEMO_PREFIX}KH-12`, XName: "Demo · Kho Phố Nối Hưng Yên",      OrganizationID: dataOrgId, CustomerGroup: `${DEMO_PREFIX}CG-WH`, Address: "KCN Phố Nối A, Mỹ Hào, Hưng Yên",      Latitude: 20.9622, Longitude: 106.0650, Phone: "0221 394 1212", OpenTime: "06:00", CloseTime: "18:00", ServiceTime: 40, Status: "Active" }
  ]);

  /* ── Orders (20 đơn PENDING — sẵn sàng lập lộ trình) ── */
  const custCodes = customers.map((c) => c.CustomerCode);
  const priceByCode = Object.fromEntries(products.map((p) => [p.ProductCode, p.Price ?? 0]));
  const calcTotal = (items) => items.reduce((s, it) => s + (priceByCode[it.ProductCode] ?? 0) * (it.NumberOfCases ?? 0), 0);
  const today = daysFromNow(0);
  const tomorrow = daysFromNow(1);

  const orders = [];
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
      OrganizationID: dataOrgId,
      CustomerCode:   cCode,
      OrderDate:      today,
      TypeWay:        "FIRST_WAY",
      TimeWindow:     "",
      ServiceTime:    0,
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
      OrganizationID: dataOrgId,
      CustomerCode:   cCode,
      OrderDate:      tomorrow,
      TypeWay:        "FIRST_WAY",
      TimeWindow:     "",
      ServiceTime:    0,
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
      branch: { _id: branchOrg._id, XCode: branchOrg.XCode, XName: branchOrg.XName },
      depot:  { _id: depotOrg._id, XCode: depotOrg.XCode, XName: depotOrg.XName },
      groups: [],
      counts: { orgGroups: 0, roleGroups: 3, users: 6, drivers: 3, customerGroups: 4, categories: 3, customers: 12, products: 8, vehicles: 3, services: 2, orders: 20 }
    }
  });
}

export async function clearDemo(req, res) {
  assertDemoAccess(req);
  const orgId = getUserOrgId(req);
  const counts = await clearDemoFromOrg(orgId);
  res.json({ success: true, message: "Đã xóa toàn bộ dữ liệu demo khỏi tổ chức của bạn", data: { counts } });
}

export async function demoStatus(req, res) {
  assertDemoAccess(req);
  const orgId = getUserOrgId(req);
  const re = new RegExp("^" + DEMO_PREFIX);
  const orgIds = await collectOrgSubtreeIds(orgId);
  const filter = { OrganizationID: { $in: orgIds } };
  const [roleGroups, users, drivers, customerGroups, customers, products, vehicles, orders, services, categories] = await Promise.all([
    RoleGroup.countDocuments({ XCode: re }),
    User.countDocuments({
      $or: [
        { XCode: re },
        { UserName: /^demo\./ },
        { Email: /^demo\..+@road-freight\.io$/ }
      ]
    }),
    Driver.countDocuments({ ...filter, DriverCode: re }),
    CustomerGroup.countDocuments({ ...filter, GroupCode: re }),
    Customer.countDocuments({ ...filter, CustomerCode: re }),
    Product.countDocuments({ ...filter, ProductCode: re }),
    Vehicle.countDocuments({ ...filter, VehicleCode: re }),
    SalesOrder.countDocuments({ ...filter, OrderCode: re }),
    Service.countDocuments({ ...filter, ServiceCode: re }),
    ProductCategory.countDocuments({ ...filter, CategoryCode: re })
  ]);
  const exists = roleGroups + users + drivers + customerGroups + customers + products + vehicles + orders + services + categories > 0;
  res.json({
    success: true,
    exists,
    counts: { roleGroups, users, drivers, customerGroups, categories, customers, products, vehicles, services, orders }
  });
}
