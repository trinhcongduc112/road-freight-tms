---
title: Nhóm vai trò (RBAC)
sidebar_position: 2
---

# Nhóm vai trò (RBAC)

Road Freight TMS dùng kết hợp **RBAC** (Role-Based Access Control) + **DAC** (Data Access Control):

- **RBAC** quyết định *làm được gì* (thao tác): tạo đơn, duyệt đơn, lập kế hoạch...
- **DAC** quyết định *xem được dữ liệu nào* (phạm vi): chỉ chi nhánh Hà Nội, hay toàn công ty.

![Nhóm vai trò](/img/screenshots/admin-role-presets.png)

## 5 Preset có sẵn

Hệ thống cung cấp **5 vai trò mẫu**, dùng được ngay không cần cấu hình:

| Preset | Quyền chính | Dùng cho ai |
|---|---|---|
| 👨‍💼 **IT Admin** | Toàn quyền: tổ chức, user, master data, đơn hàng, báo cáo | Quản trị viên hệ thống |
| 📋 **Planner** | Master data + đơn hàng + lập kế hoạch (**không xem báo cáo lương**) | Người lập kế hoạch tuyến |
| 🚦 **Dispatcher** | Giám sát chuyến + xử lý sự cố + cập nhật trạng thái | Điều phối viên trực |
| 📋🚦 **Planner + Dispatcher** | Kết hợp 2 vai trò trên | Doanh nghiệp nhỏ — 1 người làm cả 2 |
| 💰 **Accountant** | Báo cáo + bảng lương + đối soát COD | Kế toán |

:::tip Tại sao tách Planner & Accountant?
Nguyên tắc **separation of duties** — người lập kế hoạch (Planner) **không nên** xem được lương tài xế / doanh thu, tránh xung đột lợi ích và rò rỉ thông tin lương.
:::

## Tạo nhóm vai trò tuỳ chỉnh

Nếu 5 preset chưa khớp với cơ cấu công ty bạn, tạo nhóm mới:

1. Bấm **"+ Thêm nhóm vai trò"**
2. Nhập **Tên nhóm** + **Mã** (vd `PLANNER-SR` cho Senior Planner)
3. Tích các **Permission** cần thiết — phân loại theo module:
   - **Master Data**: customer.manage, product.manage, vehicle.manage, service.manage
   - **Đơn hàng**: order.create, order.approve, order.cancel, order.export
   - **Lập kế hoạch**: route.create, route.optimize, route.finalize, route.unlock
   - **Báo cáo**: report.view, report.export, payroll.view, payroll.configure
   - **Quản trị**: user.invite, user.disable, audit.view, organization.manage

## Phạm vi dữ liệu (DAC)

Sau khi tạo nhóm vai trò, khi **gán vào user**, bạn còn phải set **phạm vi tổ chức**:

```
User: Nguyễn Văn A
Vai trò: Planner
Phạm vi: Chi nhánh Hà Nội
↓
→ Anh A chỉ thấy đơn hàng + tuyến + xe của Hà Nội (+ kho con của HN)
→ KHÔNG thấy dữ liệu của Hồ Chí Minh
```

Phạm vi `subtree` tự động bao gồm **tất cả tổ chức con** ở mọi cấp.

## Sửa preset có được không?

**Có**, nhưng cẩn thận:
- Bấm vào tên preset → modify permission
- Thay đổi áp dụng **ngay lập tức** cho tất cả user thuộc preset đó
- Có log trong [Nhật ký hệ thống](/role-admin/nhat-ky-he-thong)

## Câu hỏi thường gặp

**Q: User có thể thuộc nhiều nhóm vai trò không?**
A: Không. Mỗi user chỉ thuộc **1 nhóm**. Nếu cần nhiều quyền → tạo preset tổng hợp như Planner+Dispatcher.

**Q: Xoá nhóm khi đang có user → chuyện gì xảy ra?**
A: Hệ thống chặn xoá. Bạn phải chuyển user sang nhóm khác trước.

**Q: Super Admin là gì?**
A: User có flag `IsSuperAdmin=true` — bypass mọi check phân quyền, dùng cho dev/maintenance. Chỉ có 1 super admin trên hệ thống.

## Bước tiếp theo

- [Quản lý người dùng](/role-admin/quan-ly-nguoi-dung) — Gán nhóm vai trò cho user
- [Nhật ký hệ thống](/role-admin/nhat-ky-he-thong) — Theo dõi ai thay đổi quyền hạn
