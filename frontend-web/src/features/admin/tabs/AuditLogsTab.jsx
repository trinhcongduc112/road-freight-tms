import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Table,
  Tag,
  DatePicker,
  Select,
  Space,
  Statistic,
  Row,
  Col,
  Tooltip,
  Typography
} from "antd";
import { ReloadOutlined, AuditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { auditApi } from "../../../api/audit";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const ACTION_COLORS = {
  CREATE: "green",
  UPDATE: "blue",
  DELETE: "red",
  LOGIN: "purple",
  LOGOUT: "default",
  EXPORT: "orange",
  IMPORT: "cyan",
  CREATE_PLAN: "green",
  DELETE_PLAN: "red",
  ADD_ROUTE: "geekblue",
  REMOVE_ROUTE: "volcano",
  ADD_ORDER: "cyan",
  REMOVE_ORDER: "magenta",
  FINALIZE: "gold",
  LOCK: "orange",
  UNLOCK: "lime",
  OPTIMIZE: "blue",
  DISPATCH: "purple",
  ASSIGN: "processing",
  MOVE_ORDER: "blue"
};

const ACTION_OPTIONS = [
  "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "IMPORT",
  "CREATE_PLAN", "DELETE_PLAN", "ADD_ROUTE", "REMOVE_ROUTE", "ADD_ORDER", "REMOVE_ORDER",
  "OPTIMIZE", "DISPATCH", "ASSIGN", "MOVE_ORDER", "LOCK", "UNLOCK", "FINALIZE"
];

export default function AuditLogsTab() {
  const [action, setAction] = useState();
  const [resource, setResource] = useState();
  // Mặc định = hôm nay (00:00 → 23:59:59). User có thể đổi để xem lịch sử.
  const [dateRange, setDateRange] = useState(() => [
    dayjs().startOf("day"),
    dayjs().endOf("day")
  ]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const filters = {
    page,
    limit,
    ...(action && { action }),
    ...(resource && { resource }),
    ...(dateRange?.[0] && { from: dateRange[0].toISOString() }),
    ...(dateRange?.[1] && { to: dateRange[1].toISOString() })
  };

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => auditApi.list(filters)
  });

  const { data: summary } = useQuery({
    queryKey: ["audit-summary"],
    queryFn: () => auditApi.summary(),
    refetchInterval: 30000
  });

  const columns = [
    {
      title: "Thời gian",
      dataIndex: "CreatedAt",
      width: 160,
      render: (v) => new Date(v).toLocaleString("vi-VN")
    },
    {
      title: "Hành động",
      dataIndex: "Action",
      width: 100,
      render: (v) => <Tag color={ACTION_COLORS[v] ?? "default"}>{v}</Tag>
    },
    {
      title: "Đối tượng",
      dataIndex: "Resource",
      width: 140
    },
    {
      title: "Người thực hiện",
      width: 200,
      render: (_, r) => (
        <div>
          <div>{r.UserName || "—"}</div>
          <div style={{ fontSize: 11, color: "#999" }}>{r.UserEmail}</div>
        </div>
      )
    },
    {
      title: "Endpoint",
      width: 280,
      render: (_, r) => (
        <Tooltip title={r.Path}>
          <Text code style={{ fontSize: 11 }}>{r.Method} {r.Path?.slice(0, 40)}{r.Path?.length > 40 ? "…" : ""}</Text>
        </Tooltip>
      )
    },
    {
      title: "HTTP",
      dataIndex: "StatusCode",
      width: 70,
      render: (v) => (
        <Tag color={v >= 200 && v < 300 ? "green" : v >= 400 ? "red" : "default"}>{v}</Tag>
      )
    },
    {
      title: "Thay đổi",
      dataIndex: "Changes",
      render: (v) => v ? (
        <Tooltip title={<pre style={{ maxWidth: 400, whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(v, null, 2)}</pre>}>
          <Text style={{ fontSize: 11, color: "#666", maxWidth: 180, display: "inline-block" }} ellipsis>
            {JSON.stringify(v).slice(0, 60)}...
          </Text>
        </Tooltip>
      ) : <Text type="secondary">—</Text>
    },
    {
      title: "Latency",
      dataIndex: "DurationMs",
      width: 90,
      render: (v) => v ? `${v}ms` : "—"
    },
    {
      title: "IP",
      dataIndex: "IP",
      width: 120,
      render: (v) => <Text style={{ fontSize: 11 }}>{v}</Text>
    }
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Hoạt động 24h qua"
              value={summary?.total ?? 0}
              prefix={<AuditOutlined />}
            />
          </Card>
        </Col>
        <Col span={18}>
          <Card size="small" title="Phân bố theo hành động" style={{ height: "100%" }} bodyStyle={{ padding: "8px 16px" }}>
            {(summary?.byAction ?? []).length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>
                Chưa có hoạt động trong 24h qua. Thực hiện thao tác bất kỳ (tạo/sửa/xoá đơn, tải báo cáo...) → log sẽ xuất hiện ở đây.
              </Text>
            ) : (
              <Space wrap>
                {summary.byAction.map((a) => (
                  <Tag key={a._id} color={ACTION_COLORS[a._id]} style={{ fontSize: 13, padding: "4px 8px" }}>
                    {a._id}: <b>{a.count}</b>
                  </Tag>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="Nhật ký kiểm toán (Audit Log)"
        extra={
          <Space>
            <Select
              placeholder="Hành động"
              allowClear
              style={{ width: 140 }}
              value={action}
              onChange={setAction}
              options={ACTION_OPTIONS.map((v) => ({ value: v, label: v }))}
            />
            <Select
              placeholder="Đối tượng"
              allowClear
              style={{ width: 160 }}
              value={resource}
              onChange={setResource}
              options={["Order", "Trip", "RoutePlan", "User", "Auth", "MasterData", "Report"].map((v) => ({ value: v, label: v }))}
            />
            <RangePicker showTime value={dateRange} onChange={setDateRange} />
            <Tooltip title="Làm mới">
              <ReloadOutlined onClick={() => refetch()} style={{ cursor: "pointer" }} />
            </Tooltip>
          </Space>
        }
      >
        <Table
          loading={isLoading}
          rowKey="_id"
          size="small"
          columns={columns}
          dataSource={logsData?.items ?? []}
          pagination={{
            current: page,
            pageSize: limit,
            total: logsData?.total ?? 0,
            onChange: (p, ps) => { setPage(p); setLimit(ps); },
            showSizeChanger: true,
            showTotal: (t) => `Tổng ${t} bản ghi`
          }}
          scroll={{ x: 1400 }}
        />
      </Card>
    </div>
  );
}
