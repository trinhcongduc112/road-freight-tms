import {
  CarOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  IdcardOutlined,
  LineChartOutlined,
  TeamOutlined,
  ThunderboltOutlined
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, DatePicker, Progress, Row, Segmented, Skeleton, Statistic, Table, Tabs, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import * as XLSX from "xlsx";
import { reportApi } from "../../api/report";
import PayrollPanel from "./PayrollPanel";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const ORDER_STATUS_COLOR = {
  OPEN: "#1677ff",
  PICKED_PACKED: "#13c2c2",
  SHIPPED: "#fa8c16",
  DELIVERED: "#52c41a",
  CANCELLED: "#d9d9d9",
  REJECTED: "#ff4d4f"
};
const ORDER_STATUS_LABEL = {
  OPEN: "Mở",
  PICKED_PACKED: "Đã lấy hàng",
  SHIPPED: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Hủy",
  REJECTED: "Từ chối"
};
const PERIOD_OPTIONS = [
  { label: "Tuần", value: "week" },
  { label: "Tháng", value: "month" },
  { label: "Quý", value: "quarter" },
  { label: "Tùy chọn", value: "custom" }
];

function currency(value) {
  return `${Math.round(value ?? 0).toLocaleString("vi-VN")} đ`;
}

function number(value, digits = 0) {
  return Number(value ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function periodRange(type) {
  const now = dayjs();
  if (type === "week") return [now.startOf("week"), now.endOf("week")];
  if (type === "quarter") {
    const quarterStartMonth = Math.floor(now.month() / 3) * 3;
    const start = now.month(quarterStartMonth).startOf("month");
    return [start, start.add(2, "month").endOf("month")];
  }
  if (type === "month") return [now.startOf("month"), now.endOf("month")];
  return [now.subtract(29, "days").startOf("day"), now.endOf("day")];
}

function StatKPI({ icon, color, label, value, suffix }) {
  return (
    <Card size="small" style={{ height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          background: `${color}1a`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0
        }}>
          <span style={{ color, fontSize: 20 }}>{icon}</span>
        </div>
        <Statistic title={label} value={value} suffix={suffix} valueStyle={{ fontSize: 22, fontWeight: 700 }} />
      </div>
    </Card>
  );
}

function appendSheet(workbook, name, rows) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Không có dữ liệu": "" }]);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export default function ReportingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // AI Agent deep-link: ?period=month, ?dateFrom=…, ?dateTo=…, ?autoExport=1
  const initial = useMemo(() => {
    const VALID = ["week", "month", "quarter", "custom"];
    const qp = searchParams.get("period");
    const qFrom = searchParams.get("dateFrom");
    const qTo = searchParams.get("dateTo");
    if (qp && VALID.includes(qp)) {
      if (qp === "custom" && qFrom && qTo) {
        const a = dayjs(qFrom);
        const b = dayjs(qTo);
        if (a.isValid() && b.isValid()) return { period: "custom", range: [a.startOf("day"), b.endOf("day")] };
      }
      return { period: qp, range: periodRange(qp) };
    }
    return { period: "month", range: periodRange("month") };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [periodType, setPeriodType] = useState(initial.period);
  const [dateRange, setDateRange] = useState(initial.range);

  const { data, isLoading } = useQuery({
    queryKey: ["report-summary", periodType, dateRange[0]?.toISOString(), dateRange[1]?.toISOString()],
    queryFn: () => reportApi.summary({
      periodType,
      startDate: dateRange[0].startOf("day").toISOString(),
      endDate: dateRange[1].endOf("day").toISOString()
    }),
    refetchInterval: 30_000
  });

  const d = data?.data;
  const totals = d?.totals ?? {};
  const orderTotal = totals.orders ?? 0;
  const daily = d?.dailyOrders ?? [];
  const topCustomers = (d?.customerRows ?? []).slice(0, 8);

  const orderStatusRows = useMemo(() => {
    if (!d?.byOrderStatus) return [];
    return Object.entries(d.byOrderStatus)
      .map(([status, count]) => ({ name: ORDER_STATUS_LABEL[status] ?? status, status, count }))
      .filter((row) => row.count > 0);
  }, [d]);

  const exportReport = () => {
    if (!d) return;
    const workbook = XLSX.utils.book_new();
    const start = dateRange[0].format("DD/MM/YYYY");
    const end = dateRange[1].format("DD/MM/YYYY");

    appendSheet(workbook, "Tong quan", [
      { "Chỉ tiêu": "Kỳ báo cáo", "Giá trị": `${start} - ${end}` },
      { "Chỉ tiêu": "Tổng đơn", "Giá trị": totals.orders ?? 0 },
      { "Chỉ tiêu": "Đơn đã giao", "Giá trị": totals.deliveredOrders ?? 0 },
      { "Chỉ tiêu": "Tỷ lệ giao thành công", "Giá trị": `${totals.deliveryRate ?? 0}%` },
      { "Chỉ tiêu": "Tỷ lệ phê duyệt", "Giá trị": `${totals.approvalRate ?? 0}%` },
      { "Chỉ tiêu": "Tỷ lệ đã lập kế hoạch", "Giá trị": `${totals.planningRate ?? 0}%` },
      { "Chỉ tiêu": "Tiền hàng", "Giá trị": totals.goodsAmount ?? 0 },
      { "Chỉ tiêu": "Tiền xe / dịch vụ đơn hàng", "Giá trị": totals.serviceAmount ?? 0 },
      { "Chỉ tiêu": "Tổng giá trị đơn hàng", "Giá trị": totals.totalOrderValue ?? 0 },
      { "Chỉ tiêu": "Doanh thu đã giao", "Giá trị": totals.revenue ?? 0 },
      { "Chỉ tiêu": "Chi phí vận tải ước tính", "Giá trị": totals.estimatedCost ?? 0 },
      { "Chỉ tiêu": "Lãi gộp vận tải", "Giá trị": totals.grossProfit ?? 0 },
      { "Chỉ tiêu": "Số chuyến xe", "Giá trị": totals.trips ?? 0 }
    ]);
    appendSheet(workbook, "Don hang", (d.orderRows ?? []).map((row) => ({
      "Mã đơn": row.orderCode,
      "Ngày đặt": row.orderDate,
      "Mã KH": row.customerCode,
      "Tên khách hàng": row.customerName,
      "Nhóm KH": row.customerGroup,
      "Sản phẩm": row.products,
      "Hạng mục": row.categories,
      "Trạng thái": row.status,
      "Phê duyệt": row.approvalStatus,
      "Kế hoạch": row.planningStatus,
      "Kg": row.totalWeight,
      "m3": row.totalVolume,
      "Tổng tiền": row.totalPrice,
      "Tiền dịch vụ": row.servicePrice,
      "Đã thu": row.collected
    })));
    appendSheet(workbook, "Chuyen xe", (d.tripRows ?? []).map((row) => ({
      "Mã chuyến": row.tripCode,
      "Ngày chạy": row.planDate,
      "Xe": row.vehicleCode,
      "Tài xế": row.driverName,
      "Loại dịch vụ": row.serviceType,
      "Dịch vụ 3PL": row.serviceName,
      "Trạng thái": row.status,
      "Giờ đi": row.plannedStartTime,
      "Giờ về": row.plannedReturnTime,
      "Số điểm": row.stops,
      "Hoàn thành": row.completedStops,
      "Thất bại": row.failedStops,
      "Km": row.distanceKm,
      "Kg": row.weightKg,
      "Chi phí": row.estimatedCost,
      "COD đã thu": row.codCollected
    })));
    appendSheet(workbook, "Khach hang", (d.customerRows ?? []).map((row) => ({
      "Mã KH": row.customerCode,
      "Tên khách hàng": row.customerName,
      "Nhóm KH": row.customerGroup,
      "Số đơn": row.orders,
      "Đã giao": row.delivered,
      "Doanh thu": row.revenue,
      "Kg": row.weight,
      "m3": row.volume
    })));
    appendSheet(workbook, "Xe tai", (d.vehicleRows ?? []).map((row) => ({
      "Xe": row.vehicleCode,
      "Số chuyến": row.trips,
      "Số điểm": row.stops,
      "Hoàn thành": row.completedStops,
      "Thất bại": row.failedStops,
      "Km": row.distanceKm,
      "Kg": row.weightKg,
      "Chi phí": row.estimatedCost
    })));
    appendSheet(workbook, "Theo ngay", daily.map((row) => ({
      "Ngày": row.date,
      "Số đơn": row.count,
      "Đã giao": row.delivered,
      "Doanh thu": row.revenue,
      "Chi phí": row.cost,
      "Lãi gộp": row.grossProfit
    })));
    XLSX.writeFile(workbook, `bao_cao_${periodType}_${dateRange[0].format("YYYYMMDD")}_${dateRange[1].format("YYYYMMDD")}.xlsx`);
  };

  // Sync periodType/dateRange từ URL khi AI Agent navigate vào /reports với
  // ?period=... — useState initial value chỉ chạy 1 lần lúc mount, nên nếu
  // ReportingPage đã mounted sẵn, state phải được cập nhật qua effect này.
  useEffect(() => {
    const VALID = ["week", "month", "quarter", "custom"];
    const qp = searchParams.get("period");
    if (!qp || !VALID.includes(qp)) return;
    if (qp === "custom") {
      const a = dayjs(searchParams.get("dateFrom"));
      const b = dayjs(searchParams.get("dateTo"));
      if (a.isValid() && b.isValid()) {
        setPeriodType("custom");
        setDateRange([a.startOf("day"), b.endOf("day")]);
      }
      return;
    }
    setPeriodType(qp);
    setDateRange(periodRange(qp));
  }, [searchParams]);

  // Auto-export khi AI Agent navigate với ?autoExport=1.
  // Đọc trực tiếp searchParams (không cache vào ref) để hoạt động kể cả khi
  // user đã ở sẵn trang /reports — vì useRef initial chỉ chạy 1 lần lúc mount.
  // Sau khi fire, setSearchParams xoá autoExport → effect re-run nhưng điều
  // kiện đã false nên không double-fire.
  useEffect(() => {
    if (searchParams.get("autoExport") !== "1" || !d) return;
    exportReport();
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("autoExport");
      next.delete("period");
      next.delete("dateFrom");
      next.delete("dateTo");
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, searchParams]);

  const selectPeriod = (value) => {
    setPeriodType(value);
    if (value !== "custom") setDateRange(periodRange(value));
  };

  const reportContent = (
    <>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <h2 className="title">Báo cáo kế toán vận tải</h2>
          <p className="subtitle">Lập báo cáo tuần, tháng, quý và xuất Excel số liệu chi tiết</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Segmented options={PERIOD_OPTIONS} value={periodType} onChange={selectPeriod} />
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates) {
                setPeriodType("custom");
                setDateRange(dates);
              }
            }}
            allowClear={false}
          />
          <Button type="primary" icon={<DownloadOutlined />} onClick={exportReport} disabled={!d}>
            Xuất Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}>
              <StatKPI icon={<FileSearchOutlined />} color="#1677ff" label="Tổng đơn" value={totals.orders ?? 0} />
            </Col>
            <Col xs={12} md={6}>
              <StatKPI icon={<CheckCircleOutlined />} color="#52c41a" label="Đã giao" value={totals.deliveredOrders ?? 0} suffix={`(${totals.deliveryRate ?? 0}%)`} />
            </Col>
            <Col xs={12} md={6}>
              <StatKPI icon={<CarOutlined />} color="#fa8c16" label="Chuyến xe" value={totals.trips ?? 0} />
            </Col>
            <Col xs={12} md={6}>
              <StatKPI icon={<TeamOutlined />} color="#13c2c2" label="Khách hàng" value={totals.customers ?? 0} />
            </Col>
          </Row>

          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={8}>
              <Card size="small">
                <Statistic title="Tiền hàng" value={totals.goodsAmount ?? 0} formatter={currency} valueStyle={{ color: "#1677ff", fontWeight: 700 }} prefix={<ThunderboltOutlined />} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small">
                <Statistic title="Tiền xe / dịch vụ đơn hàng" value={totals.serviceAmount ?? 0} formatter={currency} valueStyle={{ color: "#fa8c16", fontWeight: 700 }} prefix={<CarOutlined />} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small">
                <Statistic title="Tổng giá trị đơn hàng" value={totals.totalOrderValue ?? 0} formatter={currency} valueStyle={{ color: "#52c41a", fontWeight: 700 }} prefix={<LineChartOutlined />} />
              </Card>
            </Col>
          </Row>

          <Card title="Báo cáo chi tiết" size="small" style={{ marginBottom: 16 }}>
            <Table
              size="small"
              rowKey="label"
              pagination={false}
              dataSource={[
                { label: "Số đơn hàng", value: number(totals.orders), note: `${number(totals.deliveredOrders)} đơn đã giao` },
                { label: "Tổng giá trị tiền", value: currency(totals.totalOrderValue), note: "Tiền hàng + tiền xe/dịch vụ trên đơn" },
                { label: "Tiền hàng", value: currency(totals.goodsAmount), note: "Tổng tiền sản phẩm trong đơn" },
                { label: "Tiền xe / dịch vụ đơn hàng", value: currency(totals.serviceAmount), note: "Phí vận chuyển/dịch vụ tính trên đơn" },
                { label: "Chi phí vận tải ước tính", value: currency(totals.estimatedCost), note: "Tổng chi phí chuyến xe (nội bộ + 3PL)" },
                { label: "  • Chuyến xe nội bộ", value: currency(totals.inHouseTripCost), note: `${number(totals.inHouseTripCount ?? 0)} chuyến · lương TX + nhiên liệu + xe` },
                { label: "  • Chuyến 3PL (thuê ngoài)", value: currency(totals.outsourcedTripCost), note: `${number(totals.outsourcedTripCount ?? 0)} chuyến · phí dịch vụ trả hãng vận chuyển` },
                { label: "Doanh thu đã giao", value: currency(totals.revenue), note: "Chỉ tính đơn DELIVERED" },
                { label: "Lãi gộp vận tải", value: currency(totals.grossProfit), note: "Doanh thu đã giao - chi phí vận tải" }
              ]}
              columns={[
                { title: "Chỉ tiêu", dataIndex: "label", render: (v) => <Text strong>{v}</Text> },
                { title: "Số liệu", dataIndex: "value", align: "right", render: (v) => <Text strong>{v}</Text> },
                { title: "Ghi chú", dataIndex: "note", render: (v) => <Text type="secondary">{v}</Text> }
              ]}
            />
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={15}>
              <Card title="Doanh thu - chi phí theo ngày" size="small" style={{ height: "100%" }}>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={daily} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(val) => dayjs(val).format("DD/MM")} tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(val) => `${Math.round(val / 1000000)}tr`} tick={{ fontSize: 12 }} />
                      <RechartsTooltip labelFormatter={(val) => dayjs(val).format("DD/MM/YYYY")} formatter={(value, name) => [currency(value), name]} />
                      <Legend />
                      <Bar name="Doanh thu" dataKey="revenue" fill="#1677ff" radius={[4, 4, 0, 0]} />
                      <Bar name="Chi phí" dataKey="cost" fill="#fa8c16" radius={[4, 4, 0, 0]} />
                      <Bar name="Lãi gộp" dataKey="grossProfit" fill="#52c41a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={9}>
              <Card title="Trạng thái đơn hàng" size="small" style={{ height: "100%" }}>
                {orderTotal > 0 ? (
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={orderStatusRows} cx="50%" cy="48%" innerRadius={62} outerRadius={88} paddingAngle={4} dataKey="count">
                          {orderStatusRows.map((entry) => (
                            <Cell key={entry.status} fill={ORDER_STATUS_COLOR[entry.status]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => [value, "Số đơn"]} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: "#999", paddingTop: 90 }}>Không có dữ liệu</div>
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} lg={12}>
              <Card title="Top khách hàng theo doanh thu" size="small">
                <Table
                  size="small"
                  rowKey="customerCode"
                  dataSource={topCustomers}
                  pagination={false}
                  columns={[
                    { title: "Khách hàng", dataIndex: "customerName", render: (v, r) => <><Text strong>{v || r.customerCode}</Text><br /><Text type="secondary">{r.customerCode}</Text></> },
                    { title: "Nhóm", dataIndex: "customerGroup", render: (v) => v ? <Tag>{v}</Tag> : "—" },
                    { title: "Đơn", dataIndex: "orders", align: "right" },
                    { title: "Doanh thu", dataIndex: "revenue", align: "right", render: currency }
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Tỷ lệ vận hành" size="small" style={{ height: "100%" }}>
                <div style={{ display: "grid", gap: 16, padding: 8 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><Text>Phê duyệt</Text><Text strong>{totals.approvalRate ?? 0}%</Text></div>
                    <Progress percent={totals.approvalRate ?? 0} strokeColor="#52c41a" />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><Text>Đã lập kế hoạch</Text><Text strong>{totals.planningRate ?? 0}%</Text></div>
                    <Progress percent={totals.planningRate ?? 0} strokeColor="#1677ff" />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><Text>Giao thành công</Text><Text strong>{totals.deliveryRate ?? 0}%</Text></div>
                    <Progress percent={totals.deliveryRate ?? 0} strokeColor="#13c2c2" />
                  </div>
                  <div style={{ display: "flex", gap: 24, color: "#64748b" }}>
                    <span><IdcardOutlined /> {number(totals.drivers)} tài xế</span>
                    <span><CarOutlined /> {number(totals.vehicles)} xe hoạt động</span>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiết chuyến xe" size="small">
            <Table
              size="small"
              rowKey="tripCode"
              dataSource={d?.tripRows ?? []}
              pagination={{ pageSize: 8 }}
              columns={[
                { title: "Mã chuyến", dataIndex: "tripCode", render: (v) => <Tag color="blue">{v}</Tag> },
                { title: "Ngày", dataIndex: "planDate", render: (v) => dayjs(v).format("DD/MM/YYYY") },
                { title: "Loại", dataIndex: "serviceType", width: 80, render: (v) => v === "3PL" ? <Tag color="orange">3PL</Tag> : <Tag color="blue">Nội bộ</Tag> },
                { title: "Xe", dataIndex: "vehicleCode" },
                { title: "Tài xế / dịch vụ", dataIndex: "driverName", render: (v, r) => v || r.serviceName || "—" },
                { title: "Trạng thái", dataIndex: "status", render: (v) => <Tag color={v === "COMPLETED" ? "green" : v === "CANCELLED" ? "red" : "blue"}>{v}</Tag> },
                { title: "Điểm", dataIndex: "stops", align: "right" },
                { title: "Km", dataIndex: "distanceKm", align: "right", render: (v) => number(v, 1) },
                { title: "Chi phí", dataIndex: "estimatedCost", align: "right", render: currency },
                { title: "COD", dataIndex: "codCollected", align: "right", render: currency }
              ]}
            />
          </Card>
        </>
      )}
    </>
  );

  const VALID_TABS = ["report", "payroll"];
  const urlTab = searchParams.get("tab");
  const activeTab = VALID_TABS.includes(urlTab) ? urlTab : "report";

  return (
    <Tabs
      activeKey={activeTab}
      onChange={(key) => setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", key);
        return next;
      }, { replace: true })}
      type="card"
      items={[
        { key: "report", label: "📊 Báo cáo vận tải", children: reportContent },
        { key: "payroll", label: "💰 Bảng lương tài xế", children: <PayrollPanel /> }
      ]}
    />
  );
}
