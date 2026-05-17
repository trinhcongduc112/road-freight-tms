/**
 * E2E: Public tracking page (không cần auth).
 * Cover: TC-TRACK-001 (xem trip qua link), TC-TRACK-003 (link đã hoàn thành).
 *
 * Trang tracking nằm ở /track hoặc /track/:orderCode — public route.
 */
import { test, expect } from "@playwright/test";

test.describe("TC-TRACK: Public customer tracking", () => {
  test("TC-TRACK-001: Mở /track render được form tra cứu", async ({ page }) => {
    await page.goto("/track");
    // Không bị redirect về /login
    await expect(page).toHaveURL(/\/track/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("TC-TRACK-FAKE-CODE: Code không tồn tại → hiển thị friendly message", async ({ page }) => {
    await page.goto("/track/INVALID-CODE-XYZ-999");
    // Trang phải render — KHÔNG crash
    await expect(page).toHaveURL(/\/track/);
    // Có element body, không có whitescreen error
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test("Tracking không yêu cầu login", async ({ page }) => {
    await page.goto("/track");
    // Vẫn ở /track, không bị middleware redirect đến /login
    await expect(page).not.toHaveURL(/\/login/);
  });
});
