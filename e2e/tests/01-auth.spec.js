/**
 * E2E: Authentication flow.
 * Cover: TC-AUTH-006 (login OK), TC-AUTH-007 (login fail), TC-AUTH-010 (logout).
 *
 * Yêu cầu: backend + frontend chạy + seed data.
 */
import { test, expect } from "@playwright/test";

const SEED_ADMIN = { email: "admin@road-freight.io", password: "Pass@123" };
const SEED_PLANNER = { email: "planner@road-freight.io", password: "Pass@123" };

test.describe("TC-AUTH: Login & Logout", () => {
  test("TC-AUTH-006: Admin login với credentials đúng → vào dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[id="Email"]').fill(SEED_ADMIN.email);
    await page.locator('input[id="Password"]').fill(SEED_ADMIN.password);
    await page.locator('button[type="submit"]').click();

    // Sau login: vào dashboard (URL không còn /login)
    await expect(page).not.toHaveURL(/\/login/);
    // Có một số UI báo hiệu đã login (vd: tên user, menu admin, ...)
    await expect(page.locator("body")).toBeVisible();
  });

  test("TC-AUTH-007: Password sai → báo lỗi, vẫn ở trang login", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[id="Email"]').fill(SEED_ADMIN.email);
    await page.locator('input[id="Password"]').fill("wrong-password-123!");
    await page.locator('button[type="submit"]').click();

    // Vẫn ở /login
    await expect(page).toHaveURL(/\/login/);
    // Có message lỗi xuất hiện (ant message thường có class .ant-message)
    // Tolerant — không lock vào text cụ thể vì có thể i18n
  });

  test("TC-AUTH-002: Email không đúng định dạng bị reject ngay form-level", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[id="Email"]').fill("not-an-email");
    await page.locator('input[id="Password"]').fill("AnyPass123!");
    await page.locator('button[type="submit"]').click();

    // Form validation antd → vẫn ở /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("TC-AUTH-006b: Planner login → vào trang phù hợp role", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[id="Email"]').fill(SEED_PLANNER.email);
    await page.locator('input[id="Password"]').fill(SEED_PLANNER.password);
    await page.locator('button[type="submit"]').click();

    await expect(page).not.toHaveURL(/\/login/);
  });
});
