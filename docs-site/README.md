# Road Freight TMS — User Documentation

Tài liệu hướng dẫn sử dụng cho hệ thống Road Freight TMS, build bằng [Docusaurus 3](https://docusaurus.io/).

## Phát triển local

```bash
cd docs-site
npm install        # hoặc yarn
npm start          # dev server tại http://localhost:3000
```

Mọi thay đổi trong `docs/*.md` được hot-reload.

## Build production

```bash
npm run build      # build vào ./build
npm run serve      # preview bản build tại http://localhost:3000
```

## Deploy GitHub Pages

### Lần đầu setup

1. Vào repo GitHub → Settings → Pages → Source: **GitHub Actions**
2. Đẩy file `.github/workflows/docs-deploy.yml` lên (đã có sẵn)
3. Mỗi lần push vào `main` mà thay đổi `docs-site/**`, workflow tự deploy.

### Deploy thủ công

```bash
cd docs-site
GIT_USER=trinhcongduc112 npm run deploy
```

URL sau deploy: **https://trinhcongduc112.github.io/road-freight-tms/**

## Cấu trúc

```
docs-site/
├── docs/                      ← Nội dung markdown
│   ├── intro.md
│   ├── getting-started/
│   ├── role-admin/
│   ├── role-planner/
│   ├── role-dispatcher/
│   ├── role-accountant/
│   ├── role-driver/
│   ├── ai-features/
│   ├── tracking-cong-khai.md
│   └── faq.md
├── static/img/screenshots/    ← Ảnh chụp màn hình
├── src/css/custom.css         ← Tuỳ biến giao diện
├── docusaurus.config.js       ← Cấu hình site
└── sidebars.js                ← Menu trái
```

## Quy ước viết docs

### 1. Tên file

- Tiếng Việt không dấu, gạch ngang: `lap-ke-hoach.md`
- KHÔNG dùng dấu cách hoặc ký tự đặc biệt

### 2. Frontmatter bắt buộc

```yaml
---
title: Tiêu đề hiển thị trong sidebar
sidebar_position: 1
---
```

### 3. Heading

- Mỗi file có **1 `# H1`** duy nhất (đầu file)
- Section dùng `## H2`, subsection dùng `### H3`

### 4. Screenshot

- Lưu vào `static/img/screenshots/<ten-mo-ta>.png`
- Tham chiếu: `![Mô tả](/img/screenshots/ten-mo-ta.png)`
- Khuyến nghị: PNG 1280-1920px, có annotate (mũi tên/khung đỏ) khi cần chỉ vị trí

### 5. Callout đặc biệt

```markdown
:::tip Mẹo
Nội dung mẹo
:::

:::warning Lưu ý
Nội dung cảnh báo
:::

:::info Thông tin
Nội dung thông tin
:::

:::danger Nguy hiểm
Nội dung quan trọng
:::
```

### 6. Liên kết nội bộ

- Tuyệt đối: `[Xem](/role-planner/lap-ke-hoach)` (không có `.md`)
- Tương đối: `[Xem](./lap-ke-hoach)`

## Workflow biên soạn

1. Chọn 1 trang **đang có placeholder** (vd `role-admin/quan-ly-to-chuc.md`)
2. Mở app TMS, làm thử luồng đó từng bước
3. Mỗi bước chụp 1 screenshot, lưu vào `static/img/screenshots/`
4. Viết nội dung markdown theo cấu trúc mẫu của [lap-ke-hoach.md](./docs/role-planner/lap-ke-hoach.md)
5. Chạy `npm start` để xem live, sửa nếu cần
6. Commit + push → CI tự deploy

## Trang mẫu hoàn chỉnh

Tham khảo 2 trang mẫu để bắt chước cấu trúc:
- [docs/getting-started/dang-nhap.md](./docs/getting-started/dang-nhap.md)
- [docs/role-planner/lap-ke-hoach.md](./docs/role-planner/lap-ke-hoach.md)
