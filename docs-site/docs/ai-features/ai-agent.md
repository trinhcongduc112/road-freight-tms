---
title: AI Agent — Ra lệnh tự nhiên
sidebar_position: 2
---

# AI Agent

AI Agent là **trợ lý tự động hóa** — bạn ra lệnh tự nhiên bằng tiếng Việt, Agent **tự thao tác UI** thay bạn: mở trang, set filter, tải báo cáo, lập kế hoạch...

![AI Agent panel](/img/screenshots/agent-panel.png)

## Tại sao cần AI Agent?

So với menu thông thường, AI Agent giúp:
- ⚡ **Nhanh hơn**: 1 câu thay 4-5 click
- 🎯 **Đúng filter ngay**: "đơn chờ duyệt hôm nay" → tự set 2 filter
- 🗣️ **Tự nhiên**: nói/gõ như nhân viên thật, không cần học giao diện
- 🧠 **Hiểu ngày tiếng Việt**: "hôm qua", "ngày 14", "20/5/2026" — đều OK

## Mở AI Agent

**Sidebar bên trái** → bấm **"AI Agent"** (icon 🤖).

Panel mở ở góc phải, để bạn vừa ra lệnh vừa xem kết quả trên trang chính.

## 11 nhóm lệnh hỗ trợ

### 1. Mở trang chung
- *"Trang chủ"* / *"Dashboard"*
- *"Mở Quản trị"*
- *"Master Data"*

### 2. Tải báo cáo Excel
- *"Tải báo cáo tháng"* → tải báo cáo tháng hiện tại
- *"Báo cáo quý"* / *"Báo cáo tuần"*
- *"Báo cáo từ 1/5 đến 17/5"* → custom range

### 3. Đơn hàng với filter
- *"Đơn chờ duyệt"* → filter `PENDING`
- *"Đơn hôm nay"* → set ngày = today
- *"Đơn khách Vinamilk"* → filter theo tên khách
- *"Đơn đã duyệt hôm qua"* → kết hợp 2 filter

### 4. Master Data tab
- *"Tìm khách hàng"* → mở tab Customers
- *"Xem xe"* / *"phương tiện"* → tab Vehicles
- *"Danh mục sản phẩm"* → tab Products
- *"Lịch bảo dưỡng"* → tab Maintenance

### 5. Người dùng / Tài xế
- *"Danh sách user"* / *"người dùng"*
- *"Thông tin tài xế Lê Văn Nam"* → mở Users + search

### 6. Giám sát hành trình
- *"Giám sát"* / *"theo dõi xe"*
- *"Xem hành trình hôm nay"*

### 7. Lập kế hoạch — XEM
- *"Mở kế hoạch ngày 20"*
- *"Xem lộ trình hôm nay"*

### 8. Lập kế hoạch — TẠO MỚI
- *"Lập kế hoạch ngày mai"* → mở + chạy CVRP tối ưu
- *"Tạo kế hoạch cho ngày 20/5"*
- *"Tối ưu lộ trình"*

### 9. Bảng lương ⭐
- *"Bảng lương tài xế"* → mở Reports tab payroll
- *"Lương tháng này"*
- *"Xem công tài xế"*

### 10. Bảo dưỡng xe ⭐
- *"Lịch bảo dưỡng"* → mở Master Data tab maintenance
- *"Xe nào cần bảo dưỡng?"*

### 11. Nhật ký hệ thống ⭐
- *"Nhật ký"* / *"audit log"*
- *"Ai vừa sửa đơn hàng?"*
- *"Lịch sử thao tác"*

## Truy vấn dữ liệu thực

Ngoài navigation, Agent còn **đọc DB trả về kết quả**:

### Tìm chuyến
- *"Hôm nay xe 29B-12345 chạy chuyến nào?"*
- *"Chuyến nào đang chạy?"*
- *"Tài xế Nam ngày 14 đi mấy chuyến?"*

### Tìm đơn
- *"Có bao nhiêu đơn chờ duyệt?"*
- *"Đơn của Vinamilk hôm qua?"*

Agent trả kết quả dạng **markdown table/bullet** ngay trong panel.

## Hiểu ngày tiếng Việt

Agent tự convert sang `YYYY-MM-DD`:

| Bạn nói | Agent hiểu |
|---|---|
| "hôm nay" | Today |
| "hôm qua" | Yesterday |
| "ngày mai" | Tomorrow |
| "ngày kia" | Day after tomorrow |
| "ngày 14" | 14/tháng-hiện-tại |
| "14/5" | 14/05/năm-hiện-tại |
| "20/5/2026" | 2026-05-20 |
| "ngày 1 tháng 6" | 01/06/năm-hiện-tại |

## Cơ chế hoạt động

```
User gõ lệnh
    ↓
Backend → Gemini 2.5 Flash + function declarations
    ↓
Gemini chọn tool phù hợp (vd openPayroll, downloadReport)
    ↓
Backend trả về { type: "navigate", path, label }
    ↓
Frontend tự navigate + execute action
```

Khi Gemini quá tải (429 quota), hệ thống có **fallback parser** bằng regex tiếng Việt — đủ phủ 80% lệnh đơn giản.

## Limit hiện tại

- ❌ **Không tạo đơn hàng mới** — Agent chỉ mở UI để user tự nhập
- ❌ **Không xoá / approve hàng loạt** — tránh rủi ro lệnh nhầm
- ❌ **Không sửa Master Data** — chỉ mở trang tương ứng

Lý do: hành động ghi (write) cần xác nhận của con người để tránh thao tác sai do AI hiểu nhầm.

## Câu hỏi thường gặp

**Q: AI Agent có hỗ trợ giọng nói không?**
A: Chưa. Hiện chỉ gõ text. Có thể bổ sung Web Speech API trong tương lai.

**Q: Lệnh được lưu lại không?**
A: Có. Lịch sử hội thoại lưu trong session, refresh trang vẫn còn.

**Q: Agent có miễn phí không?**
A: Hệ thống dùng Gemini Free Tier (15 req/phút). Đủ cho 1 doanh nghiệp nhỏ.

## Bước tiếp theo

- [Hỏi đáp Chatbot](/ai-features/hoi-dap-chatbot) — Tư vấn cách dùng (khác với Agent thao tác hộ)
- [Lập kế hoạch](/role-planner/lap-ke-hoach) — Tính năng Agent điều khiển được
