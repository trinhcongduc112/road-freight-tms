---
slug: /
title: System Overview
sidebar_position: 1
---

# Road Freight TMS

**Road Freight TMS** is a multi-tenant road transportation management system. It supports the full logistics workflow: route planning, dispatching, driver execution, live monitoring, POD collection, reporting, payroll, and accounting reconciliation.

![System dashboard](/img/screenshots/dashboard.png)

## User roles

| Role | Responsibility | Guide |
|---|---|---|
| IT Admin | Manage organizations, users, role groups, and audit logs | [Open](/role-admin/quan-ly-to-chuc) |
| Planner | Manage master data, orders, and route planning | [Open](/role-planner/master-data) |
| Dispatcher | Monitor trips, handle incidents, and coordinate drivers | [Open](/role-dispatcher/giam-sat-hanh-trinh) |
| Accountant | Review reports, payroll, COD, and operating cost | [Open](/role-accountant/bao-cao) |
| Driver | Receive trips, deliver orders, upload POD, and report issues | [Open](/role-driver/cai-dat-app) |

## Main capabilities

- **Multi-tenant organization tree** for company, branch, depot, and teams.
- **RBAC + DAC** to control what each user can do and see.
- **CVRP route optimization** with vehicle capacity and delivery constraints.
- **Live GPS monitoring** through the driver mobile app.
- **Proof of Delivery** with photo evidence, signature, status, and COD.
- **AI Chatbot and AI Agent** for user support and guided operations.
- **Vehicle maintenance** scheduling, evidence, and review.
- **Driver payroll** based on salary, trips, distance, COD, and bonuses.
- **Audit Log** for operational traceability.
- **Public tracking** for customers without login.

## Architecture

```text
Web App + Mobile App
        ↓ REST + Socket.IO
Backend API (Express.js)
        ↓
MongoDB (Mongoose)
        ↓
Optimizer Service (Python — HGS-CVRP + LNS-SA + NN+2opt)
```

## Start here

1. [Register an account](/getting-started/dang-ky)
2. [Login to the system](/getting-started/dang-nhap)
3. [Create organizations and branches](/getting-started/tao-to-chuc)

:::tip
If you are a new administrator, read **Getting Started** and **Administrator** first before inviting staff.
:::
