/**
 * Tự động chụp màn hình các trang chính của Road Freight TMS web
 * và lưu vào docs-site/static/img/screenshots/.
 *
 * Yêu cầu: backend (5000) + frontend (5173) đang chạy, DB đã seed.
 *
 * Run: node scripts/screenshots/capture.mjs
 * Env: BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (có default cho seed account)
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../docs-site/static/img/screenshots");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const EMAIL = process.env.ADMIN_EMAIL ?? "superadmin@road-freight.io";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@123";
const VIEWPORT = { width: 1440, height: 900 };

async function shot(page, filename, opts = {}) {
  const path = join(OUT_DIR, filename);
  await page.waitForTimeout(opts.wait ?? 800);
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  console.log(`  ✔ ${filename}`);
}

async function safeShot(page, filename, action) {
  try {
    await action();
    await shot(page, filename);
  } catch (err) {
    console.log(`  ✗ ${filename} — ${err.message.slice(0, 80)}`);
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: "vi-VN" });
  const page = await ctx.newPage();

  console.log("\n── Trang đăng nhập (chưa auth) ──");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await shot(page, "login-page.png");

  // Fill form (without submitting) để chụp form đã điền
  await safeShot(page, "login-form.png", async () => {
    await page.fill('input[placeholder="admin@company.com"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
  });

  console.log("\n── Đăng nhập ──");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  console.log("\n── Trang chủ / Dashboard ──");
  await safeShot(page, "dashboard.png", () => page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" }));

  console.log("\n── Quản trị (Admin) ──");
  await safeShot(page, "admin-org-tree.png", () =>
    page.goto(`${BASE_URL}/admin?tab=organizations`, { waitUntil: "networkidle" })
  );
  await safeShot(page, "admin-role-presets.png", () =>
    page.goto(`${BASE_URL}/admin?tab=user-groups`, { waitUntil: "networkidle" })
  );
  await safeShot(page, "admin-users-list.png", () =>
    page.goto(`${BASE_URL}/admin?tab=users`, { waitUntil: "networkidle" })
  );
  await safeShot(page, "admin-audit-list.png", () =>
    page.goto(`${BASE_URL}/admin?tab=audit-logs`, { waitUntil: "networkidle" })
  );

  console.log("\n── Master Data ──");
  await safeShot(page, "md-customers.png", () =>
    page.goto(`${BASE_URL}/master-data?tab=customers`, { waitUntil: "networkidle" })
  );
  await safeShot(page, "md-products.png", () =>
    page.goto(`${BASE_URL}/master-data?tab=products`, { waitUntil: "networkidle" })
  );
  await safeShot(page, "md-vehicles.png", () =>
    page.goto(`${BASE_URL}/master-data?tab=vehicles`, { waitUntil: "networkidle" })
  );
  await safeShot(page, "md-maintenance.png", () =>
    page.goto(`${BASE_URL}/master-data?tab=maintenance`, { waitUntil: "networkidle" })
  );

  console.log("\n── Đơn hàng ──");
  await safeShot(page, "orders-list.png", () =>
    page.goto(`${BASE_URL}/orders`, { waitUntil: "networkidle" })
  );

  console.log("\n── Lập kế hoạch ──");
  await safeShot(page, "planning-overview.png", () =>
    page.goto(`${BASE_URL}/planning`, { waitUntil: "networkidle" })
  );

  console.log("\n── Giám sát ──");
  await safeShot(page, "monitor-map.png", () =>
    page.goto(`${BASE_URL}/monitoring`, { waitUntil: "networkidle" })
  );

  console.log("\n── Báo cáo ──");
  await safeShot(page, "report-overview.png", () =>
    page.goto(`${BASE_URL}/reports?tab=report`, { waitUntil: "networkidle" })
  );
  await safeShot(page, "payroll-table.png", () =>
    page.goto(`${BASE_URL}/reports?tab=payroll`, { waitUntil: "networkidle" })
  );

  console.log("\n── AI Agent panel ──");
  await safeShot(page, "agent-panel.png", async () => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.getByText("AI Agent", { exact: true }).first().click();
    await page.waitForTimeout(800);
  });

  console.log("\n── Hỏi đáp Chatbot ──");
  await safeShot(page, "chatbot-open.png", async () => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.getByText("Hỏi đáp", { exact: true }).first().click();
    await page.waitForTimeout(800);
  });

  console.log("\n── Tracking công khai (logout state) ──");
  // Logout context để không bị redirect
  const pubCtx = await browser.newContext({ viewport: VIEWPORT, locale: "vi-VN" });
  const pubPage = await pubCtx.newPage();
  await safeShot(pubPage, "tracking-input.png", () =>
    pubPage.goto(`${BASE_URL}/track`, { waitUntil: "networkidle" })
  );
  await pubCtx.close();

  console.log("\n✅ Hoàn tất!");
  await browser.close();
}

main().catch((err) => {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
});
