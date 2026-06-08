/**
 * AI Agent — nhận lệnh người dùng, tự quyết định **frontend action** (chuyển trang,
 * tải báo cáo, lọc danh sách…) thay vì chỉ trả lời chữ. Trả về danh sách
 * `frontendActions[]` để frontend thực thi.
 *
 * Khác với Hỏi đáp (knowledge + handoff), AI Agent:
 *   - Không có hand-off cho tư vấn viên (lỗi thì báo lỗi).
 *   - Có function calling: tools là "lệnh điều khiển UI" — không phải query data thuần.
 */
import { FunctionCallingMode, GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { env } from "../config/env.js";
import { Trip, TripStatus } from "../models/Trip.js";
import { SalesOrder, ApprovalStatus } from "../models/SalesOrder.js";
import { Driver } from "../models/Driver.js";
import { Customer } from "../models/Customer.js";

const MAX_TOOL_TURNS = 4;

let cachedClient = null;
function getClient() {
  if (!env.geminiApiKey) return null;
  if (!cachedClient) cachedClient = new GoogleGenerativeAI(env.geminiApiKey);
  return cachedClient;
}

const SYSTEM_PROMPT = `Bạn là AI Agent của Road Freight TMS — phần mềm quản lý vận tải đường bộ tại Việt Nam.

VAI TRÒ:
- Nhận lệnh từ user và TỰ THỰC HIỆN bằng cách gọi đúng function (tool) đại diện cho thao tác trên UI.
- Bạn KHÔNG giải thích cách làm — bạn LÀM (gọi function ngay).

TOOLS SẴN CÓ:
1. navigate(path, label) — chuyển trang chung. Dùng khi không có tool chuyên biệt nào khớp. Path hợp lệ:
   - "/" (Trang chủ)         "/admin" (Quản trị)
   - "/master-data" (Master Data)   "/orders" (Đơn hàng)
   - "/planning" (Lập kế hoạch)     "/monitoring" (Giám sát)
   - "/reports" (Báo cáo)
2. downloadReport(period, dateFrom?, dateTo?) — chuyển sang trang Báo cáo, set kỳ thời gian rồi TỰ ĐỘNG xuất file Excel.
   - period: "week" | "month" | "quarter" | "custom"
   - Khi custom: BẮT BUỘC kèm dateFrom + dateTo (YYYY-MM-DD).
3. openOrders(approvalStatus?, customerKeyword?, dateFrom?, dateTo?) — mở Đơn hàng với filter pre-set.
   - approvalStatus: "PENDING" | "APPROVED" | "REJECTED"
   - dateFrom/dateTo: YYYY-MM-DD. Hôm nay = cả 2 cùng = ngày hôm nay. Hôm qua/ngày mai tương tự.
4. openMasterData(tab) — mở Master Data, chuyển sẵn tab cần xem.
   - tab: "customers" | "customer-groups" | "product-categories" | "products" | "vehicles" | "services" | "maintenance"
   - VD: "tìm khách hàng" → tab=customers; "xem xe" → tab=vehicles; "danh mục sản phẩm" → tab=products; "lịch bảo dưỡng" → tab=maintenance.
5. openUsers() — mở Admin > Người dùng. Dùng khi user hỏi về **tài xế** hoặc **người dùng** (vd "thông tin tài xế Lê Văn Nam", "danh sách user", "danh sách tài xế").
6. openMonitoring(date?) — mở Giám sát hành trình. date dạng YYYY-MM-DD; bỏ qua nếu user không nói rõ.
7. openPlanning(date?) — chỉ MỞ trang Lập kế hoạch (xem). date YYYY-MM-DD; bỏ qua nếu user không nói rõ.
8. createRoutePlan(date) — TẠO MỚI kế hoạch vận chuyển cho ngày chỉ định, hệ thống sẽ tự chạy tối ưu tuyến luôn. Dùng khi user nói "lập kế hoạch", "tạo kế hoạch", "lập lộ trình", "tối ưu lộ trình"…
9. openPayroll() — mở trang Báo cáo > tab **Bảng lương tài xế**. Dùng khi user nói "bảng lương", "lương tài xế", "tiền lương", "thanh toán tài xế", "payroll", "công tài xế tháng này", "xem lương".
10. openMaintenance() — mở Master Data > tab **Bảo dưỡng xe**. Dùng khi user nói "bảo dưỡng", "lịch bảo dưỡng", "sửa xe", "maintenance", "bảo trì xe", "kiểm tra định kỳ".
11. openAuditLogs() — mở Quản trị > tab **Nhật ký hệ thống**. Dùng khi user nói "nhật ký", "audit log", "lịch sử thao tác", "ai làm gì", "log hệ thống", "lịch sử chỉnh sửa".

DATA QUERY TOOLS (đọc DB thật, dùng khi user HỎI thông tin — không phải ra lệnh):
12. searchTrips(date?, driverName?, vehicleCode?, status?) — Tìm chuyến chạy. Dùng cho câu "ngày X tài xế Y đi chuyến nào", "chuyến hôm nay của xe Z", "chuyến đang chạy".
13. searchOrders(date?, approvalStatus?, customerKeyword?) — Tìm đơn hàng. Dùng cho câu "đơn nào chưa duyệt", "đơn khách Vinamilk hôm nay".
- Sau khi nhận data từ tool: TRÌNH BÀY lại bằng tiếng Việt dạng bullet hoặc bảng markdown ngắn. Nêu rõ tổng số + chi tiết từng item. Đừng chỉ trả "đã làm xong" — phải hiển thị data cho user thấy.
- Nếu kết quả rỗng, nói rõ "Không tìm thấy ..." — không bịa.

VÍ DỤ INTENT → TOOL (học theo các pattern này):
- "tôi muốn xem bảng lương tài xế" → openPayroll()
- "lương tài xế tháng này" → openPayroll()
- "xem bảng lương" / "payroll" / "thanh toán tài xế" → openPayroll()
- "xem lịch bảo dưỡng xe" → openMaintenance()
- "có xe nào cần bảo dưỡng không" → openMaintenance()
- "lên lịch bảo dưỡng xe" → openMaintenance()
- "xem nhật ký hệ thống" / "audit log" → openAuditLogs()
- "ai vừa sửa đơn hàng" / "lịch sử thao tác" → openAuditLogs()
- "danh sách tài xế" / "tìm tài xế Nam" → openUsers()
- "danh sách xe" / "xem xe tải" → openMasterData(tab="vehicles")
- "tải báo cáo tháng" → downloadReport(period="month")
- "tải báo cáo tuần trước" → downloadReport(period="custom", dateFrom=monday_of_last_week, dateTo=sunday_of_last_week)
- "đơn chờ duyệt hôm nay" → openOrders(approvalStatus="PENDING", dateFrom=today, dateTo=today)
- "đơn chưa lên kế hoạch" / "đơn unplanned" → openOrders(approvalStatus="APPROVED")
- "lập kế hoạch ngày mai" → createRoutePlan(date=tomorrow)
- "xem kế hoạch ngày 14" → openPlanning(date="...-14")
- "giám sát hành trình" / "xe đang ở đâu" → openMonitoring()
- "danh sách 3PL" / "nhà vận chuyển thuê ngoài" → openMasterData(tab="services")
- "nhóm khách hàng" / "phân nhóm KH" → openMasterData(tab="customer-groups")
- "sự cố hôm nay" / "có tai nạn nào không" → openMonitoring() (tab sự cố)
- "tạo đơn mới" / "thêm đơn hàng" → openOrders() (UI có nút + Tạo đơn ở góc phải)
- "ai vừa sửa đơn X" → openAuditLogs() (filter theo Resource=orders)

NGUYÊN TẮC:
- Phân tích lệnh user, chọn đúng 1 hoặc nhiều tool và gọi ngay.
- **BẮT BUỘC trích xuất ngày** khi user nhắc ("ngày 14", "14/5", "hôm qua", "ngày mai") — luôn truyền YYYY-MM-DD vào tool, KHÔNG bỏ qua. VD "xem lộ trình ngày 14" → openPlanning(date="2026-05-14") (suy ra tháng/năm từ ngữ cảnh hôm nay).
- **Phân biệt "xem" vs "tạo"**: "xem lộ trình ngày X" → openPlanning(date) (chỉ mở). "lập/tạo kế hoạch ngày X" → createRoutePlan(date) (mở + tạo + tối ưu).
- **Phân biệt "tài xế" trong các ngữ cảnh**: "xem danh sách tài xế / thông tin tài xế" → openUsers(); "lương tài xế / bảng lương" → openPayroll(); "tài xế nào chạy chuyến X" → searchTrips(driverName=...).
- Nếu lệnh mơ hồ ("tải báo cáo" không nói kỳ): hỏi lại 1 câu ngắn để xác nhận.
- Nếu lệnh nằm ngoài phạm vi tool, trả lời ngắn: "Mình chưa biết làm việc này, bạn thử dùng menu trực tiếp nhé."
- Sau khi gọi tool, trả lời ngắn 1 câu xác nhận đã làm gì (vd: "Đã chuyển sang trang Báo cáo và tải xuống báo cáo tháng này.").
- KHÔNG giả vờ đã làm khi tool fail — frontend sẽ báo lỗi.
- Tuyệt đối không tạo path không nằm trong danh sách trên.`;

const AGENT_TOOL = {
  functionDeclarations: [
    {
      name: "navigate",
      description: "Chuyển user sang trang khác trong app.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          path: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["/", "/admin", "/master-data", "/orders", "/planning", "/monitoring", "/reports"],
            description: "Đường dẫn trang đích"
          },
          label: { type: SchemaType.STRING, description: "Tên trang user-friendly (vd 'Báo cáo')" }
        },
        required: ["path"]
      }
    },
    {
      name: "downloadReport",
      description:
        "Chuyển sang trang Báo cáo, set khoảng thời gian + tự động xuất file Excel xuống máy user.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          period: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["week", "month", "quarter", "custom"],
            description: "Kỳ báo cáo"
          },
          dateFrom: { type: SchemaType.STRING, description: "Bắt buộc khi period=custom (YYYY-MM-DD)" },
          dateTo: { type: SchemaType.STRING, description: "Bắt buộc khi period=custom (YYYY-MM-DD)" }
        },
        required: ["period"]
      }
    },
    {
      name: "openOrders",
      description: "Mở trang Đơn hàng với filter pre-set (trạng thái duyệt, khách hàng, khoảng ngày).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          approvalStatus: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["PENDING", "APPROVED", "REJECTED"]
          },
          customerKeyword: { type: SchemaType.STRING, description: "Từ khoá khách hàng" },
          dateFrom: { type: SchemaType.STRING, description: "Từ ngày OrderDate (YYYY-MM-DD)" },
          dateTo: { type: SchemaType.STRING, description: "Đến ngày OrderDate (YYYY-MM-DD)" }
        }
      }
    },
    {
      name: "openMasterData",
      description: "Mở Master Data và chuyển tới tab cụ thể (khách hàng, sản phẩm, phương tiện, bảo dưỡng…).",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          tab: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["customers", "customer-groups", "product-categories", "products", "vehicles", "services", "maintenance"],
            description: "Tab muốn mở"
          }
        },
        required: ["tab"]
      }
    },
    {
      name: "openUsers",
      description:
        "Mở Admin > Người dùng. Dùng khi user hỏi về **tài xế** (driver) hoặc người dùng (vd tìm thông tin tài xế Lê Văn Nam).",
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: "openMonitoring",
      description: "Mở trang Giám sát hành trình.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Ngày cần xem (YYYY-MM-DD), tuỳ chọn" }
        }
      }
    },
    {
      name: "openPlanning",
      description: "Chỉ MỞ trang Lập kế hoạch để xem — không tạo gì.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Ngày kế hoạch (YYYY-MM-DD), tuỳ chọn" }
        }
      }
    },
    {
      name: "createRoutePlan",
      description:
        "TẠO MỚI 1 kế hoạch vận chuyển cho ngày chỉ định và tự chạy tối ưu tuyến. Dùng khi user nói 'lập kế hoạch', 'tạo kế hoạch', 'lập lộ trình', 'tối ưu lộ trình ngày X'.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Ngày kế hoạch (YYYY-MM-DD). Bắt buộc." }
        },
        required: ["date"]
      }
    },
    {
      name: "openPayroll",
      description:
        "Mở Báo cáo > tab Bảng lương tài xế. Dùng khi user nói 'bảng lương', 'lương tài xế', 'tiền lương', 'thanh toán tài xế', 'payroll', 'xem lương', 'công tài xế'.",
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: "openMaintenance",
      description:
        "Mở Master Data > tab Bảo dưỡng xe. Dùng khi user nói 'bảo dưỡng', 'lịch bảo dưỡng', 'sửa xe', 'maintenance', 'bảo trì xe', 'kiểm tra xe định kỳ'.",
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    {
      name: "openAuditLogs",
      description:
        "Mở Quản trị > tab Nhật ký hệ thống. Dùng khi user nói 'nhật ký', 'audit log', 'lịch sử thao tác', 'ai làm gì', 'log hệ thống', 'lịch sử chỉnh sửa'.",
      parameters: { type: SchemaType.OBJECT, properties: {} }
    },
    // === DATA QUERY TOOLS — backend execute, trả kết quả về Gemini để trả lời inline ===
    {
      name: "searchTrips",
      description:
        "Truy vấn chuyến chạy thật trong DB. Dùng khi user HỎI thông tin chuyến (vd 'ngày X tài xế Y đi chuyến nào', 'chuyến hôm nay', 'chuyến của xe Z'). Trả về danh sách rút gọn để AI trình bày lại.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Ngày PlanDate (YYYY-MM-DD)" },
          driverName: { type: SchemaType.STRING, description: "Từ khoá tên tài xế (substring, case-insensitive)" },
          vehicleCode: { type: SchemaType.STRING, description: "Mã xe (substring)" },
          status: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["ASSIGNED", "DRIVER_CONFIRMED", "LOADING", "IN_PROGRESS", "RETURNING", "COMPLETED"]
          }
        }
      }
    },
    {
      name: "searchOrders",
      description:
        "Truy vấn đơn hàng thật trong DB. Dùng khi user HỎI thông tin đơn (vd 'đơn nào chưa duyệt', 'đơn khách Vinamilk hôm nay'). Trả danh sách rút gọn để AI trình bày lại.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: "Ngày OrderDate (YYYY-MM-DD)" },
          approvalStatus: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["PENDING", "APPROVED", "REJECTED"]
          },
          customerKeyword: { type: SchemaType.STRING, description: "Từ khoá khách hàng (mã hoặc tên)" }
        }
      }
    }
  ]
};

