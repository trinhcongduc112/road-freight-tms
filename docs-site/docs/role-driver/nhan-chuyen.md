---
title: Nhận chuyến
sidebar_position: 2
---

# Nhận chuyến trên app

Khi Planner chốt kế hoạch và gán bạn vào một chuyến, app sẽ **tự động hiển thị** chuyến đó cho bạn.

![Danh sách chuyến trên app tài xế](/img/screenshots/driver/trip-list.svg)

## Nhận thông báo

Khi được gán chuyến mới:

1. 🔔 **Push notification** hiện ngay (cần app đang mở hoặc chạy nền)
2. Mở app → biểu tượng chuông góc trên có **chấm đỏ + số chuyến mới**
3. Vào tab **"Chuyến đi"** ở thanh dưới → thấy chuyến mới

Nếu app **không nhận thông báo**:
- Vào Cài đặt Android > Apps > Road Freight Driver > **Thông báo** → bật
- Đảm bảo "Battery optimization" tắt cho app
- Kiểm tra WiFi/4G còn không

## Xem chi tiết chuyến

Bấm vào chuyến trong danh sách → màn **Chi tiết** hiện đầy đủ:

![Chi tiết chuyến và danh sách điểm dừng](/img/screenshots/driver/trip-detail.svg)

### Thông tin tổng quan
- **Mã chuyến** + **Ngày chạy**
- **Xe** được phân (mã + biển số + tải trọng)
- **Tổng số điểm dừng**
- **Quãng đường dự kiến** (km)
- **Giờ xuất phát** + **giờ về dự kiến**

### Danh sách điểm dừng

Hiển thị **theo thứ tự đã tối ưu** — bạn nên giao theo đúng thứ tự này để đảm bảo ETA + tiết kiệm xăng:

| Điểm | Khách | Địa chỉ | Hàng | COD |
|---|---|---|---|---|
| 1 | KH-001 Vinamilk | 123 Đống Đa, HN | 5 thùng sữa | 0 |
| 2 | KH-002 PNJ | 456 Hai Bà Trưng | 2 thùng đồng hồ | 1,500,000 |
| ... | ... | ... | ... | ... |

Bấm vào 1 điểm để xem:
- **Ghi chú từ Planner** (vd "Gọi trước 15 phút")
- **Khung giờ giao** (vd 8:00-11:00)
- **SĐT khách** (bấm để gọi)
- **Bản đồ điểm giao**

## Xác nhận nhận chuyến

Sau khi xem kỹ chi tiết:

- Nếu OK → bấm **"Xác nhận nhận chuyến"** ở cuối màn
- Trạng thái chuyến chuyển: `ASSIGNED` → `DRIVER_CONFIRMED`
- Dispatcher biết bạn đã sẵn sàng

Nếu **không nhận** được (xe hỏng, ốm, lý do khác):
- Bấm **"Từ chối chuyến"** → nhập lý do
- Notification gửi cho Planner/Dispatcher → họ phân tài xế khác

## Bắt đầu chạy

Khi đến giờ + bạn đã ở **kho xuất phát**:

1. Bấm **"Bắt đầu bốc hàng"**
2. Đợi nhân viên kho xếp hàng lên xe
3. Khi xong, bấm **"Hoàn thành bốc hàng — Xuất phát"**
4. Trạng thái: `LOADING` → `IN_PROGRESS`
5. **GPS tự động bật**, cập nhật vị trí mỗi 30 giây
6. App chuyển sang chế độ **"Đang giao hàng"** — hiện điểm dừng kế tiếp + chỉ đường

:::tip Tự động chỉ đường
Bấm icon 🧭 trên điểm dừng → mở Google Maps / Apple Maps với route đến điểm đó. Tiết kiệm thời gian nhập địa chỉ.
:::

## Trong khi chạy

App hiển thị:
- 📍 **Điểm dừng kế tiếp** (tên khách, địa chỉ, ETA)
- 🚚 **X/Y** — đã giao bao nhiêu / tổng
- ⏱️ **Thời gian còn lại** dự kiến
- 🔋 **Trạng thái GPS** (xanh = đang gửi)

Khi đến điểm → bấm điểm → mở **Màn giao hàng + POD** → xem [hướng dẫn POD](/role-driver/giao-hang-pod).

## Câu hỏi thường gặp

**Q: Có thể chạy ngược thứ tự điểm dừng không?**
A: Được, nhưng **không khuyến nghị**. Thứ tự đã được CVRP tối ưu — đảo lộn có thể làm xe đi qua một điểm 2 lần.

**Q: Lỡ giao sót 1 điểm, quay lại được không?**
A: Có. Vào danh sách điểm → chọn điểm chưa giao → thực hiện POD. App không khoá thứ tự.

**Q: Hết pin giữa chừng?**
A: Mang **sạc dự phòng**. App vẫn track vị trí cuối trước khi tắt, khi mở lại sẽ resume.

## Bước tiếp theo

- [Giao hàng & POD](/role-driver/giao-hang-pod) — Xác nhận giao thành công
- [Báo cáo sự cố](/role-dispatcher/xu-ly-su-co) — Khi gặp vấn đề trên đường
