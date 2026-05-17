// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  userGuide: [
    "intro",
    {
      type: "category",
      label: "Bắt đầu",
      collapsed: false,
      items: [
        "getting-started/dang-ky",
        "getting-started/dang-nhap",
        "getting-started/tao-to-chuc"
      ]
    },
    {
      type: "category",
      label: "Quản trị viên (IT Admin)",
      items: [
        "role-admin/quan-ly-to-chuc",
        "role-admin/nhom-vai-tro",
        "role-admin/quan-ly-nguoi-dung",
        "role-admin/nhat-ky-he-thong"
      ]
    },
    {
      type: "category",
      label: "Planner — Lập kế hoạch",
      items: [
        "role-planner/master-data",
        "role-planner/don-hang",
        "role-planner/lap-ke-hoach"
      ]
    },
    {
      type: "category",
      label: "Dispatcher — Điều phối",
      items: [
        "role-dispatcher/giam-sat-hanh-trinh",
        "role-dispatcher/xu-ly-su-co"
      ]
    },
    {
      type: "category",
      label: "Accountant — Kế toán",
      items: [
        "role-accountant/bao-cao",
        "role-accountant/bang-luong"
      ]
    },
    {
      type: "category",
      label: "Driver — App tài xế",
      items: [
        "role-driver/cai-dat-app",
        "role-driver/nhan-chuyen",
        "role-driver/giao-hang-pod",
        "role-driver/bao-duong-xe"
      ]
    },
    {
      type: "category",
      label: "Tính năng AI",
      items: [
        "ai-features/hoi-dap-chatbot",
        "ai-features/ai-agent"
      ]
    },
    "tracking-cong-khai",
    "faq"
  ]
};

export default sidebars;
