import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  LogoutOutlined,
  RadarChartOutlined,
  TruckFilled,
  UserOutlined
} from "@ant-design/icons";
import { Avatar, Badge, Dropdown, Layout, Menu } from "antd";
import { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { Permissions, usePermissions } from "../utils/permissions";

const { Sider, Header, Content } = Layout;

const pageTitles = {
  "/":            "Trang chủ",
  "/admin":       "Quản trị hệ thống",
  "/master-data": "Dữ liệu Master",
  "/orders":      "Đơn hàng",
  "/planning":    "Lập kế hoạch",
  "/monitoring":  "Giám sát hành trình",
  "/reports":     "Báo cáo"
};

export default function AppLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = useAuthStore((s) => s.user);
  const role      = useAuthStore((s) => s.role);
  const logout    = useAuthStore((s) => s.logout);
  const { can, canAny, isSuper } = usePermissions();

  const menuItems = useMemo(() => {
    const items = [
      { key: "/", icon: <DashboardOutlined />, label: "Trang chủ" }
    ];

    const canAdmin = isSuper || can("organization:create") || can("role_group:create") || can("user:create");
    if (canAdmin) {
      items.push({ key: "/admin", icon: <AppstoreOutlined />, label: "Quản trị" });
    }

    if (isSuper || canAny(Permissions.CUSTOMER_MANAGE, Permissions.PRODUCT_MANAGE, Permissions.VEHICLE_MANAGE, Permissions.DRIVER_MANAGE)) {
      items.push({ key: "/master-data", icon: <DatabaseOutlined />, label: "Master Data" });
    }
    if (isSuper || canAny(Permissions.ORDER_MANAGE)) {
      items.push({ key: "/orders", icon: <FileTextOutlined />, label: "Đơn hàng" });
    }
    if (isSuper || canAny(Permissions.ROUTE_PLAN_MANAGE, Permissions.ROUTE_PLAN_READ)) {
      items.push({ key: "/planning", icon: <CalendarOutlined />, label: "Lập kế hoạch" });
    }
    if (isSuper || canAny(Permissions.TRIP_READ, Permissions.ROUTE_PLAN_READ)) {
      items.push({ key: "/monitoring", icon: <RadarChartOutlined />, label: "Giám sát" });
    }
    if (isSuper || canAny(Permissions.REPORT_VIEW, Permissions.REPORT_EXPORT)) {
      items.push({ key: "/reports", icon: <BarChartOutlined />, label: "Báo cáo" });
    }

    return items;
  }, [can, canAny, isSuper]);

  const selectedKey = useMemo(() => {
    if (location.pathname === "/") return "/";
    const keys = menuItems
      .flatMap((g) => g.children ? g.children.map((c) => c.key) : [g.key])
      .filter((k) => k !== "/")
      .sort((a, b) => b.length - a.length);
    return keys.find((k) => location.pathname.startsWith(k)) || "/";
  }, [location.pathname, menuItems]);

  const pageTitle = pageTitles[selectedKey] ?? "Trang";

  const FUNCTION_ROLE_LABEL = {
    IT_ADMIN: "IT Admin", PLANNER: "Planner", DISPATCHER: "Dispatcher",
    PLANNER_DISPATCHER: "Planner & Dispatcher", ACCOUNTANT: "Kế toán", DRIVER: "Tài xế",
  };
  const roleLabel = user?.IsSuperAdmin
    ? "Super Admin"
    : role?.XName
      ?? (user?.FunctionRoles?.length
          ? user.FunctionRoles.map((r) => FUNCTION_ROLE_LABEL[r] ?? r).join(", ")
          : "—");

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: (
        <div style={{ minWidth: 200, padding: "2px 0" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1f36" }}>{user?.UserName}</div>
          <div style={{ color: "#8a94a6", fontSize: 12, marginTop: 1 }}>{user?.Email}</div>
        </div>
      ),
      disabled: true
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      danger: true,
      onClick: () => { logout(); navigate("/login", { replace: true }); }
    }
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={216} theme="light" className="app-sider" breakpoint="lg">
        <div className="logo-area">
          <span className="logo-mark"><TruckFilled /></span>
          <span className="logo-text">
            Road Freight
            <span>TMS Platform</span>
          </span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => { if (key.startsWith("/")) navigate(key); }}
        />
        <div className="sider-footer">
          © {new Date().getFullYear()} Road Freight TMS
        </div>
      </Sider>

      <Layout>
        <Header className="app-header">
          <span className="page-title">{pageTitle}</span>

          <div className="header-actions">
            <Badge dot color="#1a6ef5" offset={[-2, 2]}>
              <button className="icon-btn">
                <BellOutlined />
              </button>
            </Badge>

            <div className="divider-v" />

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={["click"]}>
              <div className="user-chip">
                <Avatar
                  size={32}
                  style={{
                    background: "linear-gradient(135deg, #1a6ef5, #60a5fa)",
                    fontSize: 13,
                    fontWeight: 600,
                    flexShrink: 0
                  }}
                >
                  {user?.UserName?.[0]?.toUpperCase()}
                </Avatar>
                <div className="user-info">
                  <span className="user-name">{user?.UserName}</span>
                  <span className="user-role-label">{roleLabel}</span>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
