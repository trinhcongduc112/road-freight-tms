/**
 * Unit tests cho usePermissions hook.
 * Test 3 nguồn permission: super-admin, role.Permissions, user.FunctionRoles.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "./permissions.js";
import { useAuthStore } from "../store/authStore.js";

function setAuth({ user = null, role = null, token = "fake" } = {}) {
  useAuthStore.setState({ token, user, role });
}

beforeEach(() => {
  useAuthStore.setState({ token: null, user: null, role: null });
});

describe("usePermissions — super admin", () => {
  it("SuperAdmin pass mọi permission", () => {
    setAuth({ user: { IsSuperAdmin: true } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isSuper).toBe(true);
    expect(result.current.can("anything:weird")).toBe(true);
  });
});

describe("usePermissions — wildcard '*'", () => {
  it("Permission '*' pass mọi check", () => {
    setAuth({ user: {}, role: { Permissions: ["*"] } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isAll).toBe(true);
    expect(result.current.can("customer:read")).toBe(true);
  });
});

describe("usePermissions — exact + wildcard match", () => {
  it("Exact match", () => {
    setAuth({ user: {}, role: { Permissions: ["customer:read"] } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("customer:read")).toBe(true);
    expect(result.current.can("customer:delete")).toBe(false);
  });

  it("Module wildcard 'customer:*' pass mọi action", () => {
    setAuth({ user: {}, role: { Permissions: ["customer:*"] } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("customer:read")).toBe(true);
    expect(result.current.can("customer:delete")).toBe(true);
    expect(result.current.can("order:read")).toBe(false);
  });

  it("'manage' grant ngụ ý mọi action", () => {
    setAuth({ user: {}, role: { Permissions: ["customer:manage"] } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("customer:read")).toBe(true);
    expect(result.current.can("customer:update")).toBe(true);
  });
});

describe("usePermissions — function roles (PLANNER, ACCOUNTANT)", () => {
  it("PLANNER có order:manage", () => {
    setAuth({ user: { FunctionRoles: ["PLANNER"] } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("order:manage")).toBe(true);
    expect(result.current.can("customer:read")).toBe(true);
    expect(result.current.can("report:read")).toBe(false); // PLANNER không có báo cáo
  });

  it("ACCOUNTANT có báo cáo NHƯNG không có route_plan", () => {
    setAuth({ user: { FunctionRoles: ["ACCOUNTANT"] } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("report:read")).toBe(true);
    expect(result.current.can("report:export")).toBe(true);
    expect(result.current.can("route_plan:manage")).toBe(false);
  });

  it("DRIVER chỉ có trip + order read", () => {
    setAuth({ user: { FunctionRoles: ["DRIVER"] } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("trip:read")).toBe(true);
    expect(result.current.can("trip:update")).toBe(true);
    expect(result.current.can("customer:manage")).toBe(false);
  });
});

describe("usePermissions — canAny (OR)", () => {
  it("Pass nếu có ít nhất 1 permission", () => {
    setAuth({ user: {}, role: { Permissions: ["order:read"] } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canAny("order:read", "trip:read")).toBe(true);
    expect(result.current.canAny("xyz:abc", "abc:xyz")).toBe(false);
  });
});

describe("usePermissions — empty/null safety", () => {
  it("User chưa login (null) → deny tất", () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("customer:read")).toBe(false);
    expect(result.current.isSuper).toBe(false);
  });

  it("can(undefined) → false (không crash)", () => {
    setAuth({ user: {}, role: { Permissions: ["*"] } });
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can(undefined)).toBe(false);
  });
});