/**
 * Data tool handlers — chạy ở backend, kết quả feed về Gemini để paraphrase.
 * Mọi query bắt buộc filter theo ctx.orgId (multi-tenant safety).
 */
const DATA_TOOLS = {
  async searchTrips(args, ctx) {
    if (!ctx.orgId) return { error: "User chưa có tổ chức." };
    const filter = { OrganizationID: ctx.orgId, Status: { $ne: TripStatus.CANCELLED } };
    if (args?.date) {
      const start = new Date(`${args.date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filter.PlanDate = { $gte: start, $lt: end };
    }
    if (args?.status) filter.Status = args.status;
    if (args?.vehicleCode) {
      filter.VehicleCode = new RegExp(String(args.vehicleCode).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    if (args?.driverName) {
      const re = new RegExp(String(args.driverName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const drivers = await Driver.find({ OrganizationID: ctx.orgId, XName: re }).limit(20).select("_id").lean();
      filter.DriverID = { $in: drivers.map((d) => d._id) };
    }
    const rows = await Trip.find(filter)
      .sort({ PlanDate: -1 })
      .limit(20)
      .populate("DriverID", "XName")
      .lean();
    return {
      total: rows.length,
      trips: rows.map((t) => ({
        code: t.TripCode,
        planDate: t.PlanDate?.toISOString().slice(0, 10),
        vehicle: t.VehicleCode || "(chưa gán)",
        driver: t.DriverID?.XName ?? t.DriverName ?? "(chưa gán)",
        status: t.Status,
        stops: t.Tasks?.length ?? 0,
        completed: (t.Tasks ?? []).filter((x) => ["COMPLETED", "FAILED"].includes(x.Status)).length
      }))
    };
  },

  async searchOrders(args, ctx) {
    if (!ctx.orgId) return { error: "User chưa có tổ chức." };
    const filter = { OrganizationID: ctx.orgId };
    if (args?.approvalStatus && Object.values(ApprovalStatus).includes(args.approvalStatus)) {
      filter.ApprovalStatus = args.approvalStatus;
    }
    if (args?.date) {
      const start = new Date(`${args.date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filter.OrderDate = { $gte: start, $lt: end };
    }
    if (args?.customerKeyword) {
      const re = new RegExp(String(args.customerKeyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const customers = await Customer.find({
        OrganizationID: ctx.orgId,
        $or: [{ CustomerCode: re }, { XName: re }]
      }).limit(30).select("_id").lean();
      filter.CustomerID = { $in: customers.map((c) => c._id) };
    }
    const rows = await SalesOrder.find(filter)
      .sort({ OrderDate: -1, updatedAt: -1 })
      .limit(20)
      .populate("CustomerID", "CustomerCode XName")
      .lean();
    return {
      total: rows.length,
      orders: rows.map((o) => ({
        code: o.OrderCode,
        customer: o.CustomerID?.XName ?? null,
        date: o.OrderDate?.toISOString().slice(0, 10),
        approvalStatus: o.ApprovalStatus,
        planningStatus: o.PlanningStatus,
        totalPrice: o.TotalPrice ?? 0
      }))
    };
  }
};


/**
 * Chuyển 1 function call của Gemini thành "frontend action" mà UI sẽ thực thi.
 * Mỗi action có format chung: { type, ...params }.
 */
function functionCallToAction(call) {
  const args = call.args ?? {};
  switch (call.name) {
    case "navigate":
      return { type: "navigate", path: args.path, label: args.label };
    case "downloadReport": {
      const params = new URLSearchParams();
      if (args.period) params.set("period", args.period);
      if (args.dateFrom) params.set("dateFrom", args.dateFrom);
      if (args.dateTo) params.set("dateTo", args.dateTo);
      params.set("autoExport", "1");
      return {
        type: "navigate",
        path: `/reports?${params.toString()}`,
        label: "Báo cáo"
      };
    }
    case "openOrders": {
      const params = new URLSearchParams();
      if (args.approvalStatus) params.set("approvalStatus", args.approvalStatus);
      if (args.customerKeyword) params.set("customerKeyword", args.customerKeyword);
      if (args.dateFrom) params.set("dateFrom", args.dateFrom);
      if (args.dateTo) params.set("dateTo", args.dateTo);
      const qs = params.toString();
      return {
        type: "navigate",
        path: qs ? `/orders?${qs}` : "/orders",
        label: "Đơn hàng"
      };
    }
    case "openMasterData": {
      const tab = args.tab;
      const tabLabel = {
        "customers": "Khách hàng",
        "customer-groups": "Nhóm KH",
        "product-categories": "Nhóm SP",
        "products": "Sản phẩm",
        "vehicles": "Phương tiện",
        "services": "Dịch vụ 3PL",
        "maintenance": "Bảo dưỡng xe"
      }[tab] || "Master Data";
      return {
        type: "navigate",
        path: tab ? `/master-data?tab=${tab}` : "/master-data",
        label: `Master Data · ${tabLabel}`
      };
    }
    case "openPayroll":
      return { type: "navigate", path: "/reports?tab=payroll", label: "Báo cáo · Bảng lương tài xế" };
    case "openMaintenance":
      return { type: "navigate", path: "/master-data?tab=maintenance", label: "Master Data · Bảo dưỡng xe" };
    case "openAuditLogs":
      return { type: "navigate", path: "/admin?tab=audit-logs", label: "Quản trị · Nhật ký hệ thống" };
    case "openUsers":
      return { type: "navigate", path: "/admin?tab=users", label: "Người dùng" };
    case "openMonitoring": {
      const params = new URLSearchParams();
      if (args.date) params.set("date", args.date);
      const qs = params.toString();
      return {
        type: "navigate",
        path: qs ? `/monitoring?${qs}` : "/monitoring",
        label: "Giám sát"
      };
    }
    case "openPlanning": {
      const params = new URLSearchParams();
      if (args.date) params.set("date", args.date);
      const qs = params.toString();
      return {
        type: "navigate",
        path: qs ? `/planning?${qs}` : "/planning",
        label: "Lập kế hoạch"
      };
    }
    case "createRoutePlan": {
      const params = new URLSearchParams();
      if (args.date) params.set("date", args.date);
      params.set("autoCreate", "1");
      return {
        type: "navigate",
        path: `/planning?${params.toString()}`,
        label: `Tạo kế hoạch ${args.date ?? ""}`.trim()
      };
    }
    default:
      return null;
  }
}

/**
 * Fallback rule-based parser — dùng khi Gemini fail (429 quota, network…).
 * Match keyword tiếng Việt phổ biến, trả ra action navigate đúng page.
 * Phủ ~80% command thường gặp; lệnh phức tạp thì user phải đợi quota reset.
 */
/**
 * Trích ngày từ câu lệnh tiếng Việt → "YYYY-MM-DD" hoặc null.
 * Hiểu: "hôm nay", "hôm qua", "ngày mai", "ngày kia",
 *      "ngày 14", "ngày 14/5", "14/5", "14/05/2026", "ngày 1 tháng 6".
 */
export function extractDate(cmd) {
  const now = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(now); d.setUTCDate(d.getUTCDate() + n); return d; };

  if (/hom\s*nay|ngay\s*nay|today/.test(cmd)) return fmt(now);
  if (/hom\s*qua|yesterday/.test(cmd)) return fmt(addDays(-1));
  if (/hom\s*kia/.test(cmd)) return fmt(addDays(-2));
  if (/ngay\s*mai|tomorrow/.test(cmd)) return fmt(addDays(1));
  if (/ngay\s*kia|day\s*after\s*tomorrow/.test(cmd)) return fmt(addDays(2));

  // "tuần này / tuần sau / tuần trước" → lấy thứ 2 của tuần tương ứng
  if (/tuan\s*nay|this\s*week/.test(cmd)) {
    const dow = now.getUTCDay() || 7; // CN=7 thay vì 0
    return fmt(addDays(1 - dow));
  }
  if (/tuan\s*(truoc|qua|vua\s*roi)|last\s*week/.test(cmd)) {
    const dow = now.getUTCDay() || 7;
    return fmt(addDays(-6 - dow));
  }
  if (/tuan\s*(sau|toi)|next\s*week/.test(cmd)) {
    const dow = now.getUTCDay() || 7;
    return fmt(addDays(8 - dow));
  }
  // "tháng này / tháng trước / tháng sau" → ngày 1 của tháng tương ứng
  if (/thang\s*nay|this\s*month/.test(cmd)) {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  if (/thang\s*(truoc|qua|vua\s*roi)|last\s*month/.test(cmd)) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    return fmt(d);
  }
  if (/thang\s*(sau|toi)|next\s*month/.test(cmd)) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return fmt(d);
  }

  // "14/5/2026", "14/5/26", "14/05", "14-5-2026"
  const slash = cmd.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    let year = slash[3] ? Number(slash[3]) : now.getUTCFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // "ngày 14 tháng 5" hoặc "ngày 14" (giả định tháng hiện tại)
  const vn = cmd.match(/ngay\s*(\d{1,2})(?:\s*thang\s*(\d{1,2}))?(?:\s*nam\s*(\d{2,4}))?/);
  if (vn) {
    const day = Number(vn[1]);
    const month = vn[2] ? Number(vn[2]) : now.getUTCMonth() + 1;
    let year = vn[3] ? Number(vn[3]) : now.getUTCFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function parseCommandFallback(rawCommand) {
  // Vietnamese normalization: NFD strip dấu + chuyển đ→d (không thuộc combining marks)
  const cmd = String(rawCommand ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
  if (!cmd) return null;
  const today = new Date().toISOString().slice(0, 10);
  const extractedDate = extractDate(cmd) ?? today;

  // 0a) Bảng lương tài xế — match TRƯỚC "bao cao" và "tai xe" vì có chứa "luong"
  if (/luong|payroll|tien\s*cong|thanh\s*toan\s*tai\s*xe|cong\s*tai\s*xe/.test(cmd)) {
    return {
      message: "Đã mở Bảng lương tài xế.",
      actions: [{ type: "navigate", path: "/reports?tab=payroll", label: "Bảng lương tài xế" }]
    };
  }

  // 0b) Bảo dưỡng xe — match TRƯỚC keyword "xe"
  if (/bao\s*duong|bao\s*tri|sua\s*xe|maintenance|lich\s*bao|kiem\s*tra\s*xe/.test(cmd)) {
    return {
      message: "Đã mở Bảo dưỡng xe.",
      actions: [{ type: "navigate", path: "/master-data?tab=maintenance", label: "Bảo dưỡng xe" }]
    };
  }

  // 0c) Nhật ký hệ thống / Audit log
  if (/nhat\s*ky|audit|lich\s*su\s*(thao\s*tac|chinh\s*sua|sua)|log\s*he\s*thong|ai\s*lam\s*gi|ai\s*vua\s*(sua|tao|xoa)/.test(cmd)) {
    return {
      message: "Đã mở Nhật ký hệ thống.",
      actions: [{ type: "navigate", path: "/admin?tab=audit-logs", label: "Nhật ký hệ thống" }]
    };
  }

  // 1) Tải/Xuất báo cáo
  if (/(tai|xuat|download|export).*bao\s*cao|bao\s*cao.*(tai|xuat|download|export)/.test(cmd)) {
    let period = "month";
    if (/tuan/.test(cmd)) period = "week";
    else if (/quy/.test(cmd)) period = "quarter";
    else if (/thang/.test(cmd)) period = "month";
    const params = new URLSearchParams({ period, autoExport: "1" });
    return {
      message: `Đã tự xử lý bằng parser dự phòng (Gemini đang quá tải): tải báo cáo ${period === "week" ? "tuần" : period === "quarter" ? "quý" : "tháng"}.`,
      actions: [{ type: "navigate", path: `/reports?${params}`, label: "Báo cáo" }]
    };
  }

  // 1b) Sự cố / incident → Giám sát (tab sự cố)
  if (/su\s*co|incident|tai\s*nan|hong\s*xe|ket\s*xe|deviation|lech\s*tuyen/.test(cmd)) {
    return {
      message: "Đã mở Giám sát để xem sự cố.",
      actions: [{ type: "navigate", path: "/monitoring?tab=incidents", label: "Sự cố" }]
    };
  }

  // 2) Mở trang Báo cáo (không tải)
  if (/(mo|vao|xem).*bao\s*cao/.test(cmd)) {
    return { message: "Đã mở trang Báo cáo.", actions: [{ type: "navigate", path: "/reports", label: "Báo cáo" }] };
  }

  // 3) Lập kế hoạch / Tạo kế hoạch / Lập lộ trình → CREATE (autoCreate)
  if (/(lap|tao).*(ke\s*hoach|lo\s*trinh)|toi\s*uu.*(lo\s*trinh|tuyen)/.test(cmd)) {
    return {
      message: `Đã tạo kế hoạch ngày ${extractedDate}.`,
      actions: [{ type: "navigate", path: `/planning?date=${extractedDate}&autoCreate=1`, label: `Tạo kế hoạch ${extractedDate}` }]
    };
  }
  // Xem lộ trình ngày X → CHỈ mở, không create
  if (/(mo|vao|xem).*(ke\s*hoach|lo\s*trinh|planning)/.test(cmd)) {
    return {
      message: `Đã mở trang Lập kế hoạch ngày ${extractedDate}.`,
      actions: [{ type: "navigate", path: `/planning?date=${extractedDate}`, label: `Lập kế hoạch ${extractedDate}` }]
    };
  }

  // 4) Đơn hàng — chờ duyệt / hôm nay / mở chung
  if (/don\s*hang|don|order/.test(cmd)) {
    const params = new URLSearchParams();
    if (/cho\s*duyet|pending|chua\s*duyet/.test(cmd)) params.set("approvalStatus", "PENDING");
    else if (/da\s*duyet|approved/.test(cmd)) params.set("approvalStatus", "APPROVED");
    else if (/tu\s*choi|rejected|khong\s*duyet/.test(cmd)) params.set("approvalStatus", "REJECTED");
    // "đơn chưa lên kế hoạch / chưa vào kế hoạch" → APPROVED nhưng chưa planning
    if (/chua\s*(len|vao)\s*ke\s*hoach|chua\s*planning|unplanned/.test(cmd)) {
      params.set("approvalStatus", "APPROVED");
    }
    const ord = extractDate(cmd);
    if (ord) {
      params.set("dateFrom", ord);
      params.set("dateTo", ord);
    }
    const qs = params.toString();
    return {
      message: qs ? "Đã mở Đơn hàng với filter." : "Đã mở Đơn hàng.",
      actions: [{ type: "navigate", path: qs ? `/orders?${qs}` : "/orders", label: "Đơn hàng" }]
    };
  }

  // 5) Chuyến / Trip — câu hỏi thông tin chuyến → đẩy về Giám sát (gần nhất với data query)
  if (/chuyen\s*(xe|nao|gi|hom)|trip/.test(cmd)) {
    return {
      message: "Câu hỏi về chuyến cụ thể cần AI Gemini (tạm hết quota). Mình mở Giám sát để bạn tự xem.",
      actions: [{ type: "navigate", path: "/monitoring", label: "Giám sát" }]
    };
  }
  if (/(giam\s*sat|live\s*map|monitor|theo\s*doi)/.test(cmd)) {
    return { message: "Đã mở Giám sát.", actions: [{ type: "navigate", path: "/monitoring", label: "Giám sát" }] };
  }

  // 6) Master Data — tài xế (priority cao hơn xe vì "tài xế" chứa "xe"), khách hàng, sản phẩm, xe
  if (/tai\s*xe|driver/.test(cmd)) {
    return { message: "Đã mở danh sách người dùng (tài xế là user role Driver).", actions: [{ type: "navigate", path: "/admin?tab=users", label: "Người dùng" }] };
  }
  if (/khach\s*hang|customer/.test(cmd)) {
    return { message: "Đã mở Master Data — Khách hàng.", actions: [{ type: "navigate", path: "/master-data?tab=customers", label: "Khách hàng" }] };
  }
  if (/san\s*pham|product/.test(cmd)) {
    return { message: "Đã mở Master Data — Sản phẩm.", actions: [{ type: "navigate", path: "/master-data?tab=products", label: "Sản phẩm" }] };
  }
  if (/\bxe\b|phuong\s*tien|vehicle/.test(cmd)) {
    return { message: "Đã mở Master Data — Phương tiện.", actions: [{ type: "navigate", path: "/master-data?tab=vehicles", label: "Phương tiện" }] };
  }
  if (/3pl|thue\s*ngoai|nha\s*van\s*chuyen|carrier|dich\s*vu\s*3pl|doi\s*tac\s*van\s*chuyen/.test(cmd)) {
    return { message: "Đã mở Master Data — Dịch vụ 3PL.", actions: [{ type: "navigate", path: "/master-data?tab=services", label: "Dịch vụ 3PL" }] };
  }
  if (/nhom\s*kh|nhom\s*khach|customer\s*group/.test(cmd)) {
    return { message: "Đã mở Master Data — Nhóm khách hàng.", actions: [{ type: "navigate", path: "/master-data?tab=customer-groups", label: "Nhóm KH" }] };
  }
  if (/nhom\s*sp|danh\s*muc\s*sp|product\s*categ/.test(cmd)) {
    return { message: "Đã mở Master Data — Danh mục sản phẩm.", actions: [{ type: "navigate", path: "/master-data?tab=product-categories", label: "Nhóm SP" }] };
  }

  // 7) Quản trị / User
  if (/quan\s*tri|admin|nguoi\s*dung|user/.test(cmd)) {
    return { message: "Đã mở Quản trị.", actions: [{ type: "navigate", path: "/admin", label: "Quản trị" }] };
  }

  // 8) Trang chủ / Dashboard
  if (/trang\s*chu|dashboard|home/.test(cmd)) {
    return { message: "Đã về Trang chủ.", actions: [{ type: "navigate", path: "/", label: "Trang chủ" }] };
  }

  return null;
}

// Friendly label cho từng tool — dùng để hiển thị progress khi stream.
// Khi user gõ "tải báo cáo", thay vì spinner trống, hiện "Đang chuẩn bị tải báo cáo..."
const TOOL_LABELS = {
  navigate: "Đang điều hướng",
  downloadReport: "Đang chuẩn bị tải báo cáo",
  openOrders: "Đang mở trang đơn hàng",
  openMasterData: "Đang mở dữ liệu chính",
  openUsers: "Đang mở quản lý người dùng",
  openMonitoring: "Đang mở giám sát",
  openPlanning: "Đang mở lập kế hoạch",
  createRoutePlan: "Đang tạo lộ trình tối ưu",
  openPayroll: "Đang mở bảng lương",
  openMaintenance: "Đang mở bảo dưỡng",
  openAuditLogs: "Đang mở nhật ký hệ thống",
  searchTrips: "Đang tra cứu chuyến xe",
  searchOrders: "Đang tra cứu đơn hàng"
};

/**
 * Public entry — gọi Gemini với agent tools, trả lại { message, actions[] }.
 * @param {function} [onProgress]  Callback nhận event progress: { stage, ...meta }.
 *   stage: "start" | "thinking" | "tool_call" | "tool_done" | "fallback"
 *   Dùng cho streaming endpoint hiển thị tiến trình realtime cho user.
 */
export async function runAgent({ command, history = [], orgId = null, userId = null, onProgress = () => {} }) {
  const client = getClient();
  if (!client) {
    return { ok: false, message: "AI Agent chưa được cấu hình (thiếu GEMINI_API_KEY).", actions: [] };
  }

  try {
    const model = client.getGenerativeModel({
      model: env.geminiModel,
      tools: [AGENT_TOOL],
      toolConfig: {
        functionCallingConfig: { mode: FunctionCallingMode.AUTO }
      },
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
    });

    // Gemini bắt buộc history bắt đầu bằng role "user". Strip leading model.
    let geminiHistory = (history || [])
      .filter((m) => m && m.body)
      .map((m) => ({
        role: m.role === "agent" ? "model" : "user",
        parts: [{ text: String(m.body).slice(0, 1000) }]
      }));
    while (geminiHistory.length > 0 && geminiHistory[0].role !== "user") geminiHistory.shift();
    geminiHistory = geminiHistory.slice(-8);

    const today = new Date().toISOString().slice(0, 10);
    const chat = model.startChat({ history: geminiHistory });
    onProgress({ stage: "thinking", label: "Đang phân tích yêu cầu" });
    let result = await chat.sendMessage(`[Ngữ cảnh: hôm nay là ${today}]\n\n${command}`);
    const actions = [];
    const ctx = { orgId, userId };

    // Multi-turn loop: AI gọi data tool → backend execute → feed result về AI tiếp.
    // Navigation tool tích luỹ vào `actions[]` để frontend chạy sau.
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const calls = result.response.functionCalls?.() ?? [];
      if (calls.length === 0) break;

      const dataResponses = [];
      for (const call of calls) {
        const label = TOOL_LABELS[call.name] || `Đang thực thi ${call.name}`;
        onProgress({ stage: "tool_call", tool: call.name, label });
        if (DATA_TOOLS[call.name]) {
          // Data tool: execute backend, feed response về Gemini
          try {
            const out = await DATA_TOOLS[call.name](call.args ?? {}, ctx);
            dataResponses.push({ functionResponse: { name: call.name, response: out } });
          } catch (err) {
            dataResponses.push({ functionResponse: { name: call.name, response: { error: err.message } } });
          }
        } else {
          // Navigation tool: convert thành action, KHÔNG feed về Gemini (Gemini coi như đã làm xong)
          const action = functionCallToAction(call);
          if (action) actions.push(action);
          // Vẫn phải gửi response rỗng cho Gemini biết function đã chạy
          dataResponses.push({ functionResponse: { name: call.name, response: { done: true } } });
        }
        onProgress({ stage: "tool_done", tool: call.name });
      }

      // Gửi tất cả responses về Gemini, nhận round tiếp theo
      onProgress({ stage: "thinking", label: "Đang tổng hợp kết quả" });
      result = await chat.sendMessage(dataResponses);
    }

    let message = "";
    try { message = result.response.text() ?? ""; } catch { /* no text part */ }
    message = String(message).trim();

    if (!message && actions.length === 0) {
      return {
        ok: true,
        message: "Mình chưa hiểu lệnh, bạn nói cụ thể hơn nhé (vd: 'tải báo cáo tháng', 'mở đơn hàng chờ duyệt')…",
        actions: []
      };
    }
    if (!message && actions.length > 0) {
      const labels = actions.map((a) => a.label || a.path).join(", ");
      message = `Đã thực hiện: ${labels}`;
    }

    return { ok: true, message, actions };
  } catch (err) {
    console.warn("[ai-agent] Gemini call failed:", err.message);
    // Fallback rule-based — khi Gemini lỗi (429, network, key sai) vẫn cố parse lệnh user
    onProgress({ stage: "fallback", label: "Gemini lỗi — chuyển sang parser nội bộ" });
    const fallback = parseCommandFallback(command);
    if (fallback) {
      return { ok: true, ...fallback, fallback: true };
    }
    return {
      ok: false,
      message: "AI Agent đang quá tải (Gemini hết quota daily). Bạn thử các lệnh đơn giản như 'tải báo cáo tháng', 'mở đơn hàng', 'lập kế hoạch hôm nay' — hệ thống có parser dự phòng.",
      actions: []
    };
  }
}
