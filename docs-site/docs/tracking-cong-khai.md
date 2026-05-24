---
title: Tra cứu đơn hàng công khai
sidebar_position: 90
---

# Tra cứu đơn hàng công khai

Khách hàng có thể tra cứu **trạng thái đơn hàng + vị trí xe realtime** mà **không cần tài khoản** — qua portal công khai của hệ thống.

![Form tra cứu đơn hàng](/img/screenshots/tracking-input.png)

## Cách truy cập

### Cách 1 — Từ link Planner gửi

Khi Planner tạo đơn xong, bấm icon 🔗 trên dòng đơn → copy URL:

```
https://<domain>/track/SO-2025-0001
```

Gửi URL này cho khách qua **Zalo / SMS / email**. Khách bấm vào → xem trạng thái ngay, không cần đăng ký gì.

### Cách 2 — Tự nhập mã đơn

Vào trang chính của hệ thống:

```
https://<domain>/track
```

→ form input hiện ra → khách gõ **mã đơn** (`SO-2025-0001` chẳng hạn) → bấm **"Tra cứu"**.

## Thông tin khách hàng xem được

Sau khi tra cứu thành công, khách thấy:

### 1. Trạng thái đơn hiện tại
- **OPEN** — đơn đã ghi nhận, đang chờ đóng gói
- **PICKED_PACKED** — đã đóng gói, chờ xe chở
- **SHIPPED** — đang trên đường giao 🚚
- **DELIVERED** — đã giao xong ✅
- **FAILED** — giao thất bại (kèm lý do)

### 2. Bản đồ realtime (khi đang SHIPPED)
- Vị trí xe hiện tại (cập nhật mỗi 30s)
- Lộ trình dự kiến đến điểm khách
- ETA dự kiến (giờ:phút)

### 3. Thông tin tài xế
- Tên tài xế
- Số điện thoại (để khách gọi nếu cần)
- Mã xe

### 4. Lịch sử timeline
- Thời điểm tạo đơn
- Thời điểm duyệt
- Thời điểm xe nhận hàng
- Thời điểm bắt đầu giao
- Thời điểm đến nơi

## Bảo mật & Riêng tư

:::warning Mã đơn là "khóa"
Bất kỳ ai có mã đơn đều xem được trạng thái — **giống mã vận đơn của GHN/J&T**. Đảm bảo:

- Mã đơn hệ thống tạo **đủ phức tạp** (vd `SO-2026-A8B3D`), không đoán được
- Planner **không share mã đơn lên kênh công khai** (Facebook, forum...)
- Khi đơn DELIVERED, bạn có thể vô hiệu URL nếu muốn (tuỳ cấu hình)
:::

Thông tin **không hiện** trên portal công khai:
- ❌ Giá trị đơn / tiền hàng
- ❌ Thông tin khách hàng khác (chỉ mã đơn của họ thôi)
- ❌ Lộ trình toàn bộ xe (chỉ điểm dừng của họ)

## Tích hợp vào website công ty

Nếu bạn có **website công ty riêng**, có thể nhúng form tracking dưới dạng iframe hoặc redirect:

```html
<!-- Form đơn giản trên website công ty -->
<form action="https://your-tms.com/track" method="GET">
  <input name="code" placeholder="Mã đơn hàng" />
  <button type="submit">Tra cứu</button>
</form>
```

## Câu hỏi thường gặp

**Q: Khách quên mã đơn thì sao?**
A: Họ liên hệ Planner / CSKH công ty → tra trong hệ thống → gửi lại.

**Q: Có gửi tự động link tracking cho khách qua SMS/email không?**
A: **Hiện chưa**. Trước có module SMS/Zalo nhưng đã bỏ vì không khả thi (cần Brandname Zalo OA approve...). Hiện tại Planner copy link gửi thủ công.

**Q: Khách có thể đánh giá đơn không?**
A: Hiện chưa hỗ trợ — chỉ xem trạng thái. Có thể bổ sung trong tương lai.

**Q: Đơn cũ (> 6 tháng) còn tra được không?**
A: Có. Hệ thống không xoá đơn — lưu trữ vĩnh viễn. Tra mã cũ vẫn xem được lịch sử (nhưng không có realtime GPS).

## Bước tiếp theo

- [Quản lý đơn hàng](/role-planner/don-hang) — Tạo đơn + lấy link share
- [Giám sát hành trình](/role-dispatcher/giam-sat-hanh-trinh) — Phía nội bộ theo dõi xe
