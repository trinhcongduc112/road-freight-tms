/**
 * Integration tests cho Customer Tracking Portal — endpoint PUBLIC.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import express from "express";
import "express-async-errors";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb, clearTestDb } from "../setup.js";

let app;
let request;
let SalesOrder, Trip, OrderStatus, TripStatus;

beforeAll(async () => {
  await setupTestDb();
  const { default: supertest } = await import("supertest");
  const { trackingRouter } = await import("../../src/routes/trackingRoutes.js");
  const { errorHandler } = await import("../../src/middlewares/errorHandler.js");
  ({ SalesOrder, OrderStatus } = await import("../../src/models/SalesOrder.js"));
  ({ Trip, TripStatus } = await import("../../src/models/Trip.js"));

  app = express();
  app.use(express.json());
  app.use("/api/track", trackingRouter);
  app.use(errorHandler);
  request = supertest(app);
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

describe("GET /api/track/:orderCode (PUBLIC)", () => {
  it("trả 404 khi không tìm thấy đơn", async () => {
    const res = await request.get("/api/track/SO-FAKE");
    expect(res.status).toBe(404);
  });

  it("trả thông tin đơn cho khách (không cần auth)", async () => {
    const orgId = new mongoose.Types.ObjectId();
    await SalesOrder.create({
      OrderCode: "SO-2026-0001",
      OrganizationID: orgId,
      CustomerCode: "CUS001",
      OrderDate: new Date(),
      OrderStatus: OrderStatus.SHIPPED,
      StatusHistory: [
        { ToStatus: OrderStatus.OPEN, ChangedAt: new Date(Date.now() - 86400000) },
        { ToStatus: OrderStatus.SHIPPED, ChangedAt: new Date() }
      ]
    });

    const res = await request.get("/api/track/SO-2026-0001");
    expect(res.status).toBe(200);
    expect(res.body.data.order.code).toBe("SO-2026-0001");
    expect(res.body.data.timeline.length).toBe(2);
  });

  it("trả thông tin trip + GPS khi đơn đang được giao", async () => {
    const orgId = new mongoose.Types.ObjectId();
    const orderCode = "SO-2026-0002";
    await SalesOrder.create({
      OrderCode: orderCode,
      OrganizationID: orgId,
      CustomerCode: "CUS001",
      OrderDate: new Date(),
      OrderStatus: OrderStatus.SHIPPED
    });
    await Trip.create({
      TripCode: "TRIP-001",
      OrganizationID: orgId,
      RoutePlanID: new mongoose.Types.ObjectId(),
      DeliveryRouteID: new mongoose.Types.ObjectId(),
      PlanDate: new Date(),
      Status: TripStatus.IN_PROGRESS,
      LastLatitude: 21.0285,
      LastLongitude: 105.8542,
      LastGpsAt: new Date(),
      LastSpeed: 45,
      DriverName: "Nguyễn Văn A",
      DriverPhone: "0901234567",
      VehicleCode: "29A-12345",
      Tasks: [
        {
          StopIndex: 1,
          CustomerCode: "CUS001",
          Address: "123 Nguyễn Trãi, Hà Nội",
          OrderCodes: [orderCode]
        }
      ]
    });

    const res = await request.get(`/api/track/${orderCode}`);
    expect(res.status).toBe(200);
    expect(res.body.data.trip.currentLocation.latitude).toBe(21.0285);
    expect(res.body.data.trip.driver.name).toBe("Nguyễn Văn A");
    expect(res.body.data.trip.driver.phone).toBe("0901234567");
  });

  it("KHÔNG cần Authorization header", async () => {
    const orgId = new mongoose.Types.ObjectId();
    await SalesOrder.create({
      OrderCode: "SO-PUB",
      OrganizationID: orgId,
      CustomerCode: "C",
      OrderDate: new Date(),
      OrderStatus: OrderStatus.OPEN
    });
    const res = await request.get("/api/track/SO-PUB"); // no auth header
    expect(res.status).toBe(200);
  });

  it("case-insensitive với orderCode", async () => {
    const orgId = new mongoose.Types.ObjectId();
    await SalesOrder.create({
      OrderCode: "SO-UPPER",
      OrganizationID: orgId,
      CustomerCode: "C",
      OrderDate: new Date(),
      OrderStatus: OrderStatus.OPEN
    });
    const res = await request.get("/api/track/so-upper");
    expect(res.status).toBe(200);
    expect(res.body.data.order.code).toBe("SO-UPPER");
  });

  it("từ chối orderCode quá dài", async () => {
    const res = await request.get("/api/track/" + "A".repeat(50));
    expect(res.status).toBe(400);
  });
});
