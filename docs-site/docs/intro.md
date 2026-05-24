---
slug: /
title: Giới thiệu hệ thống
sidebar_position: 1
---

# Road Freight TMS

**Road Freight TMS** là hệ thống quản lý vận tải đường bộ đa tổ chức (multi-tenant), hỗ trợ toàn bộ vòng đời nghiệp vụ logistics: từ lập kế hoạch tuyến, điều phối tài xế, theo dõi giao hàng đến đối soát kế toán.

![Trang chủ hệ thống](/img/screenshots/dashboard.png)

## Đối tượng sử dụng

Hệ thống phục vụ **5 vai trò chính** trong doanh nghiệp vận tải:

| Vai trò | Mô tả công việc | Tài liệu |
|---|---|---|
| 👨‍💼 **IT Admin** | Quản lý tổ chức, người dùng, nhóm vai trò, nhật ký hệ thống | [Xem](/role-admin/quan-ly-to-chuc) |
| 📋 **Planner** | Quản lý master data, đơn hàng, lập kế hoạch vận chuyển | [Xem](/role-planner/master-data) |
| 🚦 **Dispatcher** | Điều phối tài xế, giám sát hành trình, xử lý sự cố | [Xem](/role-dispatcher/giam-sat-hanh-trinh) |
| 💰 **Accountant** | Báo cáo doanh thu, bảng lương tài xế, đối soát COD | [Xem](/role-accountant/bao-cao) |
| 🚚 **Driver** | Nhận chuyến, giao hàng, chụp ảnh POD, báo dưỡng xe | [Xem](/role-driver/cai-dat-app) |

## Tính năng nổi bật

- ✅ **Multi-tenant** — Một tài khoản quản lý nhiều công ty con / chi nhánh / kho
- ✅ **RBAC + DAC** — Phân quyền theo vai trò + phạm vi dữ liệu (chi nhánh A không thấy chi nhánh B)
- ✅ **Tối ưu tuyến CVRP** — Tự động phân đơn vào xe theo ràng buộc tải trọng, thể tích, giờ giao
- ✅ **Realtime tracking** — GPS tài xế cập nhật mỗi 30 giây, hiển thị trên bản đồ
- ✅ **POD chụp ảnh** — Tài xế xác nhận giao hàng bằng ảnh, lưu vào hệ thống
- ✅ **AI Chatbot** — Hỗ trợ người dùng 24/7, có hand-off sang nhân viên CSKH
- ✅ **AI Agent** — Ra lệnh bằng tiếng Việt (vd "tải báo cáo tháng"), hệ thống tự thao tác
- ✅ **Bảo dưỡng xe** — Lên lịch, gán tài xế, xác nhận hoàn thành bằng ảnh
- ✅ **Bảng lương tài xế** — Cấu hình lương cứng + bonus theo km/chuyến/COD
- ✅ **Audit Log** — Ghi lại toàn bộ thao tác trên hệ thống để truy vết
- ✅ **Public Tracking** — Khách hàng tra cứu trạng thái đơn qua mã (không cần đăng nhập)

## Kiến trúc tổng quan

```
┌─────────────────────┐         ┌─────────────────────┐
│   Web Frontend      │         │   Mobile App        │
│   (React + Vite)    │         │   (React Native)    │
└──────────┬──────────┘         └──────────┬──────────┘
           │                                │
           └────────────┬───────────────────┘
                        │ REST + Socket.IO
            ┌───────────▼───────────┐
            │   Backend API         │
            │   (Express.js)        │
            └───────────┬───────────┘
                        │
            ┌───────────▼───────────┐
            │   MongoDB             │
            │   (Mongoose ODM)      │
            └───────────────────────┘
                        │
            ┌───────────▼───────────┐
            │   Optimizer Service   │
            │   (Python — HGS-CVRP) │
            └───────────────────────┘
```

## Bắt đầu nhanh

1. [Đăng ký tài khoản](/getting-started/dang-ky)
2. [Đăng nhập lần đầu](/getting-started/dang-nhap)
3. [Tạo tổ chức và chi nhánh](/getting-started/tao-to-chuc)

:::tip Lời khuyên
Nếu bạn là **Quản trị viên mới**, hãy đọc tuần tự nhóm **"Bắt đầu"** → **"Quản trị viên"** để thiết lập hệ thống trước khi mời nhân viên vào sử dụng.
:::
