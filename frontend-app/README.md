# frontend-app

React Native App cho Driver (Tài xế).

> **Chưa scaffold ở Sprint 0.**
> Sẽ scaffold ở Sprint 3 (sau khi backend có Trip / PlannedRoute / WebSocket GPS).

## Chức năng (BA UC 3 Execute)

- Đăng nhập (JWT).
- Danh sách chuyến đi trong ca → Xác nhận kế hoạch.
- Bốc xếp tại kho (check-in).
- Giao hàng từng điểm + cập nhật COD.
- ePOD: chụp ảnh + chữ ký điện tử.
- GPS background 30s/lần (BA NFR Performance).
- Offline queue khi mất mạng → đồng bộ khi có lại.
- Ghi nhận sự cố (extend UC 3.6).

## Stack đề xuất

- React Native (Expo hoặc bare)
- React Navigation
- expo-location / react-native-background-geolocation
- AsyncStorage + queue lib cho offline
- Axios với JWT
