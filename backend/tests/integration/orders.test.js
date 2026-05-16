/**
 * Integration tests cho Order CRUD + status transitions.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb, clearTestDb } from "../setup.js";

let SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus;

beforeAll(async () => {
  await setupTestDb();
  ({ SalesOrder, OrderStatus, PlanningStatus, ApprovalStatus } = await import("../../src/models/SalesOrder.js"));
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

describe("SalesOrder model", () => {
  it("tạo đơn hợp lệ với default status", async () => {
    const order = await SalesOrder.create({
      OrderCode: "SO-TEST-001",
      OrganizationID: new mongoose.Types.ObjectId(),
      CustomerCode: "CUS001",
      OrderDate: new Date()
    });
    expect(order.OrderStatus).toBe(OrderStatus.OPEN);
    expect(order.PlanningStatus).toBe(PlanningStatus.PENDING);
    expect(order.ApprovalStatus).toBe(ApprovalStatus.PENDING);
  });

  it("uppercase OrderCode tự động", async () => {
    const order = await SalesOrder.create({
      OrderCode: "so-lowercase",
      OrganizationID: new mongoose.Types.ObjectId(),
      CustomerCode: "CUS001",
      OrderDate: new Date()
    });
    expect(order.OrderCode).toBe("SO-LOWERCASE");
  });

  it("từ chối khi thiếu CustomerCode", async () => {
    await expect(
      SalesOrder.create({
        OrderCode: "SO-TEST-002",
        OrganizationID: new mongoose.Types.ObjectId(),
        OrderDate: new Date()
      })
    ).rejects.toThrow();
  });

  it("từ chối order duplicate trong cùng org", async () => {
    const orgId = new mongoose.Types.ObjectId();
    await SalesOrder.create({
      OrderCode: "SO-DUP",
      OrganizationID: orgId,
      CustomerCode: "C1",
      OrderDate: new Date()
    });
    await expect(
      SalesOrder.create({
        OrderCode: "SO-DUP",
        OrganizationID: orgId,
        CustomerCode: "C2",
        OrderDate: new Date()
      })
    ).rejects.toThrow();
  });

  it("cho phép cùng OrderCode ở 2 org khác nhau (multi-tenant isolation)", async () => {
    await SalesOrder.create({
      OrderCode: "SO-DUP-ORG",
      OrganizationID: new mongoose.Types.ObjectId(),
      CustomerCode: "C1",
      OrderDate: new Date()
    });
    const ok = await SalesOrder.create({
      OrderCode: "SO-DUP-ORG",
      OrganizationID: new mongoose.Types.ObjectId(),
      CustomerCode: "C2",
      OrderDate: new Date()
    });
    expect(ok.OrderCode).toBe("SO-DUP-ORG");
  });

  it("history append được khi đổi status", async () => {
    const order = await SalesOrder.create({
      OrderCode: "SO-HIST",
      OrganizationID: new mongoose.Types.ObjectId(),
      CustomerCode: "C1",
      OrderDate: new Date(),
      StatusHistory: [
        { ToStatus: OrderStatus.OPEN, ChangedAt: new Date() }
      ]
    });
    order.OrderStatus = OrderStatus.SHIPPED;
    order.StatusHistory.push({
      FromStatus: OrderStatus.OPEN,
      ToStatus: OrderStatus.SHIPPED,
      ChangedAt: new Date()
    });
    await order.save();
    expect(order.StatusHistory.length).toBe(2);
  });

  it("filter theo OrgID isolate được dữ liệu", async () => {
    const orgA = new mongoose.Types.ObjectId();
    const orgB = new mongoose.Types.ObjectId();
    await SalesOrder.create([
      { OrderCode: "SO-A1", OrganizationID: orgA, CustomerCode: "C", OrderDate: new Date() },
      { OrderCode: "SO-A2", OrganizationID: orgA, CustomerCode: "C", OrderDate: new Date() },
      { OrderCode: "SO-B1", OrganizationID: orgB, CustomerCode: "C", OrderDate: new Date() }
    ]);
    const aOnly = await SalesOrder.find({ OrganizationID: orgA }).lean();
    expect(aOnly.length).toBe(2);
  });
});
