import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { Organization, OrgType } from "../models/Organization.js";
import { RoleGroup, RoleGroupKind } from "../models/RoleGroup.js";
import { User, UserStatus } from "../models/User.js";
import { Customer, CustomerGroup } from "../models/CustomerGroup.js";
import { Customer as CustomerModel } from "../models/Customer.js";
import { Product } from "../models/Product.js";
import { Vehicle } from "../models/Vehicle.js";
import { Driver } from "../models/Driver.js";
import { Service } from "../models/Service.js";
import { SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus } from "../models/SalesOrder.js";
import {
  ADMIN_TEMPLATE_PERMISSIONS,
  DISPATCHER_TEMPLATE_PERMISSIONS,
  DELIVERER_TEMPLATE_PERMISSIONS,
  adminRoleCodeFor
} from "../config/permissions.js";
import { logger } from "../utils/logger.js";

/* ── helpers ── */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8, 0, 0, 0);
  return d;
}
function order(code, custCode, orgId, daysBack, items, totalPrice, approval, orderStatus, planStatus, timeWindow = "08:00-17:00") {
  return {
    OrderCode: code,
    OrganizationID: orgId,
    CustomerCode: custCode,
    OrderDate: daysAgo(daysBack),
    TypeWay: "FIRST_WAY",
    TimeWindow: timeWindow,
    ServiceTime: 20,
    Items: items,
    TotalPrice: totalPrice,
    OrderStatus: orderStatus,
    ApprovalStatus: approval,
    PlanningStatus: planStatus,
    Source: "WEB",
    StatusHistory: [{ FromStatus: null, ToStatus: orderStatus, Note: "Khởi tạo", ChangedAt: daysAgo(daysBack) }]
  };
}

async function clear() {
  await Promise.all([
    User.deleteMany({}),
    RoleGroup.deleteMany({}),
    Organization.deleteMany({}),
    mongoose.connection.collection("customers").deleteMany({}),
    mongoose.connection.collection("customergroups").deleteMany({}),
    Product.deleteMany({}),
    Vehicle.deleteMany({}),
    Driver.deleteMany({}),
    Service.deleteMany({}),
    SalesOrder.deleteMany({}),
    mongoose.connection.collection("routeplans").deleteMany({}),
    mongoose.connection.collection("deliveryroutes").deleteMany({}),
    mongoose.connection.collection("ordertripallocations").deleteMany({})
  ]);
}

