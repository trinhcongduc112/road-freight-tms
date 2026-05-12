import mongoose from "mongoose";
import { Customer } from "../models/Customer.js";
import { CustomerGroup } from "../models/CustomerGroup.js";
import { Product } from "../models/Product.js";
import { ProductCategory } from "../models/ProductCategory.js";
import { Vehicle } from "../models/Vehicle.js";
import { Driver } from "../models/Driver.js";
import { Service } from "../models/Service.js";
import { ApiError } from "../utils/apiError.js";
import { assertOrgInScope, scopeFilter } from "../middlewares/dac.js";

/* ─── Generic helpers ─── */

function buildFilter(Model, req) {
  return scopeFilter(req.orgScope, "OrganizationID");
}

async function resolveOrg(orgId, orgScope) {
  if (!mongoose.isValidObjectId(orgId)) throw new ApiError(400, "Invalid OrganizationID");
  assertOrgInScope(orgScope, orgId);
}

async function paginate(Model, filter, req, sort = { _id: 1 }) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, parseInt(req.query.limit) || 100);
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    Model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Model.countDocuments(filter)
  ]);

  return {
    data: docs,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
}

/* ══════════════════════════════════════════
   CUSTOMER
══════════════════════════════════════════ */

export async function listCustomers(req, res) {
  const filter = buildFilter(Customer, req);
  if (req.query.status) filter.Status = req.query.status;
  const result = await paginate(Customer, filter, req, { CustomerCode: 1 });
  res.json({ success: true, ...result });
}

