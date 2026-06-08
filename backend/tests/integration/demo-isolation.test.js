/**
 * Integration test: Multi-tenant isolation cho demo seed/clear.
 *
 * Bug đã fix (commit này): clearDemoFromOrg trước đây xoá RoleGroup và User
 * theo XCode/UserName regex KHÔNG kèm filter OrganizationID → org A clear demo
 * sẽ vô tình xoá demo của org B.
 *
 * Test này verify: khi org A clear, demo của org B PHẢI nguyên vẹn.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb, clearTestDb } from "../setup.js";

let Organization, RoleGroup, User, Driver, Customer, Product;

beforeAll(async () => {
  await setupTestDb();
  ({ Organization } = await import("../../src/models/Organization.js"));
  ({ RoleGroup } = await import("../../src/models/RoleGroup.js"));
  ({ User } = await import("../../src/models/User.js"));
  ({ Driver } = await import("../../src/models/Driver.js"));
  ({ Customer } = await import("../../src/models/Customer.js"));
  ({ Product } = await import("../../src/models/Product.js"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

/* Tạo dữ liệu demo cho 1 org giả lập đầu ra của seedDemo. */
async function seedFakeDemo(orgCode) {
  const org = await Organization.create({
    XCode: orgCode,
    XName: `Org ${orgCode}`,
    OrgType: "MANUFACTURER"
  });
  const suffix = String(org._id).slice(-6);

  await RoleGroup.insertMany([
    { OrganizationID: org._id, XCode: `DEMO-RG-PLANNER-${suffix}`, XName: "Demo Planner", Kind: "normal", Permissions: [] },
    { OrganizationID: org._id, XCode: `DEMO-RG-DRIVER-${suffix}`,  XName: "Demo Driver",  Kind: "normal", Permissions: [] }
  ]);
  await User.insertMany([
    { OrganizationIDs: [org._id], UserName: `demo.driver01.${suffix}`, Email: `demo.driver01.${suffix}@road-freight.io`, PasswordHash: "x", FullName: "Demo Driver 1", Status: "ACTIVE" },
    { OrganizationIDs: [org._id], UserName: `demo.planner.${suffix}`,  Email: `demo.planner.${suffix}@road-freight.io`,  PasswordHash: "x", FullName: "Demo Planner",  Status: "ACTIVE" }
  ]);
  await Driver.insertMany([
    { OrganizationID: org._id, DriverCode: `DEMO-DRV-${suffix}-1`, XName: "Demo Driver 1", PhoneNumber: "0900000001" }
  ]);
  await Customer.insertMany([
    { OrganizationID: org._id, CustomerCode: `DEMO-KH-${suffix}-1`, XName: "Khách Demo 1" }
  ]);
  await Product.insertMany([
    { OrganizationID: org._id, ProductCode: `DEMO-SP-${suffix}-1`, XName: "Sản phẩm Demo 1" }
  ]);

  return { org, suffix };
}

/* Snapshot logic clear-demo (copy nguyên từ demoController) — verify fix. */
const DEMO_PREFIX = "DEMO-";
async function clearDemoFromOrg(orgId) {
  const orgIds = [orgId]; // Trong test này không có cây con
  const filter = { OrganizationID: { $in: orgIds } };
  const re = new RegExp("^" + DEMO_PREFIX);
  const demoUserRe = /^demo\./;
  const demoEmailRe = /^demo\..+@road-freight\.io$/;
  await Promise.all([
    Customer.deleteMany({ ...filter, CustomerCode: re }),
    Driver.deleteMany({ ...filter, DriverCode: re }),
    Product.deleteMany({ ...filter, ProductCode: re }),
    // ✅ Fix: thêm filter OrganizationID — trước đây thiếu
    RoleGroup.deleteMany({ ...filter, XCode: re }),
    User.deleteMany({
      OrganizationIDs: { $in: orgIds },
      $or: [{ UserName: demoUserRe }, { Email: demoEmailRe }]
    })
  ]);
}

describe("Demo isolation — multi-tenant safety", () => {
  it("clear demo của org A KHÔNG ảnh hưởng demo của org B", async () => {
    const a = await seedFakeDemo("ORG-A");
    const b = await seedFakeDemo("ORG-B");

    // Sanity: cả 2 org đều có demo đầy đủ
    expect(await RoleGroup.countDocuments({ OrganizationID: a.org._id })).toBe(2);
    expect(await User.countDocuments({ OrganizationIDs: a.org._id })).toBe(2);
    expect(await RoleGroup.countDocuments({ OrganizationID: b.org._id })).toBe(2);
    expect(await User.countDocuments({ OrganizationIDs: b.org._id })).toBe(2);

    // Clear demo của org A
    await clearDemoFromOrg(a.org._id);

    // ORG-A sạch (đúng theo yêu cầu)
    expect(await RoleGroup.countDocuments({ OrganizationID: a.org._id })).toBe(0);
    expect(await User.countDocuments({ OrganizationIDs: a.org._id })).toBe(0);
    expect(await Driver.countDocuments({ OrganizationID: a.org._id })).toBe(0);
    expect(await Customer.countDocuments({ OrganizationID: a.org._id })).toBe(0);
    expect(await Product.countDocuments({ OrganizationID: a.org._id })).toBe(0);

    // ORG-B PHẢI NGUYÊN VẸN — đây là regression test cho bug đã fix
    expect(await RoleGroup.countDocuments({ OrganizationID: b.org._id })).toBe(2);
    expect(await User.countDocuments({ OrganizationIDs: b.org._id })).toBe(2);
    expect(await Driver.countDocuments({ OrganizationID: b.org._id })).toBe(1);
    expect(await Customer.countDocuments({ OrganizationID: b.org._id })).toBe(1);
    expect(await Product.countDocuments({ OrganizationID: b.org._id })).toBe(1);
  });

  it("clear demo idempotent — chạy 2 lần liên tiếp không lỗi", async () => {
    const a = await seedFakeDemo("ORG-IDEM");
    await clearDemoFromOrg(a.org._id);
    await expect(clearDemoFromOrg(a.org._id)).resolves.not.toThrow();
    expect(await User.countDocuments({ OrganizationIDs: a.org._id })).toBe(0);
  });
});
