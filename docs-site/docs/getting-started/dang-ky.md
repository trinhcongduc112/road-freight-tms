---
title: Đăng ký tài khoản
sidebar_position: 1
---

# Đăng ký tài khoản

Trang đăng ký dành cho **người dùng mới** — tạo tổ chức đầu tiên trên hệ thống Road Freight TMS.

:::tip Khi nào cần đăng ký?
- Bạn là **Quản trị viên** của công ty vận tải, muốn dùng hệ thống cho doanh nghiệp mình
- Bạn được nhân viên IT mời và đã có lời mời qua email → **không cần đăng ký mới**, hãy đọc [Đăng nhập vào hệ thống](/getting-started/dang-nhap)
:::

## Truy cập trang đăng ký

Mở trình duyệt và vào địa chỉ:

```
https://<domain-cua-cong-ty>/register
```

Hoặc từ trang đăng nhập, bấm liên kết **"Đăng ký ngay"** ở cuối form.

![Trang đăng ký](/img/screenshots/register-page.png)

## Điền thông tin

Form đăng ký gồm 6 trường, **tất cả đều bắt buộc**:

| Trường | Mô tả | Ví dụ |
|---|---|---|
| **Email** | Email công ty / cá nhân — dùng để đăng nhập | `admin@cong-ty.com` |
| **Họ và tên** | Tên đầy đủ của bạn | `Nguyễn Văn A` |
| **Tên công ty** | Tổ chức gốc, sẽ là tenant root trong hệ thống | `Công ty TNHH Vận tải ABC` |
| **Số điện thoại** | Liên hệ khi có vấn đề tài khoản | `0988668668` |
| **Mật khẩu** | Tối thiểu 8 ký tự, có chữ + số | `••••••••` |
| **Xác nhận mật khẩu** | Nhập lại để chống lỗi typo | `••••••••` |

:::warning Lưu ý quan trọng
- **Email một khi đăng ký không sửa được** — kiểm tra kỹ trước khi bấm "SIGN UP"
- **Tên công ty** sẽ thành tổ chức gốc trong cây tenant; sau này bạn có thể thêm chi nhánh/kho con
:::

## Xác thực email

Sau khi bấm **"SIGN UP"**, hệ thống gửi email xác thực đến địa chỉ bạn vừa nhập:

1. Kiểm tra hộp thư đến (cả thư mục **Spam**)
2. Bấm liên kết **"Xác thực email"** trong email
3. Tự động chuyển về trang đăng nhập

:::tip Email bị thất lạc?
- Kiểm tra spam folder
- Đợi 1-2 phút (email queue có thể chậm)
- Nếu sau 5 phút vẫn không có → liên hệ admin@road-freight.io
:::

## Hoàn tất đăng ký

Sau khi xác thực thành công, bạn đăng nhập bằng email + mật khẩu vừa tạo. Hệ thống sẽ:

1. ✅ Tạo tổ chức gốc với tên công ty bạn nhập
2. ✅ Gán bạn vai trò **IT Admin** của tổ chức đó
3. ✅ Chuyển đến trang chủ (Dashboard)

## Bước tiếp theo

- [Đăng nhập vào hệ thống](/getting-started/dang-nhap) — Khôi phục mật khẩu, đổi ngôn ngữ
- [Tạo tổ chức và chi nhánh](/getting-started/tao-to-chuc) — Thêm chi nhánh / kho con vào tổ chức
- [Quản lý người dùng](/role-admin/quan-ly-nguoi-dung) — Mời nhân viên vào hệ thống
