---
title: Quản lý đơn hàng
sidebar_position: 2
---

# Quản lý đơn hàng

Đơn hàng (Sales Order) là **đầu vào** của toàn bộ luồng vận tải. Một đơn = 1 khách hàng + danh sách sản phẩm + ngày giao + địa chỉ.

![Danh sách đơn hàng](/img/screenshots/orders-list.png)

## 2 Vòng đời song song

Mỗi đơn hàng có **2 trạng thái** chạy song song:

### Approval Status — Trạng thái duyệt

```
PENDING ──(Planner/Admin duyệt)──> APPROVED ──(có thể lập kế hoạch)
   │
   └──(từ chối)──> REJECTED
```

### Delivery Status — Trạng thái giao

```
OPEN ──(đã đóng gói)──> PICKED_PACKED ──(xe đang giao)──> SHIPPED
                                                            │
                                              ┌─────────────┴─────────────┐
                                              ▼                           ▼
                                         DELIVERED                   FAILED / CANCELLED
```

:::warning Quan trọng
**Chỉ đơn `APPROVED`** mới được đưa vào lập kế hoạch. Đơn `PENDING` không xuất hiện trong danh sách "Đơn chưa phân" ở trang Planning.
:::

## Tạo đơn mới

### Cách 1 — Tạo thủ công (1 đơn)

Bấm **"+ Tạo đơn"**:

1. **Mã đơn** (OrderCode): tự sinh hoặc nhập tay
2. **Khách hàng**: chọn từ Master Data
3. **Ngày đặt** + **Ngày giao dự kiến**
4. **Sản phẩm**: thêm từng dòng, mỗi dòng = `Sản phẩm × Số lượng`
5. **Khung giờ giao** (tuỳ chọn): early/late, giúp tối ưu tuyến chính xác hơn
6. **Tiền COD** (tuỳ chọn): nếu khách trả tiền mặt khi nhận hàng
7. **Ghi chú**

Sau khi tạo, đơn ở trạng thái `PENDING` chờ duyệt.

### Cách 2 — Nhập Excel hàng loạt

Bấm **"Nhập Excel"**:
1. Tải file mẫu
2. Mở Excel, mỗi dòng = 1 đơn (cùng OrderCode = gộp thành 1 đơn nhiều dòng SP)
3. Upload — hệ thống báo số đơn tạo, số dòng lỗi

## Duyệt / Từ chối đơn

Trên dòng đơn `PENDING`:
- ✅ Bấm icon **duyệt** → chuyển `APPROVED`
- ❌ Bấm icon **từ chối** → modal yêu cầu nhập **lý do**, chuyển `REJECTED`

Có thể **chọn nhiều đơn** bằng checkbox rồi bấm **"Duyệt hàng loạt"**.

:::tip Phân tách quyền
Mặc định Planner duyệt được đơn. Nếu cần quy trình phê duyệt 2 cấp (Planner đề xuất → Admin duyệt), liên hệ Admin cấu hình permission `order.approve`.
:::

## Bộ lọc

Phần đầu trang có filter đa tiêu chí:

- **Khách hàng**: search theo tên/mã
- **Trạng thái duyệt**: PENDING / APPROVED / REJECTED
- **Trạng thái giao**: OPEN / PICKED_PACKED / SHIPPED / DELIVERED / FAILED
- **Khoảng ngày đặt** / **Khoảng ngày giao**
- **Đã lập kế hoạch chưa**: có/không

## Chia sẻ link tracking với khách

Mỗi đơn có URL tra cứu công khai dạng:
```
https://<domain>/track/<OrderCode>
```

Trên dòng đơn, bấm icon 🔗 → modal hiện URL → bấm **"Sao chép"** → gửi qua Zalo/SMS/email cho khách.

Khách mở link → thấy **realtime**:
- Trạng thái đơn hiện tại
- Vị trí xe đang giao (nếu đã SHIPPED)
- ETA dự kiến
- Thông tin tài xế (tên + SĐT)

Xem thêm: [Tra cứu đơn hàng công khai](/tracking-cong-khai).

## Xuất Excel

Bấm **"Xuất Excel"** → tải file `.xlsx` với toàn bộ đơn theo filter hiện tại, gồm:
- Thông tin đơn + khách + sản phẩm
- Trạng thái duyệt + giao
- Tổng tiền, tiền COD
- Mã chuyến xe (nếu đã phân)

Dùng để báo cáo cho khách hàng / kế toán.

## Bước tiếp theo

- [Lập kế hoạch vận chuyển](/role-planner/lap-ke-hoach) — Phân đơn `APPROVED` vào xe
- [Báo cáo vận tải](/role-accountant/bao-cao) — Số liệu tổng hợp đơn theo kỳ
