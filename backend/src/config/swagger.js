import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Road Freight TMS API",
      version: "0.2.0",
      description:
        "Multi-tenant Transportation Management System — RBAC + DAC, VRP optimization, real-time GPS tracking, AI Agent & Q&A.",
      contact: {
        name: "Trịnh Công Đức",
        email: "ductuyetvoi@gmail.com"
      },
      license: { name: "MIT" }
    },
    servers: [
      { url: `http://localhost:${env.port}`, description: "Local dev" },
      { url: "/", description: "Same origin (production)" }
    ],
    tags: [
      { name: "Auth", description: "Đăng nhập / refresh / đổi mật khẩu" },
      { name: "Master Data", description: "Khách hàng / Sản phẩm / Phương tiện / Tài xế / Kho" },
      { name: "Orders", description: "Quản lý đơn hàng (SalesOrder lifecycle)" },
      { name: "Route Planning", description: "Lập kế hoạch + tối ưu tuyến (HGS-CVRP + baseline LNS-SA / NN+2opt)" },
      { name: "Trips", description: "Chuyến đi: phân công, GPS, ePOD, hoàn tất" },
      { name: "Driver", description: "API riêng cho app tài xế (mobile)" },
      { name: "Reports", description: "Báo cáo: tổng hợp / hoa hồng / bảo trì xe" },
      { name: "AI Agent", description: "AI thực thi hành động qua deep-link" },
      { name: "Support", description: "Hỏi đáp + chuyển sang tư vấn viên (handoff)" },
      { name: "Tracking", description: "Tra cứu công khai bằng OrderCode (không cần đăng nhập)" },
      { name: "System", description: "Health / metrics / observability" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "integer", example: 400 },
                message: { type: "string", example: "Validation failed" }
              }
            }
          }
        },
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "object" }
          }
        },
        PagedResult: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object" } },
            total: { type: "integer", example: 124 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ["./src/routes/*.js", "./src/controllers/*.js"]
};

export const swaggerSpec = swaggerJsdoc(options);
