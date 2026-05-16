/**
 * Integration tests cho auth flow (login, register, /me, refresh).
 * Cần mongodb-memory-server + supertest.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import express from "express";
import "express-async-errors";
import { setupTestDb, teardownTestDb, clearTestDb } from "../setup.js";

let app;
let request;

beforeAll(async () => {
  await setupTestDb();
  const { default: supertest } = await import("supertest");
  const { authRouter } = await import("../../src/routes/authRoutes.js");
  const { errorHandler } = await import("../../src/middlewares/errorHandler.js");
  app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(errorHandler);
  request = supertest(app);
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

describe("POST /api/auth/register", () => {
  it("tạo organization + admin user thành công", async () => {
    const res = await request.post("/api/auth/register").send({
      Email: "admin@acme.com",
      Password: "Password123!",
      FullName: "Admin User",
      OrganizationName: "Acme Corp"
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it("từ chối khi email không hợp lệ", async () => {
    const res = await request.post("/api/auth/register").send({
      Email: "not-an-email",
      Password: "Password123!",
      FullName: "Test",
      OrganizationName: "Test Org"
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it("từ chối khi password quá ngắn", async () => {
    const res = await request.post("/api/auth/register").send({
      Email: "valid@acme.com",
      Password: "123",
      FullName: "Test",
      OrganizationName: "Test Org"
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("không cho phép email trùng", async () => {
    const payload = {
      Email: "dup@acme.com",
      Password: "Password123!",
      FullName: "First",
      OrganizationName: "First Org"
    };
    await request.post("/api/auth/register").send(payload);
    const res2 = await request.post("/api/auth/register").send(payload);
    expect(res2.status).toBeGreaterThanOrEqual(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request.post("/api/auth/register").send({
      Email: "user@acme.com",
      Password: "MyPass123!",
      FullName: "Test User",
      OrganizationName: "Test Org"
    });
  });

  it("trả token khi credentials đúng", async () => {
    const res = await request.post("/api/auth/login").send({
      Email: "user@acme.com",
      Password: "MyPass123!"
    });
    expect(res.status).toBe(200);
    expect(res.body.data?.accessToken || res.body.data?.token).toBeTruthy();
  });

  it("từ chối khi sai password", async () => {
    const res = await request.post("/api/auth/login").send({
      Email: "user@acme.com",
      Password: "WrongPass"
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("từ chối email không tồn tại", async () => {
    const res = await request.post("/api/auth/login").send({
      Email: "ghost@acme.com",
      Password: "Anything"
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("GET /api/auth/me", () => {
  it("trả 401 khi không có token", async () => {
    const res = await request.get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("trả thông tin user khi token hợp lệ", async () => {
    await request.post("/api/auth/register").send({
      Email: "me@acme.com",
      Password: "MyPass123!",
      FullName: "Me",
      OrganizationName: "Me Org"
    });
    const login = await request.post("/api/auth/login").send({
      Email: "me@acme.com",
      Password: "MyPass123!"
    });
    const token = login.body.data?.accessToken || login.body.data?.token;
    const res = await request.get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data?.user?.Email).toBe("me@acme.com");
  });
});
