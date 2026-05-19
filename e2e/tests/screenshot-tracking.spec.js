/**
 * Chụp screenshot trang Public Tracking cho thesis (Hình 3.12).
 *
 * Output: e2e/screenshots/public-tracking-*.png
 *
 * Chạy: cd e2e && npx playwright test screenshot-tracking.spec.js
 */
import { test } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "screenshots");

test.describe("Screenshot — Public Tracking (Hình 3.12)", () => {
  test.use({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2  // retina-quality cho thesis
  });

  test("1. Empty state — form tra cứu", async ({ page }) => {
    await page.goto("/track");
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(OUT_DIR, "tracking-01-form.png"),
      fullPage: true
    });
  });

  test("2. Order đang giao (SHIPPED) — có truck trên map", async ({ page }) => {
    // Mock API trả về data đầy đủ với GPS để map hiện ra
    await page.route("**/api/track/ORD-20250506-001", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            order: {
              code: "ORD-20250506-001",
              status: "SHIPPED",
              date: "2026-05-17T03:00:00Z",
              timeWindow: "08:00 - 11:00"
            },
            timeline: [
              { status: "OPEN", at: "2026-05-17T03:00:00Z", note: "Tiếp nhận đơn từ khách" },
              { status: "PICKED_PACKED", at: "2026-05-17T06:30:00Z", note: "Đã đóng gói tại kho" },
              { status: "SHIPPED", at: "2026-05-17T08:00:00Z", note: "Xe đã xuất kho" }
            ],
            trip: {
              tripCode: "TRIP-20260517-A1",
              status: "IN_PROGRESS",
              plannedStart: "2026-05-17T08:00:00Z",
              startedAt: "2026-05-17T08:00:00Z",
              completedAt: null,
              driver: { name: "Nguyễn Văn A", phone: "0901234567" },
              vehicle: "29H-12345",
              currentLocation: {
                latitude: 10.7769,
                longitude: 106.7009,
                speed: 35,
                updatedAt: new Date().toISOString()
              },
              stop: {
                index: 3,
                address: "Số 36 Ngô Đức Kế, Phường Bến Nghé, Q.1, TP.HCM",
                plannedArrival: "09:30",
                status: "IN_PROGRESS",
                arrivedAt: null,
                completedAt: null,
                failedAt: null,
                failureReason: "",
                podImages: [],
                signature: null,
                codAmount: 2565000,
                cashCollected: 0
              }
            },
            eta: { plannedAt: "09:30", label: "Dự kiến giao lúc 09:30" },
            lastUpdated: new Date().toISOString()
          }
        })
      });
    });
    await page.goto("/track/ORD-20250506-001");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);  // chờ map tiles
    await page.screenshot({
      path: path.join(OUT_DIR, "tracking-02-in-progress.png"),
      fullPage: true
    });
  });

  test("3. Order đã giao (DELIVERED) — timeline đầy đủ", async ({ page }) => {
    await page.goto("/track/ORD-20250502-001");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUT_DIR, "tracking-03-delivered.png"),
      fullPage: true
    });
  });

  test("4. Order không tồn tại — error state", async ({ page }) => {
    await page.goto("/track/INVALID-CODE-999");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(OUT_DIR, "tracking-04-not-found.png"),
      fullPage: true
    });
  });
});
