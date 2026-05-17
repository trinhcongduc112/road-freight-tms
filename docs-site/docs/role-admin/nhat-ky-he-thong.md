---
title: Nhật ký hệ thống (Audit Log)
sidebar_position: 4
---

# Nhật ký hệ thống

Mọi thao tác thay đổi dữ liệu (tạo, sửa, xoá, đăng nhập, xuất file...) đều được hệ thống **tự động ghi lại** vào nhật ký — không thể tắt, không thể chỉnh sửa. Dùng để:

- Truy vết khi có sự cố ("ai vừa xoá đơn hàng X?")
- Kiểm soát nội bộ + audit cho khách hàng / hội đồng
- Đáp ứng yêu cầu **separation of duties** cho doanh nghiệp lớn

![Nhật ký hệ thống](/img/screenshots/admin-audit-list.png)

## Loại hành động ghi nhận

Hệ thống chia 7 loại hành động (Action):

| Action | Khi nào | Ví dụ |
|---|---|---|
| 🟢 **CREATE** | Tạo bản ghi mới | Tạo đơn hàng, tạo user, tạo tuyến |
| 🟡 **UPDATE** | Sửa bản ghi | Đổi địa chỉ khách, đổi giá đơn |
| 🔴 **DELETE** | Xoá bản ghi | Xoá tài xế, xoá xe |
| 🔵 **LOGIN** | Đăng nhập thành công | Tracking session |
| ⚫ **LOGOUT** | Đăng xuất | — |
| 🟣 **EXPORT** | Xuất dữ liệu ra file | Xuất Excel báo cáo, đơn hàng |
| 🟠 **IMPORT** | Nhập dữ liệu từ Excel | Nhập danh sách khách hàng |

## Bộ lọc

Phần lọc đa tiêu chí ở đầu trang:

- **Khoảng thời gian**: mặc định là **hôm nay**. Có thể chọn 1 ngày, 1 tuần, 1 tháng tuỳ ý.
- **Người dùng**: tìm theo email hoặc tên — chỉ xem hành động của 1 người
- **Hành động**: tích các loại Action muốn xem
- **Resource**: lọc theo loại đối tượng (Order, Trip, User, Customer, Vehicle...)

Bấm **"Áp dụng"** để tải lại danh sách.

## Đọc 1 dòng nhật ký

Mỗi dòng hiển thị:

| Cột | Ý nghĩa |
|---|---|
| **Thời gian** | YYYY-MM-DD HH:mm:ss (timezone local) |
| **Người dùng** | Email + tên hiển thị |
| **Action** | Loại hành động (badge màu) |
| **Resource** | Đối tượng bị tác động (vd `Order:ABC-001`) |
| **Endpoint** | URL backend được gọi |
| **Trạng thái** | HTTP code (200/201/400/404/500...) |
| **Thời lượng** | Ms — request mất bao lâu |

Bấm vào dòng để mở **chi tiết** với:
- IP address người dùng
- User-Agent (browser/mobile)
- **Diff trước/sau** với UPDATE — show từng field nào đổi từ giá trị nào sang giá trị nào

## Xuất Excel

Bấm **"Xuất Excel"** ở góc trên — tải file `.xlsx` với toàn bộ log theo filter hiện tại. Mỗi dòng 1 hành động, dùng để:

- Báo cáo định kỳ cho ban giám đốc
- Lưu trữ ngoài hệ thống (compliance)
- Phân tích pattern bằng Excel/Power BI

## Ai xem được Audit Log?

Chỉ **IT Admin** và user có permission `audit.view`. Planner/Dispatcher/Accountant **không xem được** — tránh việc nhân viên tự xoá log của mình.

## Câu hỏi thường gặp

**Q: Audit log có giới hạn dung lượng không?**
A: Không có giới hạn cứng, nhưng MongoDB collection sẽ lớn dần. Khuyến nghị **archive định kỳ** (vd 6 tháng) ra file Excel rồi xoá log cũ.

**Q: Sửa được audit log không?**
A: **Không**. Field `Changes` lưu diff dưới dạng append-only. Không có endpoint UPDATE cho audit log.

**Q: Audit log có ghi password / token không?**
A: **Không**. Middleware redact tự động các field nhạy cảm: `password`, `passwordHash`, `token`, `apiKey`.

## Bước tiếp theo

- [Quản lý người dùng](/role-admin/quan-ly-nguoi-dung) — Xem ai đang có quyền cao nhất
- [Báo cáo vận tải](/role-accountant/bao-cao) — Số liệu nghiệp vụ tổng hợp
