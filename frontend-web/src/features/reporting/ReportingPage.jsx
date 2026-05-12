import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
  IdcardOutlined,
  TeamOutlined,
  ThunderboltOutlined
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Card, Col, DatePicker, Progress, Row, Skeleton, Statistic, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import { reportApi } from "../../api/report";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const ORDER_STATUS_COLOR = {
  OPEN: "#1677ff",
  PICKED_PACKED: "#13c2c2",
  SHIPPED: "#fa8c16",
  DELIVERED: "#52c41a",
  CANCELLED: "#d9d9d9",
  REJECTED: "#ff4d4f"
};
const ORDER_STATUS_LABEL = {
  OPEN: "Mở", PICKED_PACKED: "Đã lấy hàng", SHIPPED: "Đang giao",
  DELIVERED: "Đã giao", CANCELLED: "Hủy", REJECTED: "Từ chối"
};
const PLANNING_STATUS_COLOR = {
  PENDING: "#8c8c8c", PLANNED: "#1677ff", LOCKED: "#fa8c16", FINALIZED: "#52c41a"
};

function StatKPI({ icon, color, label, value, suffix }) {
  return (
    <Card size="small" style={{ height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: color + "1a",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
          <span style={{ color, fontSize: 20 }}>{icon}</span>
        </div>
        <Statistic title={label} value={value} suffix={suffix} valueStyle={{ fontSize: 22, fontWeight: 700 }} />
      </div>
    </Card>
  );
}

export default function ReportingPage() {
  const [dateRange, setDateRange] = useState([dayjs().subtract(29, "days"), dayjs()]);

  const { data, isLoading } = useQuery({
    queryKey: ["report-summary", dateRange[0]?.toISOString(), dateRange[1]?.toISOString()],
    queryFn: () => {
      return reportApi.summary({
        startDate: dateRange[0].startOf("day").toISOString(),
        endDate: dateRange[1].endOf("day").toISOString()
      });
    },
    refetchInterval: 30_000
  });

  const d = data?.data;
  const orderTotal = d?.totals?.orders ?? 0;

  const orderStatusRows = d
    ? Object.entries(d.byOrderStatus)
        .map(([status, count]) => ({
          name: ORDER_STATUS_LABEL[status] ?? status,
          status,
          count
        }))
        .filter(r => r.count > 0)
    : [];

  const planningRows = d
    ? Object.entries(d.byPlanning).map(([status, count]) => ({ status, count }))
    : [];

  const approvalRows = d
    ? Object.entries(d.byApproval).map(([status, count]) => ({ status, count }))
    : [];

  const daily = d?.dailyOrders ?? [];

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="title">Báo cáo tổng quan</h2>
          <p className="subtitle">Thống kê đơn hàng, phê duyệt, lập kế hoạch và đội xe</p>
        </div>
        <div>
          <RangePicker 
            value={dateRange} 
            onChange={(dates) => { if (dates) setDateRange(dates); }} 
            allowClear={false}
          />
        </div>
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          {/* KPI strip */}
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            <Col xs={12} sm={6}>
              <StatKPI icon={<FileSearchOutlined />} color="#1677ff" label="Tổng đơn hàng" value={d?.totals?.orders ?? 0} />
            </Col>
            <Col xs={12} sm={6}>
              <StatKPI icon={<CarOutlined />} color="#fa8c16" label="Xe hoạt động" value={d?.totals?.vehicles ?? 0} />
            </Col>
            <Col xs={12} sm={6}>
              <StatKPI icon={<IdcardOutlined />} color="#13c2c2" label="Tài xế" value={d?.totals?.drivers ?? 0} />
            </Col>
            <Col xs={12} sm={6}>
              <StatKPI icon={<TeamOutlined />} color="#52c41a" label="Khách hàng" value={d?.totals?.customers ?? 0} />
            </Col>
          </Row>

          {/* Revenue */}
          <Card size="small" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <ThunderboltOutlined style={{ fontSize: 28, color: "#faad14" }} />
              <div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Doanh thu (đơn đã giao)</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#1677ff" }}>
                  {(d?.totals?.revenue ?? 0).toLocaleString("vi-VN")} ₫
                </div>
              </div>
            </div>
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {/* Order status Pie Chart */}
            <Col xs={24} md={8}>
              <Card title={<span style={{ fontWeight: 600 }}>Tỷ lệ trạng thái đơn hàng</span>} size="small" style={{ height: "100%", minHeight: 320 }}>
                {orderTotal > 0 ? (
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={orderStatusRows}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="count"
                        >
                          {orderStatusRows.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={ORDER_STATUS_COLOR[entry.status]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value) => [value, 'Số lượng']}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#999', paddingTop: 60 }}>Không có dữ liệu</div>
                )}
              </Card>
            </Col>

            {/* Approval status */}
            <Col xs={24} md={8}>
              <Card title={<span style={{ fontWeight: 600 }}>Phê duyệt</span>} size="small" style={{ height: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
                  {approvalRows.map(({ status, count }) => {
                    const pct = orderTotal ? Math.round(count / orderTotal * 100) : 0;
                    const color = status === "APPROVED" ? "#52c41a" : status === "REJECTED" ? "#ff4d4f" : "#faad14";
                    const label = status === "APPROVED" ? "Đã duyệt" : status === "REJECTED" ? "Từ chối" : "Chờ duyệt";
                    const icon = status === "APPROVED" ? <CheckCircleOutlined /> : status === "REJECTED" ? <CloseCircleOutlined /> : <ClockCircleOutlined />;
                    return (
                      <div key={status}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text style={{ color, fontSize: 13 }}>{icon} {label}</Text>
                          <Text strong>{count} <Text type="secondary" style={{ fontSize: 11 }}>({pct}%)</Text></Text>
                        </div>
                        <Progress percent={pct} strokeColor={color} showInfo={false} size="small" />
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Col>

            {/* Planning status */}
            <Col xs={24} md={8}>
              <Card title={<span style={{ fontWeight: 600 }}>Trạng thái lập kế hoạch</span>} size="small" style={{ height: "100%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
                  {planningRows.map(({ status, count }) => {
                    const pct = orderTotal ? Math.round(count / orderTotal * 100) : 0;
                    const color = PLANNING_STATUS_COLOR[status] ?? "#d9d9d9";
                    return (
                      <div key={status}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <Tag color={color} style={{ margin: 0 }}>{status}</Tag>
                          <Text strong>{count} <Text type="secondary" style={{ fontSize: 11 }}>({pct}%)</Text></Text>
                        </div>
                        <Progress percent={pct} strokeColor={color} showInfo={false} size="small" />
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Daily order volume Bar Chart */}
          <Card title={<span style={{ fontWeight: 600 }}>Đơn hàng mới theo ngày</span>} size="small">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => dayjs(val).format('DD/MM')} 
                    tick={{ fontSize: 12 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fontSize: 12 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <RechartsTooltip 
                    labelFormatter={(val) => dayjs(val).format('DD/MM/YYYY')}
                    formatter={(value) => [value, 'Số đơn hàng']}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="count" fill="#1677ff" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
