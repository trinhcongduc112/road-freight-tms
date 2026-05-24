import { FunctionCallingMode, GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { env } from "../config/env.js";
import { SupportArticle, SupportArticleStatus } from "../models/SupportArticle.js";
import { SalesOrder, ApprovalStatus, PlanningStatus, OrderStatus } from "../models/SalesOrder.js";
import { Vehicle } from "../models/Vehicle.js";
import { Driver } from "../models/Driver.js";
import { DeliveryRoute, RouteStatus } from "../models/DeliveryRoute.js";
import { Trip, TripStatus } from "../models/Trip.js";
import { TripIncident, IncidentStatus } from "../models/TripIncident.js";
import { Customer } from "../models/Customer.js";
import { Product } from "../models/Product.js";
import { findBestSupportKnowledge, normalizeSupportText, scoreSupportArticle, SUPPORT_KNOWLEDGE } from "../utils/supportKnowledge.js";

let cachedClient = null;

function getClient() {
  if (!env.geminiApiKey) return null;
  if (!cachedClient) cachedClient = new GoogleGenerativeAI(env.geminiApiKey);
  return cachedClient;
}

export function isAiEnabled() {
  return Boolean(env.geminiApiKey);
}

const SYSTEM_PROMPT = `Bạn là trợ lý AI của Road Freight TMS (Transportation Management System) — phần mềm quản lý vận tải đường bộ đa khách (multi-tenant) cho doanh nghiệp logistics tại Việt Nam.

PHONG CÁCH TRẢ LỜI:
- Luôn trả lời bằng tiếng Việt, ngắn gọn.
- **Khi user hỏi cách thao tác** ("làm sao", "cách nào", "ở đâu", "tải", "xuất", "thêm", "tạo", "sửa", "xóa", "duyệt", "in"…): BẮT BUỘC trả lời theo dạng **đánh số 1. 2. 3.**, mỗi bước nêu rõ **tên menu/tab/nút bấm** chính xác như trong KIẾN THỨC HỆ THỐNG. Không trả lời chung chung kiểu "Vào X để xem Y".
- Khi user hỏi định nghĩa/giải thích: trả lời ngắn 2–3 câu.
- Khi giải thích thuật toán/kỹ thuật: ngắn gọn, không hàn lâm.
- Ưu tiên dùng đúng tên menu/nút trong KIẾN THỨC HỆ THỐNG. Nếu kiến thức không nói rõ thì hỏi lại user thay vì đoán đường đi.
- Tuyệt đối không bịa số liệu. Nếu phần "DỮ LIỆU HIỆN TẠI" không có thông tin, trả lời "Mình chưa có dữ liệu này, hãy kiểm tra trong màn ...".

PHẠM VI HỖ TRỢ:
- Đơn hàng (SalesOrder), khách hàng, sản phẩm.
- Lập kế hoạch & tối ưu lộ trình (HGS-CVRP + baseline LNS-SA / NN+2opt), kế hoạch tuyến (RoutePlan, DeliveryRoute).
- Xe, tài xế, dịch vụ 3PL (xe thuê ngoài).
- Chuyến chạy (Trip), giám sát hành trình GPS, sự cố (TripIncident).
- Báo cáo, chi phí, dữ liệu mẫu, master data.

NGUYÊN TẮC:
- TUYỆT ĐỐI KHÔNG bịa thông tin, không tự tạo số liệu, không đoán dữ liệu không có trong ngữ cảnh.
- Nếu phần "DỮ LIỆU HIỆN TẠI" không có thông tin, nói rõ chưa có dữ liệu.
- Nếu câu hỏi nằm ngoài phạm vi TMS, cần xử lý thủ công, cần nhân viên can thiệp, có khiếu nại/phàn nàn, lỗi hệ thống nghiêm trọng, hoặc user gõ các từ khóa như "gặp nhân viên", "hỗ trợ thật", "người thật", "admin hỗ trợ", "chuyển nhân viên", BẮT BUỘC gọi function transferToAgent.
- Khi đã gọi transferToAgent thì không trả lời thay nhân viên.`;

const HANDOFF_TOOL = {
  functionDeclarations: [
    {
      name: "transferToAgent",
      description: "Chuyển cuộc hội thoại sang nhân viên hỗ trợ thật khi bot không được tự xử lý.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          reason: {
            type: SchemaType.STRING,
            description: "Lý do cần chuyển nhân viên."
          },
          priority: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["low", "normal", "high"],
            description: "Mức ưu tiên hỗ trợ."
          }
        },
        required: ["reason"]
      }
    }
  ]
};

const KNOWLEDGE_TOP_K = 4;

