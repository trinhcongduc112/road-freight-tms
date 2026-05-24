---
title: Quản lý tổ chức
sidebar_position: 1
---

# Quản lý tổ chức

Tổ chức (Organization) là **đơn vị tenant** trong hệ thống — đại diện cho công ty mẹ, chi nhánh, hoặc kho hàng. Road Freight TMS hỗ trợ **đa cấp** (multi-tenant subtree): công ty mẹ → chi nhánh → kho.

![Quản trị tổ chức](/img/screenshots/admin-org-tree.png)

## Khái niệm

```
Công ty Vận tải ABC (root)              ← cấp 1: doanh nghiệp
├─ Chi nhánh Hà Nội                     ← cấp 2: chi nhánh
│  ├─ Kho Đống Đa                       ← cấp 3: kho
│  └─ Kho Long Biên
└─ Chi nhánh Hồ Chí Minh
   ├─ Kho Quận 1
   └─ Kho Bình Tân
```

**Phân loại 3 loại tổ chức**:

| Loại | Mục đích | Có lập kế hoạch không? |
|---|---|---|
| **Doanh nghiệp** | Công ty mẹ, không chứa hoạt động giao hàng | ❌ |
| **Chi nhánh** | Đơn vị vùng/miền | ❌ |
| **Kho** | Nơi xuất hàng, có toạ độ GPS | ✅ Có thể lập kế hoạch từ đây |

## Thao tác

### Thêm tổ chức mới

1. Bấm nút **"+ Thêm tổ chức"** ở góc trên bên phải
2. Điền các trường:
   - **Mã tổ chức** (XCode): mã duy nhất, viết hoa, vd `HN-DONG-DA`
   - **Tên** (XName): tên đầy đủ hiển thị
   - **Loại**: chọn 1 trong 3 loại trên
   - **Tổ chức cha**: chọn parent — để trống nếu là root
   - **Toạ độ** (chỉ kho): vĩ độ + kinh độ — dùng cho tối ưu tuyến

### Sửa / Xoá

- Bấm icon ✏️ trên dòng tương ứng để sửa
- Bấm icon 🗑️ để xoá — **không xoá được** nếu tổ chức đang có user/đơn hàng/chuyến xe

:::warning Đa cấp phân quyền
Khi user được gán phạm vi `Chi nhánh Hà Nội`, họ thấy được dữ liệu của **cả 2 kho con** (Đống Đa + Long Biên). Phân quyền tự động kế thừa xuống nhánh con.
:::

## Lấy toạ độ kho

Toạ độ chính xác là **bắt buộc** để thuật toán tối ưu tuyến chạy đúng. Có 2 cách:

**Cách 1 — Nhập tay**: Mở Google Maps → chuột phải vào vị trí kho → copy 2 số (vd `21.0285, 105.8542`).

**Cách 2 — Tự động từ địa chỉ**: Trong form, sau khi nhập "Địa chỉ", bấm nút **"Tự động lấy toạ độ"** — hệ thống gọi Nominatim/OpenStreetMap để geocode.

:::tip Mẹo
Nếu địa chỉ chung chung (vd "Đống Đa, Hà Nội"), Nominatim trả về toạ độ **trung tâm quận** — không chính xác. Hãy nhập **địa chỉ đầy đủ** kèm số nhà.
:::

## Bước tiếp theo

- [Tạo nhóm vai trò (RBAC)](/role-admin/nhom-vai-tro) — Định nghĩa quyền hạn
- [Mời người dùng](/role-admin/quan-ly-nguoi-dung) — Thêm nhân viên vào tổ chức
