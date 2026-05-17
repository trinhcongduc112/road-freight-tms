---
title: Báo cáo vận tải
sidebar_position: 1
---

# Báo cáo vận tải

Trang Báo cáo cung cấp **bức tranh tổng thể** về tình hình kinh doanh vận tải — dùng cho lãnh đạo, kế toán, và lập kế hoạch chiến lược.

![Báo cáo vận tải](/img/screenshots/report-overview.png)

## Chọn kỳ báo cáo

Đầu trang có **bộ chọn kỳ** với 4 option:

| Kỳ | Khoảng thời gian |
|---|---|
| **Tuần** | Thứ 2 → Chủ nhật của tuần hiện tại |
| **Tháng** | Ngày 1 → ngày cuối tháng |
| **Quý** | Q1 / Q2 / Q3 / Q4 |
| **Tuỳ chọn** | RangePicker chọn 2 ngày bất kỳ |

Mỗi lần đổi kỳ, **tất cả KPI + biểu đồ tự refresh** trong 1-2 giây.

:::tip Refresh tự động
Trang tự gọi lại API **mỗi 30 giây** — số liệu luôn realtime mà không cần F5.
:::

## 4 KPI chính

Trên cùng là **4 thẻ chỉ số**:

| Thẻ | Ý nghĩa |
|---|---|
| 📄 **Tổng đơn** | Số đơn hàng trong kỳ |
| ✅ **Đã giao** (X%) | Số đơn DELIVERED + tỷ lệ giao thành công |
| 🚛 **Chuyến xe** | Số chuyến vận chuyển đã tạo |
| 👥 **Khách hàng** | Số khách hàng có đơn trong kỳ |

## 3 thẻ tiền

Hàng thứ 2:

- 💰 **Tiền hàng** — Tổng giá trị sản phẩm trong đơn (gross)
- 🚚 **Tiền xe / dịch vụ đơn hàng** — Phí vận chuyển tính trên đơn
- 📊 **Tổng giá trị đơn hàng** — Tiền hàng + Tiền xe

## Bảng chi tiết

Bảng **"Báo cáo chi tiết"** hiển thị 7 chỉ tiêu kế toán:

| Chỉ tiêu | Cách tính |
|---|---|
| Số đơn hàng | Đếm tổng đơn |
| Tổng giá trị tiền | Sum(goodsAmount + serviceAmount) |
| Tiền hàng | Sum(price × qty) trên đơn |
| Tiền xe / dịch vụ đơn hàng | Sum(servicePrice) trên đơn |
| **Chi phí vận tải ước tính** | Sum(FixedCost + CostPerKm × km) từ Trip |
| **Doanh thu đã giao** | Chỉ tính đơn DELIVERED |
| **Lãi gộp vận tải** | Doanh thu - Chi phí |

:::warning Tách biệt giá đơn vs chi phí
- **"Tiền xe trên đơn"** = giá bán cho khách (revenue)
- **"Chi phí vận tải"** = chi phí thực để chạy xe (cost)
- **Lãi gộp** = chênh lệch — chỉ số quan trọng nhất cho lãnh đạo
:::

## Biểu đồ trực quan

### Doanh thu - Chi phí theo ngày
Bar chart 3 series: **Doanh thu (xanh) · Chi phí (cam) · Lãi gộp (xanh lá)** theo từng ngày trong kỳ.

### Trạng thái đơn hàng (Pie chart)
Hiển thị tỷ trọng:
- 🟦 Mở (OPEN)
- 🟦 Đã lấy hàng (PICKED_PACKED)
- 🟧 Đang giao (SHIPPED)
- 🟩 Đã giao (DELIVERED)
- ⬜ Huỷ
- 🟥 Từ chối

## Tỷ lệ vận hành

3 progress bar đo hiệu quả:

- **Tỷ lệ phê duyệt** = APPROVED / Tổng đơn
- **Tỷ lệ đã lập kế hoạch** = đơn có trip / Tổng đơn
- **Tỷ lệ giao thành công** = DELIVERED / Tổng đơn

## Top khách hàng

Bảng **"Top khách hàng theo doanh thu"** — 8 khách có doanh thu cao nhất, gồm:
- Tên KH + Mã
- Nhóm KH
- Số đơn
- Doanh thu

Dùng để **phân tích Pareto 80/20** — thường 20% khách tạo ra 80% doanh thu.

## Chi tiết chuyến xe

Bảng cuối liệt kê **mọi chuyến** trong kỳ với mã chuyến, ngày, xe, tài xế, trạng thái, km, chi phí, COD đã thu.

## Xuất Excel

Bấm **"Xuất Excel"** ở góc trên — tải file `.xlsx` với **5 sheet**:

1. **Tong quan** — KPI + tổng tiền
2. **Don hang** — chi tiết từng đơn
3. **Chuyen xe** — chi tiết từng trip
4. **Khach hang** — doanh thu theo từng khách
5. **Theo ngay** — số liệu daily

Format chuẩn để gửi kế toán / kiểm toán.

## AI Agent — Tải báo cáo nhanh

Trong AI Agent, gõ:
- *"Tải báo cáo tháng này"* → tự mở Reports + set period=month + auto-export
- *"Báo cáo tuần"* → tương tự với period=week
- *"Báo cáo từ 1/5 đến 17/5"* → custom range

Đỡ phải bấm tay nhiều bước.

## Bước tiếp theo

- [Bảng lương tài xế](/role-accountant/bang-luong) — Tính lương dựa trên chuyến đã chạy