async function retrieveKnowledge(question, orgId) {
  const articles = await SupportArticle.find({
    Status: SupportArticleStatus.PUBLISHED,
    $or: [{ OrganizationID: null }, { OrganizationID: orgId }]
  }).lean();

  const scored = articles
    .map((a) => ({ article: a, score: scoreSupportArticle(question, a) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, KNOWLEDGE_TOP_K);

  if (scored.length > 0) {
    return scored.map((s) => `### ${s.article.Title}\n${s.article.Answer}`).join("\n\n");
  }

  const fallback = SUPPORT_KNOWLEDGE
    .map((item) => ({ item, score: scoreOf(question, item) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, KNOWLEDGE_TOP_K);

  return fallback.map((s) => `### ${s.item.title}\n${s.item.answer}`).join("\n\n");
}

function scoreOf(q, item) {
  const norm = normalizeSupportText(q);
  let score = 0;
  for (const kw of item.keywords ?? []) {
    if (norm.includes(normalizeSupportText(kw))) score += 1;
  }
  return score;
}

const INTENT_KEYWORDS = {
  orders: ["đơn hàng", "đơn", "order", "sales order", "chưa duyệt", "chưa giao", "chưa vào kế hoạch"],
  vehicles: ["xe", "phương tiện", "vehicle", "trọng tải", "thể tích", "tải trọng"],
  drivers: ["tài xế", "driver", "tai xe", "tài"],
  routes: ["lộ trình", "tuyến", "route", "delivery route", "kế hoạch", "plan"],
  trips: ["chuyến", "trip", "đang chạy", "in_progress", "ongoing"],
  incidents: ["sự cố", "incident", "tai nạn", "hỏng xe", "kẹt đường", "deviation"],
  customers: ["khách hàng", "customer", "khách"],
  products: ["sản phẩm", "product", "mặt hàng"]
};

function detectIntents(question) {
  const norm = normalizeSupportText(question);
  const intents = new Set();
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (norm.includes(normalizeSupportText(kw))) {
        intents.add(intent);
        break;
      }
    }
  }
  return [...intents];
}

async function fetchLiveData(intents, orgId) {
  if (!orgId || intents.length === 0) return "";

  const orgFilter = { OrganizationID: orgId };
  const lines = [];

  await Promise.all(
    intents.map(async (intent) => {
      try {
        if (intent === "orders") {
          const [total, pending, approved, planned, delivered] = await Promise.all([
            SalesOrder.countDocuments(orgFilter),
            SalesOrder.countDocuments({ ...orgFilter, ApprovalStatus: ApprovalStatus.PENDING }),
            SalesOrder.countDocuments({ ...orgFilter, ApprovalStatus: ApprovalStatus.APPROVED, PlanningStatus: PlanningStatus.PENDING }),
            SalesOrder.countDocuments({ ...orgFilter, PlanningStatus: { $in: [PlanningStatus.PLANNED, PlanningStatus.LOCKED] } }),
            SalesOrder.countDocuments({ ...orgFilter, OrderStatus: OrderStatus.DELIVERED })
          ]);
          lines.push(`Đơn hàng: tổng ${total}, chờ duyệt ${pending}, đã duyệt chưa lên kế hoạch ${approved}, đã/đang lên kế hoạch ${planned}, đã giao ${delivered}.`);
        } else if (intent === "vehicles") {
          const [total, active, byType] = await Promise.all([
            Vehicle.countDocuments(orgFilter),
            Vehicle.countDocuments({ ...orgFilter, Status: "Active" }),
            Vehicle.aggregate([
              { $match: orgFilter },
              { $group: { _id: "$VehicleType", count: { $sum: 1 } } }
            ])
          ]);
          const typeStr = byType.map((t) => `${t._id}=${t.count}`).join(", ");
          lines.push(`Xe: tổng ${total}, đang Active ${active}. Theo loại: ${typeStr || "(chưa có)"}.`);
        } else if (intent === "drivers") {
          const [total, active] = await Promise.all([
            Driver.countDocuments(orgFilter),
            Driver.countDocuments({ ...orgFilter, Status: "Active" })
          ]);
          lines.push(`Tài xế: tổng ${total}, đang Active ${active}.`);
        } else if (intent === "routes") {
          const [planned, locked, finalized] = await Promise.all([
            DeliveryRoute.countDocuments({ ...orgFilter, Status: RouteStatus.PLANNED }),
            DeliveryRoute.countDocuments({ ...orgFilter, Status: RouteStatus.LOCKED }),
            DeliveryRoute.countDocuments({ ...orgFilter, Status: RouteStatus.FINALIZED })
          ]);
          lines.push(`Tuyến giao: PLANNED ${planned}, LOCKED ${locked}, FINALIZED ${finalized}.`);
        } else if (intent === "trips") {
          const [assigned, inProgress, completed, cancelled] = await Promise.all([
            Trip.countDocuments({ ...orgFilter, Status: { $in: [TripStatus.ASSIGNED, TripStatus.DRIVER_CONFIRMED, TripStatus.LOADING] } }),
            Trip.countDocuments({ ...orgFilter, Status: { $in: [TripStatus.IN_PROGRESS, TripStatus.RETURNING] } }),
            Trip.countDocuments({ ...orgFilter, Status: TripStatus.COMPLETED }),
            Trip.countDocuments({ ...orgFilter, Status: TripStatus.CANCELLED })
          ]);
          lines.push(`Chuyến: chờ chạy ${assigned}, đang chạy ${inProgress}, hoàn thành ${completed}, hủy ${cancelled}.`);
        } else if (intent === "incidents") {
          const [open, ack, resolved] = await Promise.all([
            TripIncident.countDocuments({ ...orgFilter, Status: IncidentStatus.OPEN }),
            TripIncident.countDocuments({ ...orgFilter, Status: IncidentStatus.ACKNOWLEDGED }),
            TripIncident.countDocuments({ ...orgFilter, Status: IncidentStatus.RESOLVED })
          ]);
          lines.push(`Sự cố: chưa xử lý ${open}, đã tiếp nhận ${ack}, đã xử lý ${resolved}.`);
        } else if (intent === "customers") {
          const total = await Customer.countDocuments(orgFilter);
          const missingCoords = await Customer.countDocuments({ ...orgFilter, $or: [{ Latitude: null }, { Longitude: null }] });
          lines.push(`Khách hàng: tổng ${total}, thiếu tọa độ ${missingCoords}.`);
        } else if (intent === "products") {
          const total = await Product.countDocuments(orgFilter);
          lines.push(`Sản phẩm: tổng ${total} mã.`);
        }
      } catch {
        // intent fetch failed — bỏ qua
      }
    })
  );

  return lines.join("\n");
}

function buildHistory(messages = []) {
  return messages
    .filter((m) => m && m.body)
    .slice(-8)
    .map((m) => ({
      role: ["USER", "user"].includes(m.sender) ? "user" : "model",
      parts: [{ text: String(m.body).slice(0, 2000) }]
    }));
}

// Threshold cao hơn để tránh false-positive khi câu hỏi không liên quan
// (vd "AI tự đánh giá mấy điểm" có thể match nhầm các keyword "import", "tự"...)
const KNOWLEDGE_MIN_SCORE = 5;

const OUT_OF_SCOPE_MESSAGE =
  "Mình chỉ trả lời được các câu hỏi liên quan đến hệ thống quản lý vận tải Road Freight TMS " +
  "(đăng nhập, tạo đơn, lập kế hoạch, theo dõi xe, báo cáo, bảo dưỡng...). " +
  "Câu hỏi của bạn không nằm trong phạm vi này — bạn có thể bấm **Gặp tư vấn viên** để được hỗ trợ trực tiếp.";

export async function generateAiAnswer({ question, orgId, history = [] }) {
  const client = getClient();
  if (!client) {
    const fallback = findBestSupportKnowledge(question);
    return {
      ok: false,
      message: fallback?.score >= KNOWLEDGE_MIN_SCORE ? fallback.answer : OUT_OF_SCOPE_MESSAGE,
      handoff: false
    };
  }

  const intents = detectIntents(question);
  const [knowledge, liveData] = await Promise.all([
    retrieveKnowledge(question, orgId),
    fetchLiveData(intents, orgId)
  ]);

  const contextBlock = [
    knowledge ? `KIẾN THỨC HỆ THỐNG (knowledge base):\n${knowledge}` : "",
    liveData ? `DỮ LIỆU HIỆN TẠI (org của user):\n${liveData}` : ""
  ].filter(Boolean).join("\n\n");

  const fullSystem = contextBlock
    ? `${SYSTEM_PROMPT}\n\n=== NGỮ CẢNH ===\n${contextBlock}`
    : SYSTEM_PROMPT;

  try {
    const model = client.getGenerativeModel({
      model: env.geminiModel,
      tools: [HANDOFF_TOOL],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO,
          allowedFunctionNames: ["transferToAgent"]
        }
      },
      systemInstruction: fullSystem,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024
      }
    });

    const chat = model.startChat({ history: buildHistory(history) });
    const result = await chat.sendMessage(question);
    const calls = result.response.functionCalls?.() ?? [];
    const transferCall = calls.find((call) => call.name === "transferToAgent");
    if (transferCall) {
      return {
        ok: true,
        message: transferCall.args?.reason || "Yêu cầu cần nhân viên hỗ trợ xử lý.",
        handoff: true,
        functionCall: transferCall
      };
    }

    const text = result.response.text();
    if (!text || !text.trim()) {
      const fallback = findBestSupportKnowledge(question);
      return {
        ok: true,
        message: fallback?.score >= KNOWLEDGE_MIN_SCORE ? fallback.answer : OUT_OF_SCOPE_MESSAGE,
        handoff: false
      };
    }

    return {
      ok: true,
      message: text.trim(),
      handoff: false
    };
  } catch (err) {
    console.warn("[ai-assistant] Gemini call failed:", err.message);
    const fallback = findBestSupportKnowledge(question);
    // Khi AI lỗi, dùng top-1 keyword match nếu có score > 0 — tốt hơn null.
    return {
      ok: false,
      message: fallback?.answer
        ? `${fallback.answer}\n\n_Đây là nội dung tham khảo, AI cũng có thể mắc sai sót. Nếu chưa hài lòng về câu trả lời, hãy liên hệ với tư vấn viên._`
        : null,
      handoff: false,
      error: err.message
    };
  }
}
