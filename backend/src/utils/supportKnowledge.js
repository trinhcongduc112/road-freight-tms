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
    title: "Báo cáo và chi phí",
    keywords: [
      "báo cáo", "bao cao", "report", "chi phí", "chi phi", "cost", "doanh thu"
    ],
    answer: "Vào Báo cáo để xem tổng quan vận hành và chi phí. Chi phí tuyến nội bộ tính theo FixedCost và CostPerKm của xe. Tuyến 3PL tính theo bảng giá dịch vụ."
  },
  {
    title: "Theo dõi hành trình",
    keywords: [
      "giám sát", "giam sat", "monitoring", "live dispatch", "gps tài xế", "gps tai xe", "hành trình", "hanh trinh"
    ],
    answer: "Vào Giám sát để theo dõi tuyến đã chốt, timeline điểm giao và vị trí GPS tài xế. Màn hình tự cập nhật định kỳ để xem tiến độ giao hàng."
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
      if (qTokens.has(k)) score += 3;
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