async function seed() {
  await connectDatabase();
  await clear();

  /* ══════════════════════════════════════════
     SUPER ADMIN
  ══════════════════════════════════════════ */
  const superAdmin = await User.create({
    UserName: "superadmin",
    FullName: "Super Administrator",
    Email: "superadmin@road-freight.io",
    PasswordHash: await User.hashPassword("Admin@123"),
    OrganizationIDs: [],
    RoleGroupID: null,
    IsSuperAdmin: true,
    IsActive: true,
    Status: UserStatus.ACTIVE,
    EmailVerifiedAt: new Date()
  });

  /* ══════════════════════════════════════════
     CÔNG TY: Phú Thịnh Logistics
  ══════════════════════════════════════════ */
  const org = await Organization.create({
    XCode: "PTL",
    XName: "Công ty CP Vận Tải & Logistics Phú Thịnh",
    Address: "Số 45 Nguyễn Chí Thanh, Đống Đa, Hà Nội",
    Status: "Active",
    OrgType: OrgType.MANUFACTURER,
    Country: "VN",
    Currency: "VND",
    TimeZone: "Asia/Ho_Chi_Minh",
    Parent: null,
    Path: [],
    CreatedBy: superAdmin._id
  });

  /* ── Nhóm vai trò ── */
  const adminGroup = await RoleGroup.create({
    XCode: adminRoleCodeFor(org.XCode),
    XName: "Quản trị (PTL)",
    Kind: RoleGroupKind.ADMIN,
    Permissions: [...ADMIN_TEMPLATE_PERMISSIONS],
    OrganizationID: org._id,
    Configurations: { SeeChildren: true },
    IsSystem: true
  });
  const plannerGroup = await RoleGroup.create({
    XCode: "PTL-DISPATCHER",
    XName: "Điều phối vận chuyển",
    Kind: RoleGroupKind.NORMAL,
    Permissions: [...DISPATCHER_TEMPLATE_PERMISSIONS],
    OrganizationID: org._id,
    Configurations: { SeeChildren: false }
  });
  const driverGroup = await RoleGroup.create({
    XCode: "PTL-DRIVER",
    XName: "Tài xế",
    Kind: RoleGroupKind.NORMAL,
    Permissions: [...DELIVERER_TEMPLATE_PERMISSIONS],
    OrganizationID: org._id,
    Configurations: { SeeChildren: false }
  });

  /* ── Nhân viên ── */
  const adminUser = await User.create({
    XCode: "EMP-001",
    UserName: "hung.nguyen",
    FullName: "Nguyễn Văn Hưng",
    Email: "admin@road-freight.io",
    PasswordHash: await User.hashPassword("Pass@123"),
    OrganizationIDs: [org._id],
    RoleGroupID: adminGroup._id,
    IsActive: true,
    Status: UserStatus.ACTIVE,
    EmailVerifiedAt: new Date()
  });
  await User.create({
    XCode: "EMP-002",
    UserName: "hong.le",
    FullName: "Lê Thị Hồng",
    Email: "planner@road-freight.io",
    PasswordHash: await User.hashPassword("Pass@123"),
    OrganizationIDs: [org._id],
    RoleGroupID: plannerGroup._id,
    IsActive: true,
    Status: UserStatus.ACTIVE,
    EmailVerifiedAt: new Date()
  });
  const driverUser = await User.create({
    XCode: "EMP-003",
    UserName: "dung.tran",
    FullName: "Trần Văn Dũng",
    Email: "driver01@road-freight.io",
    PasswordHash: await User.hashPassword("Pass@123"),
    OrganizationIDs: [org._id],
    RoleGroupID: driverGroup._id,
    IsActive: true,
    Status: UserStatus.ACTIVE,
    EmailVerifiedAt: new Date()
  });

  org.CreatedBy = adminUser._id;
  await org.save();

  /* ══════════════════════════════════════════
     NHÓM KHÁCH HÀNG
  ══════════════════════════════════════════ */
  await mongoose.connection.collection("customergroups").insertMany([
    { GroupCode: "CG-RETAIL", XName: "Siêu thị & Bán lẻ", OrganizationID: org._id, Description: "Chuỗi siêu thị, cửa hàng tiện lợi", Status: "Active" },
    { GroupCode: "CG-DIST",   XName: "Nhà phân phối",     OrganizationID: org._id, Description: "Đại lý cấp 1, nhà phân phối", Status: "Active" },
    { GroupCode: "CG-STORE",  XName: "Kho hàng",          OrganizationID: org._id, Description: "Kho trung chuyển, kho ngoại quan", Status: "Active" }
  ]);

  /* ══════════════════════════════════════════
     KHÁCH HÀNG
  ══════════════════════════════════════════ */
  await mongoose.connection.collection("customers").insertMany([
    { CustomerCode: "KH-001", XName: "MM Mega Market Hoàng Mai",       OrganizationID: org._id, CustomerGroup: "CG-RETAIL", Address: "7A Nguyễn Tam Trinh, Hoàng Mai, Hà Nội",      Latitude: 20.9803, Longitude: 105.8434, Phone: "024 3868 1234", Email: "mm.hoangmai@bigc.vn",    OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 30, Status: "Active" },
    { CustomerCode: "KH-002", XName: "Vinmart+ Cầu Giấy",              OrganizationID: org._id, CustomerGroup: "CG-RETAIL", Address: "284 Đội Cấn, Cầu Giấy, Hà Nội",              Latitude: 21.0378, Longitude: 105.8012, Phone: "024 3765 4321", Email: "vinmart.caugiay@masan.vn", OpenTime: "07:00", CloseTime: "22:00", ServiceTime: 20, Status: "Active" },
    { CustomerCode: "KH-003", XName: "Co.opmart Hà Đông",              OrganizationID: org._id, CustomerGroup: "CG-RETAIL", Address: "Số 1 Quang Trung, Hà Đông, Hà Nội",           Latitude: 20.9612, Longitude: 105.7823, Phone: "024 3352 8888", Email: "coop.hadong@saigoncoop.vn",OpenTime: "08:00", CloseTime: "21:30", ServiceTime: 25, Status: "Active" },
    { CustomerCode: "KH-004", XName: "Lotte Mart Tây Hồ",              OrganizationID: org._id, CustomerGroup: "CG-RETAIL", Address: "Đường Xuân La, Tây Hồ, Hà Nội",               Latitude: 21.0823, Longitude: 105.8212, Phone: "024 3718 6789", Email: "lotte.tayho@lotte.vn",     OpenTime: "09:00", CloseTime: "22:00", ServiceTime: 30, Status: "Active" },
    { CustomerCode: "KH-005", XName: "Bách Hóa Xanh Đống Đa",         OrganizationID: org._id, CustomerGroup: "CG-RETAIL", Address: "87 Nguyễn Lương Bằng, Đống Đa, Hà Nội",       Latitude: 21.0189, Longitude: 105.8423, Phone: "024 3556 2222", Email: "bhx.dongda@mwg.vn",       OpenTime: "07:30", CloseTime: "22:00", ServiceTime: 15, Status: "Active" },
    { CustomerCode: "KH-006", XName: "Đại Lý Thành Đạt",              OrganizationID: org._id, CustomerGroup: "CG-DIST",   Address: "56 Minh Khai, Hai Bà Trưng, Hà Nội",          Latitude: 21.0023, Longitude: 105.8634, Phone: "024 3623 9999", Email: "daily.thanhddat@gmail.com", OpenTime: "08:00", CloseTime: "18:00", ServiceTime: 20, Status: "Active" },
    { CustomerCode: "KH-007", XName: "Nhà Phân Phối Hùng Cường",      OrganizationID: org._id, CustomerGroup: "CG-DIST",   Address: "201 Nguyễn Văn Cừ, Long Biên, Hà Nội",        Latitude: 21.0423, Longitude: 105.8912, Phone: "024 3879 1111", Email: "pp.hungcuong@gmail.com",   OpenTime: "07:00", CloseTime: "17:00", ServiceTime: 25, Status: "Active" },
    { CustomerCode: "KH-008", XName: "Kho Hàng Gia Lâm (Trung chuyển)", OrganizationID: org._id, CustomerGroup: "CG-STORE", Address: "Km 9 Quốc lộ 5, Gia Lâm, Hà Nội",          Latitude: 21.0112, Longitude: 105.9234, Phone: "024 3827 5555", Email: "kho.gialap@phuoc.vn",      OpenTime: "06:00", CloseTime: "20:00", ServiceTime: 40, Status: "Active" }
  ]);

  /* ══════════════════════════════════════════
     SẢN PHẨM
  ══════════════════════════════════════════ */
  await Product.insertMany([
    { ProductCode: "SP-001", XName: "Nước lọc Aquafina 500ml",     OrganizationID: org._id, Category: "Đồ uống",    Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.012, ItemsPerCase: 24, Price:  96000, Status: "Active" },
    { ProductCode: "SP-002", XName: "Sữa tươi Vinamilk 1L",        OrganizationID: org._id, Category: "Sữa",        Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.015, ItemsPerCase: 12, Price: 240000, Status: "Active" },
    { ProductCode: "SP-003", XName: "Mì Hảo Hảo tôm chua cay",    OrganizationID: org._id, Category: "Thực phẩm",  Unit: "Thùng", WeightPerCase:  7.5, VolumePerCase: 0.025, ItemsPerCase: 30, Price:  75000, Status: "Active" },
    { ProductCode: "SP-004", XName: "Dầu ăn Neptune 1L",           OrganizationID: org._id, Category: "Thực phẩm",  Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.014, ItemsPerCase: 12, Price: 360000, Status: "Active" },
    { ProductCode: "SP-005", XName: "Gạo ST25 túi 5kg",            OrganizationID: org._id, Category: "Lương thực", Unit: "Thùng", WeightPerCase: 50.0, VolumePerCase: 0.050, ItemsPerCase: 10, Price: 750000, Status: "Active" },
    { ProductCode: "SP-006", XName: "Nước tăng lực Sting 330ml",   OrganizationID: org._id, Category: "Đồ uống",    Unit: "Thùng", WeightPerCase:  8.0, VolumePerCase: 0.009, ItemsPerCase: 24, Price: 168000, Status: "Active" },
    { ProductCode: "SP-007", XName: "Bánh quy AFC Original 100g",  OrganizationID: org._id, Category: "Bánh kẹo",   Unit: "Thùng", WeightPerCase:  3.6, VolumePerCase: 0.018, ItemsPerCase: 36, Price: 252000, Status: "Active" }
  ]);

  /* ══════════════════════════════════════════
     XE TẢI
  ══════════════════════════════════════════ */
  await Vehicle.insertMany([
    { VehicleCode: "XE-001", XName: "Hino 500 5 tấn",     OrganizationID: org._id, LicensePlate: "30F-123.45", VehicleType: "TRUCK", MaxWeight: 5000, MaxVolume: 30, MaxCases: 300, FixedCost: 700000, CostPerKm: 14000, Status: "Active" },
    { VehicleCode: "XE-002", XName: "Hino 300 3.5 tấn",   OrganizationID: org._id, LicensePlate: "30F-234.56", VehicleType: "TRUCK", MaxWeight: 3500, MaxVolume: 20, MaxCases: 200, FixedCost: 500000, CostPerKm: 11000, Status: "Active" },
    { VehicleCode: "XE-003", XName: "Ford Transit Cargo",  OrganizationID: org._id, LicensePlate: "30A-345.67", VehicleType: "VAN",   MaxWeight: 1200, MaxVolume:  8, MaxCases:  80, FixedCost: 280000, CostPerKm:  7000, Status: "Active" },
    { VehicleCode: "XE-004", XName: "JAC X240 2.4 tấn",   OrganizationID: org._id, LicensePlate: "30F-456.78", VehicleType: "TRUCK", MaxWeight: 2400, MaxVolume: 14, MaxCases: 140, FixedCost: 380000, CostPerKm:  9000, Status: "Active" },
    { VehicleCode: "XE-005", XName: "Isuzu QKR55 2.5 tấn",OrganizationID: org._id, LicensePlate: "30F-567.89", VehicleType: "TRUCK", MaxWeight: 2500, MaxVolume: 16, MaxCases: 160, FixedCost: 420000, CostPerKm: 10000, Status: "Active" }
  ]);

  /* ══════════════════════════════════════════
     TÀI XẾ
  ══════════════════════════════════════════ */
  await Driver.insertMany([
    { DriverCode: "TX-001", XName: "Trần Văn Dũng",   OrganizationID: org._id, Phone: "0912 111 001", Email: "dung.tran@ptl.vn",  LicenseNumber: "028B1-00111", LicenseType: "C",  LicenseExpiry: new Date("2028-03-15"), LinkedUserID: driverUser._id, Status: "Active" },
    { DriverCode: "TX-002", XName: "Phạm Văn Tú",     OrganizationID: org._id, Phone: "0912 111 002", Email: "tu.pham@ptl.vn",    LicenseNumber: "028C-00222",  LicenseType: "C",  LicenseExpiry: new Date("2027-08-20"), Status: "Active" },
    { DriverCode: "TX-003", XName: "Nguyễn Đức Hải",  OrganizationID: org._id, Phone: "0912 111 003", Email: "hai.nguyen@ptl.vn", LicenseNumber: "028B2-00333", LicenseType: "B2", LicenseExpiry: new Date("2026-12-31"), Status: "Active" },
    { DriverCode: "TX-004", XName: "Lê Quang Minh",   OrganizationID: org._id, Phone: "0912 111 004", Email: "minh.le@ptl.vn",   LicenseNumber: "028C-00444",  LicenseType: "C",  LicenseExpiry: new Date("2027-05-10"), Status: "Active" }
  ]);

  /* ══════════════════════════════════════════
     DỊCH VỤ
  ══════════════════════════════════════════ */
  await Service.insertMany([
    { ServiceCode: "DV-001", XName: "Giao hàng thường",        OrganizationID: org._id, ServiceType: "DELIVERY", Price:  50000, Description: "Giao hàng trong ngày, nội thành Hà Nội",   Status: "Active" },
    { ServiceCode: "DV-002", XName: "Giao hàng nhanh",         OrganizationID: org._id, ServiceType: "EXPRESS",  Price: 120000, Description: "Giao trong 4 giờ, ưu tiên xử lý",           Status: "Active" },
    { ServiceCode: "DV-003", XName: "Thu hồi hàng trả về",     OrganizationID: org._id, ServiceType: "PICKUP",   Price:  80000, Description: "Thu hàng không đạt, hàng trả lại kho",       Status: "Active" },
    { ServiceCode: "DV-004", XName: "Lưu kho ngắn hạn",        OrganizationID: org._id, ServiceType: "STORAGE",  Price: 200000, Description: "Phí lưu kho, tính theo pallet/ngày",         Status: "Active" }
  ]);

  /* ══════════════════════════════════════════
     ĐƠN HÀNG — Trải 8 ngày, đủ mọi trạng thái
  ══════════════════════════════════════════ */
  const O = org._id;
  const APPR = ApprovalStatus.APPROVED;
  const PEND = ApprovalStatus.PENDING;
  const REJT = ApprovalStatus.REJECTED;

  await SalesOrder.insertMany([
    /* ─ 7 ngày trước: DELIVERED ─ */
    order("ORD-20250502-001","KH-001",O,7,[{ProductCode:"SP-001",NumberOfCases:20},{ProductCode:"SP-003",NumberOfCases:10}], 2_670_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED, "08:00-12:00"),
    order("ORD-20250502-002","KH-006",O,7,[{ProductCode:"SP-005",NumberOfCases:15}],                                          1_125_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED, "08:00-17:00"),

    /* ─ 6 ngày trước: DELIVERED ─ */
    order("ORD-20250503-001","KH-002",O,6,[{ProductCode:"SP-002",NumberOfCases:8},{ProductCode:"SP-004",NumberOfCases:5}],  3_720_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED, "09:00-14:00"),
    order("ORD-20250503-002","KH-007",O,6,[{ProductCode:"SP-001",NumberOfCases:30},{ProductCode:"SP-006",NumberOfCases:12}],3_936_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED, "13:00-18:00"),

    /* ─ 5 ngày trước: DELIVERED ─ */
    order("ORD-20250504-001","KH-003",O,5,[{ProductCode:"SP-003",NumberOfCases:20},{ProductCode:"SP-007",NumberOfCases:10}],4_020_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED, "08:00-12:00"),
    order("ORD-20250504-002","KH-008",O,5,[{ProductCode:"SP-005",NumberOfCases:25}],                                          1_875_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED, "07:00-12:00"),

    /* ─ 4 ngày trước: DELIVERED ─ */
    order("ORD-20250505-001","KH-004",O,4,[{ProductCode:"SP-002",NumberOfCases:10},{ProductCode:"SP-006",NumberOfCases:15}],4_920_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED, "09:00-18:00"),
    order("ORD-20250505-002","KH-005",O,4,[{ProductCode:"SP-001",NumberOfCases:25},{ProductCode:"SP-004",NumberOfCases:6}], 4_560_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED, "08:00-14:00"),

    /* ─ 3 ngày trước: SHIPPED (đang giao) ─ */
    order("ORD-20250506-001","KH-001",O,3,[{ProductCode:"SP-002",NumberOfCases:6},{ProductCode:"SP-003",NumberOfCases:15}], 2_565_000, APPR, OrderStatus.SHIPPED, PlanningStatus.LOCKED, "08:00-12:00"),
    order("ORD-20250506-002","KH-006",O,3,[{ProductCode:"SP-005",NumberOfCases:20}],                                          1_500_000, APPR, OrderStatus.SHIPPED, PlanningStatus.LOCKED, "08:00-17:00"),

    /* ─ 2 ngày trước: PICKED_PACKED ─ */
    order("ORD-20250507-001","KH-007",O,2,[{ProductCode:"SP-001",NumberOfCases:40},{ProductCode:"SP-007",NumberOfCases:8}], 5_856_000, APPR, OrderStatus.PICKED_PACKED, PlanningStatus.LOCKED, "07:00-12:00"),
    order("ORD-20250507-002","KH-003",O,2,[{ProductCode:"SP-006",NumberOfCases:20},{ProductCode:"SP-004",NumberOfCases:4}], 4_800_000, APPR, OrderStatus.PICKED_PACKED, PlanningStatus.LOCKED, "13:00-18:00"),

    /* ─ Bị từ chối ─ */
    order("ORD-20250507-003","KH-002",O,2,[{ProductCode:"SP-005",NumberOfCases:5}],                                             375_000, REJT, OrderStatus.REJECTED,     PlanningStatus.PENDING, "08:00-17:00"),

    /* ─ Hôm nay: APPROVED — sẵn sàng lên kế hoạch ─ */
    order("ORD-20250509-001","KH-001",O,0,[{ProductCode:"SP-001",NumberOfCases:30},{ProductCode:"SP-002",NumberOfCases:5}],  4_080_000, APPR, OrderStatus.OPEN, PlanningStatus.PENDING, "08:00-12:00"),
    order("ORD-20250509-002","KH-002",O,0,[{ProductCode:"SP-003",NumberOfCases:25},{ProductCode:"SP-006",NumberOfCases:10}], 3_555_000, APPR, OrderStatus.OPEN, PlanningStatus.PENDING, "13:00-17:00"),
    order("ORD-20250509-003","KH-004",O,0,[{ProductCode:"SP-004",NumberOfCases:8},{ProductCode:"SP-007",NumberOfCases:15}],  6_660_000, APPR, OrderStatus.OPEN, PlanningStatus.PENDING, "08:00-17:00"),
    order("ORD-20250509-004","KH-005",O,0,[{ProductCode:"SP-001",NumberOfCases:50}],                                           4_800_000, APPR, OrderStatus.OPEN, PlanningStatus.PENDING, "09:00-14:00"),
    order("ORD-20250509-005","KH-008",O,0,[{ProductCode:"SP-005",NumberOfCases:30}],                                           2_250_000, APPR, OrderStatus.OPEN, PlanningStatus.PENDING, "06:00-11:00"),

    /* ─ Hôm nay: PENDING — chờ phê duyệt ─ */
    order("ORD-20250509-006","KH-003",O,0,[{ProductCode:"SP-002",NumberOfCases:12},{ProductCode:"SP-003",NumberOfCases:20}], 4_380_000, PEND, OrderStatus.OPEN, PlanningStatus.PENDING, "08:00-17:00"),
    order("ORD-20250509-007","KH-006",O,0,[{ProductCode:"SP-006",NumberOfCases:30},{ProductCode:"SP-004",NumberOfCases:3}],  6_120_000, PEND, OrderStatus.OPEN, PlanningStatus.PENDING, "08:00-18:00"),
    order("ORD-20250509-008","KH-007",O,0,[{ProductCode:"SP-005",NumberOfCases:10}],                                             750_000, PEND, OrderStatus.OPEN, PlanningStatus.PENDING, "08:00-17:00")
  ]);

  /* ══════════════════════════════════════════
     IN THÔNG TIN
  ══════════════════════════════════════════ */
  logger.info("═══════════════════════════════════════════════════");
  logger.info("  SEED HOÀN TẤT — Phú Thịnh Logistics (PTL)");
  logger.info("═══════════════════════════════════════════════════");
  logger.info("  Tài khoản hệ thống:");
  logger.info("    superadmin@road-freight.io  / Admin@123  → SuperAdmin");
  logger.info("    admin@road-freight.io        / Pass@123  → Quản trị");
  logger.info("    planner@road-freight.io      / Pass@123  → Điều phối");
  logger.info("    driver01@road-freight.io     / Pass@123  → Tài xế");
  logger.info("───────────────────────────────────────────────────");
  logger.info("  Master data:");
  logger.info("    8 khách hàng, 7 sản phẩm, 5 xe, 4 tài xế, 4 dịch vụ");
  logger.info("  Đơn hàng (21 đơn, trải 8 ngày):");
  logger.info("    8 đơn DELIVERED, 2 SHIPPED, 2 PICKED_PACKED");
  logger.info("    5 APPROVED chờ lên kế hoạch, 3 PENDING duyệt, 1 REJECTED");
  logger.info("═══════════════════════════════════════════════════");
}

seed()
  .catch((err) => {
    logger.error("Seed thất bại:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
    await mongoose.connection.close();
  });
