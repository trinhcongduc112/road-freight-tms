---
title: Tạo tổ chức và chi nhánh
sidebar_position: 3
---

# Tạo tổ chức và chi nhánh

Sau khi đăng ký, bạn cần dựng **cây tổ chức** phản ánh cơ cấu công ty thực tế. Đây là bước nền tảng — mọi user, đơn hàng, xe... đều thuộc 1 tổ chức cụ thể.

![Cây tổ chức](/img/screenshots/admin-org-tree.png)

## Khái niệm

Road Freight TMS dùng mô hình **đa tầng (multi-tenant tree)**:

```
[Công ty mẹ]
  ├─ [Chi nhánh A]
  │   ├─ [Kho A1]
  │   └─ [Kho A2]
  └─ [Chi nhánh B]
      └─ [Kho B1]
```

- **Công ty mẹ** = root, tạo tự động khi bạn đăng ký
- **Chi nhánh** = đơn vị vùng/miền (HN, HCM, ĐN...)
- **Kho** = đơn vị có toạ độ thật, nơi xuất hàng giao

## Khi nào cần chi nhánh & kho?

| Quy mô | Cấu trúc đề xuất |
|---|---|
| **1 kho duy nhất** | Chỉ root + 1 kho — đơn giản |
| **2-3 kho cùng tỉnh** | Root + nhiều kho ngang hàng |
| **Đa tỉnh** | Root → Chi nhánh (theo tỉnh) → Kho |
| **Tập đoàn** | Root → Công ty con → Chi nhánh → Kho |

## Bước 1: Mở trang Quản trị

Sidebar bên trái → **"Quản trị"** → tab **"Tổ chức"**.

Hoặc dùng AI Agent: gõ *"mở quản trị tổ chức"* → tự navigate.

## Bước 2: Tạo chi nhánh

Bấm **"+ Thêm tổ chức"** ở góc trên bên phải:

1. **Mã tổ chức** (XCode): viết hoa, không khoảng trắng — vd `CN-HN`, `CN-HCM`
2. **Tên** (XName): hiển thị — vd `Chi nhánh Hà Nội`
3. **Loại**: chọn **"Chi nhánh"**
4. **Tổ chức cha**: chọn công ty mẹ (mặc định đã chọn nếu chỉ có 1 root)

## Bước 3: Tạo kho (con của chi nhánh)

Tương tự bước 2 nhưng:

1. **Loại**: chọn **"Kho"**
2. **Tổ chức cha**: chọn chi nhánh vừa tạo
3. **Địa chỉ kho**: nhập đầy đủ (số nhà, đường, phường, quận, tỉnh)
4. **Toạ độ**:
   - Bấm **"Tự động lấy toạ độ từ địa chỉ"** → hệ thống gọi OpenStreetMap
   - HOẶC mở Google Maps → chuột phải vào vị trí → copy 2 số → paste

:::warning Toạ độ kho là BẮT BUỘC
Thuật toán tối ưu tuyến **dùng toạ độ kho làm điểm xuất phát**. Sai toạ độ = sai toàn bộ lộ trình. Kiểm tra trên Google Maps trước khi lưu.
:::

## Sửa cấu trúc sau này

Sau khi đã có dữ liệu (user, đơn hàng, xe), bạn vẫn:
- ✅ **Thêm** chi nhánh / kho mới
- ✅ **Sửa** tên / địa chỉ / toạ độ
- ❌ **Không xoá được** tổ chức đang có dữ liệu

Cần xoá → phải migrate dữ liệu sang tổ chức khác trước.

## Phân quyền tự động kế thừa

Sau khi tạo cây tổ chức, khi gán user vào 1 nhánh:

```
User: Chị B
Phạm vi: Chi nhánh Hà Nội
↓
→ Tự động thấy: HN + tất cả kho con của HN
→ KHÔNG thấy: HCM hoặc các chi nhánh khác
```

Xem thêm: [Nhóm vai trò (RBAC)](/role-admin/nhom-vai-tro).

## Bước tiếp theo

- [Nhóm vai trò](/role-admin/nhom-vai-tro) — Định nghĩa quyền hạn
- [Quản lý người dùng](/role-admin/quan-ly-nguoi-dung) — Mời nhân viên vào hệ thống
