export const SUPPORT_KNOWLEDGE = [
  {
    title: "Chào hỏi",
    keywords: [
      "xin chào", "xin chao", "chào", "chao", "hello", "hi", "hey",
      "tôi cần giúp", "toi can giup", "cần hỗ trợ", "can ho tro", "help"
    ],
    answer: "Xin chào, tôi là trợ lý hỗ trợ Road Freight TMS. Bạn có thể hỏi tôi về đơn hàng, master data, lập kế hoạch, tối ưu lộ trình, tài xế, xe, giám sát hành trình hoặc báo cáo."
  },
  {
    title: "Đơn chưa vào kế hoạch",
    keywords: [
      "đơn chưa vào kế hoạch", "don chua vao ke hoach", "đơn không vào kế hoạch",
      "không thấy đơn", "khong thay don", "unplanned", "pending order"
    ],
    answer: "Đơn chỉ vào tối ưu khi đã được duyệt, chưa nằm trong lộ trình khác, thuộc đúng kho/tổ chức đang chọn và ngày đơn hợp lệ với ngày kế hoạch. Kiểm tra thêm tọa độ khách hàng, trạng thái ApprovalStatus=APPROVED và PlanningStatus=PENDING."
  },
  {
    title: "Tối ưu lộ trình",
    keywords: [
      "tối ưu", "toi uu", "lập lộ trình", "lap lo trinh", "route planning",
      "tạo kế hoạch", "tao ke hoach", "thuật toán", "thuat toan"
    ],
    answer: "Vào Lập kế hoạch, chọn kho và ngày chạy, tạo kế hoạch mới rồi bấm Tối ưu tuyến. Hệ thống gom đơn theo khách, chọn xe Active phù hợp và tạo tuyến theo ràng buộc tải trọng, thể tích, năng lực xe, tương thích hàng hóa và khung giờ chạy."
  },
  {
    title: "Gán tài xế",
    keywords: [
      "tài xế", "tai xe", "driver", "gán tài", "gan tai", "chọn tài xế", "chon tai xe"
    ],
    answer: "Trong Lập kế hoạch, tuyến Nội bộ sẽ có ô Chọn tài xế. Chọn tài xế rồi hệ thống lưu vào tuyến. Nếu tuyến đang để 3PL thì hệ thống chọn nhà vận chuyển thay vì tài xế nội bộ."
  },
  {
    title: "Xe và phương tiện",
    keywords: [
      "xe", "phương tiện", "phuong tien", "vehicle", "trọng tải", "trong tai",
      "thể tích", "the tich", "active"
    ],
    answer: "Vào Master Data > Phương tiện để thêm hoặc sửa xe. Xe cần trạng thái Active và thuộc đúng kho/tổ chức. Khi tối ưu, hệ thống kiểm tra tải trọng, thể tích, năng lực xe và chi phí xe."
  },
  {
    title: "Tọa độ khách hàng",
    keywords: [
      "tọa độ", "toa do", "gps", "bản đồ", "ban do", "khách hàng", "khach hang", "customer"
    ],
    answer: "Khách hàng cần có Latitude/Longitude để hiển thị trên bản đồ và tham gia tối ưu. Vào Master Data > Khách hàng để cập nhật tọa độ."
  },
  {
    title: "Khóa và hoàn tất tuyến",
    keywords: [
      "khóa", "khoa", "locked", "mở khóa", "mo khoa", "finalize", "hoàn tất", "hoan tat"
    ],
    answer: "Khóa lộ trình để cố định tuyến trước khi giao. Tuyến LOCKED cần mở khóa nếu muốn chỉnh sửa. Tuyến FINALIZED là đã hoàn tất và không thể tối ưu lại."
  },
  {
    title: "Dữ liệu mẫu",
    keywords: [
      "demo", "dữ liệu mẫu", "du lieu mau", "sample", "seed"
    ],
    answer: "Dữ liệu mẫu nằm ở Dashboard. Bấm Tải dữ liệu mẫu để tạo khách hàng, sản phẩm, xe, dịch vụ 3PL và đơn hàng DEMO dùng thử. Có thể xóa lại bằng nút Xóa demo."
  },
  {
    title: "Mở trang Báo cáo và xem tổng quan",
    keywords: [
      "báo cáo", "bao cao", "report", "doanh thu", "tổng quan vận hành", "tong quan van hanh",
      "kpi", "thống kê", "thong ke"
    ],
    answer: "Mở trang Báo cáo:\n1. Bấm menu **Báo cáo** ở thanh điều hướng bên trái (icon biểu đồ).\n2. Trang hiện KPIs: Tổng đơn, Đã giao, Chuyến xe, Chi phí, Doanh thu — cho khoảng thời gian đang chọn.\n3. Chọn kỳ ở thanh phía trên góc phải: **Tuần / Tháng / Quý / Tùy chọn**.\n4. Nếu chọn Tùy chọn, dùng ô RangePicker bên cạnh để pick ngày bắt đầu – kết thúc."
  },
  {
    title: "Theo dõi hành trình",
    keywords: [
      "giám sát", "giam sat", "monitoring", "live dispatch", "gps tài xế", "gps tai xe", "hành trình", "hanh trinh"
    ],
    answer: "Vào Giám sát để theo dõi tuyến đã chốt, timeline điểm giao và vị trí GPS tài xế. Màn hình tự cập nhật định kỳ để xem tiến độ giao hàng."
  },

  // ===== IT ADMIN =====
  {
    title: "Tạo tài khoản người dùng",
    keywords: [
      "tạo tài khoản", "tao tai khoan", "thêm user", "them user", "mời người dùng", "moi nguoi dung",
      "invite user", "create user", "tạo user", "tao user", "thêm nhân viên", "them nhan vien"
    ],
    answer: "Vào **Admin > Người dùng > Mời người dùng**, nhập Email + chọn Nhóm vai trò + chọn Tổ chức. Hệ thống gửi email mời, user mở link để đặt mật khẩu và đăng nhập. Có thể mời cùng lúc nhiều tổ chức/vai trò khác nhau."
  },
  {
    title: "Phân quyền và nhóm vai trò",
    keywords: [
      "phân quyền", "phan quyen", "vai trò", "vai tro", "role", "permission",
      "nhóm vai trò", "nhom vai tro", "user group", "quyền", "quyen", "rbac"
    ],
    answer: "Vào **Admin > Nhóm vai trò** để tạo nhóm và tick các Permission cần (vd ORDER_MANAGE, ROUTE_PLAN_MANAGE, REPORT_VIEW). Sau đó vào **Admin > Người dùng** gán nhóm vai trò cho user theo từng tổ chức. Một user có thể có vai trò khác nhau ở mỗi tổ chức."
  },
  {
    title: "Tạo tổ chức mới (multi-tenant)",
    keywords: [
      "tổ chức", "to chuc", "organization", "tạo công ty", "tao cong ty",
      "tenant", "multi tenant", "đa khách", "da khach", "chi nhánh", "chi nhanh"
    ],
    answer: "Chỉ Super Admin tạo được Tổ chức mới. Vào **Admin > Tổ chức > Thêm**. Mỗi tổ chức có data riêng (đơn, xe, tài xế, tuyến) — user phải được mời vào tổ chức mới truy cập được."
  },
  {
    title: "Reset mật khẩu user",
    keywords: [
      "quên mật khẩu", "quen mat khau", "reset password", "đặt lại mật khẩu", "dat lai mat khau",
      "khôi phục", "khoi phuc", "forgot password"
    ],
    answer: "User tự đặt lại: bấm **Quên mật khẩu** ở màn login, nhập email → nhận link đặt lại trong hộp thư. Nếu user không nhận được mail, IT Admin có thể vào **Admin > Người dùng > [user] > Gửi lại mời** để mời lại bằng email mới."
  },
  {
    title: "Thêm trạm/kho gốc",
    keywords: [
      "kho", "trạm", "tram", "warehouse", "depot", "kho gốc", "kho goc",
      "kho xuất phát", "kho xuat phat", "origin"
    ],
    answer: "Vào **Master Data > Kho/Trạm** (hoặc Cấu hình tổ chức) để thêm kho gốc với tọa độ. Mỗi tuyến tối ưu xuất phát từ 1 kho — đảm bảo có Latitude/Longitude chính xác. Có thể chia nhiều kho theo khu vực."
  },

  // ===== PLANNER =====
  {
    title: "Import đơn hàng từ Excel",
    keywords: [
      "import", "nhập đơn", "nhap don", "excel", "tải lên", "tai len",
      "import order", "upload đơn", "upload don", "batch order"
    ],
    answer: "Vào **Đơn hàng > Nhập Excel**, tải file mẫu, điền theo cột rồi upload. Hệ thống validate khách hàng/sản phẩm theo Mã. Đơn import vào với ApprovalStatus=PENDING — sau khi duyệt mới có thể đưa vào tối ưu lộ trình."
  },
  {
    title: "Ràng buộc khi tối ưu lộ trình",
    keywords: [
      "ràng buộc", "rang buoc", "constraint", "điều kiện tối ưu", "dieu kien toi uu",
      "khung giờ", "khung gio", "time window", "tương thích", "tuong thich",
      "vrp", "or-tools"
    ],
    answer: "Tối ưu (OR-Tools VRP) tôn trọng: tải trọng/thể tích xe, khung giờ giao của khách, tương thích hàng hóa (vd hàng đông lạnh chỉ lên xe đông lạnh), khoảng cách từ kho gốc, thời gian phục vụ tại mỗi điểm. Bấm **Tối ưu tuyến** trong kế hoạch để chạy."
  },
  {
    title: "Khóa và mở khóa tuyến giao",
    keywords: [
      "khóa tuyến", "khoa tuyen", "lock route", "mở khóa", "mo khoa", "unlock",
      "locked", "planner lock", "cố định tuyến", "co dinh tuyen"
    ],
    answer: "Trong **Lập kế hoạch**, mỗi tuyến PLANNED có nút **Khóa**. Tuyến LOCKED không bị reshuffle khi chạy tối ưu lại. Muốn sửa thì **Mở khóa** trước. Sau khi giao xong tuyến chuyển FINALIZED — không thể tối ưu hay sửa nữa."
  },
  {
    title: "Xe thuê ngoài (3PL)",
    keywords: [
      "3pl", "thuê ngoài", "thue ngoai", "outsource", "đối tác vận chuyển", "doi tac van chuyen",
      "carrier", "subcontractor", "thuê xe", "thue xe"
    ],
    answer: "Tuyến 3PL không cần xe nội bộ — vào **Master Data > Dịch vụ 3PL** để thêm nhà vận chuyển + bảng giá theo cự ly/khối lượng. Khi tạo tuyến, chọn loại 3PL và chọn nhà vận chuyển; hệ thống dùng bảng giá để tính chi phí thay vì FixedCost/CostPerKm."
  },

  // ===== DISPATCHER =====
  {
    title: "Theo dõi tuyến trên Live Map",
    keywords: [
      "live map", "bản đồ trực tiếp", "ban do truc tiep", "dispatch", "điều phối", "dieu phoi",
      "theo dõi tuyến", "theo doi tuyen", "real time", "thời gian thực", "thoi gian thuc"
    ],
    answer: "Vào **Giám sát** → chọn ngày + tuyến để xem vị trí GPS tài xế đẩy về realtime, timeline điểm giao, ETA dự kiến. Khi tài xế bị lệch tuyến hoặc dừng quá lâu, hệ thống cảnh báo deviation/idle. Có thể chat trực tiếp với tài xế qua nút Tin nhắn."
  },
  {
    title: "Xử lý sự cố tài xế báo",
    keywords: [
      "sự cố", "su co", "incident", "kẹt xe", "ket xe", "hỏng xe", "hong xe",
      "deviation", "lệch tuyến", "lech tuyen", "tai nạn", "tai nan", "open ticket"
    ],
    answer: "Sự cố tài xế gửi từ mobile sẽ hiện ở **Giám sát > Sự cố** (status OPEN). Bấm vào để xem mô tả + ảnh + tọa độ. Đổi status sang ACKNOWLEDGED khi đã liên hệ tài xế, RESOLVED khi xử lý xong. Có thể thêm note nội bộ."
  },
  {
    title: "Gửi tin nhắn cho tài xế",
    keywords: [
      "chat tài xế", "chat tai xe", "tin nhắn", "tin nhan", "message driver",
      "nhắn tin", "nhan tin", "liên lạc tài xế", "lien lac tai xe"
    ],
    answer: "Tại **Giám sát**, chọn 1 chuyến → bấm **Chat app**. Tin nhắn đẩy tới app tài xế ngay; tài xế có thể trả lời từ mục Tin nhắn dispatcher trong app. Lịch sử lưu kèm chuyến để truy ngược."
  },
  {
    title: "Cảnh báo lệch tuyến và dừng lâu",
    keywords: [
      "cảnh báo", "canh bao", "alert", "lệch tuyến", "lech tuyen", "deviation",
      "dừng lâu", "dung lau", "idle", "stuck", "off route"
    ],
    answer: "Hệ thống tự cảnh báo khi: (1) tài xế lệch tuyến tối ưu > 500m hoặc > 5 phút, (2) dừng > 15 phút mà chưa ở điểm giao, (3) chuyến chậm so với ETA. Cảnh báo hiện ở Live Map và Dashboard, dispatcher có thể acknowledge để tắt nhắc."
  },

  // ===== ACCOUNTANT =====
  {
    title: "Tải/Xuất báo cáo tháng ra Excel",
    keywords: [
      "tải báo cáo", "tai bao cao", "xuất báo cáo", "xuat bao cao", "download báo cáo", "download bao cao",
      "export báo cáo", "export bao cao", "báo cáo tháng", "bao cao thang", "báo cáo tuần", "bao cao tuan",
      "báo cáo quý", "bao cao quy", "xuất excel", "xuat excel", "tải excel", "tai excel",
      "monthly report", "weekly report", "tải về", "tai ve"
    ],
    answer: "Tải báo cáo (tháng/tuần/quý) ra Excel:\n1. Bấm menu **Báo cáo** bên trái.\n2. Trên góc phải có thanh chọn kỳ (Segmented) — bấm **Tháng** (hoặc Tuần / Quý / Tùy chọn).\n3. Nếu chọn Tùy chọn, dùng **RangePicker** để pick khoảng ngày cụ thể.\n4. Đợi KPIs load xong (Tổng đơn, Đã giao, Chuyến xe…).\n5. Bấm nút **Xuất Excel** (icon ⬇ ở cùng hàng, ngoài cùng bên phải) — file `.xlsx` tự tải về máy."
  },
  {
    title: "Đối soát COD",
    keywords: [
      "cod", "thu hộ", "thu ho", "đối soát", "doi soat", "tiền cod", "tien cod",
      "cash on delivery", "reconcile", "tiền thu", "tien thu"
    ],
    answer: "Số COD tài xế đã thu hiển thị trong **Báo cáo** (KPI Tổng giá trị tiền + chi tiết theo chuyến) và trong từng **Đơn hàng**. Đối soát:\n1. Vào **Báo cáo** → chọn kỳ (Tuần/Tháng) → xem KPI tiền hàng + tiền dịch vụ.\n2. Bấm **Xuất Excel** để có file chi tiết theo chuyến, đối chiếu với số tài xế nộp về quỹ.\n3. Nếu lệch, vào **Đơn hàng** lọc theo mã chuyến để rà từng đơn — COD ghi nhận tự động khi tài xế xác nhận ePOD."
  },
  {
    title: "Cước vận chuyển và doanh thu",
    keywords: [
      "cước", "cuoc", "freight", "doanh thu vận chuyển", "doanh thu van chuyen",
      "báo cáo cước", "bao cao cuoc", "tariff", "phí vận chuyển", "phi van chuyen",
      "service price", "tiền xe", "tien xe"
    ],
    answer: "Cước/doanh thu xem trên trang **Báo cáo**. Cách lấy:\n1. Vào **Báo cáo** → chọn kỳ (Tuần/Tháng/Quý).\n2. Xem KPI **Tổng giá trị tiền** và **Tiền xe/dịch vụ đơn hàng** — đây là cước.\n3. Bấm **Xuất Excel** để có chi tiết từng đơn/chuyến.\n\nGhi chú: cước đơn nội bộ tính theo `ServicePrice` của đơn; tuyến 3PL tính theo bảng giá ở Master Data > Dịch vụ 3PL."
  },
  {
    title: "Chi phí vận hành nội bộ (FixedCost + CostPerKm)",
    keywords: [
      "chi phí", "chi phi", "cost", "vận hành", "van hanh", "fixed cost", "cost per km",
      "chi phí xe", "chi phi xe", "operating cost", "chi phí chuyến", "chi phi chuyen"
    ],
    answer: "Chi phí 1 chuyến nội bộ = **FixedCost** + (**CostPerKm** × tổng km). Cấu hình:\n1. Vào **Master Data** → tab **Phương tiện** → mở 1 xe.\n2. Nhập `FixedCost` (chi phí cố định/chuyến) và `CostPerKm` → Lưu.\n\nXem tổng chi phí: vào **Báo cáo** → chọn kỳ → KPI **Chi phí** ; bấm **Xuất Excel** để xem chi tiết theo xe/tài xế."
  },

  // ===== DRIVER (MOBILE APP) =====
  {
    title: "Tải app tài xế và đăng nhập",
    keywords: [
      "tải app", "tai app", "download", "cài app", "cai app", "install",
      "đăng nhập app", "dang nhap app", "login app", "expo go"
    ],
    answer: "App tài xế cài qua Expo Go (dev) hoặc bản APK do IT phát hành. Mở app → nhập username/email + mật khẩu được IT cấp. Nếu chưa có tài khoản, liên hệ điều phối/IT để được mời. App tự lưu phiên đăng nhập trong SecureStore."
  },
  {
    title: "Quy trình chuyến chạy trên app",
    keywords: [
      "nhận chuyến", "nhan chuyen", "xuất kho", "xuat kho", "về kho", "ve kho",
      "kết thúc chuyến", "ket thuc chuyen", "quy trình", "quy trinh", "workflow",
      "soạn hàng", "soan hang", "loading",
      "xác nhận chuyến", "xac nhan chuyen", "xác nhận lộ trình", "xac nhan lo trinh",
      "bắt đầu chạy", "bat dau chay", "bắt đầu chuyến", "bat dau chuyen",
      "chạy xe", "chay xe", "lộ trình tài xế", "lo trinh tai xe",
      "trên app", "tren app", "app tài xế", "app tai xe", "quy trình tài xế", "quy trinh tai xe"
    ],
    answer: "Quy trình chạy chuyến trên app tài xế:\n1. **Nhận chuyến** — mở Danh sách chuyến → chọn chuyến ASSIGNED → bấm **Nhận chuyến** (chuyển sang DRIVER_CONFIRMED).\n2. **Soạn hàng** — bấm khi bắt đầu lấy hàng tại kho (LOADING).\n3. **Xuất kho** — bấm khi rời kho đi giao (IN_PROGRESS, chính là bắt đầu chạy xe).\n4. Tới từng điểm → mở **Chi tiết điểm dừng** → bấm **Xác nhận giao hàng (ePOD)** → chụp ảnh + ký nhận.\n5. Khi tất cả điểm đã COMPLETED/FAILED → bấm **Về kho** (RETURNING).\n6. Về tới kho → bấm **Kết thúc chuyến** (COMPLETED)."
  },
  {
    title: "Xác nhận giao hàng (ePOD)",
    keywords: [
      "epod", "pod", "xác nhận giao", "xac nhan giao", "ảnh giao hàng", "anh giao hang",
      "proof of delivery", "chụp ảnh giao", "chup anh giao", "ký nhận", "ky nhan"
    ],
    answer: "Tới điểm giao, mở **Chi tiết điểm dừng** trong app → bấm **Xác nhận giao hàng (ePOD)**. Bắt buộc: chụp ít nhất 1 ảnh hàng đã giao + chữ ký khách (vẽ trên màn hình). Có thể ghi chú lý do nếu giao thất bại. Bấm Xong → trạng thái điểm chuyển COMPLETED/FAILED, đẩy về dispatcher ngay."
  },
  {
    title: "Báo sự cố từ app",
    keywords: [
      "báo sự cố", "bao su co", "report incident", "kẹt đường", "ket duong",
      "hỏng xe", "hong xe", "tai nạn", "tai nan", "sự cố app", "su co app"
    ],
    answer: "Trong **Chi tiết chuyến** trên app, bấm **Báo sự cố**. Chọn loại (kẹt xe / hỏng xe / tai nạn / khác), mô tả ngắn, chụp ảnh (tùy chọn). Vị trí GPS tự đính kèm. Bấm Gửi — dispatcher thấy ngay ở màn Giám sát và sẽ liên hệ xử lý."
  },
  {
    title: "Quên mật khẩu trên app tài xế",
    keywords: [
      "quên mật khẩu app", "quen mat khau app", "đổi mật khẩu app", "doi mat khau app",
      "reset password app", "không đăng nhập được", "khong dang nhap duoc", "lỗi đăng nhập", "loi dang nhap"
    ],
    answer: "App tài xế hiện không có chức năng tự reset. Vào trang web Road Freight TMS bấm **Quên mật khẩu**, nhập email → đặt lại mật khẩu mới → quay về app đăng nhập lại. Nếu không có máy tính, gọi điều phối/IT để được reset thủ công."
  }
];

