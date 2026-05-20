import enUS from "antd/locale/en_US";
import viVN from "antd/locale/vi_VN";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "tms_language";

export const languages = [
  { code: "vi", label: "Tiếng Việt", shortLabel: "VI" },
  { code: "en", label: "English", shortLabel: "EN" }
];

const dictionaries = {
  vi: {
    "common.language": "Ngôn ngữ",
    "common.vietnamese": "Tiếng Việt",
    "common.english": "English",
    "common.currentLanguage": "VI",
    "common.unknown": "—",

    "layout.nav.dashboard": "Trang chủ",
    "layout.nav.admin": "Quản trị",
    "layout.nav.masterData": "Master Data",
    "layout.nav.orders": "Đơn hàng",
    "layout.nav.planning": "Lập kế hoạch",
    "layout.nav.monitoring": "Giám sát",
    "layout.nav.reports": "Báo cáo",
    "layout.title.dashboard": "Trang chủ",
    "layout.title.admin": "Quản trị hệ thống",
    "layout.title.masterData": "Dữ liệu Master",
    "layout.title.orders": "Đơn hàng",
    "layout.title.planning": "Lập kế hoạch",
    "layout.title.monitoring": "Giám sát hành trình",
    "layout.title.reports": "Báo cáo",
    "layout.title.default": "Trang",
    "layout.role.accountant": "Kế toán",
    "layout.role.driver": "Tài xế",
    "layout.user.logout": "Đăng xuất",
    "layout.brand.platform": "TMS Platform",

    "dashboard.greeting.morning": "Chào buổi sáng",
    "dashboard.greeting.afternoon": "Chào buổi chiều",
    "dashboard.greeting.evening": "Chào buổi tối",
    "dashboard.defaultName": "bạn",
    "dashboard.summary": "Đây là tổng quan hoạt động vận tải hôm nay của bạn.",
    "dashboard.demo.confirmSeedTitle": "Tải dữ liệu mẫu vào tổ chức của bạn?",
    "dashboard.demo.confirmSeedIntro": "Sẽ thêm vào tổ chức hiện tại các bản ghi",
    "dashboard.demo.seedItems1": "3 nhóm SP · 8 sản phẩm · 7 xe (3 nội bộ + 4 thuê 3PL) · 7 tài xế (3 nội bộ + 4 thuê 3PL) · 2 dịch vụ 3PL",
    "dashboard.demo.seedItems2": "12 khách hàng Hà Nội · Bắc Ninh · Hưng Yên (tọa độ thật)",
    "dashboard.demo.seedItems3": "20 đơn hàng PENDING — sẵn sàng lập lộ trình",
    "dashboard.demo.seedNote": "Tất cả đều có prefix DEMO- để xóa lại dễ dàng.",
    "dashboard.demo.seedOk": "Tải dữ liệu mẫu",
    "dashboard.demo.cancel": "Hủy",
    "dashboard.demo.loadingSeed": "Đang tải dữ liệu mẫu vào tổ chức...",
    "dashboard.demo.seedSuccess": "Đã tải xong dữ liệu mẫu!",
    "dashboard.demo.seedDoneTitle": "Đã thêm dữ liệu mẫu!",
    "dashboard.demo.organization": "Tổ chức",
    "dashboard.demo.added": "Đã thêm:",
    "dashboard.demo.addedCategories": "{{categories}} nhóm SP · {{products}} sản phẩm",
    "dashboard.demo.addedVehicles": "{{vehicles}} xe · {{services}} dịch vụ 3PL",
    "dashboard.demo.addedCustomers": "{{customers}} khách hàng · {{orders}} đơn hàng",
    "dashboard.demo.planNote": "Vào Lập kế hoạch để test tối ưu lộ trình ngay.",
    "dashboard.demo.clearTitle": "Xóa toàn bộ dữ liệu demo?",
    "dashboard.demo.clearContent": "Sẽ xóa tất cả bản ghi có prefix DEMO- (khách hàng, sản phẩm, xe, đơn hàng, ...) khỏi tổ chức của bạn. Dữ liệu thật KHÔNG bị ảnh hưởng. Không thể hoàn tác.",
    "dashboard.demo.clearOk": "Xóa dữ liệu demo",
    "dashboard.demo.loadingClear": "Đang xóa dữ liệu demo...",
    "dashboard.demo.clearSuccess": "Đã xóa toàn bộ dữ liệu demo",
    "dashboard.demo.activeTitle": "Dữ liệu mẫu đã kích hoạt",
    "dashboard.demo.activeDesc": "Trong tổ chức hiện có:",
    "dashboard.demo.quickTitle": "Bắt đầu nhanh với dữ liệu mẫu",
    "dashboard.demo.quickDesc": "Thêm vào tổ chức của bạn: {{customers}} khách hàng Hà Nội · Bắc Ninh · Hưng Yên, {{vehicles}} xe tải, {{products}} sản phẩm, {{orders}} đơn hàng — đều có prefix DEMO- để xóa lại dễ dàng.",
    "dashboard.demo.reload": "Tải lại",
    "dashboard.demo.clear": "Xóa demo",
    "dashboard.unit.customers": "khách hàng",
    "dashboard.unit.products": "sản phẩm",
    "dashboard.unit.vehicles": "xe",
    "dashboard.unit.orders": "đơn hàng",
    "dashboard.unit.categories": "nhóm SP",
    "dashboard.unit.services": "dịch vụ 3PL",
    "dashboard.status.pending": "Chờ duyệt",
    "dashboard.status.approved": "Đã duyệt",
    "dashboard.status.rejected": "Từ chối",
    "dashboard.status.planning": "Lên kế hoạch",
    "dashboard.status.completed": "Hoàn thành",
    "dashboard.quick.access": "Truy cập",
    "dashboard.quick.title": "Truy cập nhanh",
    "dashboard.quick.count": "{{count}} module khả dụng",
    "dashboard.quick.noPermission": "Tài khoản của bạn chưa được cấp quyền truy cập module nào. Liên hệ quản trị viên.",
    "dashboard.quick.masterDesc": "Khách hàng · Hàng hoá · Xe · Tài xế",
    "dashboard.quick.ordersDesc": "{{count}} đơn đang chờ phê duyệt",
    "dashboard.quick.planningDesc": "Phân tuyến & điều phối xe",
    "dashboard.quick.monitoringDesc": "GPS realtime · Hành trình xe",
    "dashboard.quick.userTitle": "Người dùng",
    "dashboard.quick.userDesc": "Thêm & phân quyền nhân sự",
    "dashboard.quick.orgTitle": "Tổ chức",
    "dashboard.quick.orgDesc": "Cấu trúc công ty & chi nhánh",
    "dashboard.quick.roleTitle": "Nhóm vai trò",
    "dashboard.quick.roleDesc": "Phân quyền RBAC linh hoạt",
    "dashboard.quick.reportsDesc": "Thống kê vận hành & doanh thu",
    "dashboard.stats.totalOrders": "Tổng đơn hàng",
    "dashboard.stats.pendingOrders": "{{count}} chờ phê duyệt",
    "dashboard.stats.dispatchVehicles": "Xe chờ điều phối",
    "dashboard.stats.unavailableVehicles": "{{count}} xe không khả dụng",
    "dashboard.stats.accounts": "Tài khoản",
    "dashboard.stats.accountsSub": "Người dùng trong tổ chức",
    "dashboard.stats.organizations": "Tổ chức",
    "dashboard.stats.organizationsSub": "Trong phạm vi truy cập",
    "dashboard.recent.title": "Đơn hàng gần đây",
    "dashboard.recent.viewAll": "Xem tất cả →",
    "dashboard.recent.loading": "Đang tải…",
    "dashboard.recent.empty": "Chưa có đơn hàng nào",
    "dashboard.table.code": "Mã đơn",
    "dashboard.table.customer": "Khách hàng",
    "dashboard.table.route": "Tuyến",
    "dashboard.table.status": "Trạng thái",
    "dashboard.table.createdAt": "Ngày tạo",

    "orders.title": "Đơn hàng",
    "orders.subtitle": "Quản lý Sales Order — tạo, phê duyệt, theo dõi trạng thái",
    "orders.export": "Xuất Excel",
    "orders.import": "Import",
    "orders.create": "Tạo đơn",
    "orders.filter.status": "Trạng thái đơn:",
    "orders.filter.approval": "Phê duyệt:",
    "orders.filter.date": "Ngày đặt:",
    "orders.filter.all": "Tất cả",
    "orders.filter.searchProduct": "Tìm mã/tên sản phẩm",
    "orders.col.orderCode": "Mã đơn",
    "orders.col.customer": "Khách hàng",
    "orders.col.products": "Sản phẩm trong đơn",
    "orders.col.orderDate": "Ngày đặt",
    "orders.col.status": "Trạng thái",
    "orders.col.planning": "Kế hoạch",
    "orders.col.approval": "Phê duyệt",
    "orders.col.category": "Hạng mục",
    "orders.col.weight": "Khối lượng",
    "orders.col.total": "Tổng tiền",
    "orders.col.actions": "Thao tác",
    "orders.col.quantity": "Số lượng",
    "orders.col.subtotal": "Thành tiền",
    "orders.col.from": "Từ",
    "orders.col.to": "Sang",
    "orders.col.time": "Thời gian",
    "orders.action.detail": "Chi tiết",
    "orders.action.approve": "Phê duyệt",
    "orders.action.reject": "Từ chối",
    "orders.action.changeStatus": "Đổi trạng thái",
    "orders.confirm.approveOrder": "Phê duyệt đơn hàng này?",
    "orders.confirm.rejectOrder": "Từ chối đơn hàng này?",
    "orders.confirm.approveShort": "Phê duyệt đơn?",
    "orders.confirm.rejectShort": "Từ chối đơn?",
    "orders.status.pending": "Chờ duyệt",
    "orders.status.approved": "Đã duyệt",
    "orders.status.rejected": "Từ chối",
    "orders.message.created": "Đã tạo đơn hàng",
    "orders.message.statusUpdated": "Đã cập nhật trạng thái",
    "orders.message.approvalUpdated": "Đã cập nhật phê duyệt",
    "orders.message.importSuccess": "Import thành công {{count}} đơn hàng",
    "orders.message.chooseFile": "Chọn file trước",
    "orders.unit.case": "thùng",
    "orders.moreProducts": "+{{count}} sản phẩm khác",
    "orders.modal.createTitle": "Tạo đơn hàng mới",
    "orders.form.organization": "Tổ chức",
    "orders.form.orderCode": "Mã đơn hàng",
    "orders.form.customerCode": "Mã khách hàng",
    "orders.form.chooseOrEnterCode": "Chọn hoặc nhập mã",
    "orders.form.orderDate": "Ngày đặt hàng",
    "orders.form.typeWay": "Chiều vận chuyển",
    "orders.form.firstWay": "Chiều đi (FIRST_WAY)",
    "orders.form.secondWay": "Chiều về (SECOND_WAY)",
    "orders.form.goods": "Hàng hóa",
    "orders.form.goodsTooltip": "Chọn sản phẩm và số lượng. Tổng tiền tự tính = Σ(Số lượng × Đơn giá sản phẩm)",
    "orders.form.chooseProduct": "Chọn SP",
    "orders.form.searchProduct": "Tìm theo mã hoặc tên sản phẩm",
    "orders.form.quantityShort": "SL",
    "orders.form.quantity": "Số lượng",
    "orders.form.addProduct": "Thêm sản phẩm",
    "orders.form.estimatedTotal": "Tổng tiền tạm tính: ",
    "orders.modal.statusTitle": "Cập nhật trạng thái đơn hàng",
    "orders.form.newStatus": "Trạng thái mới",
    "orders.form.note": "Ghi chú",
    "orders.modal.importTitle": "Import đơn hàng (Excel / JSON)",
    "orders.modal.downloadTemplate": "Tải file Excel mẫu (Template)",
    "orders.modal.chooseImportFile": "Chọn file Excel (.xlsx) hoặc JSON",
    "orders.modal.importHint": "Excel: cột tiêu đề dòng 1 — OrderCode, CustomerCode, OrganizationID, OrderDate, ProductCode, NumberOfCases.",
    "orders.drawer.title": "Chi tiết đơn: {{code}}",
    "orders.drawer.approve": "Duyệt",
    "orders.drawer.goodsDetail": "Chi tiết hàng hóa",
    "orders.drawer.statusHistory": "Lịch sử trạng thái",
    "orders.desc.volumeWeight": "Khối lượng / Thể tích",

    "auth.login.title": "Đăng nhập",
    "auth.login.subtitle": "Nhập thông tin tài khoản để tiếp tục",
    "auth.login.password": "Mật khẩu",
    "auth.login.emailRequired": "Vui lòng nhập email",
    "auth.login.emailInvalid": "Email không hợp lệ",
    "auth.login.passwordRequired": "Vui lòng nhập mật khẩu",
    "auth.login.remember": "Ghi nhớ đăng nhập",
    "auth.login.forgotPassword": "Quên mật khẩu?",
    "auth.login.loading": "Đang xác thực...",
    "auth.login.submit": "ĐĂNG NHẬP",
    "auth.login.registerText": "Chưa có tổ chức?",
    "auth.login.registerLink": "Đăng ký ngay",
    "auth.login.footer": "Nền tảng quản lý vận tải đường bộ · GPS thời gian thực · Phân tuyến thông minh",
    "auth.login.welcome": "Xin chào, {{name}}!",
    "auth.error.password": "Mật khẩu không đúng. Vui lòng kiểm tra lại.",
    "auth.error.email": "Email chưa được đăng ký trong hệ thống.",
    "auth.error.locked": "Tài khoản đã bị khoá. Liên hệ quản trị viên.",
    "auth.error.network": "Không kết nối được máy chủ. Kiểm tra kết nối mạng.",
    "auth.error.default": "Đăng nhập thất bại. Vui lòng thử lại.",

    // === Trợ lý AI / Hỏi đáp ===
    "layout.nav.support": "Hỏi đáp",
    "layout.nav.agent": "AI Agent",
    "agent.title": "AI Agent",
    "agent.tagline": "Ra lệnh để AI tự thao tác",
    "agent.welcome": "Mình là **AI Agent**. Ra lệnh tự nhiên, mình sẽ tự mở trang và thao tác giúp bạn. Vd: _tải báo cáo tháng này_, _mở đơn hàng chờ duyệt_, _lập kế hoạch hôm nay_…",
    "agent.placeholder": "Nhập lệnh cho AI (vd: tải báo cáo tháng này)",
    "agent.working": "Đang xử lý lệnh…",
    "agent.actionDone": "Đã thực hiện: {{label}}",
    "agent.error.send": "Không gọi được AI Agent",
    "support.title": "Trợ lý AI",
    "support.brand": "Road Freight Support",
    "support.greet": "Hi {{name}}",
    "support.placeholder": "Nhập câu hỏi của bạn",
    "support.send": "Gửi",
    "support.close": "Đóng",
    "support.requestHuman": "Gặp tư vấn viên",
    "support.resumeBot": "Quay lại AI",
    "support.waitingHuman": "Đang chờ tư vấn viên phản hồi.",
    "support.consultantLabel": "Tư vấn viên",
    "support.welcome": "Xin chào! Mình là trợ lý AI của Road Freight TMS. Bạn có thể hỏi về **đơn hàng, xe, tài xế, tuyến giao, sự cố, báo cáo**. Nếu mình không trả lời được, mình sẽ chuyển cho tư vấn viên.",
    "support.quickPrompt.unplanned": "Hôm nay có bao nhiêu đơn chưa vào kế hoạch?",
    "support.quickPrompt.optimize": "Cách tối ưu lộ trình?",
    "support.quickPrompt.activeVehicles": "Có bao nhiêu xe đang Active?",
    "support.quickPrompt.askHuman": "Tôi muốn gặp tư vấn viên",
    "support.error.send": "Không gửi được tin nhắn",
    "support.error.resumeBot": "Không quay lại AI được",

    // Trang reply tư vấn viên qua magic link
    "supportReply.title": "Phản hồi tư vấn",
    "supportReply.subtitle": "Road Freight TMS · Trang dành cho tư vấn viên",
    "supportReply.customer": "Khách",
    "supportReply.email": "Email",
    "supportReply.subject": "Chủ đề",
    "supportReply.history": "Lịch sử hội thoại",
    "supportReply.empty": "(Chưa có hội thoại)",
    "supportReply.agentName": "Tên tư vấn viên (tuỳ chọn)",
    "supportReply.agentPlaceholder": "VD: Đức (Support)",
    "supportReply.body": "Nội dung phản hồi",
    "supportReply.bodyPlaceholder": "Gõ phản hồi gửi tới khách hàng...",
    "supportReply.bodyRequired": "Nhập nội dung",
    "supportReply.submit": "Gửi cho khách",
    "supportReply.sent.title": "Đã gửi tin nhắn",
    "supportReply.sent.desc": "Khách hàng đã thấy phản hồi trong app. Bạn có thể đóng tab hoặc gửi tiếp nếu cần.",
    "supportReply.errorTitle": "Không mở được link",
    "supportReply.missingToken": "Thiếu token. Vui lòng mở link từ email gốc.",
    "supportReply.loadError": "Không tải được thông tin phiên chat",
    "supportReply.sendSuccess": "Đã gửi phản hồi tới khách hàng",
    "supportReply.sendError": "Không gửi được",

    // === Liên hệ tư vấn (login page) ===
    "contact.cta": "Liên hệ với chúng tôi",
    "contact.title": "Liên hệ tư vấn sản phẩm",
    "contact.subtitle": "Để lại thông tin, đội ngũ Road Freight TMS sẽ liên hệ tư vấn gói phù hợp.",
    "contact.field.fullName": "Họ và tên",
    "contact.field.fullNameRequired": "Vui lòng nhập họ tên",
    "contact.field.email": "Email",
    "contact.field.emailRequired": "Vui lòng nhập email",
    "contact.field.emailInvalid": "Email không hợp lệ",
    "contact.field.phone": "Số điện thoại",
    "contact.field.company": "Công ty",
    "contact.field.fleetSize": "Quy mô đội xe",
    "contact.field.fleetSize.placeholder": "VD: < 10 xe, 10–50 xe, > 50 xe",
    "contact.field.message": "Nhu cầu / câu hỏi",
    "contact.field.messageRequired": "Vui lòng nhập lời nhắn",
    "contact.field.messagePlaceholder": "VD: Doanh nghiệp em có 25 xe tải, muốn tư vấn gói phần mềm phù hợp...",
    "contact.submit": "Gửi liên hệ",
    "contact.cancel": "Đóng",
    "contact.success.title": "Đã gửi thành công",
    "contact.success.desc": "Cảm ơn bạn đã quan tâm. Đội ngũ tư vấn sẽ liên hệ qua email/điện thoại trong thời gian sớm nhất."
  },
  en: {
    "common.language": "Language",
    "common.vietnamese": "Tiếng Việt",
    "common.english": "English",
    "common.currentLanguage": "EN",
    "common.unknown": "—",

    "layout.nav.dashboard": "Dashboard",
    "layout.nav.admin": "Administration",
    "layout.nav.masterData": "Master Data",
    "layout.nav.orders": "Orders",
    "layout.nav.planning": "Planning",
    "layout.nav.monitoring": "Monitoring",
    "layout.nav.reports": "Reports",
    "layout.title.dashboard": "Dashboard",
    "layout.title.admin": "System Administration",
    "layout.title.masterData": "Master Data",
    "layout.title.orders": "Orders",
    "layout.title.planning": "Planning",
    "layout.title.monitoring": "Route Monitoring",
    "layout.title.reports": "Reports",
    "layout.title.default": "Page",
    "layout.role.accountant": "Accountant",
    "layout.role.driver": "Driver",
    "layout.user.logout": "Log out",
    "layout.brand.platform": "TMS Platform",

    "dashboard.greeting.morning": "Good morning",
    "dashboard.greeting.afternoon": "Good afternoon",
    "dashboard.greeting.evening": "Good evening",
    "dashboard.defaultName": "you",
    "dashboard.summary": "Here is today's transport operations overview.",
    "dashboard.demo.confirmSeedTitle": "Load sample data into your organization?",
    "dashboard.demo.confirmSeedIntro": "This will add DEMO-* records to the current organization:",
    "dashboard.demo.seedItems1": "3 product groups · 8 products · 7 vehicles (3 in-house + 4 outsourced 3PL) · 7 drivers (3 in-house + 4 outsourced 3PL) · 2 3PL services",
    "dashboard.demo.seedItems2": "12 customers in Hanoi · Bac Ninh · Hung Yen (real coordinates)",
    "dashboard.demo.seedItems3": "20 PENDING orders — ready for route planning",
    "dashboard.demo.seedNote": "All records use the DEMO- prefix so they are easy to remove later.",
    "dashboard.demo.seedOk": "Load sample data",
    "dashboard.demo.cancel": "Cancel",
    "dashboard.demo.loadingSeed": "Loading sample data into organization...",
    "dashboard.demo.seedSuccess": "Sample data loaded.",
    "dashboard.demo.seedDoneTitle": "Sample data added.",
    "dashboard.demo.organization": "Organization",
    "dashboard.demo.added": "Added:",
    "dashboard.demo.addedCategories": "{{categories}} product groups · {{products}} products",
    "dashboard.demo.addedVehicles": "{{vehicles}} vehicles · {{services}} 3PL services",
    "dashboard.demo.addedCustomers": "{{customers}} customers · {{orders}} orders",
    "dashboard.demo.planNote": "Go to Planning to test route optimization now.",
    "dashboard.demo.clearTitle": "Delete all demo data?",
    "dashboard.demo.clearContent": "This will delete all DEMO- records (customers, products, vehicles, orders, ...) from your organization. Real data is NOT affected. This cannot be undone.",
    "dashboard.demo.clearOk": "Delete demo data",
    "dashboard.demo.loadingClear": "Deleting demo data...",
    "dashboard.demo.clearSuccess": "All demo data deleted.",
    "dashboard.demo.activeTitle": "Sample data is active",
    "dashboard.demo.activeDesc": "Current organization has:",
    "dashboard.demo.quickTitle": "Start quickly with sample data",
    "dashboard.demo.quickDesc": "Add to your organization: {{customers}} customers in Hanoi · Bac Ninh · Hung Yen, {{vehicles}} trucks, {{products}} products, {{orders}} orders — all with the DEMO- prefix so they are easy to remove later.",
    "dashboard.demo.reload": "Reload",
    "dashboard.demo.clear": "Delete demo",
    "dashboard.unit.customers": "customers",
    "dashboard.unit.products": "products",
    "dashboard.unit.vehicles": "vehicles",
    "dashboard.unit.orders": "orders",
    "dashboard.unit.categories": "product groups",
    "dashboard.unit.services": "3PL services",
    "dashboard.status.pending": "Pending",
    "dashboard.status.approved": "Approved",
    "dashboard.status.rejected": "Rejected",
    "dashboard.status.planning": "Planning",
    "dashboard.status.completed": "Completed",
    "dashboard.quick.access": "Open",
    "dashboard.quick.title": "Quick access",
    "dashboard.quick.count": "{{count}} modules available",
    "dashboard.quick.noPermission": "Your account has not been granted access to any modules. Contact an administrator.",
    "dashboard.quick.masterDesc": "Customers · Goods · Vehicles · Drivers",
    "dashboard.quick.ordersDesc": "{{count}} orders pending approval",
    "dashboard.quick.planningDesc": "Route planning & vehicle dispatch",
    "dashboard.quick.monitoringDesc": "Realtime GPS · Vehicle trips",
    "dashboard.quick.userTitle": "Users",
    "dashboard.quick.userDesc": "Add users & assign permissions",
    "dashboard.quick.orgTitle": "Organizations",
    "dashboard.quick.orgDesc": "Company & branch structure",
    "dashboard.quick.roleTitle": "Role groups",
    "dashboard.quick.roleDesc": "Flexible RBAC permissions",
    "dashboard.quick.reportsDesc": "Operations & revenue statistics",
    "dashboard.stats.totalOrders": "Total orders",
    "dashboard.stats.pendingOrders": "{{count}} pending approval",
    "dashboard.stats.dispatchVehicles": "Vehicles awaiting dispatch",
    "dashboard.stats.unavailableVehicles": "{{count}} vehicles unavailable",
    "dashboard.stats.accounts": "Accounts",
    "dashboard.stats.accountsSub": "Users in organization",
    "dashboard.stats.organizations": "Organizations",
    "dashboard.stats.organizationsSub": "Within access scope",
    "dashboard.recent.title": "Recent orders",
    "dashboard.recent.viewAll": "View all →",
    "dashboard.recent.loading": "Loading…",
    "dashboard.recent.empty": "No orders yet",
    "dashboard.table.code": "Order code",
    "dashboard.table.customer": "Customer",
    "dashboard.table.route": "Route",
    "dashboard.table.status": "Status",
    "dashboard.table.createdAt": "Created date",

    "orders.title": "Orders",
    "orders.subtitle": "Manage Sales Orders — create, approve, and track status",
    "orders.export": "Export Excel",
    "orders.import": "Import",
    "orders.create": "Create order",
    "orders.filter.status": "Order status:",
    "orders.filter.approval": "Approval:",
    "orders.filter.date": "Order date:",
    "orders.filter.all": "All",
    "orders.filter.searchProduct": "Search product code/name",
    "orders.col.orderCode": "Order code",
    "orders.col.customer": "Customer",
    "orders.col.products": "Products in order",
    "orders.col.orderDate": "Order date",
    "orders.col.status": "Status",
    "orders.col.planning": "Planning",
    "orders.col.approval": "Approval",
    "orders.col.category": "Category",
    "orders.col.weight": "Weight",
    "orders.col.total": "Total",
    "orders.col.actions": "Actions",
    "orders.col.quantity": "Quantity",
    "orders.col.subtotal": "Subtotal",
    "orders.col.from": "From",
    "orders.col.to": "To",
    "orders.col.time": "Time",
    "orders.action.detail": "Details",
    "orders.action.approve": "Approve",
    "orders.action.reject": "Reject",
    "orders.action.changeStatus": "Change status",
    "orders.confirm.approveOrder": "Approve this order?",
    "orders.confirm.rejectOrder": "Reject this order?",
    "orders.confirm.approveShort": "Approve order?",
    "orders.confirm.rejectShort": "Reject order?",
    "orders.status.pending": "Pending",
    "orders.status.approved": "Approved",
    "orders.status.rejected": "Rejected",
    "orders.message.created": "Order created",
    "orders.message.statusUpdated": "Status updated",
    "orders.message.approvalUpdated": "Approval updated",
    "orders.message.importSuccess": "Imported {{count}} orders successfully",
    "orders.message.chooseFile": "Choose a file first",
    "orders.unit.case": "cases",
    "orders.moreProducts": "+{{count}} more products",
    "orders.modal.createTitle": "Create new order",
    "orders.form.organization": "Organization",
    "orders.form.orderCode": "Order code",
    "orders.form.customerCode": "Customer code",
    "orders.form.chooseOrEnterCode": "Choose or enter code",
    "orders.form.orderDate": "Order date",
    "orders.form.typeWay": "Transport direction",
    "orders.form.firstWay": "Outbound (FIRST_WAY)",
    "orders.form.secondWay": "Return (SECOND_WAY)",
    "orders.form.goods": "Goods",
    "orders.form.goodsTooltip": "Choose products and quantities. Total = Σ(Quantity × Product unit price)",
    "orders.form.chooseProduct": "Choose product",
    "orders.form.searchProduct": "Search by product code or name",
    "orders.form.quantityShort": "Qty",
    "orders.form.quantity": "Quantity",
    "orders.form.addProduct": "Add product",
    "orders.form.estimatedTotal": "Estimated total: ",
    "orders.modal.statusTitle": "Update order status",
    "orders.form.newStatus": "New status",
    "orders.form.note": "Note",
    "orders.modal.importTitle": "Import orders (Excel / JSON)",
    "orders.modal.downloadTemplate": "Download Excel template",
    "orders.modal.chooseImportFile": "Choose Excel (.xlsx) or JSON file",
    "orders.modal.importHint": "Excel: header row 1 — OrderCode, CustomerCode, OrganizationID, OrderDate, ProductCode, NumberOfCases.",
    "orders.drawer.title": "Order details: {{code}}",
    "orders.drawer.approve": "Approve",
    "orders.drawer.goodsDetail": "Goods details",
    "orders.drawer.statusHistory": "Status history",
    "orders.desc.volumeWeight": "Weight / Volume",

    "auth.login.title": "Sign in",
    "auth.login.subtitle": "Enter your account details to continue",
    "auth.login.password": "Password",
    "auth.login.emailRequired": "Please enter your email",
    "auth.login.emailInvalid": "Invalid email address",
    "auth.login.passwordRequired": "Please enter your password",
    "auth.login.remember": "Remember me",
    "auth.login.forgotPassword": "Forgot password?",
    "auth.login.loading": "Authenticating...",
    "auth.login.submit": "SIGN IN",
    "auth.login.registerText": "No organization yet?",
    "auth.login.registerLink": "Register now",
    "auth.login.footer": "Road freight management · Real-time GPS · Smart route planning",
    "auth.login.welcome": "Hello, {{name}}!",
    "auth.error.password": "Incorrect password. Please check again.",
    "auth.error.email": "This email is not registered in the system.",
    "auth.error.locked": "This account is locked. Contact an administrator.",
    "auth.error.network": "Cannot connect to the server. Check your network.",
    "auth.error.default": "Sign in failed. Please try again.",

    // === AI Assistant / Support ===
    "layout.nav.support": "Help & FAQ",
    "layout.nav.agent": "AI Agent",
    "agent.title": "AI Agent",
    "agent.tagline": "Give a command, AI takes action",
    "agent.welcome": "I'm the **AI Agent**. Type a natural-language command and I'll open the right page and act on it. E.g. _download this month's report_, _show pending orders_, _create a plan for today_…",
    "agent.placeholder": "Type a command (e.g. download this month's report)",
    "agent.working": "Working on it…",
    "agent.actionDone": "Done: {{label}}",
    "agent.error.send": "AI Agent call failed",
    "support.title": "AI Assistant",
    "support.brand": "Road Freight Support",
    "support.greet": "Hi {{name}}",
    "support.placeholder": "Type your question",
    "support.send": "Send",
    "support.close": "Close",
    "support.requestHuman": "Talk to consultant",
    "support.resumeBot": "Back to AI",
    "support.waitingHuman": "Waiting for a consultant to reply.",
    "support.consultantLabel": "Consultant",
    "support.welcome": "Hi! I'm the Road Freight TMS AI assistant. Ask me about **orders, vehicles, drivers, routes, incidents, reports**. If I cannot answer, I will hand you over to a consultant.",
    "support.quickPrompt.unplanned": "How many orders are not yet planned today?",
    "support.quickPrompt.optimize": "How do I optimize routes?",
    "support.quickPrompt.activeVehicles": "How many vehicles are Active?",
    "support.quickPrompt.askHuman": "I want to talk to a consultant",
    "support.error.send": "Failed to send message",
    "support.error.resumeBot": "Failed to switch back to AI",

    // Consultant reply (magic link) page
    "supportReply.title": "Consultant reply",
    "supportReply.subtitle": "Road Freight TMS · Consultant page",
    "supportReply.customer": "Customer",
    "supportReply.email": "Email",
    "supportReply.subject": "Subject",
    "supportReply.history": "Conversation history",
    "supportReply.empty": "(No conversation yet)",
    "supportReply.agentName": "Consultant name (optional)",
    "supportReply.agentPlaceholder": "e.g. Duc (Support)",
    "supportReply.body": "Reply content",
    "supportReply.bodyPlaceholder": "Type your reply to the customer...",
    "supportReply.bodyRequired": "Content is required",
    "supportReply.submit": "Send to customer",
    "supportReply.sent.title": "Message sent",
    "supportReply.sent.desc": "The customer has received your reply in-app. You can close this tab or send another message.",
    "supportReply.errorTitle": "Cannot open link",
    "supportReply.missingToken": "Missing token. Please open the link from the original email.",
    "supportReply.loadError": "Failed to load chat session",
    "supportReply.sendSuccess": "Reply sent to customer",
    "supportReply.sendError": "Send failed",

    // === Contact sales (login page) ===
    "contact.cta": "Contact us",
    "contact.title": "Talk to our sales team",
    "contact.subtitle": "Leave your info and the Road Freight TMS team will get back to recommend the right plan.",
    "contact.field.fullName": "Full name",
    "contact.field.fullNameRequired": "Please enter your full name",
    "contact.field.email": "Email",
    "contact.field.emailRequired": "Please enter your email",
    "contact.field.emailInvalid": "Invalid email",
    "contact.field.phone": "Phone",
    "contact.field.company": "Company",
    "contact.field.fleetSize": "Fleet size",
    "contact.field.fleetSize.placeholder": "e.g. < 10 trucks, 10–50, > 50",
    "contact.field.message": "Your message",
    "contact.field.messageRequired": "Please enter a message",
    "contact.field.messagePlaceholder": "e.g. We operate 25 trucks and need help choosing a plan...",
    "contact.submit": "Send",
    "contact.cancel": "Close",
    "contact.success.title": "Sent successfully",
    "contact.success.desc": "Thanks for reaching out. Our team will contact you via email/phone shortly."
  }
};

