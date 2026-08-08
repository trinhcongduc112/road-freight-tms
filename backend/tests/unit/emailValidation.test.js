import { isSuspiciousSignupText, validateSignupEmail } from "../../src/utils/emailValidation.js";

describe("validateSignupEmail", () => {
  it.each([
    "sa_1785766497@example.com",
    "pt2_1785766463@example.com",
    "admin_bypass_test@example.com",
    "pentest_scan_2024@example.com",
    "bypass90798@test.com",
    "fuzzadmin@test.com",
    "fuzzsuper@test.com",
    "audit_8080_test@ductms.id.vn"
  ])("blocks spam email %s", (email) => {
    expect(validateSignupEmail(email).ok).toBe(false);
  });

  it("accepts normal business email", () => {
    expect(validateSignupEmail("planner@acme-logistics.vn")).toEqual({
      ok: true,
      email: "planner@acme-logistics.vn"
    });
  });
});

describe("isSuspiciousSignupText", () => {
  it.each([
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)"
  ])("blocks payload %s", (value) => {
    expect(isSuspiciousSignupText(value)).toBe(true);
  });
});
