---
title: Giao hàng & xác nhận POD
sidebar_position: 3
---

# Giao hàng và xác nhận POD

**POD** = **Proof of Delivery** = Bằng chứng giao hàng. Bằng cách chụp ảnh khi giao, hệ thống có **bằng chứng pháp lý** đơn đã đến tay khách — quan trọng cho đối soát + tránh tranh chấp.

![Màn hình chi tiết điểm giao](/img/screenshots/driver/stop-detail.svg)

## Tới điểm dừng

Khi đến gần điểm giao:

1. App **rung + thông báo**: "Bạn đang gần điểm KH-002 (200m)"
2. Bấm điểm dừng đó trong danh sách → mở **Màn giao hàng**
3. Bấm **"Tôi đã đến"** → trạng thái điểm chuyển `IN_PROGRESS`

## Giao hàng — Trường hợp THÀNH CÔNG

### Bước 1: Bốc dỡ hàng
- Khách kiểm tra hàng + số lượng
- Khách ký vào phiếu giao (nếu có in)

### Bước 2: Chụp ảnh POD

![Màn hình POD giao hàng](/img/screenshots/driver/pod.svg)

Bấm **"📷 Chụp ảnh POD"** → camera mở:

- Chụp **1-3 ảnh** xác nhận:
  - Ảnh 1: Khách + hàng (mặt khách hoặc bảng tên công ty)
  - Ảnh 2: Phiếu giao đã ký
  - Ảnh 3 (tuỳ): Số đo / tem niêm phong

:::warning Ảnh POD chất lượng
- Đủ sáng (mở đèn flash nếu trong kho tối)
- Rõ chữ ký + tên người nhận
- Không chụp xa quá → blur không đọc được
:::

### Bước 3: Nhập tiền COD (nếu có)

Nếu đơn có **tiền thu hộ (COD)**:

1. Khách trả tiền mặt cho bạn
2. Đếm kỹ
3. App hiện ô **"Số tiền COD đã thu"** với giá trị đề xuất = số kế hoạch
4. **Sửa lại** nếu khác (vd khách chỉ trả được 1.4tr thay vì 1.5tr)
5. Ghi chú nếu có chênh lệch

### Bước 4: Đánh dấu hoàn thành

Bấm **"✅ Xác nhận giao thành công"**:

- Trạng thái điểm: `IN_PROGRESS` → **`COMPLETED`**
- App upload ảnh + COD lên server
- Bạn quay về danh sách điểm dừng → điểm này có dấu ✅

## Giao hàng — Trường hợp THẤT BẠI

Nếu không giao được:

1. Bấm **"❌ Đánh dấu thất bại"**
2. Chọn **lý do** từ danh sách:
   - Khách vắng (không có ai mở cửa)
   - Khách từ chối nhận
   - Sai địa chỉ
   - Hàng hỏng/sai
   - Khác (nhập tay)
3. **Chụp ảnh hiện trường** (bắt buộc, làm bằng chứng):
   - Cửa khách đóng + biển số nhà
   - Bảng hiệu "Đã chuyển địa chỉ"
   - Hàng bị hỏng...
4. Bấm **"Xác nhận"**

→ Trạng thái: `IN_PROGRESS` → **`FAILED`**
→ Notification gửi cho Dispatcher
→ Hàng quay về kho (Dispatcher quyết định)

:::tip Đừng tự ý bỏ qua
Nếu không chụp được bằng chứng → **vẫn chọn "Khác" + mô tả**. Sau này bạn sẽ phải giải trình với kế toán nếu thiếu thông tin.
:::

## Báo cáo sự cố

Khi gặp vấn đề **không thuộc 1 điểm cụ thể** (xe hỏng, kẹt xe, tai nạn):

- Vào menu chính → **"Báo cáo sự cố"**
- Chọn loại: Sự cố xe / Tắc đường / Khác
- Mô tả + chụp ảnh + bấm gửi

Xem thêm: [Xử lý sự cố](/role-dispatcher/xu-ly-su-co).

## Hoàn thành chuyến

Sau khi đã giao tất cả điểm:

1. App tự hiện màn **"Quay về kho"**
2. Bấm **"Bắt đầu về kho"** → trạng thái `RETURNING`
3. Khi tới kho → bấm **"Đã về kho"**
4. **Nộp tiền COD** cho kế toán (đối chiếu với app)
5. Trạng thái chuyến: `RETURNING` → **`COMPLETED`**

🎉 Hoàn thành! Bonus + lương được tính cho chuyến này.

## Câu hỏi thường gặp

**Q: Quên chụp POD, đã đóng giao thành công, sửa được không?**
A: **Không sửa được trên app**. Liên hệ admin để mở khoá điểm (cần lý do).

**Q: Mạng yếu, không upload được ảnh?**
A: App lưu offline → tự upload khi có mạng. Không cần lo mất ảnh.

**Q: Khách yêu cầu hoá đơn VAT?**
A: App chưa hỗ trợ in HĐ — liên hệ kế toán công ty xử lý sau.

**Q: COD tiền lẻ, không đủ tiền thối?**
A: Ghi chú vào ô **"Chênh lệch"** + giải thích. Kế toán bù trừ sau.

## Bước tiếp theo

- [Bảo dưỡng xe](/role-driver/bao-duong-xe) — Khi được giao lịch bảo dưỡng
