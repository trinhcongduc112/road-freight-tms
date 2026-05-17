/**
 * Unit tests cho fallback parser của AI Agent.
 * Test trực tiếp hàm thật trong aiAgentService — KHÔNG re-implement.
 * Dùng fake timers để cố định "now" → tránh flaky theo timezone/giờ chạy.
 */
import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import { extractDate } from "../../src/services/aiAgentService.js";

// Cố định "now" tại 2026-05-17T12:00:00Z (UTC giữa trưa — tránh ngày bị lệch theo timezone)
const FIXED_NOW = new Date("2026-05-17T12:00:00Z");

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  jest.useRealTimers();
});

describe("AI Agent: extractDate", () => {
  it("hôm nay → 2026-05-17", () => {
    expect(extractDate("lap ke hoach hom nay")).toBe("2026-05-17");
  });

  it("ngày mai → 2026-05-18", () => {
    expect(extractDate("ke hoach ngay mai")).toBe("2026-05-18");
  });

  it("hôm qua → 2026-05-16", () => {
    expect(extractDate("bao cao hom qua")).toBe("2026-05-16");
  });

  it("ngày kia → 2026-05-19", () => {
    expect(extractDate("ke hoach ngay kia")).toBe("2026-05-19");
  });

  it("dd/mm/yyyy format → giữ nguyên năm", () => {
    expect(extractDate("ke hoach 15/03/2026")).toBe("2026-03-15");
  });

  it("dd/mm format → suy ra năm hiện tại", () => {
    expect(extractDate("ngay 05/07")).toBe("2026-07-05");
  });

  it("dd-mm-yy format → mở rộng năm 2 chữ số", () => {
    expect(extractDate("14-5-26")).toBe("2026-05-14");
  });

  it("ngày DD tháng MM → format Vietnamese", () => {
    expect(extractDate("ngay 14 thang 5")).toBe("2026-05-14");
  });

  it("không có ngày trong câu → null", () => {
    expect(extractDate("xin chao AI")).toBeNull();
  });

  it("day >31 → reject", () => {
    expect(extractDate("ke hoach 32/01/2026")).toBeNull();
  });

  it("month >12 → reject", () => {
    expect(extractDate("ke hoach 15/13/2026")).toBeNull();
  });
});