const antdLocales = { vi: viVN, en: enUS };
const LanguageContext = createContext(null);
const originalTextNodes = new WeakMap();

const staticUiText = {
  "Chào buổi sáng": "Good morning",
  "Chào buổi chiều": "Good afternoon",
  "Chào buổi tối": "Good evening",
  "Đây là tổng quan hoạt động vận tải hôm nay của bạn.": "Here is today's transport operations overview.",
  "Quản trị tổ chức (ABC)": "Organization admin (ABC)",
  "Dữ liệu mẫu đã kích hoạt": "Sample data is active",
  "Trong tổ chức hiện có:": "Current organization has:",
  "khách hàng": "customers",
  "sản phẩm": "products",
  "xe": "vehicles",
  "đơn hàng": "orders",
  "nhóm SP": "product groups",
  "dịch vụ 3PL": "3PL services",
  "Tải lại": "Reload",
  "Xóa demo": "Delete demo",
  "Tổng đơn hàng": "Total orders",
  "Xe chờ điều phối": "Vehicles awaiting dispatch",
  "Tài khoản": "Accounts",
  "Tổ chức": "Organizations",
  "Người dùng trong tổ chức": "Users in organization",
  "Trong phạm vi truy cập": "Within access scope",
  "Truy cập nhanh": "Quick access",
  "Đơn hàng": "Orders",
  "Lập kế hoạch": "Planning",
  "Người dùng": "Users",
  "Nhóm vai trò": "Role groups",
  "Báo cáo": "Reports",
  "Khách hàng · Hàng hoá · Xe · Tài xế": "Customers · Goods · Vehicles · Drivers",
  "Phân tuyến & điều phối xe": "Route planning & vehicle dispatch",
  "Thêm & phân quyền nhân sự": "Add users & assign permissions",
  "Cấu trúc công ty & chi nhánh": "Company & branch structure",
  "Phân quyền RBAC linh hoạt": "Flexible RBAC permissions",
  "Thống kê vận hành & doanh thu": "Operations & revenue statistics",
  "Truy cập": "Open",
  "Đơn hàng gần đây": "Recent orders",
  "Xem tất cả →": "View all →",
  "MÃ ĐƠN": "ORDER CODE",
  "KHÁCH HÀNG": "CUSTOMER",
  "TUYẾN": "ROUTE",
  "TRẠNG THÁI": "STATUS",
  "NGÀY TẠO": "CREATED DATE",
  "Đã duyệt": "Approved",
  "Chờ duyệt": "Pending",
  "Từ chối": "Rejected",
  "Lên kế hoạch": "Planning",
  "Hoàn thành": "Completed",
  "Đang tải…": "Loading…",
  "Chưa có đơn hàng nào": "No orders yet",
  "Trang chủ": "Dashboard",
  "Quản trị": "Administration",
  "Giám sát": "Monitoring",
  "Giám sát hành trình": "Route Monitoring",
  "Dữ liệu Master": "Master Data",
  "Đăng xuất": "Log out",

  // ───── Audit Logs tab (Admin) ─────
  "Nhật ký hệ thống": "System Logs",
  "Nhật ký kiểm toán (Audit Log)": "Audit Log",
  "Hoạt động 24h qua": "Activity in last 24h",
  "Phân bố theo hành động": "Distribution by action",
  "Chưa có hoạt động trong 24h qua. Thực hiện thao tác bất kỳ (tạo/sửa/xoá đơn, tải báo cáo...) → log sẽ xuất hiện ở đây.":
    "No activity in the last 24h. Any action (create/edit/delete orders, download reports...) will appear here.",
  "THỜI GIAN": "TIME",
  "HÀNH ĐỘNG": "ACTION",
  "ĐỐI TƯỢNG": "RESOURCE",
  "NGƯỜI THỰC HIỆN": "USER",
  "ENDPOINT": "ENDPOINT",
  "HTTP": "HTTP",
  "THAY ĐỔI": "CHANGES",
  "LATENCY": "LATENCY",
  "IP": "IP",
  "Hành động": "Action",
  "Đối tượng": "Resource",
  "Làm mới": "Refresh",

  // ───── Maintenance tab (Master Data) ─────
  "Bảo dưỡng xe": "Vehicle Maintenance",
  "Lịch bảo dưỡng phương tiện": "Vehicle maintenance schedule",
  "Lịch sắp tới (7 ngày)": "Upcoming (7 days)",
  "Quá hạn": "Overdue",
  "Cảnh báo Km": "Mileage warnings",
  "Tạo lịch": "Create schedule",
  "Tạo lịch bảo dưỡng": "Create maintenance schedule",
  "Sửa lịch bảo dưỡng": "Edit maintenance schedule",
  "Tài xế phụ trách": "Assigned driver",
  "Chưa phân công": "Unassigned",
  "Chưa nhận": "Not acknowledged",
  "Người sẽ đưa xe đi bảo dưỡng (có thể để trống nếu chưa phân công)":
    "Person who will take the vehicle for maintenance (can leave empty if unassigned)",
  "Chọn xe": "Select vehicle",
  "Chọn tài xế đưa xe đi bảo dưỡng": "Select driver to take vehicle for maintenance",
  "Loại bảo dưỡng": "Maintenance type",
  "Tiêu đề": "Title",
  "Mô tả": "Description",
  "Ngày lên lịch": "Scheduled date",
  "Ngày hoàn tất": "Completed date",
  "Km hiện tại": "Current km",
  "Km kế tiếp": "Next service km",
  "Chi phí (đ)": "Cost (VND)",
  "Chi phí": "Cost",
  "Nhà cung cấp": "Vendor",
  "Trạng thái": "Status",
  "Ghi chú": "Notes",
  "🛢️ Thay dầu nhớt": "🛢️ Oil change",
  "🛞 Đảo lốp": "🛞 Tire rotation",
  "🔧 Kiểm tra phanh": "🔧 Brake check",
  "🔍 Bảo dưỡng tổng quát": "🔍 General service",
  "📄 Gia hạn bảo hiểm": "📄 Insurance renewal",
  "🚗 Gia hạn đăng kiểm": "🚗 Vehicle inspection renewal",
  "⚙️ Sửa chữa đột xuất": "⚙️ Emergency repair",
  "📌 Khác": "📌 Other",
  "Chờ tài xế nhận": "Waiting driver",
  "TX đã nhận việc": "Driver acknowledged",
  "Đang thực hiện": "In progress",
  "Chờ duyệt": "Awaiting review",
  "Hoàn tất": "Completed",
  "Đã huỷ": "Cancelled",
  "Xem ảnh": "View photos",
  "Duyệt": "Approve",
  "Duyệt hoàn thành": "Approve completion",
  "Duyệt hoàn thành?": "Approve completion?",
  "Sau khi duyệt, lịch bảo dưỡng được khoá.": "After approval, the schedule will be locked.",
  "Sửa": "Edit",
  "Xoá": "Delete",
  "Xoá bản ghi?": "Delete record?",
  "Ảnh tài xế upload": "Photos uploaded by driver",
  "Ghi chú từ tài xế": "Driver's note",
  "Không có ảnh": "No photos",
  "Đóng": "Close",

  // ───── Payroll tab (Reports) ─────
  "💰 Bảng lương tài xế": "💰 Driver Payroll",
  "📊 Báo cáo vận tải": "📊 Transport Reports",
  "Bảng lương + Hoa hồng tài xế": "Driver Payroll + Commission",
  "Tổng quỹ lương tháng": "Monthly payroll total",
  "Số tài xế": "Driver count",
  "Tổng thưởng": "Total bonuses",
  "Tổng COD thu hộ": "Total COD collected",
  "Cấu hình lương": "Payroll config",
  "Cấu hình lương tài xế": "Driver payroll configuration",
  "Tuỳ chỉnh công thức lương (lương cứng, thưởng, % COD...)":
    "Customize the payroll formula (base salary, bonuses, COD %)...",
  "Xuất Excel": "Export Excel",
  "Không có dữ liệu lương cho tháng này": "No payroll data for this month",
  "Mã TX": "Driver code",
  "Tên": "Name",
  "SĐT": "Phone",
  "Chuyến (HT/Tổng)": "Trips (Done/Total)",
  "Km": "Km",
  "COD thu": "COD collected",
  "Lương cứng": "Base salary",
  "Thưởng km": "Km bonus",
  "Thưởng chuyến": "Trip bonus",
  "% COD": "% COD",
  "Thực lĩnh": "Net pay",
  "TỔNG CỘNG": "TOTAL",
  "Lương cứng / tháng (đ)": "Base salary / month (VND)",
  "Lương cố định trả mỗi tháng cho tài xế bất kể số chuyến":
    "Fixed monthly salary regardless of trip count",
  "Ngưỡng km / tháng": "Km threshold / month",
  "Chạy vượt ngưỡng này mới được tính thưởng km": "Bonus only applies above this km threshold",
  "Thưởng / km vượt (đ)": "Bonus / km over (VND)",
  "Thưởng / chuyến hoàn thành (đ)": "Bonus / completed trip (VND)",
  "Hoa hồng COD thu hộ (%)": "COD commission (%)",
  "Vd: 0.005 = 0.5%. Tài xế nhận % này trên tổng COD họ thu hộ":
    "E.g. 0.005 = 0.5%. Driver receives this % of total COD collected",
  "Lưu": "Save",
  "Huỷ": "Cancel",
  "Đã cập nhật cấu hình lương": "Payroll config updated",

  // ───── Orders tracking link ─────
  "Sao chép link tracking cho khách": "Copy customer tracking link",
  "Link tracking đã sao chép": "Tracking link copied",
  "Gửi link này cho khách hàng để họ tự theo dõi đơn:":
    "Send this link to the customer so they can track their order:",
  "Khách KHÔNG cần đăng nhập. Có thể mở trên điện thoại để xem vị trí xe real-time + ETA + ảnh ePOD.":
    "Customer does NOT need to log in. Can be opened on mobile to view real-time vehicle position + ETA + ePOD photos.",
  "🔗 Mở thử trong tab mới": "🔗 Try opening in new tab",

  // ───── Notifications ─────
  "Có tin nhắn mới": "New message",

  // ───── Planning page ─────
  "Đã chốt lộ trình": "Route finalized",
  "Đã tạo ${planCode}": "Created ${planCode}",
  "Đã tạo lịch bảo dưỡng": "Maintenance scheduled",
  "Đã cập nhật": "Updated",

  // ───── Admin Audit Logs filter dropdown ─────
  "Tổng ": "Total ",
  " bản ghi": " records"
};

