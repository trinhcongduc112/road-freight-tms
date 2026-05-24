/**
 * E2E: Smoke navigation — vào từng trang chính, đảm bảo không crash.
 *
 * Không click sâu vào CRUD — chỉ verify render được.
 * Đây là "deployment health check" — chạy nhanh để biết hệ thống có lên không.
 */
import { test, expect } from "@playwright/test";

const ADMIN = { email: "admin@road-freight.io", password: "Pass@123" };

test.describe("TC-NAV: Smoke test các trang chính", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[id="Email"]').fill(ADMIN.email);
    await page.locator('input[id="Password"]').fill(ADMIN.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("Dashboard / render được", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$|^\/$|dashboard|admin/);
    // Không có lỗi React crash
    const errors = await page.evaluate(() =>
      document.body.innerText.toLowerCase().includes("something went wrong")
    );
    expect(errors).toBe(false);
  });

  test("Orders page mở được", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/orders/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("Planning page mở được", async ({ page }) => {
    await page.goto("/planning");
    await expect(page).toHaveURL(/\/planning/);
  });

  test("Master data page mở được", async ({ page }) => {
    await page.goto("/master-data");
    await expect(page).toHaveURL(/\/master-data/);
  });

  test("Monitoring page mở được", async ({ page }) => {
    await page.goto("/monitoring");
    await expect(page).toHaveURL(/\/monitoring/);
  });

  test("Reports page mở được", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/reports/);
  });
});