export async function getCustomer(req, res) {
  const doc = await Customer.findById(req.params.id).lean();
  if (!doc) throw new ApiError(404, "Customer not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  res.json({ success: true, data: doc });
}

export async function createCustomer(req, res) {
  const { CustomerCode, XName, OrganizationID, CustomerGroup, Address, Latitude, Longitude,
    OpenTime, CloseTime, ServiceTime, Phone, Email, Status } = req.body ?? {};
  if (!CustomerCode || !XName || !OrganizationID) throw new ApiError(400, "CustomerCode, XName, OrganizationID required");
  await resolveOrg(OrganizationID, req.orgScope);
  const code = CustomerCode.toUpperCase();
  if (await Customer.exists({ OrganizationID, CustomerCode: code })) throw new ApiError(409, "CustomerCode already exists in this org");
  const doc = await Customer.create({
    CustomerCode: code, XName, OrganizationID, CustomerGroup: CustomerGroup ?? "",
    Address: Address ?? "", Latitude: Latitude ?? null, Longitude: Longitude ?? null,
    OpenTime: OpenTime ?? null, CloseTime: CloseTime ?? null, ServiceTime: ServiceTime ?? 0,
    Phone: Phone ?? "", Email: Email ?? "", Status: Status ?? "Active", CreatedBy: req.user._id
  });
  res.status(201).json({ success: true, data: doc });
}

export async function updateCustomer(req, res) {
  const doc = await Customer.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Customer not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  const fields = ["XName", "CustomerGroup", "Address", "Latitude", "Longitude", "OpenTime", "CloseTime", "ServiceTime", "Phone", "Email", "Status"];
  for (const f of fields) if (req.body?.[f] !== undefined) doc[f] = req.body[f];
  await doc.save();
  res.json({ success: true, data: doc });
}

export async function deleteCustomer(req, res) {
  const doc = await Customer.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Customer not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  await doc.deleteOne();
  res.json({ success: true });
}

/* ══════════════════════════════════════════
   PRODUCT
══════════════════════════════════════════ */

export async function listProducts(req, res) {
  const filter = buildFilter(Product, req);
  if (req.query.status) filter.Status = req.query.status;
  const result = await paginate(Product, filter, req, { ProductCode: 1 });
  res.json({ success: true, ...result });
}

export async function getProduct(req, res) {
  const doc = await Product.findById(req.params.id).lean();
  if (!doc) throw new ApiError(404, "Product not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  res.json({ success: true, data: doc });
}

export async function createProduct(req, res) {
  const { ProductCode, XName, OrganizationID, CategoryID, Unit, WeightPerCase, VolumePerCase, ItemsPerCase, Price, Status } = req.body ?? {};
  if (!ProductCode || !XName || !OrganizationID) throw new ApiError(400, "ProductCode, XName, OrganizationID required");
  await resolveOrg(OrganizationID, req.orgScope);
  const code = ProductCode.toUpperCase();
  if (await Product.exists({ OrganizationID, ProductCode: code })) throw new ApiError(409, "ProductCode already exists in this org");
  const doc = await Product.create({
    ProductCode: code, XName, OrganizationID,
    CategoryID: CategoryID || null,
    Unit: Unit ?? "pcs",
    WeightPerCase: WeightPerCase ?? 0, VolumePerCase: VolumePerCase ?? 0,
    ItemsPerCase: ItemsPerCase ?? 1, Price: Price ?? 0, Status: Status ?? "Active", CreatedBy: req.user._id
  });
  res.status(201).json({ success: true, data: doc });
}

export async function updateProduct(req, res) {
  const doc = await Product.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Product not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  const fields = ["XName", "Unit", "WeightPerCase", "VolumePerCase", "ItemsPerCase", "Price", "Status"];
  for (const f of fields) if (req.body?.[f] !== undefined) doc[f] = req.body[f];
  if (req.body?.CategoryID !== undefined) doc.CategoryID = req.body.CategoryID || null;
  await doc.save();
  res.json({ success: true, data: doc });
}

export async function deleteProduct(req, res) {
  const doc = await Product.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Product not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  await doc.deleteOne();
  res.json({ success: true });
}

/* ══════════════════════════════════════════
   VEHICLE
══════════════════════════════════════════ */

export async function listVehicles(req, res) {
  const filter = buildFilter(Vehicle, req);
  if (req.query.status) filter.Status = req.query.status;
  const result = await paginate(Vehicle, filter, req, { VehicleCode: 1 });
  res.json({ success: true, ...result });
}

export async function getVehicle(req, res) {
  const doc = await Vehicle.findById(req.params.id).lean();
  if (!doc) throw new ApiError(404, "Vehicle not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  res.json({ success: true, data: doc });
}

export async function createVehicle(req, res) {
  const { VehicleCode, XName, OrganizationID, LicensePlate, VehicleType: vtype,
    MaxWeight, MaxVolume, MaxCases, FixedCost, CostPerKm, Status } = req.body ?? {};
  if (!VehicleCode || !XName || !OrganizationID) throw new ApiError(400, "VehicleCode, XName, OrganizationID required");
  await resolveOrg(OrganizationID, req.orgScope);
  const code = VehicleCode.toUpperCase();
  if (await Vehicle.exists({ OrganizationID, VehicleCode: code })) throw new ApiError(409, "VehicleCode already exists in this org");
  const doc = await Vehicle.create({
    VehicleCode: code, XName, OrganizationID, LicensePlate: LicensePlate ?? "",
    VehicleType: vtype ?? "TRUCK", MaxWeight: MaxWeight ?? 0, MaxVolume: MaxVolume ?? 0,
    MaxCases: MaxCases ?? 0, FixedCost: FixedCost ?? 0, CostPerKm: CostPerKm ?? 0,
    Status: Status ?? "Active", CreatedBy: req.user._id
  });
  res.status(201).json({ success: true, data: doc });
}

export async function updateVehicle(req, res) {
  const doc = await Vehicle.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Vehicle not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  const fields = ["XName", "LicensePlate", "VehicleType", "MaxWeight", "MaxVolume", "MaxCases", "FixedCost", "CostPerKm", "Status"];
  for (const f of fields) if (req.body?.[f] !== undefined) doc[f] = req.body[f];
  await doc.save();
  res.json({ success: true, data: doc });
}

export async function deleteVehicle(req, res) {
  const doc = await Vehicle.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Vehicle not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  await doc.deleteOne();
  res.json({ success: true });
}

/* ══════════════════════════════════════════
   DRIVER
══════════════════════════════════════════ */

export async function listDrivers(req, res) {
  const filter = buildFilter(Driver, req);
  if (req.query.status) filter.Status = req.query.status;
  const result = await paginate(Driver, filter, req, { DriverCode: 1 });
  res.json({ success: true, ...result });
}

export async function getDriver(req, res) {
  const doc = await Driver.findById(req.params.id).lean();
  if (!doc) throw new ApiError(404, "Driver not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  res.json({ success: true, data: doc });
}

export async function createDriver(req, res) {
  const { DriverCode, XName, OrganizationID, Phone, Email, VehicleType, Status } = req.body ?? {};
  if (!DriverCode || !XName || !OrganizationID) throw new ApiError(400, "DriverCode, XName, OrganizationID required");
  await resolveOrg(OrganizationID, req.orgScope);
  const code = DriverCode.toUpperCase();
  if (await Driver.exists({ OrganizationID, DriverCode: code })) throw new ApiError(409, "DriverCode already exists in this org");
  const doc = await Driver.create({
    DriverCode: code, XName, OrganizationID,
    Phone: Phone ?? "", Email: Email ?? "",
    VehicleType: VehicleType ?? null,
    Status: Status ?? "Active", CreatedBy: req.user._id
  });
  res.status(201).json({ success: true, data: doc });
}

export async function updateDriver(req, res) {
  const doc = await Driver.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Driver not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  const fields = ["XName", "Phone", "Email", "VehicleType", "Status"];
  for (const f of fields) if (req.body?.[f] !== undefined) doc[f] = req.body[f];
  await doc.save();
  res.json({ success: true, data: doc });
}

export async function deleteDriver(req, res) {
  const doc = await Driver.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Driver not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  await doc.deleteOne();
  res.json({ success: true });
}

/* ══════════════════════════════════════════
   SERVICE
══════════════════════════════════════════ */

export async function listServices(req, res) {
  const filter = buildFilter(Service, req);
  if (req.query.status) filter.Status = req.query.status;
  const result = await paginate(Service, filter, req, { ServiceCode: 1 });
  res.json({ success: true, ...result });
}

export async function getService(req, res) {
  const doc = await Service.findById(req.params.id).lean();
  if (!doc) throw new ApiError(404, "Service not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  res.json({ success: true, data: doc });
}

export async function createService(req, res) {
  const { ServiceCode, XName, OrganizationID, ServiceType: stype, Carrier, Description,
    FlatRate, PricePerKm, PricePerKg, PricePerCBM, MinCharge, FuelSurchargePercent, Status } = req.body ?? {};
  if (!ServiceCode || !XName || !OrganizationID) throw new ApiError(400, "ServiceCode, XName, OrganizationID required");
  await resolveOrg(OrganizationID, req.orgScope);
  const code = ServiceCode.toUpperCase();
  if (await Service.exists({ OrganizationID, ServiceCode: code })) throw new ApiError(409, "ServiceCode already exists in this org");
  const doc = await Service.create({
    ServiceCode: code, XName, OrganizationID,
    Carrier: Carrier ?? "",
    ServiceType: stype ?? "FTL",
    Description: Description ?? "",
    FlatRate: FlatRate ?? 0,
    PricePerKm: PricePerKm ?? 0,
    PricePerKg: PricePerKg ?? 0,
    PricePerCBM: PricePerCBM ?? 0,
    MinCharge: MinCharge ?? 0,
    FuelSurchargePercent: FuelSurchargePercent ?? 0,
    Status: Status ?? "Active",
    CreatedBy: req.user._id
  });
  res.status(201).json({ success: true, data: doc });
}

export async function updateService(req, res) {
  const doc = await Service.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Service not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  const fields = ["XName", "Carrier", "ServiceType", "Description",
    "FlatRate", "PricePerKm", "PricePerKg", "PricePerCBM", "MinCharge", "FuelSurchargePercent", "Status"];
  for (const f of fields) if (req.body?.[f] !== undefined) doc[f] = req.body[f];
  await doc.save();
  res.json({ success: true, data: doc });
}

export async function deleteService(req, res) {
  const doc = await Service.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Service not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  await doc.deleteOne();
  res.json({ success: true });
}

/* ─── CustomerGroup ─── */

export async function listCustomerGroups(req, res) {
  const filter = scopeFilter(req.orgScope, "OrganizationID");
  const result = await paginate(CustomerGroup, filter, req, { GroupCode: 1 });
  res.json({ success: true, ...result });
}

export async function createCustomerGroup(req, res) {
  const { GroupCode, XName, OrganizationID, Description, Status } = req.body ?? {};
  if (!GroupCode || !XName || !OrganizationID) throw new ApiError(400, "GroupCode, XName, OrganizationID là bắt buộc");
  await resolveOrg(OrganizationID, req.orgScope);
  const exists = await CustomerGroup.exists({ OrganizationID, GroupCode: GroupCode.toUpperCase() });
  if (exists) throw new ApiError(409, `GroupCode ${GroupCode} đã tồn tại trong tổ chức này`);
  const doc = await CustomerGroup.create({ GroupCode, XName, OrganizationID, Description, Status });
  res.status(201).json({ success: true, data: doc });
}

export async function updateCustomerGroup(req, res) {
  const doc = await CustomerGroup.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Customer Group not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  const fields = ["XName", "Description", "Status"];
  for (const f of fields) if (req.body?.[f] !== undefined) doc[f] = req.body[f];
  await doc.save();
  res.json({ success: true, data: doc });
}

export async function deleteCustomerGroup(req, res) {
  const doc = await CustomerGroup.findById(req.params.id);
  if (!doc) throw new ApiError(404, "Customer Group not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  await doc.deleteOne();
  res.json({ success: true });
}

/* ══════════════════════════════════════════
   BULK IMPORT (Excel → JSON rows)
   Body: { organizationId, rows: [...] }
   Returns: { created, skipped, errors[] }
══════════════════════════════════════════ */

async function bulkImport({ rows, orgId, orgScope, codeField, Model, buildDoc, codeUpper = true }) {
  await resolveOrg(orgId, orgScope);
  let created = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const raw = row[codeField];
    if (!raw || !row.XName) { errors.push({ row: i + 2, reason: `${codeField} và Tên là bắt buộc` }); continue; }
    const code = codeUpper ? String(raw).toUpperCase() : String(raw);
    try {
      const exists = await Model.exists({ OrganizationID: orgId, [codeField]: code });
      if (exists) { skipped++; continue; }
      await Model.create(buildDoc(row, code, orgId));
      created++;
    } catch (e) {
      errors.push({ row: i + 2, reason: e.message });
    }
  }
  return { created, skipped, errors };
}

export async function importCustomers(req, res) {
  const { organizationId, rows = [] } = req.body ?? {};
  if (!organizationId) throw new ApiError(400, "organizationId required");
  const result = await bulkImport({
    rows, orgId: organizationId, orgScope: req.orgScope,
    codeField: "CustomerCode", Model: Customer,
    buildDoc: (r, code, orgId) => ({
      CustomerCode: code, XName: r.XName, OrganizationID: orgId,
      CustomerGroup: r.CustomerGroup ?? "", Address: r.Address ?? "",
      Latitude: r.Latitude ? parseFloat(r.Latitude) : null,
      Longitude: r.Longitude ? parseFloat(r.Longitude) : null,
      OpenTime: r.OpenTime ?? null, CloseTime: r.CloseTime ?? null,
      ServiceTime: r.ServiceTime ? parseInt(r.ServiceTime) : 0,
      Phone: r.Phone ?? "", Email: r.Email ?? "", Status: "Active"
    })
  });
  res.json({ success: true, ...result });
}

export async function importProducts(req, res) {
  const { organizationId, rows = [] } = req.body ?? {};
  if (!organizationId) throw new ApiError(400, "organizationId required");

  /* pre-build CategoryCode → _id map for this org */
  const catDocs = await ProductCategory.find({ OrganizationID: organizationId }).lean();
  const catMap = Object.fromEntries(catDocs.map((c) => [c.CategoryCode, c._id]));

  const result = await bulkImport({
    rows, orgId: organizationId, orgScope: req.orgScope,
    codeField: "ProductCode", Model: Product,
    buildDoc: (r, code, orgId) => {
      const catCode = r.CategoryCode ? String(r.CategoryCode).trim().toUpperCase() : null;
      return {
        ProductCode: code, XName: r.XName, OrganizationID: orgId,
        CategoryID: catCode ? (catMap[catCode] ?? null) : null,
        Unit: r.Unit ?? "pcs",
        WeightPerCase: r.WeightPerCase ? parseFloat(r.WeightPerCase) : 0,
        VolumePerCase: r.VolumePerCase ? parseFloat(r.VolumePerCase) : 0,
        ItemsPerCase:  r.ItemsPerCase  ? parseInt(r.ItemsPerCase)    : 1,
        Price:         r.Price         ? parseFloat(r.Price)         : 0,
        Status: "Active"
      };
    }
  });
  res.json({ success: true, ...result });
}

export async function importVehicles(req, res) {
  const { organizationId, rows = [] } = req.body ?? {};
  if (!organizationId) throw new ApiError(400, "organizationId required");
  const result = await bulkImport({
    rows, orgId: organizationId, orgScope: req.orgScope,
    codeField: "VehicleCode", Model: Vehicle,
    buildDoc: (r, code, orgId) => ({
      VehicleCode: code, XName: r.XName, OrganizationID: orgId,
      LicensePlate: r.LicensePlate ?? "", VehicleType: r.VehicleType ?? "TRUCK",
      MaxWeight: r.MaxWeight ? parseFloat(r.MaxWeight) : 0,
      MaxVolume: r.MaxVolume ? parseFloat(r.MaxVolume) : 0,
      MaxCases:  r.MaxCases  ? parseInt(r.MaxCases)    : 0,
      FixedCost: r.FixedCost ? parseFloat(r.FixedCost) : 0,
      CostPerKm: r.CostPerKm ? parseFloat(r.CostPerKm) : 0,
      Status: "Active"
    })
  });
  res.json({ success: true, ...result });
}

export async function importDrivers(req, res) {
  const { organizationId, rows = [] } = req.body ?? {};
  if (!organizationId) throw new ApiError(400, "organizationId required");
  const result = await bulkImport({
    rows, orgId: organizationId, orgScope: req.orgScope,
    codeField: "DriverCode", Model: Driver,
    buildDoc: (r, code, orgId) => ({
      DriverCode: code, XName: r.XName, OrganizationID: orgId,
      Phone: r.Phone ?? "", Email: r.Email ?? "",
      VehicleType: r.VehicleType ?? null, Status: "Active"
    })
  });
  res.json({ success: true, ...result });
}

export async function importCustomerGroups(req, res) {
  const { organizationId, rows = [] } = req.body ?? {};
  if (!organizationId) throw new ApiError(400, "organizationId required");
  const result = await bulkImport({
    rows, orgId: organizationId, orgScope: req.orgScope,
    codeField: "GroupCode", Model: CustomerGroup,
    buildDoc: (r, code, orgId) => ({
      GroupCode: code, XName: r.XName, OrganizationID: orgId,
      Description: r.Description ?? "", Status: "Active"
    })
  });
  res.json({ success: true, ...result });
}

export async function importServices(req, res) {
  const { organizationId, rows = [] } = req.body ?? {};
  if (!organizationId) throw new ApiError(400, "organizationId required");
  const result = await bulkImport({
    rows, orgId: organizationId, orgScope: req.orgScope,
    codeField: "ServiceCode", Model: Service,
    buildDoc: (r, code, orgId) => ({
      ServiceCode: code, XName: r.XName, OrganizationID: orgId,
      Carrier: r.Carrier ?? "",
      ServiceType: r.ServiceType ?? "FTL",
      Description: r.Description ?? "",
      FlatRate:             r.FlatRate             ? parseFloat(r.FlatRate)             : 0,
      PricePerKm:           r.PricePerKm           ? parseFloat(r.PricePerKm)           : 0,
      PricePerKg:           r.PricePerKg           ? parseFloat(r.PricePerKg)           : 0,
      PricePerCBM:          r.PricePerCBM          ? parseFloat(r.PricePerCBM)          : 0,
      MinCharge:            r.MinCharge            ? parseFloat(r.MinCharge)            : 0,
      FuelSurchargePercent: r.FuelSurchargePercent ? parseFloat(r.FuelSurchargePercent) : 0,
      Status: "Active"
    })
  });
  res.json({ success: true, ...result });
}

/* ══════════════════════════════════════════
   PRODUCT CATEGORY
══════════════════════════════════════════ */

export async function listProductCategories(req, res) {
  const filter = buildFilter(ProductCategory, req);
  if (req.query.status) filter.Status = req.query.status;
  const result = await paginate(ProductCategory, filter, req, { CategoryCode: 1 });
  res.json({ success: true, ...result });
}

export async function getProductCategory(req, res) {
  const doc = await ProductCategory.findById(req.params.id).lean();
  if (!doc) throw new ApiError(404, "ProductCategory not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  res.json({ success: true, data: doc });
}

export async function createProductCategory(req, res) {
  const { CategoryCode, XName, OrganizationID, ParentID, CategoryType,
    UnloadTimePerUnit, AllowedTopLoad, Status } = req.body ?? {};
  if (!CategoryCode || !XName || !OrganizationID) throw new ApiError(400, "CategoryCode, XName, OrganizationID required");
  await resolveOrg(OrganizationID, req.orgScope);
  const dup = await ProductCategory.findOne({ OrganizationID, CategoryCode: CategoryCode.toUpperCase() });
  if (dup) throw new ApiError(409, "CategoryCode already exists in this organization");
  const doc = await ProductCategory.create({
    CategoryCode: CategoryCode.toUpperCase(), XName, OrganizationID,
    ParentID: ParentID || null,
    CategoryType: CategoryType ?? "OTHER",
    UnloadTimePerUnit: UnloadTimePerUnit ?? 0,
    AllowedTopLoad: AllowedTopLoad !== false,
    Status: Status ?? "Active",
    CreatedBy: req.user._id
  });
  res.status(201).json({ success: true, data: doc });
}

export async function updateProductCategory(req, res) {
  const doc = await ProductCategory.findById(req.params.id);
  if (!doc) throw new ApiError(404, "ProductCategory not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  const { XName, ParentID, CategoryType, UnloadTimePerUnit, AllowedTopLoad, Status } = req.body ?? {};
  if (XName !== undefined) doc.XName = XName;
  if (ParentID !== undefined) doc.ParentID = ParentID || null;
  if (CategoryType !== undefined) doc.CategoryType = CategoryType;
  if (UnloadTimePerUnit !== undefined) doc.UnloadTimePerUnit = UnloadTimePerUnit;
  if (AllowedTopLoad !== undefined) doc.AllowedTopLoad = AllowedTopLoad;
  if (Status !== undefined) doc.Status = Status;
  await doc.save();
  res.json({ success: true, data: doc });
}

export async function deleteProductCategory(req, res) {
  const doc = await ProductCategory.findById(req.params.id);
  if (!doc) throw new ApiError(404, "ProductCategory not found");
  assertOrgInScope(req.orgScope, doc.OrganizationID);
  await doc.deleteOne();
  res.json({ success: true });
}

export async function importProductCategories(req, res) {
  const { organizationId, rows = [] } = req.body ?? {};
  if (!organizationId) throw new ApiError(400, "organizationId required");
  const result = await bulkImport({
    rows, orgId: organizationId, orgScope: req.orgScope,
    codeField: "CategoryCode", Model: ProductCategory,
    buildDoc: (r, code, orgId) => ({
      CategoryCode: code, XName: r.XName, OrganizationID: orgId,
      CategoryType: r.CategoryType ?? "OTHER",
      UnloadTimePerUnit: r.UnloadTimePerUnit ? parseFloat(r.UnloadTimePerUnit) : 0,
      AllowedTopLoad: r.AllowedTopLoad !== undefined ? String(r.AllowedTopLoad).toLowerCase() !== "false" : true,
      Status: "Active"
    })
  });
  res.json({ success: true, ...result });
}