function translateStaticText(text) {
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const core = text.trim();

  if (!core) return text;
  if (staticUiText[core]) return `${leading}${staticUiText[core]}${trailing}`;

  const replacements = [
    [/^(.+),\s*(.+)\s*👋$/, (_, greeting, name) => `${staticUiText[greeting] ?? greeting}, ${name} 👋`],
    [/^(\d+)\s+chờ phê duyệt$/, (_, count) => `${count} pending approval`],
    [/^(\d+)\s+xe không khả dụng$/, (_, count) => `${count} vehicles unavailable`],
    [/^(\d+)\s+đơn đang chờ phê duyệt$/, (_, count) => `${count} orders pending approval`],
    [/^(\d+)\s+module khả dụng$/, (_, count) => `${count} modules available`],
    [/^(\d+)\s+khách hàng$/, (_, count) => `${count} customers`],
    [/^(\d+)\s+sản phẩm$/, (_, count) => `${count} products`],
    [/^(\d+)\s+xe$/, (_, count) => `${count} vehicles`],
    [/^(\d+)\s+đơn hàng$/, (_, count) => `${count} orders`],
    [/^(\d+)\s+nhóm SP$/, (_, count) => `${count} product groups`],
    [/^(\d+)\s+dịch vụ 3PL\.?$/, (_, count) => `${count} 3PL services`],

    // ─── Audit / Maintenance / Payroll dynamic strings ───
    [/^Tổng\s+(\d+)\s+bản ghi$/, (_, count) => `Total ${count} records`],
    [/^Có\s+(\d+)\s+lịch bảo dưỡng QUÁ HẠN$/, (_, count) => `${count} OVERDUE maintenance schedules`],
    [/^(\d+)\s+xe sắp\/đã vượt km bảo dưỡng$/, (_, count) => `${count} vehicles approaching/past maintenance mileage`],
    [/^TX xong\s+(.+)$/, (_, dt) => `Driver done ${dt}`],
    [/^Đã nhận\s+(.+)$/, (_, dt) => `Acknowledged ${dt}`],
    [/^Xem ảnh \((\d+)\)$/, (_, count) => `View photos (${count})`],
    [/^Hoàn thành \((\d+)\s+ảnh\)$/, (_, count) => `Complete (${count} photos)`],
    [/^Đã phân\s+(\d+)\/(\d+)\s+tuyến chưa có tài xế$/, (_, a, b) => `Assigned ${a}/${b} routes without driver`]
  ];

  for (const [pattern, replacer] of replacements) {
    if (pattern.test(core)) return `${leading}${core.replace(pattern, replacer)}${trailing}`;
  }

  return text;
}

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return parent.closest("script, style, textarea, input, [data-no-translate]");
}

