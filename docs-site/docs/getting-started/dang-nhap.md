---
title: Đăng nhập vào hệ thống
sidebar_position: 2
---

# Đăng nhập vào hệ thống

Trang đăng nhập là cửa ngõ vào toàn bộ tính năng của Road Freight TMS. Tài khoản của bạn được cấp bởi Quản trị viên tổ chức.

## Truy cập trang đăng nhập

Mở trình duyệt và truy cập địa chỉ:

```
https://<domain-cua-cong-ty>/login
```

Bạn sẽ thấy màn hình đăng nhập như sau:

![Màn hình đăng nhập](/img/screenshots/login-page.png)

## Các bước đăng nhập

### Bước 1 — Nhập email

Nhập địa chỉ email đã được Quản trị viên đăng ký cho bạn.

:::warning Lưu ý
Email phải khớp **chính xác** với email được mời. Nếu không nhận được email mời, liên hệ Quản trị viên tổ chức.
:::

### Bước 2 — Nhập mật khẩu

Nhập mật khẩu bạn đã thiết lập khi chấp nhận lời mời.

![Nhập thông tin đăng nhập](/img/screenshots/login-form.png)

### Bước 3 — Bấm "Đăng nhập"

Nếu thông tin chính xác, hệ thống sẽ chuyển sang **Trang chủ** tương ứng với vai trò của bạn:

- **IT Admin / Planner** → Dashboard tổng quan
- **Dispatcher** → Trang Giám sát hành trình
- **Accountant** → Trang Báo cáo
- **Driver** → App mobile (không vào được web)

## Quên mật khẩu

Nếu quên mật khẩu, bấm liên kết **"Quên mật khẩu?"** dưới form đăng nhập.

### Quy trình khôi phục

1. Nhập email tài khoản
2. Kiểm tra hộp thư đến (cả thư mục Spam)
3. Bấm liên kết trong email để đặt mật khẩu mới
4. Liên kết có hiệu lực **30 phút**

## Đổi ngôn ngữ

Bạn có thể chuyển giữa **Tiếng Việt** và **English** bằng nút ở góc dưới bên trái sidebar:

## Đăng xuất

Bấm vào avatar góc trên bên phải → chọn **"Đăng xuất"** để kết thúc phiên làm việc.

:::tip Bảo mật
Luôn đăng xuất khi sử dụng máy tính chung. Hệ thống sẽ tự động đăng xuất sau **8 giờ không hoạt động**.
:::

## Các lỗi thường gặp

| Lỗi | Nguyên nhân | Cách khắc phục |
|---|---|---|
| "Email hoặc mật khẩu không đúng" | Sai thông tin | Kiểm tra lại, chú ý phím Caps Lock |
| "Tài khoản chưa được xác thực" | Chưa bấm link xác thực email | Kiểm tra hộp thư hoặc liên hệ Admin |
| "Tài khoản đã bị khóa" | Admin vô hiệu hoá | Liên hệ Quản trị viên |
| "Quá nhiều lần đăng nhập sai" | Rate limit | Đợi 15 phút rồi thử lại |

## Tiếp theo

- Nếu là lần đầu đăng nhập với vai trò **Quản trị viên** → [Tạo tổ chức và chi nhánh](/getting-started/tao-to-chuc)
- Nếu bạn là **Planner** → [Quản lý Master Data](/role-planner/master-data)
- Nếu bạn là **Tài xế** → [Cài đặt app mobile](/role-driver/cai-dat-app)
