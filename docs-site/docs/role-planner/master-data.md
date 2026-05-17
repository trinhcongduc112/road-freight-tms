---
title: Quản lý Master Data
sidebar_position: 1
---

# Quản lý Master Data

Master Data là **dữ liệu nền** của hệ thống — danh sách khách hàng, sản phẩm, phương tiện... được dùng đi dùng lại trong nghiệp vụ. Đầu tư setup Master Data tốt = giảm sai sót khi lập đơn / kế hoạch.

Trang Master Data có **7 tab**, mỗi tab quản lý 1 loại entity.

## Tab 1: Khách hàng

![Master Data — Khách hàng](/img/screenshots/md-customers.png)

Thông tin quan trọng cho mỗi khách hàng:

| Field | Bắt buộc | Mục đích |
|---|---|---|
| **Mã KH** (CustomerCode) | ✅ | Mã duy nhất, vd `CUS-001` |
| **Tên** | ✅ | Hiển thị trong đơn hàng / báo cáo |
| **Nhóm KH** | — | Phân loại (VIP, Thường, Gia đình...) |
| **Địa chỉ** | ✅ | Nơi giao hàng |
| **Toạ độ** (Lat/Lng) | ✅✅ | **CỰC KỲ QUAN TRỌNG** — không có toạ độ thì tối ưu tuyến không chạy được |
| **SĐT** | — | Liên hệ |
| **Giờ mở/đóng cửa** | — | Khung giờ giao hàng cho phép |
| **Thời gian dừng** | — | Phút dự kiến tại điểm giao (default 10') |

:::tip Lấy toạ độ tự động
Nhập địa chỉ → bấm nút **"Tự động lấy toạ độ từ địa chỉ"** → hệ thống gọi OpenStreetMap. Nếu địa chỉ chung chung, kết quả không chính xác — kiểm tra trên Google Maps trước khi lưu.
:::

## Tab 2: Nhóm khách hàng

Group khách hàng để báo cáo / phân loại. Vd: `VIP`, `Doanh nghiệp`, `Cá nhân`.

## Tab 3: Nhóm sản phẩm

Phân loại theo loại hàng hoá: `Thực phẩm`, `Đồ uống`, `Điện tử`, `Dược phẩm`, `Hoá chất`...

Mỗi nhóm có:
- **Thời gian bốc dỡ/thùng** (phút) — dùng tính thời gian dừng
- **Cho phép chồng hàng** — ràng buộc xếp hàng trên xe

## Tab 4: Sản phẩm

![Master Data — Sản phẩm](/img/screenshots/md-products.png)

Mỗi sản phẩm có:

- **Mã SP**, **Tên**, **Nhóm SP**
- **Đơn vị tính** (pcs, kg, lít...)
- **Khối lượng/thùng** (kg)
- **Thể tích/thùng** (m³)
- **Số lượng/thùng** (đơn vị)
- **Đơn giá** (VND)

Khi tạo đơn hàng, chọn sản phẩm → hệ thống tự tính tổng kg/m³ để biết xe nào chở được.

## Tab 5: Phương tiện (Xe)

![Master Data — Phương tiện](/img/screenshots/md-vehicles.png)

| Field | Quan trọng |
|---|---|
| **Mã xe**, **Biển số** | Định danh |
| **Loại xe** | Truck / Semi-truck / Trailer / Bike |
| **Tải trọng (kg)** | ⚠️ Ràng buộc tối ưu |
| **Thể tích (m³)** | ⚠️ Ràng buộc tối ưu |
| **Chi phí cố định/ngày** | Tính chi phí kế hoạch |
| **Chi phí/km** | Tính chi phí thực tế |
| **Tốc độ TB (km/h)** | Tính thời gian di chuyển |
| **TG bốc hàng tại kho** (phút) | Trước khi xuất phát |
| **TG dỡ hàng tại mỗi điểm** (phút) | Cộng vào tổng thời gian tuyến |

## Tab 6: Dịch vụ 3PL

Cho phép thuê **nhà vận chuyển bên thứ 3** (3PL) thay vì tự chạy:

- **FTL** — Full Truck Load
- **LTL** — Less Than Truck Load
- **EXPRESS** — Giao nhanh
- **LAST_MILE** — Chặng cuối
- **REFRIGERATED** — Dây chuyền lạnh

Mỗi dịch vụ có giá: Flat rate, /km, /kg, /m³, phụ phí nhiên liệu.

## Tab 7: Bảo dưỡng xe

![Master Data — Bảo dưỡng](/img/screenshots/md-maintenance.png)

Lên lịch bảo dưỡng định kỳ cho xe:

- **Xe** + **Loại bảo dưỡng** (thay dầu / lốp / phanh / kiểm tra...)
- **Ngày dự kiến**
- **Tài xế thực hiện** (tuỳ chọn — driver được gán sẽ nhận thông báo trên app)
- **Trạng thái**: SCHEDULED → ACKNOWLEDGED → IN_PROGRESS → AWAITING_REVIEW → COMPLETED

Đầy đủ workflow ở [App tài xế > Bảo dưỡng xe](/role-driver/bao-duong-xe).

## Nhập Excel hàng loạt

Hầu hết các tab đều có nút **"Nhập Excel"** ở góc trên:

1. Bấm **"Tải mẫu"** để lấy file template với header sẵn
2. Mở Excel, điền dữ liệu (mỗi dòng = 1 bản ghi)
3. Bấm **"Chọn file (.xlsx)"** → upload lên
4. Hệ thống hiển thị **kết quả import**:
   - ✅ Đã tạo: bao nhiêu bản ghi
   - ⏭ Bỏ qua: trùng mã
   - ❌ Lỗi: dòng nào sai, lý do gì

:::tip Mẹo import nhanh
Khi setup hệ thống lần đầu, dùng import Excel để vào hàng trăm khách hàng / sản phẩm trong 1 lần thay vì nhập tay.
:::

## Bước tiếp theo

- [Quản lý đơn hàng](/role-planner/don-hang) — Tạo đơn từ khách hàng đã có
- [Lập kế hoạch vận chuyển](/role-planner/lap-ke-hoach) — Phân đơn vào xe
