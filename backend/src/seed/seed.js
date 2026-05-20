import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { Organization, OrgType } from "../models/Organization.js";
import { RoleGroup, RoleGroupKind } from "../models/RoleGroup.js";
import { User, UserStatus, FunctionRole } from "../models/User.js";
import { CustomerGroup } from "../models/CustomerGroup.js";
import { Customer } from "../models/Customer.js";
import { ProductCategory } from "../models/ProductCategory.js";
import { Product } from "../models/Product.js";
import { Vehicle } from "../models/Vehicle.js";
import { Driver } from "../models/Driver.js";
import { Service } from "../models/Service.js";
import { SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus } from "../models/SalesOrder.js";
import {
  ADMIN_TEMPLATE_PERMISSIONS,
  DISPATCHER_TEMPLATE_PERMISSIONS,
  DELIVERER_TEMPLATE_PERMISSIONS,
  adminRoleCodeFor,
  p,
  Modules,
  Actions
} from "../config/permissions.js";
import { logger } from "../utils/logger.js";

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8, 0, 0, 0);
  return d;
}

function order(code, customerCode, depotId, daysBack, items, totalPrice, approval, orderStatus, planningStatus) {
  return {
    OrderCode: code,
    OrganizationID: depotId,
    CustomerCode: customerCode,
    OrderDate: daysAgo(daysBack),
    TypeWay: "FIRST_WAY",
    TimeWindow: "",
    ServiceTime: 0,
    Items: items,
    TotalPrice: totalPrice,
    OrderStatus: orderStatus,
    ApprovalStatus: approval,
    PlanningStatus: planningStatus,
    Source: "WEB",
    StatusHistory: [{ FromStatus: null, ToStatus: orderStatus, Note: "Khởi tạo", ChangedAt: daysAgo(daysBack) }]
  };
}

