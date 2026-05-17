---
title: Hỏi đáp Chatbot
sidebar_position: 1
---

# Hỏi đáp Chatbot

Trợ lý AI tích hợp giúp người dùng **tự tìm câu trả lời** cho các câu hỏi thường gặp về cách dùng hệ thống — không cần đợi nhân viên CSKH.

![Trợ lý AI](/img/screenshots/chatbot-open.png)

## Mở chatbot

**Sidebar bên trái** → bấm mục **"Hỏi đáp"** (icon ❓).

Panel chatbot mở ra ở **góc phải màn hình**, không che giao diện làm việc — bạn có thể vừa hỏi vừa thao tác.

## Đặt câu hỏi

Gõ câu hỏi tự nhiên bằng tiếng Việt vào ô input dưới cùng:

| Câu hỏi tốt | Câu hỏi mơ hồ |
|---|---|
| "Làm sao xuất báo cáo lương?" | "lương" |
| "Cách thêm khách hàng mới" | "khách" |
| "Tài xế đăng nhập app bằng gì?" | "app" |

Chatbot dùng cơ chế **RAG (Retrieval-Augmented Generation)**:

1. Tìm trong **43 chủ đề kiến thức** đã được tổng hợp
2. Nếu tìm thấy → trả lời ngay với trích dẫn nguồn
3. Nếu không tìm thấy → gợi ý liên hệ CSKH (handoff)

## Phạm vi trả lời

Chatbot biết **rất rõ** các chủ đề:

- ✅ Cách dùng từng tính năng (CRUD master data, đơn hàng, kế hoạch, báo cáo)
- ✅ Phân quyền RBAC/DAC
- ✅ Quy trình nghiệp vụ (duyệt đơn → lập kế hoạch → giao → đối soát)
- ✅ Lỗi thường gặp + cách khắc phục
- ✅ Tính năng AI Agent
- ✅ App mobile tài xế

Chatbot **không** trả lời:

- ❌ Thông tin ngoài hệ thống TMS (thời tiết, tin tức...)
- ❌ Câu hỏi cá nhân, gợi ý đầu tư...
- ❌ Dữ liệu cụ thể trong DB ("đơn X trạng thái gì") — đây là việc của [AI Agent](/ai-features/ai-agent)

:::tip Phân biệt với AI Agent
- **Chatbot Hỏi đáp** = trả lời "**cách làm**" (how-to, hướng dẫn)
- **AI Agent** = "**làm hộ**" (thao tác UI tự động) + truy vấn dữ liệu thực
:::

## Hand-off sang nhân viên

Nếu chatbot không có câu trả lời, panel hiện nút **"Liên hệ tư vấn viên"**:

1. Bấm nút → form mở
2. Điền:
   - Họ tên + email liên hệ
   - Vấn đề cụ thể
3. Bấm **"Gửi"**
4. Email được gửi cho admin@road-freight.io kèm context cuộc hội thoại
5. Nhân viên CSKH reply lại qua email trong vòng **24 giờ làm việc**

## Kỹ thuật phía sau

- **LLM**: Google Gemini 2.5 Flash Lite (miễn phí, đủ tốt cho RAG)
- **Knowledge base**: 43 chủ đề trong `backend/src/utils/supportKnowledge.js`
- **Threshold**: score ≥ 5 mới coi là match (tránh false positive)
- **Fallback**: ngoài phạm vi → handoff thay vì trả lời bừa

## Câu hỏi thường gặp

**Q: Chatbot trả lời sai/không chính xác?**
A: Bấm nút **"Liên hệ tư vấn viên"** → ghi rõ câu hỏi + câu trả lời sai. Đội ngũ sẽ cải thiện knowledge base.

**Q: Lịch sử chat có lưu không?**
A: Có. Vào lại Hỏi đáp lần sau sẽ thấy hội thoại cũ — context tiếp tục.

**Q: Có thể hỏi bằng tiếng Anh không?**
A: Có. Gemini hỗ trợ đa ngôn ngữ, nhưng knowledge base chính bằng tiếng Việt nên trả lời TV chính xác hơn.

**Q: Chatbot có dùng hết quota Gemini của hệ thống không?**
A: Mỗi câu hỏi mất ~1-2 tokens. Free tier Gemini cho ~15 req/phút — đủ cho 1 doanh nghiệp nhỏ. Nếu cần scale, nâng cấp lên Gemini Pro hoặc thay LLM tự host.

## Bước tiếp theo

- [AI Agent](/ai-features/ai-agent) — Ra lệnh để AI thao tác UI thay bạn
