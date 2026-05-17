/**
 * Integration tests cho DAC (Discretionary Access Control) — phạm vi org theo cây con cháu.
 * Build cây org A→B→C, D độc lập; assert đúng scope cho từng role/kind.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb, clearTestDb } from "../setup.js";

let resolveOrgScope, scopeFilter, assertOrgInScope;
let Organization, RoleGroupKind;
let orgA, orgB, orgC, orgD;

beforeAll(async () => {
  await setupTestDb();
  ({ resolveOrgScope, scopeFilter, assertOrgInScope } = await import("../../src/middlewares/dac.js"));
  ({ Organization } = await import("../../src/models/Organization.js"));
  ({ RoleGroupKind } = await import("../../src/models/RoleGroup.js"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearTestDb();

  // Cây tổ chức:
  //   A (gốc)
  //   └─ B
  //       └─ C
  //   D (gốc khác — không liên quan)
  orgA = await Organization.create({ XCode: "A", XName: "Org A", Parent: null, Path: [] });
  orgB = await Organization.create({
    XCode: "B", XName: "Org B",
    Parent: orgA._id,
    Path: [orgA._id]
  });
  orgC = await Organization.create({
    XCode: "C", XName: "Org C",
    Parent: orgB._id,
    Path: [orgA._id, orgB._id]
  });
  orgD = await Organization.create({ XCode: "D", XName: "Org D", Parent: null, Path: [] });
});

describe("resolveOrgScope", () => {
  it("SuperAdmin → null (no filter, xem hết)", async () => {
    const scope = await resolveOrgScope({ user: { IsSuperAdmin: true } });
    expect(scope).toBeNull();
  });

  it("User không có org → Set rỗng", async () => {
    const scope = await resolveOrgScope({
      user: { IsSuperAdmin: false, OrganizationIDs: [] }
    });
    expect(scope.size).toBe(0);
  });

  it("ADMIN của A → thấy A + B + C (toàn bộ con cháu)", async () => {
    const scope = await resolveOrgScope({
      user: { IsSuperAdmin: false, OrganizationIDs: [orgA._id] },
      role: { Kind: RoleGroupKind.ADMIN }
    });
    expect(scope.has(orgA._id.toString())).toBe(true);
    expect(scope.has(orgB._id.toString())).toBe(true);
    expect(scope.has(orgC._id.toString())).toBe(true);
    expect(scope.has(orgD._id.toString())).toBe(false);
  });

  it("ADMIN của B → thấy B + C, KHÔNG thấy A (cha)", async () => {
    const scope = await resolveOrgScope({
      user: { IsSuperAdmin: false, OrganizationIDs: [orgB._id] },
      role: { Kind: RoleGroupKind.ADMIN }
    });
    expect(scope.has(orgA._id.toString())).toBe(false);
    expect(scope.has(orgB._id.toString())).toBe(true);
    expect(scope.has(orgC._id.toString())).toBe(true);
  });

  it("NORMAL + seeChildren=false → đúng A, không có con", async () => {
    const scope = await resolveOrgScope({
      user: { IsSuperAdmin: false, OrganizationIDs: [orgA._id] },
      role: { Kind: RoleGroupKind.NORMAL, Configurations: { SeeChildren: false } }
    });
    expect(scope.has(orgA._id.toString())).toBe(true);
    expect(scope.has(orgB._id.toString())).toBe(false);
  });

  it("NORMAL + seeChildren=true → A + descendants", async () => {
    const scope = await resolveOrgScope({
      user: { IsSuperAdmin: false, OrganizationIDs: [orgA._id] },
      role: { Kind: RoleGroupKind.NORMAL, Configurations: { SeeChildren: true } }
    });
    expect(scope.has(orgB._id.toString())).toBe(true);
    expect(scope.has(orgC._id.toString())).toBe(true);
  });

  it("Multi-tenant isolation: org A KHÔNG bao giờ thấy org D (cây riêng)", async () => {
    const scope = await resolveOrgScope({
      user: { IsSuperAdmin: false, OrganizationIDs: [orgA._id] },
      role: { Kind: RoleGroupKind.ADMIN }
    });
    expect(scope.has(orgD._id.toString())).toBe(false);
  });
});

describe("scopeFilter", () => {
  it("scope = null (SuperAdmin) → filter rỗng", () => {
    expect(scopeFilter(null)).toEqual({});
  });

  it("Empty scope → filter trả về 0 results", () => {
    const filter = scopeFilter(new Set());
    expect(filter).toEqual({ _id: null });
  });

  it("Scope có id → $in filter", () => {
    const filter = scopeFilter(new Set(["a", "b"]));
    expect(filter).toEqual({ OrganizationID: { $in: ["a", "b"] } });
  });

  it("Custom field name", () => {
    const filter = scopeFilter(new Set(["a"]), "OwnerOrgID");
    expect(filter).toEqual({ OwnerOrgID: { $in: ["a"] } });
  });
});

describe("assertOrgInScope", () => {
  it("scope = null → pass mọi orgId", () => {
    expect(() => assertOrgInScope(null, new mongoose.Types.ObjectId())).not.toThrow();
  });

  it("orgId trong scope → pass", () => {
    const id = "abc123";
    expect(() => assertOrgInScope(new Set([id]), id)).not.toThrow();
  });

  it("orgId ngoài scope → throw 403", () => {
    const otherId = new mongoose.Types.ObjectId();
    expect(() => assertOrgInScope(new Set(["abc"]), otherId)).toThrow(/out of scope/i);
  });
});
