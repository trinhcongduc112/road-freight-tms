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
import { useAuthStore } from "../../store/authStore";
import { Permissions, usePermissions } from "../../utils/permissions";

const { Text } = Typography;

const APPROVAL_STATUS = {
  PENDING:   { color: "#fa8c16", bg: "#fff7e6", label: "Chờ duyệt" },
  APPROVED:  { color: "#52c41a", bg: "#f6ffed", label: "Đã duyệt" },
  REJECTED:  { color: "#ff4d4f", bg: "#fff1f0", label: "Từ chối" },
  PLANNING:  { color: "#1677ff", bg: "#e6f4ff", label: "Lên kế hoạch" },
  COMPLETED: { color: "#13c2c2", bg: "#e6fffb", label: "Hoàn thành" }
};

function DemoSetupCard() {
  const { modal, message } = App.useApp();
  const { isSuper, isAll } = usePermissions();
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
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product-categories"] });
    qc.invalidateQueries({ queryKey: ["vehicles"] });
    qc.invalidateQueries({ queryKey: ["services"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  async function handleSeed() {
    modal.confirm({
      title: "Tải dữ liệu mẫu vào tổ chức của bạn?",
      content: (
        <div>
          <p>Sẽ thêm vào tổ chức hiện tại các bản ghi <code>DEMO-*</code>:</p>
          <ul style={{ marginBottom: 0 }}>
            <li>3 nhóm SP · 8 sản phẩm · 3 xe tải · 2 dịch vụ 3PL</li>
            <li>12 khách hàng Hà Nội · Bắc Ninh · Hưng Yên (tọa độ thật)</li>
            <li>20 đơn hàng PENDING — sẵn sàng lập lộ trình</li>
          </ul>
          <p style={{ marginTop: 8, color: "#64748b" }}>Tất cả đều có prefix <code>DEMO-</code> để xóa lại dễ dàng.</p>
        </div>
      ),
      okText: "Tải dữ liệu mẫu",
      okType: "primary",
      cancelText: "Hủy",
      onOk: async () => {
        setSeeding(true);
        const key = "seed-demo";
        message.loading({ content: "Đang tải dữ liệu mẫu vào tổ chức...", key, duration: 0 });
        try {
          const res = await demoApi.seed();
          const { org, counts: c } = res.data ?? {};
          message.success({ content: "Đã tải xong dữ liệu mẫu!", key, duration: 2.5 });
          refreshAll();
          modal.success({
            title: "Đã thêm dữ liệu mẫu!",
            width: 480,
            content: (
              <div>
                <p>Tổ chức: <Tag color="blue">{org?.XCode}</Tag> {org?.XName}</p>
                <p>Đã thêm:</p>
                <ul>
                  <li>{c?.categories} nhóm SP · {c?.products} sản phẩm</li>
                  <li>{c?.vehicles} xe · {c?.services} dịch vụ 3PL</li>
                  <li>{c?.customers} khách hàng · {c?.orders} đơn hàng</li>
                </ul>
                <p style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                  Vào <b>Lập kế hoạch</b> để test tối ưu lộ trình ngay.
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
      title: "Xóa toàn bộ dữ liệu demo?",
      content: "Sẽ xóa tất cả bản ghi có prefix DEMO- (khách hàng, sản phẩm, xe, đơn hàng, ...) khỏi tổ chức của bạn. Dữ liệu thật KHÔNG bị ảnh hưởng. Không thể hoàn tác.",
      okText: "Xóa dữ liệu demo",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        setClearing(true);
        const key = "clear-demo";
        message.loading({ content: "Đang xóa dữ liệu demo...", key, duration: 0 });
        try {
          await demoApi.clear();
          message.success({ content: "Đã xóa toàn bộ dữ liệu demo", key, duration: 2.5 });
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
              Dữ liệu mẫu đã kích hoạt
              <span className="db-demo-pill">DEMO-*</span>
            </div>
            <div className="db-demo-desc">
              Trong tổ chức hiện có:{" "}
              <b>{counts.customers ?? 0} khách hàng</b> ·{" "}
              <b>{counts.products ?? 0} sản phẩm</b> ·{" "}
              <b>{counts.vehicles ?? 0} xe</b> ·{" "}
              <b>{counts.orders ?? 0} đơn hàng</b>{" "}
              · <b>{counts.categories ?? 0} nhóm SP</b>{" "}
              · <b>{counts.services ?? 0} dịch vụ 3PL</b>.
            </div>
          </>
        ) : (
          <>
            <div className="db-demo-title">Bắt đầu nhanh với dữ liệu mẫu</div>
            <div className="db-demo-desc">
              Thêm vào tổ chức của bạn: <b>12 khách hàng</b> Hà Nội · Bắc Ninh · Hưng Yên, <b>3 xe tải</b>, <b>8 sản phẩm</b>, <b>20 đơn hàng</b> — đều có prefix <code>DEMO-</code> để xóa lại dễ dàng.
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
          {isActive ? "Tải lại" : "Tải dữ liệu mẫu"}
        </Button>
        {isActive && (
          <Button
            icon={<DeleteOutlined />}
            onClick={handleClear}
            loading={clearing}
            className="db-demo-btn-clear"
          >
            Xóa demo
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
          Truy cập <RightOutlined style={{ fontSize: 10 }} />
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
  const greeting = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const displayName = user?.FullName || user?.UserName || "bạn";

  const quickActions = [
    {
      key: "masterdata", icon: <ShoppingOutlined />, accent: "#f59e0b",
      title: "Master Data",   desc: "Khách hàng · Hàng hoá · Xe · Tài xế",
      perm: Permissions.CUSTOMER_MANAGE, path: "/master-data"
    },
    {
      key: "orders", icon: <FileTextOutlined />, accent: "#3b82f6",
      title: "Đơn hàng", desc: `${pendingOrders} đơn đang chờ phê duyệt`,
      perm: Permissions.ORDER_MANAGE, path: "/orders"
    },
    {
      key: "planning", icon: <EnvironmentOutlined />, accent: "#8b5cf6",
      title: "Lập kế hoạch", desc: "Phân tuyến & điều phối xe",
      perm: Permissions.ROUTE_PLAN_MANAGE, path: "/planning"
    },
    {
      key: "monitoring", icon: <TruckOutlined />, accent: "#06b6d4",
      title: "Giám sát", desc: "GPS realtime · Hành trình xe",
      perm: Permissions.TRIP_VIEW, path: "/monitoring"
    },
    {
      key: "user", icon: <UserAddOutlined />, accent: "#10b981",
      title: "Người dùng", desc: "Thêm & phân quyền nhân sự",
      perm: Permissions.USER_MANAGE, path: "/users"
    },
    {
      key: "org", icon: <ApartmentOutlined />, accent: "#0ea5e9",
      title: "Tổ chức", desc: "Cấu trúc công ty & chi nhánh",
      perm: Permissions.ORG_MANAGE, path: "/organizations"
    },
    {
      key: "role", icon: <IdcardOutlined />, accent: "#ec4899",
      title: "Nhóm vai trò", desc: "Phân quyền RBAC linh hoạt",
      perm: Permissions.ROLE_MANAGE, path: "/role-groups"
    },
    {
      key: "reports", icon: <TeamOutlined />, accent: "#7c3aed",
      title: "Báo cáo", desc: "Thống kê vận hành & doanh thu",
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
            Đây là tổng quan hoạt động vận tải hôm nay của bạn.
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
          label="Tổng đơn hàng"   value={ordersQ.isLoading   ? "…" : orders.length}
          sub={`${pendingOrders} chờ phê duyệt`} />
        <StatCard icon={<CarOutlined />}      accent="#10b981"
          label="Xe chờ điều phối"  value={vehiclesQ.isLoading  ? "…" : activeVehicles}
          sub={`${vehicles.length - activeVehicles} xe không khả dụng`} />
        <StatCard icon={<TeamOutlined />}     accent="#06b6d4"
          label="Tài khoản"       value={usersQ.isLoading     ? "…" : usersQ.data?.data?.length ?? 0}
          sub="Người dùng trong tổ chức" />
        <StatCard icon={<ApartmentOutlined />} accent="#8b5cf6"
          label="Tổ chức"         value={orgsQ.isLoading      ? "…" : orgsQ.data?.data?.length ?? 0}
          sub="Trong phạm vi truy cập" />
      </div>

      {/* ── Quick access ── */}
      <div className="db-section">
        <div className="db-section-hd">
          <span className="db-section-title">Truy cập nhanh</span>
          <span className="db-section-count">{quickActions.length} module khả dụng</span>
        </div>
        {quickActions.length === 0 ? (
          <div className="db-empty-perm">
            Tài khoản của bạn chưa được cấp quyền truy cập module nào. Liên hệ quản trị viên.
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
          <span className="db-section-title">Đơn hàng gần đây</span>
          <button className="db-link" onClick={() => navigate("/orders")}>
            Xem tất cả →
          </button>
        </div>
        <div className="db-table-wrap">
          {ordersQ.isLoading ? (
            <div className="db-panel-loading">Đang tải…</div>
          ) : recentOrders.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">Chưa có đơn hàng nào</Text>}
              style={{ padding: "28px 0" }} />
          ) : (
            <table className="db-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Tuyến</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => {
                  const s = APPROVAL_STATUS[o.ApprovalStatus] ?? APPROVAL_STATUS.PENDING;
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
                          ? new Date(o.CreatedAt).toLocaleDateString("vi-VN")
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
