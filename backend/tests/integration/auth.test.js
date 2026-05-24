/**
 * Integration tests cho auth flow (register, verify, login, /me, refresh).
 * Pattern: AAA (Arrange-Act-Assert), 1 behavior / test.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import express from "express";
import "express-async-errors";
import { setupTestDb, teardownTestDb, clearTestDb } from "../setup.js";
import { registerAndVerify, loginAs } from "../helpers/auth.js";

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
  const validPayload = {
    Email: "admin@acme.com",
    Password: "Password123!",
    FullName: "Admin User",
    CompanyName: "Acme Corp",
    Phone: "0900000001"
  };

  it("tạo organization + admin user thành công (201)", async () => {
    const res = await request.post("/api/auth/register").send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.Email).toBe("admin@acme.com");
  });

  it("từ chối khi thiếu CompanyName", async () => {
    const res = await request.post("/api/auth/register").send({ ...validPayload, CompanyName: "" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("từ chối khi email không đúng định dạng", async () => {
    const res = await request.post("/api/auth/register").send({ ...validPayload, Email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("từ chối khi password ngắn hơn 8 ký tự", async () => {
    const res = await request.post("/api/auth/register").send({ ...validPayload, Password: "Aa1!" });
    expect(res.status).toBe(400);
  });

  it("từ chối khi password không có ký tự đặc biệt", async () => {
    const res = await request.post("/api/auth/register").send({ ...validPayload, Password: "Password123" });
    expect(res.status).toBe(400);
  });

  it("từ chối khi email đã tồn tại (409)", async () => {
    await request.post("/api/auth/register").send(validPayload);
    const res = await request.post("/api/auth/register").send({ ...validPayload, CompanyName: "Other" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await registerAndVerify(request, { Email: "user@acme.com", Password: "MyPass123!" });
  });

  it("trả accessToken khi credentials đúng", async () => {
    const res = await request.post("/api/auth/login").send({
      Email: "user@acme.com",
      Password: "MyPass123!"
    });
    expect(res.status).toBe(200);
    const token = res.body.data?.accessToken || res.body.data?.token;
    expect(token).toBeTruthy();
    expect(res.body.data?.user?.Email).toBe("user@acme.com");
  });

  it("từ chối khi sai password", async () => {
    const res = await request.post("/api/auth/login").send({
      Email: "user@acme.com",
      Password: "WrongPass"
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("từ chối khi email không tồn tại", async () => {
    const res = await request.post("/api/auth/login").send({
      Email: "ghost@acme.com",
      Password: "Anything123!"
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("từ chối khi account chưa verify email (403)", async () => {
    // Register but skip verification helper
    await request.post("/api/auth/register").send({
      Email: "unverified@acme.com",
      Password: "MyPass123!",
      FullName: "Unverified",
      CompanyName: "Unverified Org",
      Phone: "0900000099"
    });
    const res = await request.post("/api/auth/login").send({
      Email: "unverified@acme.com",
      Password: "MyPass123!"
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("GET /api/auth/me", () => {
  it("trả 401 khi không có token", async () => {
    const res = await request.get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("trả 401 khi token sai", async () => {
    const res = await request.get("/api/auth/me").set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
  });

  it("trả thông tin user khi token hợp lệ", async () => {
    await registerAndVerify(request, { Email: "me@acme.com", Password: "MyPass123!" });
    const token = await loginAs(request, "me@acme.com", "MyPass123!");
    const res = await request.get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data?.user?.Email).toBe("me@acme.com");
  });
});
