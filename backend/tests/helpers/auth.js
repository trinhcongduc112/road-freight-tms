/**
 * Helpers để register + verify email trong test environment.
 * Trong production, user phải click link email. Trong test, ta bypass step đó
 * bằng cách update trực tiếp trên DB.
 */
import { User, UserStatus } from "../../src/models/User.js";

/**
 * Register một user mới + đánh dấu email đã verify ngay → user ACTIVE, có thể login.
 * Trả về { user, body } — `body` là raw response từ register endpoint.
 */
export async function registerAndVerify(request, payload) {
  const fullPayload = {
    Email: payload.Email,
    Password: payload.Password ?? "Password123!",
    FullName: payload.FullName ?? "Test User",
    CompanyName: payload.CompanyName ?? "Test Org",
    Phone: payload.Phone ?? "0900000000"
  };

  const res = await request.post("/api/auth/register").send(fullPayload);
  if (res.status >= 400) {
    throw new Error(`register failed (${res.status}): ${JSON.stringify(res.body)}`);
  }

  const user = await User.findOneAndUpdate(
    { Email: fullPayload.Email.toLowerCase() },
    {
      Status: UserStatus.ACTIVE,
      EmailVerifiedAt: new Date(),
      VerificationTokenHash: null,
      VerificationTokenExpiresAt: null
    },
    { new: true }
  );
  return { user, body: res.body };
}

/**
 * Login → trả accessToken (raw).
 */
export async function loginAs(request, email, password = "Password123!") {
  const res = await request.post("/api/auth/login").send({ Email: email, Password: password });
  if (res.status !== 200) {
    throw new Error(`login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data?.accessToken || res.body.data?.token;
}