export function findSupportAnswer(question) {
  const match = findBestSupportKnowledge(question);
  return match?.answer ?? null;
}

export function findBestSupportKnowledge(question) {
  const raw = String(question ?? "").trim();
  if (!raw || raw.length < 2) return null;

  let best = null;
  for (const item of SUPPORT_KNOWLEDGE) {
    const score = scoreKnowledgeItem(raw, item);
    if (!best || score > best.score) best = { item, score };
  }

  return best?.score > 0 ? { ...best.item, score: best.score } : null;
}

export function scoreSupportArticle(question, article) {
  return scoreKnowledgeItem(question, {
    title: article.Title,
    keywords: article.Keywords ?? [],
    answer: `${article.Question ?? ""} ${article.Answer ?? ""}`
  });
}

export function normalizeSupportText(text) {
  return String(text ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalize(text) {
  return normalizeSupportText(text);
}

function tokens(text) {
  return normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreKnowledgeItem(question, item) {
  const q = normalize(question);
  const qTokens = new Set(tokens(question));
  let score = 0;

  for (const keyword of item.keywords ?? []) {
    const k = normalize(keyword);
    if (!k) continue;
    const kTokens = tokens(keyword);
    if (kTokens.length <= 1 && k.length <= 3) {
      // Keyword đơn ngắn (xe, kho…) — nhiều câu hỏi có sẵn từ này không liên quan,
      // chấm điểm nhỏ để tránh false-positive.
      if (qTokens.has(k)) score += 1;
    } else if (q.includes(k)) {
      score += Math.max(4, kTokens.length * 2);
    }
  }

  for (const token of tokens(item.title ?? "")) {
    if (qTokens.has(token)) score += 1;
  }
  for (const token of tokens(item.answer ?? "")) {
    if (token.length > 3 && qTokens.has(token)) score += 0.25;
  }

  return score;
}
