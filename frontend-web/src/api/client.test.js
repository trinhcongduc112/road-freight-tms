/**
 * Integration tests cho axios apiClient — interceptors.
 *
 * Test 3 behavior chính:
 * 1. Request interceptor gắn Bearer token từ authStore
 * 2. Response 401 + có refreshToken → auto refresh + retry
 * 3. Response 401 ở public auth endpoint → KHÔNG refresh (chỉ forward error)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import { apiClient } from "./client.js";
import { useAuthStore } from "../store/authStore.js";

let mock;
let mockGlobalAxios;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  // axios.post() trong refresh path dùng top-level axios, không phải apiClient
  mockGlobalAxios = new MockAdapter(axios);
  useAuthStore.setState({ token: null, refreshToken: null, user: null, role: null });
});

afterEach(() => {
  mock.restore();
  mockGlobalAxios.restore();
});

describe("Request interceptor — Authorization header", () => {
  it("Không có token → KHÔNG gắn Authorization header", async () => {
    let receivedAuth;
    mock.onGet("/customers").reply((config) => {
      receivedAuth = config.headers.Authorization;
      return [200, { data: [] }];
    });
    await apiClient.get("/customers");
    expect(receivedAuth).toBeUndefined();
  });

  it("Có token → gắn 'Bearer <token>' vào header", async () => {
    useAuthStore.setState({ token: "abc-123" });
    let receivedAuth;
    mock.onGet("/customers").reply((config) => {
      receivedAuth = config.headers.Authorization;
      return [200, { data: [] }];
    });
    await apiClient.get("/customers");
    expect(receivedAuth).toBe("Bearer abc-123");
  });
});

describe("Response interceptor — 401 trên public auth endpoint", () => {
  it("Login fail (401) → KHÔNG trigger refresh, forward error message", async () => {
    mock.onPost("/auth/login").reply(401, { error: "Sai email hoặc mật khẩu" });
    let refreshCalled = false;
    mockGlobalAxios.onPost(/\/auth\/refresh$/).reply(() => {
      refreshCalled = true;
      return [200, { data: { token: "new" } }];
    });

    await expect(apiClient.post("/auth/login", {})).rejects.toThrow(/Sai email/);
    expect(refreshCalled).toBe(false);
  });

  it("Register fail (401) → KHÔNG refresh", async () => {
    mock.onPost("/auth/register").reply(401, { error: "Email đã tồn tại" });
    let refreshCalled = false;
    mockGlobalAxios.onPost(/\/auth\/refresh$/).reply(() => {
      refreshCalled = true;
      return [200];
    });
    await expect(apiClient.post("/auth/register", {})).rejects.toThrow();
    expect(refreshCalled).toBe(false);
  });
});

describe("Response interceptor — 401 + có refresh token", () => {
  it("Auto refresh + retry với token mới", async () => {
    useAuthStore.setState({
      token: "expired-token", refreshToken: "valid-refresh", user: { Email: "a@a.com" }, role: {}
    });

    // Lần 1: 401, lần 2 (retry): 200
    let callCount = 0;
    mock.onGet("/me").reply((config) => {
      callCount++;
      if (callCount === 1) return [401, { error: "Token expired" }];
      return [200, { data: { user: { Email: "a@a.com" } } }];
    });
    mockGlobalAxios.onPost(/\/auth\/refresh$/).reply(200, {
      data: { token: "fresh-token", refreshToken: "new-refresh" }
    });

    const result = await apiClient.get("/me");
    expect(callCount).toBe(2);
    expect(useAuthStore.getState().token).toBe("fresh-token");
    expect(useAuthStore.getState().refreshToken).toBe("new-refresh");
  });

  it("Refresh fail → logout state", async () => {
    useAuthStore.setState({
      token: "expired", refreshToken: "bad-refresh", user: { Email: "a@a.com" }, role: {}
    });
    mock.onGet("/me").reply(401);
    mockGlobalAxios.onPost(/\/auth\/refresh$/).reply(401);

    await expect(apiClient.get("/me")).rejects.toThrow(/Session expired/);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("Response interceptor — 401 + KHÔNG có refresh token", () => {
  it("401 + no refreshToken → logout ngay", async () => {
    useAuthStore.setState({ token: "lonely-token", refreshToken: null, user: { Email: "u@a.com" } });
    mock.onGet("/me").reply(401);

    await expect(apiClient.get("/me")).rejects.toThrow(/Session expired/);
    expect(useAuthStore.getState().token).toBeNull();
  });
});

describe("Response interceptor — error forwarding", () => {
  it("500 server error → forward error message", async () => {
    mock.onGet("/oops").reply(500, { error: "Internal error" });
    await expect(apiClient.get("/oops")).rejects.toThrow(/Internal error/);
  });

  it("Network error (không có response) → 'Network error' fallback", async () => {
    mock.onGet("/timeout").networkError();
    await expect(apiClient.get("/timeout")).rejects.toThrow();
  });

  it("Response data có 'message' field thay vì 'error'", async () => {
    mock.onGet("/x").reply(400, { message: "Validation failed" });
    await expect(apiClient.get("/x")).rejects.toThrow(/Validation failed/);
  });
});
