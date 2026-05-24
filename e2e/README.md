# E2E Tests — Road Freight TMS

End-to-end tests dùng **Playwright** + Chromium. Click thật trên browser, verify hành vi xuyên tầng (UI → API → DB).

## Tiền điều kiện

Phải có backend + frontend + MongoDB đang chạy + đã seed data:

```bash
# Terminal 1 (root)
make start

# Terminal 2 (chỉ lần đầu)
make seed
```

## Chạy E2E

```bash
# Từ root project
make test-e2e              # chạy headless
make test-e2e-ui           # mở Playwright UI để debug
make test-e2e-headed       # chạy với browser hiện ra

# Hoặc trực tiếp
cd e2e && npx playwright test
```

## Xem report

```bash
make test-e2e-report       # mở HTML report (có screenshot + video lỗi)
```

## Scenarios

| File | Test | Manual TC mapping |
|---|---|---|
| [`01-auth.spec.js`](tests/01-auth.spec.js) | Login OK, sai password, email không hợp lệ, planner login | TC-AUTH-002, TC-AUTH-006, TC-AUTH-007 |
| [`02-tracking-public.spec.js`](tests/02-tracking-public.spec.js) | Public tracking không cần auth, code không tồn tại không crash | TC-TRACK-001, TC-TRACK-003 |
| [`03-rbac.spec.js`](tests/03-rbac.spec.js) | Admin vào /admin, Planner bị chặn, Accountant vào /reports | TC-PERM-002, TC-PERM-006 |
| [`04-navigation.spec.js`](tests/04-navigation.spec.js) | Smoke test 6 trang chính sau login admin | Cross-cutting |

## Output artifacts

- `playwright-report/` — HTML report sau mỗi run
- `test-results/` — screenshots + video khi fail (lưu giữ để debug)
