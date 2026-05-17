/**
 * Vitest setup — chạy 1 lần trước test suite.
 * - Mở rộng expect với matcher của jest-dom (toBeInTheDocument, etc.)
 * - Mock matchMedia (jsdom không có sẵn → antd cần)
 */
import "@testing-library/jest-dom/vitest";

// Antd dùng matchMedia → jsdom chưa support, polyfill
window.matchMedia = window.matchMedia || function () {
  return {
    matches: false,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  };
};
