/**
 * Integration test cho audit middleware.
 * Bắn HTTP qua app fake → đợi AuditLog ghi xong → assert đúng Action + Resource.
 *
 * Test các lifecycle action mới (FINALIZE, LOCK, OPTIMIZE, DISPATCH) — đây là
 * lý do user yêu cầu update audit log ban đầu.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import express from "express";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb, clearTestDb } from "../setup.js";

let app, request, AuditLog, auditLogger;
const FAKE_ORG_ID = new mongoose.Types.ObjectId();
const FAKE_USER_ID = new mongoose.Types.ObjectId();

beforeAll(async () => {
  await setupTestDb();
  const { default: supertest } = await import("supertest");
  ({ auditLogger } = await import("../../src/middlewares/audit.js"));
  ({ AuditLog } = await import("../../src/models/AuditLog.js"));

  app = express();
  app.use(express.json());
  // Fake auth attaches user/role với ObjectId thật
  app.use((req, _res, next) => {
    req.user = { _id: FAKE_USER_ID, Email: "tester@acme.com", FullName: "Tester", OrganizationIDs: [FAKE_ORG_ID] };
    req.role = { OrganizationID: FAKE_ORG_ID };
    next();
  });
  app.use(auditLogger());

  // Routes mô phỏng các action route-plan lifecycle
  app.post("/api/route-plans", (_req, res) => res.status(201).json({ ok: true }));
  app.post("/api/route-plans/:planId/finalize", (_req, res) => res.json({ ok: true }));
  app.post("/api/route-plans/:planId/lock", (_req, res) => res.json({ ok: true }));
  app.post("/api/route-plans/:planId/optimize", (_req, res) => res.json({ ok: true }));
  app.post("/api/route-plans/:planId/auto-dispatch", (_req, res) => res.json({ ok: true }));
  app.post("/api/orders", (_req, res) => res.status(201).json({ ok: true }));
  app.patch("/api/orders/:id", (_req, res) => res.json({ ok: true }));
  app.delete("/api/orders/:id", (_req, res) => res.json({ ok: true }));
  app.get("/api/orders/:id", (_req, res) => res.json({ ok: true }));   // không audit GET thường
  app.get("/api/reports/summary", (_req, res) => res.json({ ok: true })); // audit GET báo cáo
  app.get("/api/driver/12345/gps", (_req, res) => res.json({ ok: true }));  // SKIP

  request = supertest(app);
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

// Audit là fire-and-forget — poll ngắn để chờ ghi xong
async function waitForLog(filter, timeoutMs = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const log = await AuditLog.findOne(filter);
    if (log) return log;
    await new Promise((r) => setTimeout(r, 20));
  }
  return null;
}

describe("audit middleware — action mapping", () => {
  it("POST /api/route-plans → CREATE_PLAN", async () => {
    await request.post("/api/route-plans").send({ Date: "2026-05-17" });
    const log = await waitForLog({ Action: "CREATE_PLAN" });
    expect(log).toBeTruthy();
    expect(log.Resource).toBe("RoutePlan");
    expect(log.Method).toBe("POST");
  });

  it("POST .../finalize → FINALIZE", async () => {
    await request.post("/api/route-plans/abc123/finalize").send({});
    const log = await waitForLog({ Action: "FINALIZE" });
    expect(log).toBeTruthy();
    expect(log.ResourceID).toBe("abc123");
  });

  it("POST .../lock → LOCK", async () => {
    await request.post("/api/route-plans/abc123/lock").send({});
    const log = await waitForLog({ Action: "LOCK" });
    expect(log).toBeTruthy();
  });

  it("POST .../optimize → OPTIMIZE", async () => {
    await request.post("/api/route-plans/abc123/optimize").send({ algorithm: "hgs" });
    const log = await waitForLog({ Action: "OPTIMIZE" });
    expect(log).toBeTruthy();
  });

  it("POST .../auto-dispatch → DISPATCH", async () => {
    await request.post("/api/route-plans/abc123/auto-dispatch").send({});
    const log = await waitForLog({ Action: "DISPATCH" });
    expect(log).toBeTruthy();
  });

  it("POST /api/orders → CREATE", async () => {
    await request.post("/api/orders").send({ Code: "SO1" });
    const log = await waitForLog({ Action: "CREATE", Resource: "Order" });
    expect(log).toBeTruthy();
  });

  it("PATCH /api/orders/:id → UPDATE", async () => {
    await request.patch("/api/orders/o1").send({ CustomerName: "X" });
    const log = await waitForLog({ Action: "UPDATE", ResourceID: "o1" });
    expect(log).toBeTruthy();
  });

  it("DELETE /api/orders/:id → DELETE", async () => {
    await request.delete("/api/orders/o1");
    const log = await waitForLog({ Action: "DELETE", ResourceID: "o1" });
    expect(log).toBeTruthy();
  });
});

describe("audit middleware — payload sanitization", () => {
  it("KHÔNG ghi Password trong Changes", async () => {
    await request.post("/api/orders").send({ Code: "SO1", Password: "secret-do-not-log" });
    const log = await waitForLog({ Action: "CREATE", Resource: "Order" });
    expect(log).toBeTruthy();
    expect(JSON.stringify(log.Changes)).not.toMatch(/secret-do-not-log/);
    expect(log.Changes.Code).toBe("SO1");
  });

  it("Truncate string >200 ký tự", async () => {
    const longText = "x".repeat(500);
    await request.post("/api/orders").send({ Code: "SO1", Notes: longText });
    const log = await waitForLog({ Action: "CREATE", Resource: "Order" });
    expect(log.Changes.Notes.length).toBeLessThanOrEqual(203);
    expect(log.Changes.Notes).toMatch(/\.\.\.$/);
  });
});

describe("audit middleware — skip rules", () => {
  it("GET /api/orders/:id thường KHÔNG audit", async () => {
    await request.get("/api/orders/o1");
    await new Promise((r) => setTimeout(r, 200));
    const log = await AuditLog.findOne({ Path: "/api/orders/o1" });
    expect(log).toBeNull();
  });

  it("GET /api/reports/summary CÓ audit (EXPORT)", async () => {
    await request.get("/api/reports/summary");
    const log = await waitForLog({ Action: "EXPORT", Resource: "Report" });
    expect(log).toBeTruthy();
  });

  it("GPS push KHÔNG audit (skip-list)", async () => {
    await request.get("/api/driver/12345/gps");
    await new Promise((r) => setTimeout(r, 200));
    const log = await AuditLog.findOne({ Path: /\/gps/ });
    expect(log).toBeNull();
  });
});
