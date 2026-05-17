/**
 * Unit tests cho RBAC middleware.
 * Test 3 nhánh chính: SuperAdmin bypass / permission match / permission miss.
 */
import { describe, it, expect, jest } from "@jest/globals";
import { requirePermission, requireAnyPermission, requireSuperAdmin } from "../../src/middlewares/rbac.js";

function mockReq({ user, role } = {}) {
  return { user, role };
}

describe("requirePermission", () => {
  it("401 khi chưa authenticated", () => {
    const next = jest.fn();
    requirePermission("customer:read")(mockReq(), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it("SuperAdmin pass mọi permission", () => {
    const next = jest.fn();
    const req = mockReq({ user: { IsSuperAdmin: true }, role: { Permissions: [] } });
    requirePermission("customer:read", "customer:delete")(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("Pass khi có đủ tất cả permission (AND)", () => {
    const next = jest.fn();
    const req = mockReq({
      user: { IsSuperAdmin: false },
      role: { Permissions: ["customer:read", "customer:update"] }
    });
    requirePermission("customer:read", "customer:update")(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("403 khi thiếu một trong các permission", () => {
    const next = jest.fn();
    const req = mockReq({
      user: { IsSuperAdmin: false },
      role: { Permissions: ["customer:read"] }
    });
    requirePermission("customer:read", "customer:delete")(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("Pass khi wildcard '*'", () => {
    const next = jest.fn();
    const req = mockReq({
      user: { IsSuperAdmin: false },
      role: { Permissions: ["*"] }
    });
    requirePermission("customer:read")(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("Pass khi module wildcard 'customer:*'", () => {
    const next = jest.fn();
    const req = mockReq({
      user: { IsSuperAdmin: false },
      role: { Permissions: ["customer:*"] }
    });
    requirePermission("customer:read", "customer:delete")(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("Module wildcard không leak sang module khác", () => {
    const next = jest.fn();
    const req = mockReq({
      user: { IsSuperAdmin: false },
      role: { Permissions: ["customer:*"] }
    });
    requirePermission("vehicle:read")(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe("requireAnyPermission (OR)", () => {
  it("Pass khi có ít nhất 1 permission", () => {
    const next = jest.fn();
    const req = mockReq({
      user: { IsSuperAdmin: false },
      role: { Permissions: ["task:read"] }
    });
    requireAnyPermission("order:read", "task:read")(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("403 khi không có permission nào", () => {
    const next = jest.fn();
    const req = mockReq({
      user: { IsSuperAdmin: false },
      role: { Permissions: ["customer:read"] }
    });
    requireAnyPermission("order:read", "task:read")(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

describe("requireSuperAdmin", () => {
  it("Pass cho SuperAdmin", () => {
    const next = jest.fn();
    requireSuperAdmin(mockReq({ user: { IsSuperAdmin: true } }), {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("403 cho user thường", () => {
    const next = jest.fn();
    requireSuperAdmin(mockReq({ user: { IsSuperAdmin: false } }), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("401 khi chưa authenticated", () => {
    const next = jest.fn();
    requireSuperAdmin(mockReq(), {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
