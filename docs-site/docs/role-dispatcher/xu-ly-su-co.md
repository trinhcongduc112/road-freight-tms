---
title: Xử lý sự cố
sidebar_position: 2
---

# Xử lý sự cố (Incident)

Khi tài xế đang giao hàng gặp vấn đề (hỏng xe, tai nạn, kẹt đường, khách vắng...), họ báo cáo sự cố từ **app mobile**. Dispatcher xử lý trên web.

:::info Đang cập nhật screenshot
Phần này cần dữ liệu sự cố thực để demo — sẽ bổ sung ảnh sau khi tài xế test báo sự cố thật.
:::

## Luồng báo cáo sự cố

```
Tài xế gặp vấn đề
       ↓
Mở app → "Báo cáo sự cố" → chọn loại + chụp ảnh + ghi chú
       ↓
Backend tạo Incident record + push notification cho Dispatcher
       ↓
Dispatcher xử lý → đóng sự cố
```

## Loại sự cố

App tài xế cho phép chọn 1 trong 6 loại:

| Loại | Khi nào dùng |
|---|---|
| 🚗 **Sự cố xe** | Hỏng máy, lốp nổ, hết xăng |
| 🚦 **Tắc đường** | Kẹt xe nặng, ảnh hưởng ETA |
| 📍 **Sai địa chỉ** | Không tìm được điểm giao |
| 🚫 **Khách từ chối** | Khách không nhận hàng |
| 👤 **Khách vắng** | Đến nơi nhưng không ai mở cửa |
| ⚠️ **Khác** | Nguyên nhân khác kèm mô tả |

Mỗi sự cố có thể đính kèm **tối đa 3 ảnh** (hỏng xe, biển hiệu khách, hiện trường...).

## Xem sự cố trên web

Sự cố hiện ở **2 nơi**:

1. **Trang Giám sát hành trình** — popup cảnh báo + marker đỏ trên xe
2. **Sidebar > Quản trị > Sự cố** (nếu enable module) — danh sách lịch sử

## Xử lý sự cố

Bấm vào sự cố → modal chi tiết:

### Thông tin hiển thị

- Loại sự cố + thời gian xảy ra
- Mô tả từ tài xế
- Ảnh đính kèm
- Vị trí GPS khi báo cáo
- Chuyến đang chạy + điểm dừng liên quan

### 4 hành động Dispatcher

#### 1. Liên hệ tài xế
- Bấm SĐT để gọi
- Hoặc gửi tin nhắn in-app (icon 💬)

#### 2. Phân tuyến lại
Khi sự cố nghiêm trọng (xe hỏng nặng):
- Mở trang **Lập kế hoạch** → chọn ngày tương ứng
- **Mở khoá** chuyến (cần quyền Admin)
- Kéo các đơn chưa giao sang xe khác đang sẵn sàng

#### 3. Đánh dấu điểm thất bại
Khi sự cố là "khách vắng / từ chối":
- Đóng điểm đó với trạng thái **FAILED**
- Ghi rõ lý do để báo cáo

#### 4. Đóng sự cố
- Sau khi xử lý xong, bấm **"Đóng sự cố"**
- Nhập **ghi chú cách xử lý** (vd "Đã cử xe thay thế lúc 14:30")
- Trạng thái chuyển: OPEN → RESOLVED

## Báo cáo sự cố

Trang **Báo cáo > Sự cố** (tuỳ chọn module) cho biết:
- Số sự cố trong kỳ
- Tỷ lệ % chuyến có sự cố
- Loại sự cố thường gặp nhất
- Tài xế có nhiều sự cố nhất

Dùng để cải thiện: bảo dưỡng xe định kỳ, đào tạo tài xế, đàm phán với khách thường vắng.

## Câu hỏi thường gặp

**Q: Tài xế báo nhầm sự cố thì sao?**
A: Dispatcher có thể đóng sự cố với note "báo nhầm". Sự cố vẫn lưu lại trong audit log nhưng không tính vào báo cáo.

**Q: Nếu Dispatcher không online thì ai xử lý?**
A: Notification cũng gửi cho **IT Admin** của tổ chức + lưu vào DB. Sự cố vẫn ở trạng thái OPEN cho đến khi có người xử lý.

**Q: Tài xế báo xong có làm gì tiếp được không?**
A: Có. Báo cáo không khoá app — tài xế vẫn tiếp tục giao các điểm khác nếu xe vẫn chạy được.

## Bước tiếp theo

- [Giám sát hành trình](/role-dispatcher/giam-sat-hanh-trinh) — Nguồn phát hiện sự cố
- [Báo cáo vận tải](/role-accountant/bao-cao) — Tổng kết KPI sự cố