function applyStaticUiTranslation(language) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();

  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }

  nodes.forEach((textNode) => {
    if (shouldSkipNode(textNode)) return;
    const storedOriginal = originalTextNodes.get(textNode);

    if (language === "vi") {
      if (storedOriginal !== undefined) {
        textNode.nodeValue = storedOriginal;
        originalTextNodes.delete(textNode);
      }
      return;
    }

    if (storedOriginal !== undefined) {
      const storedTranslation = translateStaticText(storedOriginal);
      if (textNode.nodeValue === storedTranslation) return;
      originalTextNodes.delete(textNode);
    }

    const current = textNode.nodeValue;
    const nextValue = translateStaticText(current);
    if (nextValue === current) return;

    originalTextNodes.set(textNode, current);
    textNode.nodeValue = nextValue;
  });
}

function getInitialLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "vi" ? stored : "vi";
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(getInitialLanguage);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => {
    const t = (key, params = {}) => {
      const template = dictionaries[language][key] ?? dictionaries.vi[key] ?? key;
      return Object.entries(params).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, value ?? ""),
        template
      );
    };

    return {
      language,
      antdLocale: antdLocales[language],
      setLanguage,
      toggleLanguage: () => setLanguage((current) => (current === "vi" ? "en" : "vi")),
      t
    };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function UiTextTranslator() {
  const { language } = useLanguage();

  useEffect(() => {
    const translate = () => applyStaticUiTranslation(language);
    translate();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(translate);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => observer.disconnect();
  }, [language]);

  return null;
}
