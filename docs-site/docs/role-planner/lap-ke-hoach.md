---
title: Lập kế hoạch vận chuyển
sidebar_position: 3
---

# Lập kế hoạch vận chuyển

Đây là tính năng **cốt lõi** của hệ thống — tự động phân đơn hàng vào các xe có sẵn, tối ưu tuyến đường để giảm chi phí vận tải.

![Trang Lập kế hoạch](/img/screenshots/planning-overview.png)

## Khi nào dùng

Sử dụng tính năng này khi:
- Bạn đã có **danh sách đơn hàng đã duyệt** trong ngày
- Cần phân đơn vào xe sao cho **tối ưu** (ít xe nhất, ít km nhất)
- Cần chốt kế hoạch để **chuyển sang Dispatcher** giao xe

## Quy trình tổng thể

```
1. Chọn kho & ngày chạy
       ↓
2. Hệ thống lấy đơn chưa phân
       ↓
3. Tạo kế hoạch mới (chạy tối ưu CVRP)
       ↓
4. Kiểm tra tuyến trên bản đồ
       ↓
5. Gán tài xế cho từng xe
       ↓
6. Chốt kế hoạch → khóa, chuyển sang giao việc
```

## Bước 1 — Chọn kho và ngày chạy

Ở đầu trang, chọn:
- **Kho lập kế hoạch**: là tổ chức con loại "kho", nơi xuất hàng
- **Ngày chạy**: ngày dự kiến giao hàng

![Chọn kho và ngày](/img/screenshots/planning-select-warehouse.png)

:::warning Lưu ý
Chỉ những kho thuộc phạm vi quyền của bạn mới xuất hiện. Nếu thiếu kho, liên hệ Admin để mở quyền.
:::

## Bước 2 — Xem đơn chưa phân

Cột bên phải hiển thị **danh sách đơn hàng đã duyệt** cho ngày đó nhưng chưa thuộc kế hoạch nào.

![Danh sách đơn chưa phân](/img/screenshots/planning-unassigned-orders.png)

Mỗi đơn cho biết:
- Mã đơn + tên khách hàng
- Tổng khối lượng (kg), thể tích (m³)
- Khung giờ giao hàng (nếu có)

## Bước 3 — Tạo kế hoạch mới

Bấm nút **"+ Tạo kế hoạch mới"** màu xanh để bắt đầu.

![Nút tạo kế hoạch mới](/img/screenshots/planning-create-button.png)

Hệ thống sẽ:
1. Lấy toàn bộ đơn chưa phân của ngày
2. Lấy danh sách xe sẵn sàng của kho
3. Gọi **OR-Tools CVRP** để giải bài toán định tuyến
4. Tạo các tuyến tối ưu (mỗi tuyến = 1 xe)

Quá trình mất khoảng **3-10 giây** tuỳ số lượng đơn.

### Kết quả tối ưu

Sau khi chạy xong, hệ thống hiển thị:

![Kết quả tối ưu](/img/screenshots/planning-optimized-result.png)

Mỗi tuyến hiển thị:
- **Mã xe** đảm nhiệm
- **Số điểm dừng** + tổng km
- **Tải trọng** sử dụng / max (vd: 1800/2000 kg = 90%)
- **Thời gian dự kiến** đi + về

## Bước 4 — Xem bản đồ tuyến

Phần bản đồ ở giữa hiển thị **toàn bộ tuyến đường** với màu khác nhau:

![Bản đồ các tuyến](/img/screenshots/planning-map-routes.png)

- 🟢 **Xanh lá** = Tuyến đầu tiên
- 🔵 **Xanh dương** = Tuyến thứ hai
- 🟠 **Cam** = Tuyến thứ ba
- ... (mỗi tuyến 1 màu)

Bấm vào **điểm dừng** trên bản đồ để xem chi tiết đơn hàng tại đó.

:::tip Mẹo
Bấm nút **"Phóng to"** ở góc trên bản đồ để mở chế độ xem toàn màn hình — dễ kiểm tra tuyến phức tạp hơn.
:::

## Bước 5 — Gán tài xế

Trong mỗi card tuyến, bấm dropdown **"Chọn tài xế"** để gán người chạy.

![Gán tài xế cho tuyến](/img/screenshots/planning-assign-driver.png)

Danh sách chỉ hiện những tài xế:
- Thuộc phạm vi quyền của bạn
- Trạng thái **Active**
- **Chưa được gán** chuyến nào trong ngày

### Điều chỉnh thủ công

Bạn có thể:
- **Kéo đơn** từ tuyến này sang tuyến khác
- **Xoá đơn** khỏi tuyến (đơn quay lại danh sách "chưa phân")
- **Đổi thứ tự điểm dừng** trong tuyến

![Kéo thả đơn giữa các tuyến](/img/screenshots/planning-drag-drop.png)

## Bước 6 — Chốt kế hoạch

Khi đã ưng ý, bấm nút **"Chốt lộ trình"** màu đỏ ở cuối trang.

![Nút chốt lộ trình](/img/screenshots/planning-finalize-button.png)

### Điều gì xảy ra sau khi chốt?

1. ✅ Kế hoạch **chuyển sang trạng thái LOCKED** — không sửa được nữa
2. ✅ Mỗi tuyến **tự động tạo Trip** trong hệ thống
3. ✅ Tài xế được gán **nhận thông báo realtime** trên app mobile
4. ✅ Đơn hàng chuyển sang trạng thái **"Đã lập kế hoạch"**
5. ✅ Dispatcher có thể bắt đầu theo dõi trên trang Giám sát

:::warning Đã chốt là không sửa
Sau khi chốt, để sửa kế hoạch bạn phải **mở khóa** (cần quyền Admin) — hành động này sẽ ghi vào Audit Log.
:::

## AI Agent — Lập kế hoạch bằng giọng nói

Bạn có thể bỏ qua các bước trên bằng cách **ra lệnh cho AI Agent**:

![AI Agent lập kế hoạch](/img/screenshots/planning-ai-agent.png)

Ví dụ các lệnh:
- *"Lập kế hoạch ngày mai"*
- *"Tối ưu lộ trình ngày 20/5"*
- *"Tạo kế hoạch hôm nay cho kho Đống Đa"*

AI Agent sẽ tự mở trang, set ngày, chạy tối ưu thay bạn.

## Câu hỏi thường gặp

**Q: Tại sao có đơn không được phân?**
A: Có thể do (1) tải trọng tất cả xe đã đầy, (2) đơn nằm quá xa kho, (3) đơn thiếu toạ độ. Kiểm tra cảnh báo màu đỏ ở dưới mỗi đơn.

**Q: Có thể chạy tối ưu nhiều lần không?**
A: Có. Mỗi lần bấm "Tạo kế hoạch mới" sẽ xoá kế hoạch cũ chưa chốt và chạy lại từ đầu.

**Q: Tôi muốn ưu tiên giao đơn này trước?**
A: Sau khi tối ưu, bạn có thể **kéo đơn** lên đầu tuyến để giao sớm.

**Q: Hệ thống tính chi phí thế nào?**
A: Dựa vào cấu hình của xe trong Master Data: `FixedCost` (cố định/ngày) + `CostPerKm` × km. Tổng các tuyến cho ra chi phí kế hoạch.

## Tiếp theo

- [Giám sát hành trình thực tế](/role-dispatcher/giam-sat-hanh-trinh) — Theo dõi xe sau khi chốt
- [Xử lý sự cố](/role-dispatcher/xu-ly-su-co) — Khi xe gặp vấn đề trên đường
