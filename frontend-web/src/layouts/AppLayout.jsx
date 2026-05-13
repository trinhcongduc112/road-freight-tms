import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  GlobalOutlined,
  LogoutOutlined,
  RadarChartOutlined,
  TruckFilled,
  UserOutlined
} from "@ant-design/icons";
import { Avatar, Badge, Dropdown, Layout, Menu } from "antd";
import { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { languages, useLanguage } from "../i18n.jsx";
import { useAuthStore } from "../store/authStore";
import { Permissions, usePermissions } from "../utils/permissions";

const { Sider, Header, Content } = Layout;

export default function AppLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = useAuthStore((s) => s.user);
  const role      = useAuthStore((s) => s.role);
  const logout    = useAuthStore((s) => s.logout);
  const { can, canAny, isSuper } = usePermissions();
  const { language, setLanguage, t } = useLanguage();

  const menuItems = useMemo(() => {
    const items = [
      { key: "/", icon: <DashboardOutlined />, label: t("layout.nav.dashboard") }
    ];

    const canAdmin = isSuper || can("organization:create") || can("role_group:create") || can("user:create");
    if (canAdmin) {
      items.push({ key: "/admin", icon: <AppstoreOutlined />, label: t("layout.nav.admin") });
    }

    if (isSuper || canAny(Permissions.CUSTOMER_MANAGE, Permissions.PRODUCT_MANAGE, Permissions.VEHICLE_MANAGE, Permissions.DRIVER_MANAGE)) {
      items.push({ key: "/master-data", icon: <DatabaseOutlined />, label: t("layout.nav.masterData") });
    }
    if (isSuper || canAny(Permissions.ORDER_MANAGE)) {
      items.push({ key: "/orders", icon: <FileTextOutlined />, label: t("layout.nav.orders") });
    }
    if (isSuper || canAny(Permissions.ROUTE_PLAN_MANAGE, Permissions.ROUTE_PLAN_READ)) {
      items.push({ key: "/planning", icon: <CalendarOutlined />, label: t("layout.nav.planning") });
    }
    if (isSuper || canAny(Permissions.TRIP_READ, Permissions.ROUTE_PLAN_READ)) {
      items.push({ key: "/monitoring", icon: <RadarChartOutlined />, label: t("layout.nav.monitoring") });
    }
    if (isSuper || canAny(Permissions.REPORT_VIEW, Permissions.REPORT_EXPORT)) {
      items.push({ key: "/reports", icon: <BarChartOutlined />, label: t("layout.nav.reports") });
    }

    return items;
  }, [can, canAny, isSuper, t]);

  const selectedKey = useMemo(() => {
    if (location.pathname === "/") return "/";
    const keys = menuItems
      .flatMap((g) => g.children ? g.children.map((c) => c.key) : [g.key])
      .filter((k) => k !== "/")
      .sort((a, b) => b.length - a.length);
    return keys.find((k) => location.pathname.startsWith(k)) || "/";
  }, [location.pathname, menuItems]);

  const pageTitles = {
    "/":            t("layout.title.dashboard"),
    "/admin":       t("layout.title.admin"),
    "/master-data": t("layout.title.masterData"),
    "/orders":      t("layout.title.orders"),
    "/planning":    t("layout.title.planning"),
    "/monitoring":  t("layout.title.monitoring"),
    "/reports":     t("layout.title.reports")
  };
  const pageTitle = pageTitles[selectedKey] ?? t("layout.title.default");

  const FUNCTION_ROLE_LABEL = {
    IT_ADMIN: "IT Admin", PLANNER: "Planner", DISPATCHER: "Dispatcher",
    PLANNER_DISPATCHER: "Planner & Dispatcher", ACCOUNTANT: t("layout.role.accountant"), DRIVER: t("layout.role.driver"),
  };
  const roleLabel = user?.IsSuperAdmin
    ? "Super Admin"
    : role?.XName
      ?? (user?.FunctionRoles?.length
          ? user.FunctionRoles.map((r) => FUNCTION_ROLE_LABEL[r] ?? r).join(", ")
          : t("common.unknown"));

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
      label: t("layout.user.logout"),
      danger: true,
      onClick: () => { logout(); navigate("/login", { replace: true }); }
    }
  ];
  const languageMenuItems = languages.map((item) => ({
    key: item.code,
    label: item.label,
    onClick: () => setLanguage(item.code)
  }));
  const currentLanguage = languages.find((item) => item.code === language) ?? languages[0];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider 
        width={216} 
        theme="light" 
        className="app-sider" 
        breakpoint="lg"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
        }}
      >
        <div className="logo-area">
          <span className="logo-mark"><TruckFilled /></span>
          <span className="logo-text">
            Road Freight
            <span>{t("layout.brand.platform")}</span>
          </span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => { if (key.startsWith("/")) navigate(key); }}
        />
        <div className="sider-footer">
          <Dropdown menu={{ items: languageMenuItems, selectedKeys: [language] }} placement="top" trigger={["click"]}>
            <button className="language-toggle" type="button" aria-label={t("common.language")}>
              <GlobalOutlined />
              <span>{currentLanguage.label}</span>
            </button>
          </Dropdown>
          <div>© {new Date().getFullYear()} Road Freight TMS</div>
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
