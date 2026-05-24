---
title: Nhận và hoàn thành bảo dưỡng
sidebar_position: 4
---

# Nhận và hoàn thành bảo dưỡng xe

Ngoài giao hàng, tài xế còn nhận **công việc bảo dưỡng xe** — thay dầu, lốp, kiểm tra định kỳ. Workflow tương tự nhận chuyến nhưng đơn giản hơn.

![Màn hình bảo dưỡng trên app tài xế](/img/screenshots/driver/maintenance.svg)

## Luồng workflow

```
Master Data > Bảo dưỡng > Lên lịch
       ↓
Planner/Admin gán tài xế thực hiện
       ↓
🔔 Tài xế nhận thông báo
       ↓
"Nhận việc" → trạng thái ACKNOWLEDGED
       ↓
Đến nơi → IN_PROGRESS
       ↓
Hoàn thành → chụp ảnh → AWAITING_REVIEW
       ↓
Admin/kế toán duyệt → COMPLETED ✅
```

## 1. Nhận thông báo

Khi admin gán bảo dưỡng:

- 🔔 Push notification: "Bạn được giao lịch bảo dưỡng xe 29B-12345"
- Icon chuông trong app có chấm đỏ
- Vào **Thông báo** → bấm vào dòng bảo dưỡng

## 2. Xem chi tiết

Màn chi tiết hiển thị:

- **Xe** được bảo dưỡng (mã + biển số)
- **Loại bảo dưỡng**:
  - 🛢️ Thay dầu máy
  - 🛞 Thay lốp
  - 🔧 Kiểm tra phanh
  - 🔋 Kiểm tra ắc quy
  - ⚙️ Bảo dưỡng tổng quát
  - 🔩 Sửa chữa
  - ... (8 loại)
- **Ngày dự kiến**
- **Hạn hoàn thành**
- **Ghi chú từ admin** (vd "Mang xe đến gara Toyota Cầu Giấy")
- **Trạng thái hiện tại**

## 3. Nhận việc

Bấm **"Nhận việc"**:

- Trạng thái: `SCHEDULED` → **`ACKNOWLEDGED`**
- Admin biết bạn đã sẵn sàng + sẽ thực hiện

Nếu bận → bấm **"Từ chối"** + nêu lý do (xin nghỉ phép, ốm, kẹt chuyến khác...).

## 4. Bắt đầu thực hiện

Khi đến gara/cửa hàng/cơ sở bảo dưỡng:

- Bấm **"Bắt đầu thực hiện"**
- Trạng thái: `ACKNOWLEDGED` → **`IN_PROGRESS`**

App cho phép **vừa làm chuyến giao hàng vừa làm bảo dưỡng cùng ngày** — nhưng chỉ 1 việc đang `IN_PROGRESS` tại một thời điểm.

## 5. Hoàn thành

Khi bảo dưỡng xong:

### Bước 1: Chụp ảnh kết quả

Bấm **"📷 Chụp ảnh hoàn thành"** → camera mở. Chụp **1-5 ảnh**:

- Hoá đơn cửa hàng / gara
- Phần xe đã được sửa (vd lốp mới)
- Ki-lô-mét đồng hồ
- Tem tem niêm phong (nếu có)

:::warning Ảnh là bằng chứng
Ảnh dùng để admin/kế toán **xác minh** công việc đã làm trước khi duyệt. Thiếu ảnh = không duyệt được = không trả lương bonus bảo dưỡng.
:::

### Bước 2: Nhập ghi chú (tuỳ chọn)

Ô **"Ghi chú hoàn thành"**: viết những gì làm thực tế. Vd:
> "Đã thay dầu Motul 5W30, lọc dầu, lọc gió. Tổng 850k. Hoá đơn đính kèm."

### Bước 3: Gửi để duyệt

Bấm **"Gửi để duyệt"**:

- Trạng thái: `IN_PROGRESS` → **`AWAITING_REVIEW`**
- Notification gửi cho admin/kế toán

## 6. Chờ duyệt

Trạng thái `AWAITING_REVIEW` có thể kéo dài **1-3 ngày**:

- Admin xem ảnh + ghi chú
- So sánh với chi phí kế hoạch
- Nếu OK → bấm "Duyệt" → trạng thái `COMPLETED` ✅
- Nếu không → trả lại với note "Cần bổ sung ảnh X" → quay về `IN_PROGRESS`

## Xem lịch sử

Vào tab **"Bảo dưỡng"** trong app → 2 sub-tab:

- **Sắp tới**: lịch chưa làm
- **Đã làm**: lịch sử bảo dưỡng đã hoàn thành (xem lại ảnh)

## Câu hỏi thường gặp

**Q: Tôi không phải tài xế của xe này, sao lại nhận bảo dưỡng?**
A: Admin có thể gán **bất kỳ** tài xế nào. Lý do: tài xế gốc bận chuyến / nghỉ phép. Bạn nhận thay → vẫn được tính công.

**Q: Bảo dưỡng có tính vào lương không?**
A: Cấu hình tuỳ tổ chức. Mặc định **chưa tính** trong [bảng lương](/role-accountant/bang-luong) — nhưng admin có thể bổ sung khoản bonus riêng.

**Q: Sửa nhỏ tại đường (vá lốp tạm) có khai bảo dưỡng không?**
A: **Không**. Cái đó là [sự cố](/role-dispatcher/xu-ly-su-co). Bảo dưỡng = công việc đã lên kế hoạch, có ngày + loại cụ thể.

**Q: Quên chụp ảnh, lỡ submit rồi?**
A: Liên hệ admin → họ trả lại trạng thái `IN_PROGRESS` → bạn bổ sung ảnh.

## Bước tiếp theo

- [Giao hàng & POD](/role-driver/giao-hang-pod) — Workflow chính
- [Cài đặt app](/role-driver/cai-dat-app) — Cấp quyền camera để chụp ảnh được
