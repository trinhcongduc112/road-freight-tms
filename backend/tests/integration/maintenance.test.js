/**
 * Integration tests cho Vehicle Maintenance.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import express from "express";
import "express-async-errors";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb, clearTestDb } from "../setup.js";

let app;
let request;
let userToken;
let orgId, vehicleId;

beforeAll(async () => {
  await setupTestDb();
  const { default: supertest } = await import("supertest");
  const { authRouter } = await import("../../src/routes/authRoutes.js");
  const { maintenanceRouter } = await import("../../src/routes/maintenanceRoutes.js");
  const { errorHandler } = await import("../../src/middlewares/errorHandler.js");
  const { Vehicle } = await import("../../src/models/Vehicle.js");
  const { Organization } = await import("../../src/models/Organization.js");
  const { User } = await import("../../src/models/User.js");
  const jwt = (await import("jsonwebtoken")).default;

  app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use("/api/maintenance", maintenanceRouter);
  app.use(errorHandler);
  request = supertest(app);

  // Tạo org + user + vehicle để test
  await clearTestDb();
  const org = await Organization.create({
    OrganizationCode: "ORG001",
    XName: "Test Org"
  });
  orgId = org._id;
  const user = await User.create({
    Email: "vehicle@test.com",
    Password: "hashed",
    FullName: "Vehicle Tester",
    OrganizationIDs: [orgId],
    IsSuperAdmin: false
  });
  const vehicle = await Vehicle.create({
    VehicleCode: "29A-99999",
    XName: "Test Truck",
    OrganizationID: orgId,
    LicensePlate: "29A-99999",
    VehicleType: "TRUCK",
    Status: "Active"
  });
  vehicleId = vehicle._id;

  userToken = jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET ?? "test-secret",
    { expiresIn: "1h" }
  );
});

afterAll(async () => {
  await teardownTestDb();
});

describe("POST /api/maintenance", () => {
  it("từ chối khi không có token", async () => {
    const res = await request.post("/api/maintenance").send({
      VehicleID: vehicleId.toString(),
      Type: "OIL_CHANGE",
      Title: "Thay nhớt",
      ScheduledDate: new Date()
    });
    expect(res.status).toBe(401);
  });

  it("tạo lịch bảo dưỡng thành công", async () => {
    const res = await request
      .post("/api/maintenance")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        VehicleID: vehicleId.toString(),
        Type: "OIL_CHANGE",
        Title: "Thay nhớt 5000km",
        ScheduledDate: "2026-06-01",
        OdometerAtService: 5000,
        NextServiceOdometer: 10000,
        Cost: 800000
      });
    expect(res.status).toBe(201);
    expect(res.body.data.Title).toBe("Thay nhớt 5000km");
  });

  it("từ chối khi thiếu field bắt buộc", async () => {
    const res = await request
      .post("/api/maintenance")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ Type: "OIL_CHANGE" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("GET /api/maintenance", () => {
  it("liệt kê maintenance records của org", async () => {
    const res = await request
      .get("/api/maintenance")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});

describe("GET /api/maintenance/alerts", () => {
  it("trả về cấu trúc upcoming + overdue + odometerWarnings", async () => {
    const res = await request
      .get("/api/maintenance/alerts")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("upcoming");
    expect(res.body.data).toHaveProperty("overdue");
    expect(res.body.data).toHaveProperty("odometerWarnings");
    expect(res.body.data).toHaveProperty("summary");
  });
});
