/**
 * Unit tests cho env config.
 * Vitest set VITE_API_URL = undefined → default ngả về localhost:5000/api.
 */
import { describe, it, expect } from "vitest";
import { env } from "./env.js";

describe("env config", () => {
  it("apiUrl có giá trị (default hoặc từ VITE_API_URL)", () => {
    expect(env.apiUrl).toBeTruthy();
    expect(typeof env.apiUrl).toBe("string");
  });

  it("socketUrl = apiUrl bỏ '/api'", () => {
    expect(env.socketUrl).toBe(env.apiUrl.replace("/api", ""));
  });

  it("socketUrl KHÔNG kết thúc bằng '/api'", () => {
    expect(env.socketUrl.endsWith("/api")).toBe(false);
  });
});
