/**
 * Unit tests cho công thức tính lương tài xế.
 * Test logic thuần (không cần DB) — chạy nhanh, deterministic.
 */
import { jest, describe, it, expect } from "@jest/globals";

// Re-implement công thức để test (mirror payrollController.js)
const CONFIG = {
  baseSalary: 8_000_000,
  kmThreshold: 1000,
  perKmBonus: 500,
  perCompletedTrip: 50_000,
  codCommissionRate: 0.005
};

function calcGross(stats) {
  // KHÔNG phạt huỷ — huỷ chuyến thường do planner/khách, không phải lỗi tài xế
  const kmBonus = Math.max(0, stats.totalDistance - CONFIG.kmThreshold) * CONFIG.perKmBonus;
  const completionBonus = stats.completed * CONFIG.perCompletedTrip;
  const codCommission = Math.round(stats.totalCOD * CONFIG.codCommissionRate);
  return CONFIG.baseSalary + kmBonus + completionBonus + codCommission;
}

describe("Driver payroll calculation", () => {
  it("trả lương cứng khi không có chuyến", () => {
    expect(calcGross({ totalDistance: 0, completed: 0, cancelled: 0, totalCOD: 0 })).toBe(8_000_000);
  });

  it("không cộng km bonus nếu chưa vượt ngưỡng", () => {
    const gross = calcGross({ totalDistance: 500, completed: 0, cancelled: 0, totalCOD: 0 });
    expect(gross).toBe(8_000_000);
  });

  it("cộng 500đ/km cho phần vượt ngưỡng 1000km", () => {
    const gross = calcGross({ totalDistance: 1500, completed: 0, cancelled: 0, totalCOD: 0 });
    expect(gross).toBe(8_000_000 + 500 * 500); // 8tr + 250k
  });

  it("cộng 50k/chuyến hoàn thành", () => {
    const gross = calcGross({ totalDistance: 0, completed: 10, cancelled: 0, totalCOD: 0 });
    expect(gross).toBe(8_000_000 + 500_000);
  });

  it("cộng 0.5% COD đã thu", () => {
    const gross = calcGross({ totalDistance: 0, completed: 0, cancelled: 0, totalCOD: 100_000_000 });
    expect(gross).toBe(8_000_000 + 500_000);
  });

  it("KHÔNG trừ lương dù tài xế có chuyến bị huỷ (huỷ là lỗi planner/khách)", () => {
    const gross = calcGross({ totalDistance: 0, completed: 0, cancelled: 3, totalCOD: 0 });
    expect(gross).toBe(8_000_000);
  });

  it("kết hợp đầy đủ — chuyến trung bình", () => {
    // 1 tháng: chạy 2000km, hoàn thành 20 chuyến, có 2 chuyến huỷ, thu COD 50tr
    const gross = calcGross({ totalDistance: 2000, completed: 20, cancelled: 2, totalCOD: 50_000_000 });
    // Base 8tr + km bonus (1000*500=500k) + completion (20*50k=1tr) + COD (50tr*0.5%=250k)
    // Chuyến huỷ KHÔNG bị trừ
    expect(gross).toBe(8_000_000 + 500_000 + 1_000_000 + 250_000);
  });
});
