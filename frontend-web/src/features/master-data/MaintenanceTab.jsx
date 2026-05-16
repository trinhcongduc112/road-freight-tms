import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Row,
  Col,
  Tooltip,
  Typography
} from "antd";
import {
  PlusOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ToolOutlined,
  AlertOutlined,
  ReloadOutlined,
  PictureOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import { maintenanceApi } from "../../api/maintenance";
import { vehicleApi, driverApi } from "../../api/masterData";

const { Text } = Typography;

const TYPE_OPTIONS = [
  { value: "OIL_CHANGE", label: "🛢️ Thay dầu nhớt" },
  { value: "TIRE_ROTATION", label: "🛞 Đảo lốp" },
  { value: "BRAKE_CHECK", label: "🔧 Kiểm tra phanh" },
  { value: "GENERAL", label: "🔍 Bảo dưỡng tổng quát" },
  { value: "INSURANCE", label: "📄 Gia hạn bảo hiểm" },
  { value: "REGISTRATION", label: "🚗 Gia hạn đăng kiểm" },
  { value: "REPAIR", label: "⚙️ Sửa chữa đột xuất" },
  { value: "OTHER", label: "📌 Khác" }
];

const STATUS_COLORS = {
  SCHEDULED: "blue",
  ACKNOWLEDGED: "cyan",
  IN_PROGRESS: "orange",
  AWAITING_REVIEW: "gold",
  COMPLETED: "green",
  CANCELLED: "default"
};

const STATUS_LABELS = {
  SCHEDULED: "Chờ tài xế nhận",
  ACKNOWLEDGED: "TX đã nhận việc",
  IN_PROGRESS: "Đang thực hiện",
  AWAITING_REVIEW: "Chờ duyệt",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ"
};

export default function MaintenanceTab() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: listData, isLoading } = useQuery({
    queryKey: ["maintenance-list"],
    queryFn: () => maintenanceApi.list({ limit: 200 })
  });

  const { data: alertData } = useQuery({
    queryKey: ["maintenance-alerts"],
    queryFn: () => maintenanceApi.alerts(),
    refetchInterval: 60000
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ["vehicles-for-maintenance"],
    queryFn: () => vehicleApi.list({ limit: 500 })
  });

  const { data: driversData } = useQuery({
    queryKey: ["drivers-for-maintenance"],
    queryFn: () => driverApi.list({ limit: 500 })
  });

  const vehicles = vehiclesData?.data?.items ?? vehiclesData?.data ?? [];
  const drivers = driversData?.data?.items ?? driversData?.data ?? [];

  const createM = useMutation({
    mutationFn: (body) => maintenanceApi.create(body),
    onSuccess: () => {
      message.success("Đã tạo lịch bảo dưỡng");
      setOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ["maintenance-list"] });
      qc.invalidateQueries({ queryKey: ["maintenance-alerts"] });
    },
    onError: (e) => message.error(e.message)
  });

  const updateM = useMutation({
    mutationFn: ({ id, body }) => maintenanceApi.update(id, body),
    onSuccess: () => {
      message.success("Đã cập nhật");
      setOpen(false);
      setEditing(null);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ["maintenance-list"] });
      qc.invalidateQueries({ queryKey: ["maintenance-alerts"] });
    },
    onError: (e) => message.error(e.message)
  });

  const deleteM = useMutation({
    mutationFn: (id) => maintenanceApi.remove(id),
    onSuccess: () => {
      message.success("Đã xoá");
      qc.invalidateQueries({ queryKey: ["maintenance-list"] });
      qc.invalidateQueries({ queryKey: ["maintenance-alerts"] }); // fix: alert phải refresh
    }
  });

  const approveM = useMutation({
    mutationFn: (id) => maintenanceApi.update(id, { Status: "COMPLETED" }),
    onSuccess: () => {
      message.success("Đã duyệt hoàn thành");
      qc.invalidateQueries({ queryKey: ["maintenance-list"] });
      qc.invalidateQueries({ queryKey: ["maintenance-alerts"] });
    },
    onError: (e) => message.error(e.message)
  });

  const [reviewItem, setReviewItem] = useState(null); // doc đang review ảnh

  const onSubmit = (values) => {
    const body = {
      ...values,
      ScheduledDate: values.ScheduledDate?.toISOString(),
      NextServiceDate: values.NextServiceDate?.toISOString() || null,
      CompletedDate: values.CompletedDate?.toISOString() || null
    };
    if (editing) updateM.mutate({ id: editing._id, body });
    else createM.mutate(body);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ Status: "SCHEDULED", ScheduledDate: dayjs() });
    setOpen(true);
  };

  const openEdit = (rec) => {
    setEditing(rec);
    form.setFieldsValue({
      ...rec,
      ScheduledDate: rec.ScheduledDate ? dayjs(rec.ScheduledDate) : null,
      NextServiceDate: rec.NextServiceDate ? dayjs(rec.NextServiceDate) : null,
      CompletedDate: rec.CompletedDate ? dayjs(rec.CompletedDate) : null
    });
    setOpen(true);
  };

  const items = listData?.items ?? [];
  const summary = alertData?.summary;

  const columns = [
    { title: "Xe", dataIndex: "VehicleCode", width: 110, render: (v) => <Text strong>{v}</Text> },
    {
      title: "Loại",
      dataIndex: "Type",
      width: 180,
      render: (v) => TYPE_OPTIONS.find((t) => t.value === v)?.label ?? v
    },
    { title: "Tiêu đề", dataIndex: "Title" },
    {
      title: "Tài xế phụ trách",
      dataIndex: "DriverName",
      width: 200,
      render: (v, r) => {
        if (!v) return <Text type="secondary" style={{ fontStyle: "italic" }}>Chưa phân công</Text>;
        return (
          <div>
            <div><Text strong>{v}</Text> <Text type="secondary" style={{ fontSize: 11 }}>({r.DriverCode})</Text></div>
            {r.DriverCompletedAt && (
              <Tag color="gold" style={{ marginTop: 2, fontSize: 10 }}>
                TX xong {dayjs(r.DriverCompletedAt).format("DD/MM HH:mm")}
              </Tag>
            )}
            {!r.DriverCompletedAt && r.DriverAcknowledgedAt && (
              <Tag color="cyan" style={{ marginTop: 2, fontSize: 10 }}>
                Đã nhận {dayjs(r.DriverAcknowledgedAt).format("DD/MM HH:mm")}
              </Tag>
            )}
            {!r.DriverAcknowledgedAt && !r.DriverCompletedAt && (
              <Tag color="default" style={{ marginTop: 2, fontSize: 10 }}>Chưa nhận</Tag>
            )}
          </div>
        );
      }
    },
    {
      title: "Ngày lên lịch",
      dataIndex: "ScheduledDate",
      width: 130,
      render: (v) => v ? dayjs(v).format("DD/MM/YYYY") : "—"
    },
    {
      title: "Km kế tiếp",
      dataIndex: "NextServiceOdometer",
      width: 110,
      render: (v) => v > 0 ? `${v.toLocaleString()} km` : "—"
    },
    {
      title: "Chi phí",
      dataIndex: "Cost",
      width: 120,
      render: (v) => v > 0 ? `${v.toLocaleString()} đ` : "—"
    },
    {
      title: "Trạng thái",
      dataIndex: "Status",
      width: 130,
      render: (v) => <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] ?? v}</Tag>
    },
    {
      title: "Hành động",
      width: 280,
      render: (_, r) => (
        <Space size="small" wrap>
          {r.Status === "AWAITING_REVIEW" && (
            <>
              <Tooltip title="Xem ảnh hoá đơn / xe sau bảo dưỡng">
                <Button size="small" type="dashed" icon={<PictureOutlined />} onClick={() => setReviewItem(r)}>
                  Xem ảnh ({r.CompletionPhotos?.length ?? 0})
                </Button>
              </Tooltip>
              <Popconfirm
                title="Duyệt hoàn thành?"
                description="Sau khi duyệt, lịch bảo dưỡng được khoá."
                onConfirm={() => approveM.mutate(r._id)}
              >
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}>
                  Duyệt
                </Button>
              </Popconfirm>
            </>
          )}
          <Button size="small" onClick={() => openEdit(r)}>Sửa</Button>
          <Popconfirm title="Xoá bản ghi?" onConfirm={() => deleteM.mutate(r._id)}>
            <Button size="small" danger>Xoá</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* Alert summary cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Lịch sắp tới (7 ngày)"
              value={summary?.upcomingCount ?? 0}
              prefix={<ToolOutlined style={{ color: "#1677ff" }} />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Quá hạn"
              value={summary?.overdueCount ?? 0}
              valueStyle={{ color: summary?.overdueCount > 0 ? "#cf1322" : undefined }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Cảnh báo Km"
              value={summary?.odometerWarningCount ?? 0}
              valueStyle={{ color: summary?.odometerWarningCount > 0 ? "#fa8c16" : undefined }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Critical alerts banner */}
      {(alertData?.overdue?.length ?? 0) > 0 && (
        <Alert
          message={`Có ${alertData.overdue.length} lịch bảo dưỡng QUÁ HẠN`}
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {alertData.overdue.slice(0, 5).map((o) => (
                <li key={o._id}>
                  <Text strong>{o.VehicleCode}</Text> — {o.Title} (hẹn {dayjs(o.ScheduledDate).format("DD/MM/YYYY")})
                </li>
              ))}
            </ul>
          }
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}
      {(alertData?.data?.odometerWarnings?.length ?? 0) > 0 && (
        <Alert
          message={`${alertData.odometerWarnings.length} xe sắp/đã vượt km bảo dưỡng`}
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {alertData.odometerWarnings.map((w) => (
                <li key={w.vehicleId}>
                  <Text strong>{w.vehicleCode}</Text>: đã chạy {w.currentKm.toLocaleString()} km
                  / hạn {w.targetKm.toLocaleString()} km
                  {" "}<Tag color={w.severity === "CRITICAL" ? "red" : "orange"}>{w.severity}</Tag>
                </li>
              ))}
            </ul>
          }
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title="Lịch bảo dưỡng phương tiện"
        extra={
          <Space>
            <Tooltip title="Làm mới">
              <Button icon={<ReloadOutlined />} onClick={() => qc.invalidateQueries({ queryKey: ["maintenance-list"] })} />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tạo lịch
            </Button>
          </Space>
        }
      >
        <Table
          loading={isLoading}
          rowKey="_id"
          size="small"
          columns={columns}
          dataSource={items}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={editing ? "Sửa lịch bảo dưỡng" : "Tạo lịch bảo dưỡng"}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createM.isPending || updateM.isPending}
        width={640}
      >
        <Form layout="vertical" form={form} onFinish={onSubmit}>
          <Form.Item label="Xe" name="VehicleID" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn xe"
              options={vehicles.map((v) => ({
                value: v._id,
                label: `${v.VehicleCode} — ${v.XName} (${v.LicensePlate})`
              }))}
            />
          </Form.Item>
          <Form.Item
            label="Tài xế phụ trách"
            name="DriverID"
            help="Người sẽ đưa xe đi bảo dưỡng (có thể để trống nếu chưa phân công)"
          >
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="Chọn tài xế đưa xe đi bảo dưỡng"
              options={drivers.map((d) => ({
                value: d._id,
                label: `${d.DriverCode} — ${d.XName}${d.Phone ? ` (${d.Phone})` : ""}`
              }))}
            />
          </Form.Item>
          <Form.Item label="Loại bảo dưỡng" name="Type" rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label="Tiêu đề" name="Title" rules={[{ required: true }]}>
            <Input placeholder="VD: Thay dầu nhớt 5000km" />
          </Form.Item>
          <Form.Item label="Mô tả" name="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Ngày lên lịch" name="ScheduledDate" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Ngày hoàn tất" name="CompletedDate">
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Km hiện tại" name="OdometerAtService" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Km kế tiếp" name="NextServiceOdometer" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Chi phí (đ)" name="Cost" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nhà cung cấp" name="Vendor">
                <Input placeholder="VD: Garage Toyota" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Trạng thái" name="Status" initialValue="SCHEDULED">
            <Select
              options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            />
          </Form.Item>
          <Form.Item label="Ghi chú" name="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<Space><PictureOutlined /> Ảnh tài xế upload</Space>}
        open={!!reviewItem}
        onCancel={() => setReviewItem(null)}
        width={720}
        footer={
          reviewItem?.Status === "AWAITING_REVIEW" ? (
            <Space>
              <Button onClick={() => setReviewItem(null)}>Đóng</Button>
              <Popconfirm
                title="Duyệt hoàn thành?"
                onConfirm={() => {
                  approveM.mutate(reviewItem._id);
                  setReviewItem(null);
                }}
              >
                <Button type="primary" icon={<CheckCircleOutlined />}>Duyệt hoàn thành</Button>
              </Popconfirm>
            </Space>
          ) : null
        }
      >
        {reviewItem && (
          <div>
            <Text strong>{reviewItem.VehicleCode}</Text> · {TYPE_OPTIONS.find((t) => t.value === reviewItem.Type)?.label}
            <div style={{ color: "#666", margin: "4px 0 12px" }}>
              TX: {reviewItem.DriverName} · Hoàn thành lúc {reviewItem.DriverCompletedAt ? dayjs(reviewItem.DriverCompletedAt).format("DD/MM/YYYY HH:mm") : "—"}
            </div>
            {reviewItem.CompletionNote && (
              <Alert
                type="info"
                message="Ghi chú từ tài xế"
                description={reviewItem.CompletionNote}
                style={{ marginBottom: 12 }}
              />
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Image.PreviewGroup>
                {(reviewItem.CompletionPhotos ?? []).map((src, i) => (
                  <Image
                    key={i}
                    src={src}
                    width={140}
                    height={140}
                    style={{ objectFit: "cover", borderRadius: 6 }}
                  />
                ))}
              </Image.PreviewGroup>
              {(reviewItem.CompletionPhotos ?? []).length === 0 && (
                <Text type="secondary">Không có ảnh</Text>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