async function clear() {
  await Promise.all([
    User.deleteMany({}),
    RoleGroup.deleteMany({}),
    Organization.deleteMany({}),
    Customer.deleteMany({}),
    CustomerGroup.deleteMany({}),
    ProductCategory.deleteMany({}),
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

  const company = await Organization.create({
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

  const branch = await Organization.create({
    XCode: "PTL-CN-HN",
    XName: "Chi nhánh Hà Nội - Phú Thịnh",
    Address: "Số 45 Nguyễn Chí Thanh, Đống Đa, Hà Nội",
    Status: "Active",
    OrgType: OrgType.BRANCH,
    Parent: company._id,
    Path: [company._id],
    CreatedBy: superAdmin._id
  });

  const depot = await Organization.create({
    XCode: "PTL-KHO-HN",
    XName: "Kho Hà Nội - Phú Thịnh",
    Address: "Km 9 Quốc lộ 5, Gia Lâm, Hà Nội",
    Status: "Active",
    OrgType: OrgType.DEPOT,
    Parent: branch._id,
    Path: [company._id, branch._id],
    Latitude: 21.0112,
    Longitude: 105.9234,
    OpenTime: "06:00",
    CloseTime: "20:00",
    CreatedBy: superAdmin._id
  });

  const adminGroup = await RoleGroup.create({
    XCode: adminRoleCodeFor(company.XCode),
    XName: "Quản trị (PTL)",
    Kind: RoleGroupKind.ADMIN,
    Permissions: [...ADMIN_TEMPLATE_PERMISSIONS],
    OrganizationID: company._id,
    Configurations: { SeeChildren: true },
    IsSystem: true
  });
  const plannerGroup = await RoleGroup.create({
    XCode: "PTL-PLANNER-DISPATCHER",
    XName: "Planner & Dispatcher",
    Kind: RoleGroupKind.NORMAL,
    Permissions: [...DISPATCHER_TEMPLATE_PERMISSIONS],
    OrganizationID: depot._id,
    Configurations: { SeeChildren: true }
  });
  const accountantGroup = await RoleGroup.create({
    XCode: "PTL-ACCOUNTANT",
    XName: "Kế toán vận tải",
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
    OrganizationID: depot._id,
    Configurations: { SeeChildren: true }
  });
  const deliveryGroup = await RoleGroup.create({
    XCode: "PTL-DELIVERY",
    XName: "Delivery",
    Kind: RoleGroupKind.NORMAL,
    Permissions: [...DELIVERER_TEMPLATE_PERMISSIONS],
    OrganizationID: depot._id,
    Configurations: { SeeChildren: false }
  });

  const adminUser = await User.create({
    XCode: "EMP-001",
    UserName: "hung.nguyen",
    FullName: "Nguyễn Văn Hưng",
    Email: "admin@road-freight.io",
    PasswordHash: await User.hashPassword("Pass@123"),
    OrganizationIDs: [company._id, branch._id, depot._id],
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
    OrganizationIDs: [depot._id],
    RoleGroupID: plannerGroup._id,
    FunctionRoles: [FunctionRole.PLANNER_DISPATCHER, FunctionRole.PLANNER, FunctionRole.DISPATCHER],
    IsActive: true,
    Status: UserStatus.ACTIVE,
    EmailVerifiedAt: new Date()
  });
  await User.create({
    XCode: "EMP-004",
    UserName: "lan.pham",
    FullName: "Phạm Thị Lan",
    Email: "accountant@road-freight.io",
    Phone: "0912 111 010",
    PasswordHash: await User.hashPassword("Pass@123"),
    OrganizationIDs: [depot._id],
    RoleGroupID: accountantGroup._id,
    FunctionRoles: [FunctionRole.ACCOUNTANT],
    IsActive: true,
    Status: UserStatus.ACTIVE,
    EmailVerifiedAt: new Date()
  });
  const driverUsers = await User.insertMany([
    {
    XCode: "EMP-003",
    UserName: "dung.tran",
    FullName: "Trần Văn Dũng",
    Email: "driver01@road-freight.io",
      Phone: "0912 111 001",
      PasswordHash: await User.hashPassword("Pass@123"),
    OrganizationIDs: [depot._id],
    RoleGroupID: deliveryGroup._id,
      FunctionRoles: [FunctionRole.DRIVER],
      AllowedVehicleTypes: ["TRUCK"],
    IsActive: true,
    Status: UserStatus.ACTIVE,
    EmailVerifiedAt: new Date()
    },
    {
      XCode: "EMP-005",
      UserName: "tu.pham",
      FullName: "Phạm Văn Tú",
      Email: "driver02@road-freight.io",
      Phone: "0912 111 002",
      PasswordHash: await User.hashPassword("Pass@123"),
      OrganizationIDs: [depot._id],
      RoleGroupID: deliveryGroup._id,
      FunctionRoles: [FunctionRole.DRIVER],
      AllowedVehicleTypes: ["TRUCK"],
      IsActive: true,
      Status: UserStatus.ACTIVE,
      EmailVerifiedAt: new Date()
    },
    {
      XCode: "EMP-006",
      UserName: "hai.nguyen",
      FullName: "Nguyễn Đức Hải",
      Email: "driver03@road-freight.io",
      Phone: "0912 111 003",
      PasswordHash: await User.hashPassword("Pass@123"),
      OrganizationIDs: [depot._id],
      RoleGroupID: deliveryGroup._id,
      FunctionRoles: [FunctionRole.DRIVER],
      AllowedVehicleTypes: ["TRUCK"],
      IsActive: true,
      Status: UserStatus.ACTIVE,
      EmailVerifiedAt: new Date()
    }
  ]);

  company.CreatedBy = adminUser._id;
  branch.CreatedBy = adminUser._id;
  depot.CreatedBy = adminUser._id;
  await company.save();
  await branch.save();
  await depot.save();

  await CustomerGroup.insertMany([
    { GroupCode: "CG-RETAIL", XName: "Siêu thị & Bán lẻ", OrganizationID: depot._id, Description: "Chuỗi siêu thị, cửa hàng tiện lợi", Status: "Active" },
    { GroupCode: "CG-DIST", XName: "Nhà phân phối", OrganizationID: depot._id, Description: "Đại lý cấp 1, nhà phân phối", Status: "Active" },
    { GroupCode: "CG-WHOLESALE", XName: "Bán buôn", OrganizationID: depot._id, Description: "Khách mua số lượng lớn", Status: "Active" }
  ]);

  await Customer.insertMany([
    { CustomerCode: "KH-001", XName: "MM Mega Market Hoàng Mai", OrganizationID: depot._id, CustomerGroup: "CG-RETAIL", Address: "7A Nguyễn Tam Trinh, Hoàng Mai, Hà Nội", Latitude: 20.9803, Longitude: 105.8434, Phone: "024 3868 1234", Email: "mm.hoangmai@example.vn", OpenTime: "08:00", CloseTime: "22:00", ServiceTime: 30, Status: "Active" },
    { CustomerCode: "KH-002", XName: "WinMart Cầu Giấy", OrganizationID: depot._id, CustomerGroup: "CG-RETAIL", Address: "284 Đội Cấn, Cầu Giấy, Hà Nội", Latitude: 21.0378, Longitude: 105.8012, Phone: "024 3765 4321", Email: "winmart.caugiay@example.vn", OpenTime: "07:00", CloseTime: "22:00", ServiceTime: 20, Status: "Active" },
    { CustomerCode: "KH-003", XName: "Co.opmart Hà Đông", OrganizationID: depot._id, CustomerGroup: "CG-RETAIL", Address: "Số 1 Quang Trung, Hà Đông, Hà Nội", Latitude: 20.9612, Longitude: 105.7823, Phone: "024 3352 8888", Email: "coop.hadong@example.vn", OpenTime: "08:00", CloseTime: "21:30", ServiceTime: 25, Status: "Active" },
    { CustomerCode: "KH-004", XName: "Lotte Mart Tây Hồ", OrganizationID: depot._id, CustomerGroup: "CG-RETAIL", Address: "Đường Xuân La, Tây Hồ, Hà Nội", Latitude: 21.0823, Longitude: 105.8212, Phone: "024 3718 6789", Email: "lotte.tayho@example.vn", OpenTime: "09:00", CloseTime: "22:00", ServiceTime: 30, Status: "Active" },
    { CustomerCode: "KH-005", XName: "Bách Hóa Xanh Đống Đa", OrganizationID: depot._id, CustomerGroup: "CG-RETAIL", Address: "87 Nguyễn Lương Bằng, Đống Đa, Hà Nội", Latitude: 21.0189, Longitude: 105.8423, Phone: "024 3556 2222", Email: "bhx.dongda@example.vn", OpenTime: "07:30", CloseTime: "22:00", ServiceTime: 15, Status: "Active" },
    { CustomerCode: "KH-006", XName: "Đại Lý Thành Đạt", OrganizationID: depot._id, CustomerGroup: "CG-DIST", Address: "56 Minh Khai, Hai Bà Trưng, Hà Nội", Latitude: 21.0023, Longitude: 105.8634, Phone: "024 3623 9999", Email: "daily.thanhdat@example.vn", OpenTime: "08:00", CloseTime: "18:00", ServiceTime: 20, Status: "Active" },
    { CustomerCode: "KH-007", XName: "Nhà Phân Phối Hùng Cường", OrganizationID: depot._id, CustomerGroup: "CG-WHOLESALE", Address: "201 Nguyễn Văn Cừ, Long Biên, Hà Nội", Latitude: 21.0423, Longitude: 105.8912, Phone: "024 3879 1111", Email: "pp.hungcuong@example.vn", OpenTime: "07:00", CloseTime: "17:00", ServiceTime: 25, Status: "Active" }
  ]);

  const categories = await ProductCategory.insertMany([
    { CategoryCode: "CAT-BEV", XName: "Đồ uống", OrganizationID: depot._id, CategoryType: "BEVERAGE", UnloadTimePerUnit: 0.4, AllowedTopLoad: true, Status: "Active" },
    { CategoryCode: "CAT-FOOD", XName: "Thực phẩm khô", OrganizationID: depot._id, CategoryType: "FOOD", UnloadTimePerUnit: 0.5, AllowedTopLoad: true, Status: "Active" },
    { CategoryCode: "CAT-RICE", XName: "Lương thực", OrganizationID: depot._id, CategoryType: "FOOD", UnloadTimePerUnit: 0.8, AllowedTopLoad: false, Status: "Active" },
    { CategoryCode: "CAT-SNACK", XName: "Bánh kẹo", OrganizationID: depot._id, CategoryType: "FOOD", UnloadTimePerUnit: 0.3, AllowedTopLoad: true, Status: "Active" }
  ]);
  const catId = Object.fromEntries(categories.map((c) => [c.CategoryCode, c._id]));

  await Product.insertMany([
    { ProductCode: "SP-001", XName: "Nước lọc Aquafina 500ml", OrganizationID: depot._id, CategoryID: catId["CAT-BEV"], Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.012, ItemsPerCase: 24, Price: 96000, Status: "Active" },
    { ProductCode: "SP-002", XName: "Sữa tươi Vinamilk 1L", OrganizationID: depot._id, CategoryID: catId["CAT-BEV"], Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.015, ItemsPerCase: 12, Price: 240000, Status: "Active" },
    { ProductCode: "SP-003", XName: "Mì Hảo Hảo tôm chua cay", OrganizationID: depot._id, CategoryID: catId["CAT-FOOD"], Unit: "Thùng", WeightPerCase: 7.5, VolumePerCase: 0.025, ItemsPerCase: 30, Price: 75000, Status: "Active" },
    { ProductCode: "SP-004", XName: "Dầu ăn Neptune 1L", OrganizationID: depot._id, CategoryID: catId["CAT-FOOD"], Unit: "Thùng", WeightPerCase: 12.0, VolumePerCase: 0.014, ItemsPerCase: 12, Price: 360000, Status: "Active" },
    { ProductCode: "SP-005", XName: "Gạo ST25 túi 5kg", OrganizationID: depot._id, CategoryID: catId["CAT-RICE"], Unit: "Thùng", WeightPerCase: 50.0, VolumePerCase: 0.050, ItemsPerCase: 10, Price: 750000, Status: "Active" },
    { ProductCode: "SP-006", XName: "Nước tăng lực Sting 330ml", OrganizationID: depot._id, CategoryID: catId["CAT-BEV"], Unit: "Thùng", WeightPerCase: 8.0, VolumePerCase: 0.009, ItemsPerCase: 24, Price: 168000, Status: "Active" },
    { ProductCode: "SP-007", XName: "Bánh quy AFC Original 100g", OrganizationID: depot._id, CategoryID: catId["CAT-SNACK"], Unit: "Thùng", WeightPerCase: 3.6, VolumePerCase: 0.018, ItemsPerCase: 36, Price: 252000, Status: "Active" }
  ]);

  // Tạo Service (hãng 3PL) TRƯỚC vì Vehicle/Driver thuê ngoài cần ServiceID.
  const services = await Service.insertMany([
    { ServiceCode: "DV-001", XName: "Thuê xe tải nguyên chuyến nội thành", OrganizationID: depot._id, Carrier: "An Bình Transport", ServiceType: "FTL", FlatRate: 650000, PricePerKm: 12000, MinCharge: 900000, FuelSurchargePercent: 5, Description: "Thuê nguyên xe giao nội thành Hà Nội", Status: "Active" },
    { ServiceCode: "DV-002", XName: "Ghép hàng LTL nội thành", OrganizationID: depot._id, Carrier: "Kerry Express", ServiceType: "LTL", FlatRate: 120000, PricePerKm: 5000, PricePerKg: 800, MinCharge: 250000, FuelSurchargePercent: 3, Description: "Dịch vụ ghép hàng theo kg và km", Status: "Active" },
    { ServiceCode: "DV-003", XName: "Giao nhanh chặng cuối", OrganizationID: depot._id, Carrier: "GHN Logistics", ServiceType: "EXPRESS", FlatRate: 180000, PricePerKm: 9000, MinCharge: 350000, FuelSurchargePercent: 4, Description: "Giao ưu tiên trong ngày", Status: "Active" }
  ]);
  const svcByCode = Object.fromEntries(services.map((s) => [s.ServiceCode, s._id]));

  await Vehicle.insertMany([
    // 5 xe nội bộ
    { VehicleCode: "XE-001", XName: "Hino 500 5 tấn", OrganizationID: depot._id, LicensePlate: "30F-123.45", VehicleType: "TRUCK", EmploymentType: "IN_HOUSE", MaxWeight: 5000, MaxVolume: 30, MaxCases: 300, FixedCost: 700000, CostPerKm: 14000, AvgSpeedKmh: 38, LoadingTime: 35, UnloadingTimePerStop: 18, Status: "Active" },
    { VehicleCode: "XE-002", XName: "Hino 300 3.5 tấn", OrganizationID: depot._id, LicensePlate: "30F-234.56", VehicleType: "TRUCK", EmploymentType: "IN_HOUSE", MaxWeight: 3500, MaxVolume: 20, MaxCases: 200, FixedCost: 500000, CostPerKm: 11000, AvgSpeedKmh: 40, LoadingTime: 30, UnloadingTimePerStop: 15, Status: "Active" },
    { VehicleCode: "XE-003", XName: "Xe tải nhẹ Ford 1.2 tấn", OrganizationID: depot._id, LicensePlate: "30A-345.67", VehicleType: "TRUCK", EmploymentType: "IN_HOUSE", MaxWeight: 1200, MaxVolume: 8, MaxCases: 80, FixedCost: 280000, CostPerKm: 7000, AvgSpeedKmh: 42, LoadingTime: 20, UnloadingTimePerStop: 12, Status: "Active" },
    { VehicleCode: "XE-004", XName: "JAC X240 2.4 tấn", OrganizationID: depot._id, LicensePlate: "30F-456.78", VehicleType: "TRUCK", EmploymentType: "IN_HOUSE", MaxWeight: 2400, MaxVolume: 14, MaxCases: 140, FixedCost: 380000, CostPerKm: 9000, AvgSpeedKmh: 40, LoadingTime: 25, UnloadingTimePerStop: 15, Status: "Active" },
    { VehicleCode: "XE-005", XName: "Isuzu QKR55 2.5 tấn", OrganizationID: depot._id, LicensePlate: "30F-567.89", VehicleType: "TRUCK", EmploymentType: "IN_HOUSE", MaxWeight: 2500, MaxVolume: 16, MaxCases: 160, FixedCost: 420000, CostPerKm: 10000, AvgSpeedKmh: 40, LoadingTime: 25, UnloadingTimePerStop: 15, Status: "Active" },
    // 2 xe thuê ngoài (3PL) — chi phí tính qua bảng giá Service, không tham gia bảo dưỡng nội bộ
    { VehicleCode: "XE-3PL-01", XName: "An Bình Hino 8 tấn (thuê ngoài)", OrganizationID: depot._id, LicensePlate: "29C-888.01", VehicleType: "TRUCK", EmploymentType: "OUTSOURCED", ServiceID: svcByCode["DV-001"], MaxWeight: 8000, MaxVolume: 45, MaxCases: 400, FixedCost: 0, CostPerKm: 0, AvgSpeedKmh: 38, LoadingTime: 35, UnloadingTimePerStop: 18, Status: "Active" },
    { VehicleCode: "XE-3PL-02", XName: "GHN Hyundai 1.5 tấn (thuê ngoài)", OrganizationID: depot._id, LicensePlate: "29C-888.02", VehicleType: "TRUCK", EmploymentType: "OUTSOURCED", ServiceID: svcByCode["DV-003"], MaxWeight: 1500, MaxVolume: 10, MaxCases: 100, FixedCost: 0, CostPerKm: 0, AvgSpeedKmh: 42, LoadingTime: 20, UnloadingTimePerStop: 12, Status: "Active" }
  ]);

  await Driver.insertMany([
    // 4 tài xế nội bộ — có LinkedUserID để login app
    { DriverCode: "TX-001", XName: "Trần Văn Dũng", OrganizationID: depot._id, Phone: "0912 111 001", Email: "driver01@road-freight.io", VehicleType: "TRUCK", EmploymentType: "IN_HOUSE", LinkedUserID: driverUsers[0]._id, Status: "Active" },
    { DriverCode: "TX-002", XName: "Phạm Văn Tú", OrganizationID: depot._id, Phone: "0912 111 002", Email: "driver02@road-freight.io", VehicleType: "TRUCK", EmploymentType: "IN_HOUSE", LinkedUserID: driverUsers[1]._id, Status: "Active" },
    { DriverCode: "TX-003", XName: "Nguyễn Đức Hải", OrganizationID: depot._id, Phone: "0912 111 003", Email: "driver03@road-freight.io", VehicleType: "TRUCK", EmploymentType: "IN_HOUSE", LinkedUserID: driverUsers[2]._id, Status: "Active" },
    { DriverCode: "TX-004", XName: "Lê Quang Minh", OrganizationID: depot._id, Phone: "0912 111 004", Email: "minh.le@ptl.vn", VehicleType: "TRUCK", EmploymentType: "IN_HOUSE", Status: "Active" },
    // 2 tài xế 3PL — vẫn có LinkedUserID để dùng app driver (GPS + ePOD), nhưng không hưởng lương
    { DriverCode: "TX-3PL-01", XName: "Vũ Văn Lộc (An Bình)", OrganizationID: depot._id, Phone: "0988 777 001", Email: "loc.vu@anbinh.vn", VehicleType: "TRUCK", EmploymentType: "OUTSOURCED", ServiceID: svcByCode["DV-001"], Status: "Active" },
    { DriverCode: "TX-3PL-02", XName: "Đỗ Tuấn Anh (GHN)", OrganizationID: depot._id, Phone: "0988 777 002", Email: "anh.do@ghn.vn", VehicleType: "TRUCK", EmploymentType: "OUTSOURCED", ServiceID: svcByCode["DV-003"], Status: "Active" }
  ]);

  const O = depot._id;
  const APPR = ApprovalStatus.APPROVED;
  const PEND = ApprovalStatus.PENDING;
  const REJT = ApprovalStatus.REJECTED;

  await SalesOrder.insertMany([
    order("ORD-20250502-001", "KH-001", O, 7, [{ ProductCode: "SP-001", NumberOfCases: 20 }, { ProductCode: "SP-003", NumberOfCases: 10 }], 2_670_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED),
    order("ORD-20250502-002", "KH-006", O, 7, [{ ProductCode: "SP-005", NumberOfCases: 15 }], 1_125_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED),
    order("ORD-20250503-001", "KH-002", O, 6, [{ ProductCode: "SP-002", NumberOfCases: 8 }, { ProductCode: "SP-004", NumberOfCases: 5 }], 3_720_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED),
    order("ORD-20250503-002", "KH-007", O, 6, [{ ProductCode: "SP-001", NumberOfCases: 30 }, { ProductCode: "SP-006", NumberOfCases: 12 }], 3_936_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED),
    order("ORD-20250504-001", "KH-003", O, 5, [{ ProductCode: "SP-003", NumberOfCases: 20 }, { ProductCode: "SP-007", NumberOfCases: 10 }], 4_020_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED),
    order("ORD-20250505-001", "KH-004", O, 4, [{ ProductCode: "SP-002", NumberOfCases: 10 }, { ProductCode: "SP-006", NumberOfCases: 15 }], 4_920_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED),
    order("ORD-20250505-002", "KH-005", O, 4, [{ ProductCode: "SP-001", NumberOfCases: 25 }, { ProductCode: "SP-004", NumberOfCases: 6 }], 4_560_000, APPR, OrderStatus.DELIVERED, PlanningStatus.FINALIZED),
    order("ORD-20250506-001", "KH-001", O, 3, [{ ProductCode: "SP-002", NumberOfCases: 6 }, { ProductCode: "SP-003", NumberOfCases: 15 }], 2_565_000, APPR, OrderStatus.SHIPPED, PlanningStatus.LOCKED),
    order("ORD-20250506-002", "KH-006", O, 3, [{ ProductCode: "SP-005", NumberOfCases: 20 }], 1_500_000, APPR, OrderStatus.SHIPPED, PlanningStatus.LOCKED),
    order("ORD-20250507-001", "KH-007", O, 2, [{ ProductCode: "SP-001", NumberOfCases: 40 }, { ProductCode: "SP-007", NumberOfCases: 8 }], 5_856_000, APPR, OrderStatus.PICKED_PACKED, PlanningStatus.LOCKED),
    order("ORD-20250507-002", "KH-003", O, 2, [{ ProductCode: "SP-006", NumberOfCases: 20 }, { ProductCode: "SP-004", NumberOfCases: 4 }], 4_800_000, APPR, OrderStatus.PICKED_PACKED, PlanningStatus.LOCKED),
    order("ORD-20250507-003", "KH-002", O, 2, [{ ProductCode: "SP-005", NumberOfCases: 5 }], 375_000, REJT, OrderStatus.REJECTED, PlanningStatus.PENDING),
    order("ORD-20250509-001", "KH-001", O, 0, [{ ProductCode: "SP-001", NumberOfCases: 30 }, { ProductCode: "SP-002", NumberOfCases: 5 }], 4_080_000, APPR, OrderStatus.OPEN, PlanningStatus.PENDING),
    order("ORD-20250509-002", "KH-002", O, 0, [{ ProductCode: "SP-003", NumberOfCases: 25 }, { ProductCode: "SP-006", NumberOfCases: 10 }], 3_555_000, APPR, OrderStatus.OPEN, PlanningStatus.PENDING),
    order("ORD-20250509-003", "KH-004", O, 0, [{ ProductCode: "SP-004", NumberOfCases: 8 }, { ProductCode: "SP-007", NumberOfCases: 15 }], 6_660_000, APPR, OrderStatus.OPEN, PlanningStatus.PENDING),
    order("ORD-20250509-004", "KH-005", O, 0, [{ ProductCode: "SP-001", NumberOfCases: 50 }], 4_800_000, APPR, OrderStatus.OPEN, PlanningStatus.PENDING),
    order("ORD-20250509-006", "KH-003", O, 0, [{ ProductCode: "SP-002", NumberOfCases: 12 }, { ProductCode: "SP-003", NumberOfCases: 20 }], 4_380_000, PEND, OrderStatus.OPEN, PlanningStatus.PENDING),
    order("ORD-20250509-007", "KH-006", O, 0, [{ ProductCode: "SP-006", NumberOfCases: 30 }, { ProductCode: "SP-004", NumberOfCases: 3 }], 6_120_000, PEND, OrderStatus.OPEN, PlanningStatus.PENDING),
    order("ORD-20250509-008", "KH-007", O, 0, [{ ProductCode: "SP-005", NumberOfCases: 10 }], 750_000, PEND, OrderStatus.OPEN, PlanningStatus.PENDING)
  ]);

  logger.info("═══════════════════════════════════════════════════");
  logger.info("  SEED HOÀN TẤT — Phú Thịnh Logistics (PTL)");
  logger.info("═══════════════════════════════════════════════════");
  logger.info("  Tài khoản hệ thống:");
  logger.info("    superadmin@road-freight.io  / Admin@123  → SuperAdmin");
  logger.info("    admin@road-freight.io        / Pass@123  → Quản trị");
  logger.info("    planner@road-freight.io      / Pass@123  → Điều phối kho PTL-KHO-HN");
  logger.info("    driver01@road-freight.io     / Pass@123  → Tài xế kho PTL-KHO-HN");
  logger.info("───────────────────────────────────────────────────");
  logger.info("  CSDL mẫu:");
  logger.info("    1 công ty + 1 chi nhánh + 1 kho thật, 7 khách hàng, 3 nhóm KH, 4 nhóm SP");
  logger.info("    7 sản phẩm, 3 dịch vụ 3PL");
  logger.info("    7 xe (5 nội bộ + 2 thuê ngoài), 6 tài xế (4 nội bộ + 2 thuê ngoài)");
  logger.info("    18 đơn hàng thuộc kho PTL-KHO-HN, không đặt khung giờ giao ở đơn");
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
