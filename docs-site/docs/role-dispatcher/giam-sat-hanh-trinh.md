---
title: Giám sát hành trình
sidebar_position: 1
---

# Giám sát hành trình

Trang Giám sát là **trung tâm điều phối** trong giờ làm việc — cho phép Dispatcher theo dõi **realtime** vị trí xe, tiến độ chuyến, và phản ứng nhanh khi có vấn đề.

![Giám sát hành trình](/img/screenshots/monitor-map.png)

## Bố cục trang

| Khu vực | Nội dung |
|---|---|
| **Bản đồ (giữa)** | Toàn bộ xe đang chạy trên 1 bản đồ Leaflet/OSM |
| **Danh sách chuyến (phải)** | Card từng chuyến: xe, tài xế, tiến độ, ETA |
| **Bộ lọc (trên)** | Lọc theo ngày, trạng thái, kho |

## Thông tin trên bản đồ

Mỗi xe = **1 marker màu** trên bản đồ:

| Màu | Ý nghĩa |
|---|---|
| 🟢 Xanh lá | Đang chạy đúng tuyến (IN_PROGRESS) |
| 🔵 Xanh dương | Vừa bắt đầu (LOADING / vừa rời kho) |
| 🟠 Cam | Đang về kho (RETURNING) |
| 🔴 Đỏ | **Lệch tuyến** (deviation) — cảnh báo! |
| ⚫ Xám | Mất tín hiệu GPS > 5 phút |

Bấm vào marker để **popup chi tiết**: tài xế, mã xe, điểm dừng kế tiếp, tốc độ hiện tại, thời gian cập nhật cuối.

## GPS Realtime

App mobile tài xế gửi vị trí lên server **mỗi 30 giây** khi chuyến đang chạy. Trên bản đồ:

- **Marker** = vị trí hiện tại
- **Đường nét đứt** = lộ trình dự kiến (theo kế hoạch)
- **Đường nét liền** = lộ trình thực tế (vẽ từ các điểm GPS lịch sử)

:::tip Phát hiện lệch tuyến
Hệ thống tự động so sánh GPS thực tế vs đường nét đứt kế hoạch. Nếu lệch quá **200m trong 3 lần liên tiếp** → đổi marker thành 🔴 đỏ + báo notification.

Nguyên nhân lệch tuyến thường gặp: tài xế đi đường khác (kẹt xe, tránh công an), tài xế đi sai địa chỉ, hoặc cần xác minh.
:::

## Chi tiết 1 chuyến

Bấm vào card chuyến bên phải hoặc marker trên bản đồ → mở **panel chi tiết**:

- **Thông tin xe + tài xế** (kèm SĐT bấm để gọi)
- **Danh sách điểm dừng** với trạng thái:
  - ⏳ Chưa đến
  - 📍 Đang ở
  - ✅ Hoàn thành (có POD ảnh kèm)
  - ❌ Thất bại (có lý do + ảnh)
- **Tiến độ**: X/N điểm đã giao
- **Tổng km thực tế** vs **kế hoạch**
- **COD đã thu**: tổng tiền + chi tiết từng điểm

## Trạng thái chuyến

```
ASSIGNED ─(tài xế confirm)─> DRIVER_CONFIRMED
   │
   └─(bắt đầu chạy)─> LOADING ─> IN_PROGRESS ─> RETURNING ─> COMPLETED
                                      │
                                      └─(có vấn đề)─> CANCELLED
```

## Hành động Dispatcher có thể làm

### 1. Gọi tài xế
Bấm SĐT trong card → mở dial trên máy tính (cần softphone) hoặc copy số.

### 2. Gửi tin nhắn (in-app)
Bấm icon 💬 trên chuyến → nhập text → tài xế nhận notification trên app.

### 3. Đánh dấu điểm thất bại
Khi tài xế không liên lạc được, Dispatcher có thể đánh dấu thay:
- Bấm điểm dừng → **"Đánh dấu thất bại"** → chọn lý do (khách vắng, sai địa chỉ, từ chối nhận...)

### 4. Đóng chuyến sớm
Khi tài xế gặp sự cố nghiêm trọng:
- Bấm **"Kết thúc chuyến"** → chuyển sang `CANCELLED`
- Hệ thống ghi vào Audit Log
- Đơn hàng chưa giao quay về trạng thái `OPEN` (chờ tái phân tuyến)

## Bộ lọc

- **Ngày**: mặc định hôm nay
- **Trạng thái**: tích các trạng thái muốn xem
- **Kho xuất phát**: lọc theo kho cha
- **Có cảnh báo**: chỉ hiện chuyến đang có deviation / GPS mất

## Bước tiếp theo

- [Xử lý sự cố](/role-dispatcher/xu-ly-su-co) — Khi tài xế báo có vấn đề
