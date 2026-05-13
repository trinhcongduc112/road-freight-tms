import {
  ApartmentOutlined,
  CarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  IdcardOutlined,
  ReloadOutlined,
  RightOutlined,
  ShoppingOutlined,
  TeamOutlined,
  TruckOutlined,
  UserAddOutlined
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Space, Tag, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { demoApi } from "../../api/demo";
import { orderApi } from "../../api/order";
import { vehicleApi } from "../../api/masterData";
import { organizationApi } from "../../api/organization";
import { userApi } from "../../api/user";
import { useLanguage } from "../../i18n.jsx";
import { useAuthStore } from "../../store/authStore";
import { Permissions, usePermissions } from "../../utils/permissions";

const { Text } = Typography;

function DemoSetupCard() {
  const { modal, message } = App.useApp();
  const { isSuper, isAll } = usePermissions();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [seeding, setSeeding]   = useState(false);
  const [clearing, setClearing] = useState(false);

  const statusQ = useQuery({
    queryKey: ["demo-status"],
    queryFn: () => demoApi.status().then((r) => r.data ?? r),
    enabled: isSuper || isAll,
    staleTime: 30_000
  });

  if (!isSuper && !isAll) return null;

  const status = statusQ.data;
  const isActive = !!status?.exists;
  const counts = status?.counts ?? {};

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["demo-status"] });
    qc.invalidateQueries({ queryKey: ["organizations"] });
    qc.invalidateQueries({ queryKey: ["role-groups"] });
    qc.invalidateQueries({ queryKey: ["users"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["customer-groups"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product-categories"] });
    qc.invalidateQueries({ queryKey: ["vehicles"] });
    qc.invalidateQueries({ queryKey: ["drivers"] });
    qc.invalidateQueries({ queryKey: ["services"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["route-plans"] });
  };

  async function handleSeed() {
    modal.confirm({
      title: t("dashboard.demo.confirmSeedTitle"),
      content: (
        <div>
          <p>{t("dashboard.demo.confirmSeedIntro")} <code>DEMO-*</code>:</p>
          <ul style={{ marginBottom: 0 }}>
            <li>{t("dashboard.demo.seedItems1")}</li>
            <li>{t("dashboard.demo.seedItems2")}</li>
            <li>{t("dashboard.demo.seedItems3")}</li>
          </ul>
          <p style={{ marginTop: 8, color: "#64748b" }}>{t("dashboard.demo.seedNote")}</p>
        </div>
      ),
      okText: t("dashboard.demo.seedOk"),
      okType: "primary",
      cancelText: t("dashboard.demo.cancel"),
      onOk: async () => {
        setSeeding(true);
        const key = "seed-demo";
        message.loading({ content: t("dashboard.demo.loadingSeed"), key, duration: 0 });
        try {
          const res = await demoApi.seed();
          const { org, counts: c } = res.data ?? {};
          message.success({ content: t("dashboard.demo.seedSuccess"), key, duration: 2.5 });
          refreshAll();
          modal.success({
            title: t("dashboard.demo.seedDoneTitle"),
            width: 480,
            content: (
              <div>
                <p>{t("dashboard.demo.organization")}: <Tag color="blue">{org?.XCode}</Tag> {org?.XName}</p>
                <p>{t("dashboard.demo.added")}</p>
                <ul>
                  <li>{t("dashboard.demo.addedCategories", { categories: c?.categories, products: c?.products })}</li>
                  <li>{t("dashboard.demo.addedVehicles", { vehicles: c?.vehicles, services: c?.services })}</li>
                  <li>{t("dashboard.demo.addedCustomers", { customers: c?.customers, orders: c?.orders })}</li>
                </ul>
                <p style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                  {t("dashboard.demo.planNote")}
                </p>
              </div>
            )
          });
        } catch (e) {
          message.error({ content: e.response?.data?.message || e.message, key, duration: 4 });
          throw e;
        } finally {
          setSeeding(false);
        }
      }
    });
  }

  async function handleClear() {
    modal.confirm({
      title: t("dashboard.demo.clearTitle"),
      content: t("dashboard.demo.clearContent"),
      okText: t("dashboard.demo.clearOk"),
      okType: "danger",
      cancelText: t("dashboard.demo.cancel"),
      onOk: async () => {
        setClearing(true);
        const key = "clear-demo";
        message.loading({ content: t("dashboard.demo.loadingClear"), key, duration: 0 });
        try {
          await demoApi.clear();
          message.success({ content: t("dashboard.demo.clearSuccess"), key, duration: 2.5 });
          refreshAll();
        } catch (e) {
          message.error({ content: e.response?.data?.message || e.message, key, duration: 4 });
          throw e;
        } finally {
          setClearing(false);
        }
      }
    });
  }

  return (
    <div className={`db-demo-banner${isActive ? " db-demo-banner--active" : ""}`}>
      <div className="db-demo-icon">{isActive ? <CheckCircleFilled /> : "🚀"}</div>
      <div className="db-demo-body">
        {isActive ? (
          <>
            <div className="db-demo-title">
              {t("dashboard.demo.activeTitle")}
              <span className="db-demo-pill">DEMO-*</span>
            </div>
            <div className="db-demo-desc">
              {t("dashboard.demo.activeDesc")}{" "}
              <b>{counts.customers ?? 0} {t("dashboard.unit.customers")}</b> ·{" "}
              <b>{counts.products ?? 0} {t("dashboard.unit.products")}</b> ·{" "}
              <b>{counts.vehicles ?? 0} {t("dashboard.unit.vehicles")}</b> ·{" "}
              <b>{counts.orders ?? 0} {t("dashboard.unit.orders")}</b>{" "}
              · <b>{counts.categories ?? 0} {t("dashboard.unit.categories")}</b>{" "}
              · <b>{counts.services ?? 0} {t("dashboard.unit.services")}</b>.
            </div>
          </>
        ) : (
          <>
            <div className="db-demo-title">{t("dashboard.demo.quickTitle")}</div>
            <div className="db-demo-desc">
              {t("dashboard.demo.quickDesc", { customers: 12, vehicles: 3, products: 8, orders: 20 })}
            </div>
          </>
        )}
      </div>
      <Space wrap>
        <Button
          icon={isActive ? <ReloadOutlined /> : <DatabaseOutlined />}
          onClick={handleSeed}
          loading={seeding}
          className="db-demo-btn-seed"
        >
          {isActive ? t("dashboard.demo.reload") : t("dashboard.demo.seedOk")}
        </Button>
        {isActive && (
          <Button
            icon={<DeleteOutlined />}
            onClick={handleClear}
            loading={clearing}
            className="db-demo-btn-clear"
          >
            {t("dashboard.demo.clear")}
          </Button>
        )}
      </Space>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <div className="db-stat">
      <div className="db-stat-icon" style={{ background: accent + "1a", color: accent }}>
        {icon}
      </div>
      <div className="db-stat-body">
        <div className="db-stat-value">{value}</div>
        <div className="db-stat-label">{label}</div>
        {sub && <div className="db-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function QuickCard({ icon, accent, title, desc, onClick, disabled }) {
  const { t } = useLanguage();

  return (
    <button
      className={`db-qcard2${disabled ? " db-qcard2--off" : ""}`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="db-qcard2-icon" style={{ background: accent + "18", color: accent }}>
        {icon}
      </div>
      <div className="db-qcard2-title">{title}</div>
      <div className="db-qcard2-desc">{desc}</div>
      {!disabled && (
        <div className="db-qcard2-cta" style={{ color: accent }}>
          {t("dashboard.quick.access")} <RightOutlined style={{ fontSize: 10 }} />
        </div>
      )}
    </button>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user  = useAuthStore((s) => s.user);
  const role  = useAuthStore((s) => s.role);
  const { can, isSuper } = usePermissions();
  const { language, t } = useLanguage();

  const approvalStatus = {
    PENDING:   { color: "#fa8c16", bg: "#fff7e6", label: t("dashboard.status.pending") },
    APPROVED:  { color: "#52c41a", bg: "#f6ffed", label: t("dashboard.status.approved") },
    REJECTED:  { color: "#ff4d4f", bg: "#fff1f0", label: t("dashboard.status.rejected") },
    PLANNING:  { color: "#1677ff", bg: "#e6f4ff", label: t("dashboard.status.planning") },
    COMPLETED: { color: "#13c2c2", bg: "#e6fffb", label: t("dashboard.status.completed") }
  };

  const orgsQ     = useQuery({ queryKey: ["organizations"],  queryFn: organizationApi.list });
  const usersQ    = useQuery({ queryKey: ["users"],          queryFn: () => userApi.list() });
  const ordersQ   = useQuery({ queryKey: ["orders"],         queryFn: () => orderApi.list() });
  const vehiclesQ = useQuery({ queryKey: ["vehicles"],       queryFn: () => vehicleApi.list() });

  const orders         = ordersQ.data?.data  ?? [];
  const vehicles       = vehiclesQ.data?.data ?? [];
  const pendingOrders  = orders.filter((o) => o.ApprovalStatus === "PENDING").length;
  const activeVehicles = vehicles.filter((v) => v.Status === "Active").length;
  const recentOrders   = [...orders]
    .sort((a, b) => new Date(b.CreatedAt ?? 0) - new Date(a.CreatedAt ?? 0))
    .slice(0, 6);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dashboard.greeting.morning") : hour < 18 ? t("dashboard.greeting.afternoon") : t("dashboard.greeting.evening");
  const displayName = user?.FullName || user?.UserName || t("dashboard.defaultName");

  const quickActions = [
    {
      key: "masterdata", icon: <ShoppingOutlined />, accent: "#f59e0b",
      title: "Master Data", desc: t("dashboard.quick.masterDesc"),
      perm: Permissions.CUSTOMER_MANAGE, path: "/master-data"
    },
    {
      key: "orders", icon: <FileTextOutlined />, accent: "#3b82f6",
      title: t("layout.nav.orders"), desc: t("dashboard.quick.ordersDesc", { count: pendingOrders }),
      perm: Permissions.ORDER_MANAGE, path: "/orders"
    },
    {
      key: "planning", icon: <EnvironmentOutlined />, accent: "#8b5cf6",
      title: t("layout.nav.planning"), desc: t("dashboard.quick.planningDesc"),
      perm: Permissions.ROUTE_PLAN_MANAGE, path: "/planning"
    },
    {
      key: "monitoring", icon: <TruckOutlined />, accent: "#06b6d4",
      title: t("layout.nav.monitoring"), desc: t("dashboard.quick.monitoringDesc"),
      perm: Permissions.TRIP_VIEW, path: "/monitoring"
    },
    {
      key: "user", icon: <UserAddOutlined />, accent: "#10b981",
      title: t("dashboard.quick.userTitle"), desc: t("dashboard.quick.userDesc"),
      perm: Permissions.USER_MANAGE, path: "/users"
    },
    {
      key: "org", icon: <ApartmentOutlined />, accent: "#0ea5e9",
      title: t("dashboard.quick.orgTitle"), desc: t("dashboard.quick.orgDesc"),
      perm: Permissions.ORG_MANAGE, path: "/organizations"
    },
    {
      key: "role", icon: <IdcardOutlined />, accent: "#ec4899",
      title: t("dashboard.quick.roleTitle"), desc: t("dashboard.quick.roleDesc"),
      perm: Permissions.ROLE_MANAGE, path: "/role-groups"
    },
    {
      key: "reports", icon: <TeamOutlined />, accent: "#7c3aed",
      title: t("layout.nav.reports"), desc: t("dashboard.quick.reportsDesc"),
      perm: Permissions.REPORT_VIEW, path: "/reports"
    }
  ].filter((a) => isSuper || can(a.perm));

  return (
    <div className="db-wrap">

      {/* ── Greeting ── */}
      <div className="db-greeting">
        <div className="db-greeting-left">
          <h2 className="db-greeting-title">
            {greeting}, <span className="db-greeting-name">{displayName}</span> 👋
          </h2>
          <p className="db-greeting-sub">
            {t("dashboard.summary")}
          </p>
        </div>
        <div className="db-greeting-badges">
          {role?.XName && (
            <Tag color={role.Kind === "admin" ? "red" : "blue"} style={{ margin: 0 }}>
              {role.XName}
            </Tag>
          )}
          {user?.IsSuperAdmin && <Tag color="gold" style={{ margin: 0 }}>SuperAdmin</Tag>}
        </div>
      </div>

      {/* ── Demo setup ── */}
      <DemoSetupCard />

      {/* ── Stats ── */}
      <div className="db-stats">
        <StatCard icon={<FileTextOutlined />} accent="#3b82f6"
          label={t("dashboard.stats.totalOrders")} value={ordersQ.isLoading ? "…" : orders.length}
          sub={t("dashboard.stats.pendingOrders", { count: pendingOrders })} />
        <StatCard icon={<CarOutlined />}      accent="#10b981"
          label={t("dashboard.stats.dispatchVehicles")} value={vehiclesQ.isLoading ? "…" : activeVehicles}
          sub={t("dashboard.stats.unavailableVehicles", { count: vehicles.length - activeVehicles })} />
        <StatCard icon={<TeamOutlined />}     accent="#06b6d4"
          label={t("dashboard.stats.accounts")} value={usersQ.isLoading ? "…" : usersQ.data?.data?.length ?? 0}
          sub={t("dashboard.stats.accountsSub")} />
        <StatCard icon={<ApartmentOutlined />} accent="#8b5cf6"
          label={t("dashboard.stats.organizations")} value={orgsQ.isLoading ? "…" : orgsQ.data?.data?.length ?? 0}
          sub={t("dashboard.stats.organizationsSub")} />
      </div>

      {/* ── Quick access ── */}
      <div className="db-section">
        <div className="db-section-hd">
          <span className="db-section-title">{t("dashboard.quick.title")}</span>
          <span className="db-section-count">{t("dashboard.quick.count", { count: quickActions.length })}</span>
        </div>
        {quickActions.length === 0 ? (
          <div className="db-empty-perm">
            {t("dashboard.quick.noPermission")}
          </div>
        ) : (
          <div className="db-qgrid2">
            {quickActions.map((a) => (
              <QuickCard key={a.key} {...a} onClick={() => navigate(a.path)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Recent orders ── */}
      <div className="db-section">
        <div className="db-section-hd">
          <span className="db-section-title">{t("dashboard.recent.title")}</span>
          <button className="db-link" onClick={() => navigate("/orders")}>
            {t("dashboard.recent.viewAll")}
          </button>
        </div>
        <div className="db-table-wrap">
          {ordersQ.isLoading ? (
            <div className="db-panel-loading">{t("dashboard.recent.loading")}</div>
          ) : recentOrders.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">{t("dashboard.recent.empty")}</Text>}
              style={{ padding: "28px 0" }} />
          ) : (
            <table className="db-table">
              <thead>
                <tr>
                  <th>{t("dashboard.table.code")}</th>
                  <th>{t("dashboard.table.customer")}</th>
                  <th>{t("dashboard.table.route")}</th>
                  <th>{t("dashboard.table.status")}</th>
                  <th>{t("dashboard.table.createdAt")}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => {
                  const s = approvalStatus[o.ApprovalStatus] ?? approvalStatus.PENDING;
                  return (
                    <tr key={o._id} className="db-table-row" onClick={() => navigate("/orders")}>
                      <td className="db-table-code">{o.XCode || o._id?.slice(-8)}</td>
                      <td className="db-table-cust">{o.CustomerCode || "—"}</td>
                      <td className="db-table-meta">
                        {o.DeliveryAddress
                          ? o.DeliveryAddress.slice(0, 28) + (o.DeliveryAddress.length > 28 ? "…" : "")
                          : "—"}
                      </td>
                      <td>
                        <span className="db-status-pill"
                          style={{ background: s.bg, color: s.color }}>
                          <ClockCircleOutlined style={{ fontSize: 10, marginRight: 3 }} />
                          {s.label}
                        </span>
                      </td>
                      <td className="db-table-date">
                        {o.CreatedAt
                          ? new Date(o.CreatedAt).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
