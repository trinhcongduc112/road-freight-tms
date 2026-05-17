/**
 * Unit tests cho authStore (zustand).
 * Test state transitions: setSession, setToken, logout, selector.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore, selectIsAuthenticated } from "./authStore.js";

beforeEach(() => {
  useAuthStore.setState({ token: null, refreshToken: null, user: null, role: null });
});

describe("authStore — initial state", () => {
  it("Khởi tạo với mọi field = null", () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.role).toBeNull();
  });
});

describe("authStore — setSession", () => {
  it("Lưu đầy đủ token + user + role", () => {
    const session = {
      token: "access-123",
      refreshToken: "refresh-456",
      user: { Email: "u@a.com" },
      role: { Permissions: ["customer:read"] }
    };
    useAuthStore.getState().setSession(session);
    const s = useAuthStore.getState();
    expect(s.token).toBe("access-123");
    expect(s.refreshToken).toBe("refresh-456");
    expect(s.user.Email).toBe("u@a.com");
    expect(s.role.Permissions).toEqual(["customer:read"]);
  });

  it("refreshToken null → coerce thành null (không undefined)", () => {
    useAuthStore.getState().setSession({ token: "t1", user: {} });
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it("role null → coerce thành null", () => {
    useAuthStore.getState().setSession({ token: "t1", user: {} });
    expect(useAuthStore.getState().role).toBeNull();
  });
});

describe("authStore — setToken (chỉ update access token)", () => {
  it("Update token, giữ nguyên user/role", () => {
    useAuthStore.getState().setSession({
      token: "old-token", refreshToken: "rt1", user: { Email: "u@a.com" }, role: { Permissions: [] }
    });
    useAuthStore.getState().setToken("new-token");
    const s = useAuthStore.getState();
    expect(s.token).toBe("new-token");
    expect(s.user.Email).toBe("u@a.com");
    expect(s.refreshToken).toBe("rt1");
  });
});

describe("authStore — logout", () => {
  it("Reset hết về null", () => {
    useAuthStore.getState().setSession({
      token: "t", refreshToken: "rt", user: { Email: "u" }, role: { Permissions: [] }
    });
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.token).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.user).toBeNull();
    expect(s.role).toBeNull();
  });
});

describe("selectIsAuthenticated", () => {
  it("true khi có token", () => {
    expect(selectIsAuthenticated({ token: "abc" })).toBe(true);
  });

  it("false khi token null", () => {
    expect(selectIsAuthenticated({ token: null })).toBe(false);
  });

  it("false khi token rỗng", () => {
    expect(selectIsAuthenticated({ token: "" })).toBe(false);
  });
});
