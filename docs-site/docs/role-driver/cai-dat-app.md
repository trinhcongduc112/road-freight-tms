---
title: Cài đặt app mobile
sidebar_position: 1
---

# Cài đặt app mobile cho tài xế

App **Road Freight Driver** chạy trên Android (yêu cầu version 7.0+) và iOS (13.0+). Đây là tool chính tài xế dùng hằng ngày.

![Màn hình đăng nhập app tài xế](/img/screenshots/driver/login.svg)

## Cài đặt Android

### Cách 1 — File APK (gửi từ admin)

1. Admin gửi file `road-freight-driver.apk` qua Zalo/email
2. Tài xế **tải về điện thoại**
3. Mở file → Android hỏi xác nhận cài app từ nguồn lạ
4. Vào **Cài đặt > Bảo mật > Cho phép từ nguồn này** → bật lên
5. Quay lại → bấm **"Cài đặt"**
6. Cài xong → mở app

### Cách 2 — Google Play Store (khi đã publish)

Tìm "Road Freight Driver" → cài như app thường.

## Cài đặt iOS

Hiện tại app **chưa public trên App Store**. Cài qua **TestFlight**:

1. Admin thêm Apple ID của tài xế vào TestFlight
2. Tài xế nhận email mời
3. Mở email → cài app TestFlight → nhận lời mời
4. Trong TestFlight, bấm **"Cài đặt"** trên app Road Freight Driver

## Đăng nhập lần đầu

Mở app → màn **Đăng nhập**:

1. Nhập **Email** + **Mật khẩu** đã được admin cấp
2. Tích **"Ghi nhớ đăng nhập"** (tuỳ chọn — đỡ phải nhập lại)
3. Bấm **"ĐĂNG NHẬP"**

Ảnh trên minh họa đúng các phần tài xế cần kiểm tra: email, mật khẩu, tùy chọn ghi nhớ đăng nhập và khối quyền bắt buộc.

:::tip Tài khoản từ đâu?
Admin công ty (qua web) **mời tài xế** trong **Quản trị > Người dùng** → tài xế nhận email mời → đặt mật khẩu → mới dùng được.
:::

### Cấu hình URL backend (chỉ lần đầu)

Nếu màn đăng nhập báo **"Không kết nối được server"**, có thể URL backend chưa cấu hình. Cách fix:

1. Trên màn Login, bấm **"⚙️ Cấu hình kết nối"** (dưới form)
2. Nhập URL backend admin cung cấp (vd `https://tms-cong-ty.com/api`)
3. Bấm **"Lưu"**
4. Quay lại đăng nhập

URL được lưu vĩnh viễn — không cần nhập lại lần sau.

## Cấp quyền

Sau khi đăng nhập, app yêu cầu 3 quyền **bắt buộc**:

| Quyền | Mục đích | Nếu từ chối |
|---|---|---|
| 📍 **Vị trí (GPS)** — "Luôn luôn" | Cập nhật vị trí khi chạy chuyến | Không nhận được chuyến |
| 📷 **Camera** | Chụp ảnh POD + sự cố | Không xác nhận giao được |
| 🔔 **Thông báo** | Nhận chuyến mới, lịch bảo dưỡng | Bỏ lỡ chuyến |

:::warning Quyền Vị trí phải là "Luôn luôn"
Android 10+ có 3 mức: "Khi dùng app" / "Luôn luôn" / "Từ chối". Chọn **"Luôn luôn"** để GPS chạy cả khi app ở nền (tài xế khoá màn hình khi lái xe).
:::

## Test kết nối

Sau khi cấp quyền:

1. Màn chính hiện danh sách chuyến
2. Nếu thấy `Chưa có chuyến nào` → bình thường (admin chưa gán)
3. Nếu báo **"Lỗi kết nối"** → kiểm tra:
   - WiFi/4G còn không
   - URL backend đúng chưa (vào ⚙️ Cấu hình kiểm tra)
   - Liên hệ admin xác minh backend đang hoạt động

## Lưu ý quan trọng

- **Không cho phép tắt app trong background**: vào Cài đặt Android > Pin > Optimization > tắt cho "Road Freight Driver" để app duy trì GPS liên tục
- **Không xoá cache app**: làm mất token đăng nhập, phải login lại
- **App không có quảng cáo / theo dõi cá nhân**: chỉ dùng GPS cho mục đích công việc

## Bước tiếp theo

- [Nhận chuyến](/role-driver/nhan-chuyen) — Khi admin gán chuyến mới
