# Backend Tests

Test suite cho Road Freight TMS backend, dùng **Jest** + **Supertest** + **mongodb-memory-server**.

## Cài đặt

```bash
cd backend
npm install
```

## Chạy

```bash
npm test                # Chạy tất cả test
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## Cấu trúc

```
tests/
├── setup.js                  # In-memory MongoDB setup
├── unit/                     # Unit tests (pure functions, no DB)
│   ├── payroll.test.js       # Công thức lương tài xế
│   └── aiAgent.test.js       # extractDate + normalize tiếng Việt
└── integration/              # Integration tests (real DB + HTTP)
    ├── auth.test.js          # Register/login/me/refresh
    ├── orders.test.js        # SalesOrder model + multi-tenant isolation
    ├── tracking.test.js      # Public customer tracking
    └── maintenance.test.js   # Vehicle maintenance CRUD + alerts
```

Tổng cộng ~43 test case, cover các flow trọng yếu.

## ISO 25010 coverage

| Test type | ISO Aspect |
|-----------|------------|
| Unit (pure functions) | Functional Suitability + Maintainability |
| Integration (HTTP + DB) | Reliability + Functional Correctness |
| Multi-tenant isolation | Security (DAC) |
