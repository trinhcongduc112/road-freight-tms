---
title: Bảng lương tài xế
sidebar_position: 2
---

# Bảng lương tài xế

Hệ thống **tự động tính lương** mỗi tài xế dựa trên dữ liệu chuyến xe đã hoàn thành. Kế toán chỉ việc xem + xuất Excel để chuyển khoản.

![Bảng lương tài xế](/img/screenshots/payroll-table.png)

## Công thức tính lương

```
Lương tháng = Lương cứng
            + Bonus theo km    (nếu vượt ngưỡng)
            + Bonus mỗi chuyến hoàn thành
            + Hoa hồng COD     (% trên tổng tiền thu hộ)
```

### Chi tiết từng thành phần

| Thành phần | Cách tính | Cấu hình mặc định |
|---|---|---|
| **Lương cứng** | Số tiền cố định/tháng, không phụ thuộc số chuyến | `8,000,000 VND` |
| **Ngưỡng km** | Số km tối thiểu không tính bonus | `300 km/tháng` |
| **Bonus km** | (km thực - ngưỡng) × giá/km | `2,000 VND/km` |
| **Bonus chuyến** | Số chuyến COMPLETED × giá/chuyến | `30,000 VND/chuyến` |
| **% COD** | Tổng COD đã thu × tỷ lệ | `0.5%` |

:::tip Tại sao không có "phạt huỷ chuyến"?
Phiên bản đầu có cột phạt khi tài xế huỷ chuyến, nhưng đã **bỏ** vì:
- Huỷ chuyến thường do Planner sai (lập kế hoạch không khả thi) hoặc khách huỷ — không phải lỗi tài xế
- Phạt làm xói mòn tinh thần tài xế khi họ không kiểm soát được nguyên nhân

Thay vào đó, hệ thống chỉ **không cộng bonus** cho chuyến chưa hoàn thành — đủ tạo động lực.
:::

## Bảng lương

### Bộ lọc

Chọn **Tháng** (mặc định tháng hiện tại) → nhấn **Áp dụng**.

### Cột trong bảng

| Cột | Ý nghĩa |
|---|---|
| **Tài xế** | Tên + mã driver |
| **Số chuyến hoàn thành** | Đếm trip có Status=COMPLETED |
| **Tổng km** | Sum(distanceKm) từ trip |
| **COD đã thu** | Sum(TotalCODCollected) |
| **Lương cứng** | Theo cấu hình |
| **Bonus km** | (km - ngưỡng) × giá/km, ≥ 0 |
| **Bonus chuyến** | chuyến × giá/chuyến |
| **Hoa hồng COD** | COD × % |
| **TỔNG** | Cộng tất cả cột bonus |

### KPI tổng

Trên đầu bảng có **3 thẻ tổng**:

- 💵 **Tổng lương phải trả** — Sum tất cả tài xế
- 🚛 **Tổng số chuyến** — Đếm tổng chuyến tháng đó
- 💰 **Tổng COD** — Tổng tiền thu hộ trong tháng

## Cấu hình công thức

Bấm icon **⚙️ Cài đặt** ở góc trên → modal hiện:

| Trường | Giá trị mặc định |
|---|---|
| Lương cứng (VND) | `8,000,000` |
| Ngưỡng km miễn bonus | `300` |
| Bonus mỗi km vượt ngưỡng (VND) | `2,000` |
| Bonus mỗi chuyến hoàn thành (VND) | `30,000` |
| Hoa hồng COD (%) | `0.5` |

Sửa các giá trị này → bấm **"Lưu"** → áp dụng cho **toàn bộ tổ chức** từ ngay lập tức.

:::warning Hiệu lực thay đổi
Thay đổi cấu hình **không hồi tố** — chỉ áp dụng cho dữ liệu mới. Bảng lương các tháng trước đã chốt vẫn dùng config cũ.
:::

## Xuất Excel

Bấm **"Xuất Excel"** → file `.xlsx` với:
- 1 sheet **Tổng** — bảng tóm tắt tháng
- Mỗi tài xế **1 sheet riêng** — chi tiết từng chuyến góp phần vào lương

Dùng để:
- In bảng lương đóng dấu, trình ký
- Upload Internet Banking chuyển khoản hàng loạt
- Lưu trữ hồ sơ kế toán

## Câu hỏi thường gặp

**Q: Tài xế chạy 2 chuyến trong 1 ngày, có tính 2 không?**
A: Có. Bonus chuyến tính theo từng record Trip có Status=COMPLETED.

**Q: Lương tài xế nhập thủ công được không?**
A: Hiện tại **không** — toàn bộ tự động. Nếu cần điều chỉnh (vd thưởng đặc biệt), gợi ý làm offline trong Excel sau khi xuất.

**Q: Ai xem được bảng lương?**
A: Chỉ **Accountant** (preset) hoặc user có permission `payroll.view`. Planner/Dispatcher **không xem được** — tránh xung đột.

**Q: Bảng lương có liên kết với Đối soát COD?**
A: Có. Cột "COD đã thu" lấy từ `TotalCODCollected` đã được tài xế khai báo (và nếu có module đối soát, từ con số kế toán đã xác nhận thực thu).

## Bước tiếp theo

- [Báo cáo vận tải](/role-accountant/bao-cao) — Bức tranh doanh thu/chi phí tổng
