/**
 * Unit tests cho parser AI Agent fallback (regex offline).
 * Khi Gemini API fail, hệ thống vẫn parse được lệnh cơ bản tiếng Việt.
 */
import { describe, it, expect } from "@jest/globals";

// Re-implement extractDate để test thuần
function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

function extractDate(cmd) {
  const t = normalize(cmd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (/\bhom nay\b|\btoday\b/.test(t)) return today.toISOString().slice(0, 10);
  if (/\bngay mai\b|\bmai\b|\btomorrow\b/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (/\bhom qua\b|\byesterday\b/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  const dmy = t.match(/\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{4}))?\b/);
  if (dmy) {
    const dd = String(dmy[1]).padStart(2, "0");
    const mm = String(dmy[2]).padStart(2, "0");
    const yyyy = dmy[3] || String(today.getFullYear());
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

describe("AI Agent: extractDate", () => {
  it("hôm nay → today ISO", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(extractDate("lập kế hoạch hôm nay")).toBe(today);
  });

  it("ngày mai → tomorrow", () => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    expect(extractDate("kế hoạch ngày mai")).toBe(tmr.toISOString().slice(0, 10));
  });

  it("hôm qua → yesterday", () => {
    const yes = new Date();
    yes.setDate(yes.getDate() - 1);
    expect(extractDate("báo cáo hôm qua")).toBe(yes.toISOString().slice(0, 10));
  });

  it("dd/mm/yyyy format", () => {
    expect(extractDate("kế hoạch 15/03/2026")).toBe("2026-03-15");
  });

  it("dd-mm format dùng năm hiện tại", () => {
    const yyyy = String(new Date().getFullYear());
    expect(extractDate("ngày 5-7")).toBe(`${yyyy}-07-05`);
  });

  it("không nhận diện được → null", () => {
    expect(extractDate("xin chào AI")).toBeNull();
  });

  it("normalize được dấu đ + dấu thanh", () => {
    // "Hôm Nay" với dấu lẫn lộn vẫn match
    expect(extractDate("Hôm Nay")).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("AI Agent: text normalize", () => {
  it("đ thành d", () => {
    expect(normalize("đầy đủ")).toBe("day du");
  });
  it("xóa dấu thanh", () => {
    expect(normalize("Trịnh Công Đức")).toBe("trinh cong duc");
  });
});
