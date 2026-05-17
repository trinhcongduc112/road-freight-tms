---
title: Quản lý người dùng
sidebar_position: 3
---

# Quản lý người dùng

Trang này quản lý **toàn bộ nhân viên** truy cập hệ thống — bao gồm web (Planner/Dispatcher/Accountant) và mobile app (Driver).

![Danh sách người dùng](/img/screenshots/admin-users-list.png)

## Mời người dùng mới

Cách an toàn nhất để thêm user là **mời qua email** — user tự đặt mật khẩu, bạn không bao giờ thấy.

### Quy trình mời

1. Bấm **"+ Mời người dùng"**
2. Điền form:
   - **Email**: địa chỉ nhân viên
   - **Họ và tên**: hiển thị trong hệ thống
   - **Nhóm vai trò**: chọn 1 trong [5 preset hoặc nhóm tuỳ chỉnh](/role-admin/nhom-vai-tro)
   - **Phạm vi tổ chức**: chọn nhánh dữ liệu user được xem (subtree)
3. Bấm **"Gửi lời mời"**

User nhận email với liên kết kích hoạt → đặt mật khẩu → đăng nhập được ngay.

:::tip Lời mời có thời hạn
Link kích hoạt hết hạn sau **48 giờ**. Nếu user không bấm kịp, vào lại trang Users, bấm icon ↻ trên dòng pending để gửi lại.
:::

## Cột danh sách

| Cột | Nội dung |
|---|---|
| **Tên + Email** | Thông tin cơ bản |
| **Nhóm vai trò** | Preset hiện tại của user |
| **Tổ chức** | Phạm vi DAC user được xem |
| **Trạng thái** | `Active` / `Pending` (chưa kích hoạt) / `Disabled` |
| **Lần đăng nhập cuối** | Theo dõi user có hoạt động không |
| **Thao tác** | Sửa / Reset mật khẩu / Vô hiệu hoá |

## Sửa thông tin user

Bấm icon ✏️ → modal hiện ra để đổi:
- Tên hiển thị
- Nhóm vai trò
- Phạm vi tổ chức
- Số điện thoại liên hệ

**Email không sửa được** (vì đó là khóa định danh + đường dẫn login).

## Reset mật khẩu

Có 2 cách:

**Cách 1 — Gửi link đặt lại** (khuyến nghị):
- Bấm icon 🔑 trên dòng user
- Hệ thống gửi email reset password
- User tự đặt mật khẩu mới

**Cách 2 — Đặt mật khẩu thủ công** (chỉ cho emergency):
- Trong modal sửa, bấm **"Đặt mật khẩu mới"**
- Nhập password mới → user phải đổi lại lần đăng nhập đầu tiên

:::warning Bảo mật
**Không bao giờ** chia sẻ mật khẩu qua chat / email không mã hoá. Cách 1 luôn an toàn hơn vì password chỉ user biết.
:::

## Vô hiệu hoá tài khoản

Khi nhân viên nghỉ việc:

1. Bấm icon 🚫 trên dòng user
2. Trạng thái chuyển `Disabled`
3. User không đăng nhập được nữa
4. **Dữ liệu lịch sử vẫn giữ** — không xoá để bảo toàn audit trail

:::tip Khôi phục
Bấm lại icon ✓ trên user `Disabled` → khôi phục Active.
:::

## Liên kết User ↔ Driver

Trong hệ thống có **2 entity riêng biệt**:

- **User**: tài khoản đăng nhập (Email + Password)
- **Driver**: hồ sơ tài xế (Bằng lái, Số điện thoại, Liên kết xe)

Để tài xế đăng nhập **app mobile**, phải **liên kết** 2 entity:

1. Tạo Driver record trong Master Data (hoặc đã có sẵn)
2. Mời user mới với nhóm vai trò **"Driver"**
3. Trong modal user, chọn **"Liên kết với tài xế"** → chọn Driver tương ứng

Sau khi liên kết, app mobile dùng email user để login + nhận chuyến của Driver tương ứng.

## Bước tiếp theo

- [Nhóm vai trò](/role-admin/nhom-vai-tro) — Tạo preset phù hợp với cơ cấu công ty
- [Nhật ký hệ thống](/role-admin/nhat-ky-he-thong) — Xem ai thao tác gì
