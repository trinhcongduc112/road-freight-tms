import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileAddOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SwapOutlined,
  UploadOutlined
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload
} from "antd";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { useState } from "react";
import { orderApi } from "../../api/order";
import { organizationApi } from "../../api/organization";
import { customerApi, productApi, productCategoryApi } from "../../api/masterData";
import { Permissions, usePermissions } from "../../utils/permissions";

const { Text } = Typography;

function downloadExcelTemplate() {
  const wsData = [
    ["OrderCode", "CustomerCode", "OrganizationID", "OrderDate", "ProductCode", "NumberOfCases"],
    ["ORD-TEST-001", "CUST-01", "org-id-here", "2024-05-01", "SKU-01", 10],
    ["ORD-TEST-002", "CUST-02", "org-id-here", "2024-05-02", "SKU-02", 5]
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "Import_Order_Template.xlsx");
}

function exportXlsx(rows, fields, filename) {
  const data = rows.map((r) =>
    Object.fromEntries(fields.map((f) => [f.label, f.key.split(".").reduce((o, k) => o?.[k], r) ?? ""]))
  );
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, filename);
}

const ORDER_STATUS_COLOR = {
  OPEN: "blue", PICKED_PACKED: "cyan", SHIPPED: "orange",
  DELIVERED: "green", CANCELLED: "default", REJECTED: "red"
};
const PLANNING_STATUS_COLOR = {
  PENDING: "default", PLANNED: "blue", LOCKED: "orange", FINALIZED: "green"
};
const APPROVAL_STATUS_COLOR = {
  PENDING: "default", APPROVED: "green", REJECTED: "red"
};
const APPROVAL_STATUS_LABEL = {
  PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Từ chối"
};
const ORDER_STATUS_OPTIONS = [
  { value: "OPEN", label: "OPEN" }, { value: "PICKED_PACKED", label: "PICKED_PACKED" },
  { value: "SHIPPED", label: "SHIPPED" }, { value: "DELIVERED", label: "DELIVERED" },
  { value: "CANCELLED", label: "CANCELLED" }, { value: "REJECTED", label: "REJECTED" }
];

export default function OrdersPage() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { can, isSuper } = usePermissions();
  const canManage = isSuper || can(Permissions.ORDER_MANAGE);

  const [statusFilter, setStatusFilter] = useState(undefined);
  const [approvalFilter, setApprovalFilter] = useState(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [targetOrder, setTargetOrder] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [createForm] = Form.useForm();
  const [statusForm] = Form.useForm();

  const ordersQ = useQuery({
    queryKey: ["orders", statusFilter, approvalFilter, page, pageSize],
    queryFn: () => {
      const params = { page, limit: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (approvalFilter) params.approvalStatus = approvalFilter;
      return orderApi.list(params);
    }
  });
  const orgsQ = useQuery({ queryKey: ["organizations"], queryFn: organizationApi.list });
  const customersQ = useQuery({ queryKey: ["customers"], queryFn: () => customerApi.list() });
  const productsQ = useQuery({ queryKey: ["products"], queryFn: () => productApi.list() });
  const categoriesQ = useQuery({ queryKey: ["product-categories"], queryFn: () => productCategoryApi.list() });

  const orders = ordersQ.data?.data ?? [];
  const pagination = ordersQ.data?.pagination;
  const orgs = orgsQ.data?.data ?? [];
  const customers = customersQ.data?.data ?? [];
  const products = productsQ.data?.data ?? [];
  const categories = categoriesQ.data?.data ?? [];
  const productByCode = Object.fromEntries(products.map((p) => [p.ProductCode, p]));
  const categoryById = Object.fromEntries(categories.map((c) => [c._id, c]));

  /* Compute total weight (kg) and volume (m³) of an order from its items */
  function orderWeight(order) {
    return (order?.Items ?? []).reduce((sum, it) => {
      const p = productByCode[it.ProductCode];
      return sum + (Number(p?.WeightPerCase) || 0) * (Number(it.NumberOfCases) || 0);
    }, 0);
  }
  function orderVolume(order) {
    return (order?.Items ?? []).reduce((sum, it) => {
      const p = productByCode[it.ProductCode];
      return sum + (Number(p?.VolumePerCase) || 0) * (Number(it.NumberOfCases) || 0);
    }, 0);
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["orders"] });

  const createM = useMutation({
    mutationFn: orderApi.create,
    onSuccess: () => { message.success("Đã tạo đơn hàng"); invalidate(); setCreateOpen(false); createForm.resetFields(); },
    onError: (e) => message.error(e.message)
  });

  const changeStatusM = useMutation({
    mutationFn: orderApi.changeStatus,
    onSuccess: () => { message.success("Đã cập nhật trạng thái"); invalidate(); setStatusModalOpen(false); },
    onError: (e) => message.error(e.message)
  });

  const approveM = useMutation({
    mutationFn: orderApi.approve,
    onSuccess: () => { message.success("Đã cập nhật phê duyệt"); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const uploadM = useMutation({
    mutationFn: (formData) => orderApi.upload(formData),
    onSuccess: (res) => {
      message.success(`Import thành công ${res.data?.created ?? 0} đơn hàng`);
      invalidate();
      setUploadOpen(false);
      setFileList([]);
    },
    onError: (e) => message.error(e.message)
  });

  async function onCreateOk() {
    const values = await createForm.validateFields();
    const { TotalPrice: _drop, ...rest } = values;
    const payload = {
      ...rest,
      OrderDate: values.OrderDate?.toISOString() ?? new Date().toISOString(),
      Items: values.Items ?? []
    };
    createM.mutate(payload);
  }

  function openStatusChange(order) {
    setTargetOrder(order);
    statusForm.setFieldsValue({ OrderCode: order.OrderCode, Note: "" });
    setStatusModalOpen(true);
  }

  async function onStatusOk() {
    const values = await statusForm.validateFields();
    changeStatusM.mutate({ OrderCode: targetOrder.OrderCode, ToStatus: values.ToStatus, Note: values.Note });
  }

  async function onUpload() {
    if (!fileList.length) return message.warning("Chọn file trước");
    const formData = new FormData();
    formData.append("file", fileList[0].originFileObj);
    uploadM.mutate(formData);
  }

  const columns = [
    {
      title: "Mã đơn", dataIndex: "OrderCode", width: 150,
      render: (v) => <Tag color="blue">{v}</Tag>
    },
    {
      title: "Khách hàng", dataIndex: "CustomerCode", width: 130,
      render: (v) => <Text code>{v}</Text>
    },
    {
      title: "Ngày đặt", dataIndex: "OrderDate", width: 105,
      render: (v) => dayjs(v).format("DD/MM/YYYY")
    },
    {
      title: "Trạng thái", dataIndex: "OrderStatus", width: 130,
      render: (v) => <Badge color={ORDER_STATUS_COLOR[v] ?? "default"} text={v} />
    },
    {
      title: "Kế hoạch", dataIndex: "PlanningStatus", width: 105,
      render: (v) => <Tag color={PLANNING_STATUS_COLOR[v] ?? "default"} style={{ fontSize: 11 }}>{v}</Tag>
    },
    {
      title: "Phê duyệt", dataIndex: "ApprovalStatus", width: 120,
      render: (v) => (
        <Tag color={APPROVAL_STATUS_COLOR[v] ?? "default"} style={{ fontSize: 11 }}>
          {APPROVAL_STATUS_LABEL[v] ?? v}
        </Tag>
      ),
      filters: [
        { text: "Chờ duyệt", value: "PENDING" },
        { text: "Đã duyệt", value: "APPROVED" },
        { text: "Từ chối", value: "REJECTED" }
      ],
      onFilter: (val, rec) => rec.ApprovalStatus === val
    },
    {
      title: "Hạng mục", key: "categories", width: 150,
      render: (_, rec) => {
        const cats = new Set();
        (rec.Items ?? []).forEach((it) => {
          const p = productByCode[it.ProductCode];
          if (!p) return;
          const cat = p.CategoryID ? categoryById[p.CategoryID] : null;
          if (cat?.CategoryType) cats.add(cat.CategoryType);
          else if (p.Category) cats.add(p.Category);
        });
        if (!cats.size) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        return <Space size={2} wrap>{[...cats].map((c) => <Tag key={c} style={{ fontSize: 11 }}>{c}</Tag>)}</Space>;
      }
    },
    {
      title: "Khối lượng", key: "weight", width: 110, align: "right",
      render: (_, rec) => {
        const kg = orderWeight(rec);
        const m3 = orderVolume(rec);
        return (
          <div style={{ lineHeight: 1.3 }}>
            <Text strong style={{ fontSize: 12 }}>{kg.toLocaleString("vi-VN")} kg</Text>
            <div style={{ fontSize: 10, color: "#888" }}>{m3.toFixed(3)} m³</div>
          </div>
        );
      }
    },
    {
      title: "Tổng tiền", dataIndex: "TotalPrice", width: 120, align: "right",
      render: (v) => <Text strong>{(v ?? 0).toLocaleString("vi-VN")} ₫</Text>
    },
    {
      title: "Nguồn", dataIndex: "Source", width: 80,
      render: (v) => <Tag style={{ fontSize: 11 }}>{v}</Tag>
    },
    {
      title: "Thao tác", width: 160, align: "right",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Chi tiết">
            <Button size="small" icon={<InfoCircleOutlined />} onClick={() => setDetailOrder(record)} />
          </Tooltip>
          {canManage && record.ApprovalStatus === "PENDING" && (
            <>
              <Tooltip title="Phê duyệt">
                <Popconfirm
                  title="Phê duyệt đơn hàng này?"
                  onConfirm={() => approveM.mutate({ OrderID: record._id, ToApprovalStatus: "APPROVED" })}
                >
                  <Button size="small" icon={<CheckCircleOutlined />} style={{ color: "#52c41a", borderColor: "#52c41a" }} />
                </Popconfirm>
              </Tooltip>
              <Tooltip title="Từ chối">
                <Popconfirm
                  title="Từ chối đơn hàng này?"
                  onConfirm={() => approveM.mutate({ OrderID: record._id, ToApprovalStatus: "REJECTED" })}
                >
                  <Button size="small" danger icon={<CloseCircleOutlined />} />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          {canManage && (
            <Tooltip title="Đổi trạng thái">
              <Button size="small" icon={<SwapOutlined />} onClick={() => openStatusChange(record)} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="title">Đơn hàng</h2>
          <p className="subtitle">Quản lý Sales Order — tạo, phê duyệt, theo dõi trạng thái</p>
        </div>
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportXlsx(orders, [
              { key: "OrderCode", label: "Mã đơn" },
              { key: "CustomerCode", label: "Khách hàng" },
              { key: "OrderDate", label: "Ngày đặt" },
              { key: "OrderStatus", label: "Trạng thái" },
              { key: "ApprovalStatus", label: "Phê duyệt" },
              { key: "PlanningStatus", label: "Kế hoạch" },
              { key: "TotalPrice", label: "Tổng tiền" },
              { key: "Source", label: "Nguồn" }
            ], `orders_${new Date().toISOString().slice(0, 10)}.xlsx`)}
            disabled={orders.length === 0}
          >
            Xuất Excel
          </Button>
          {canManage && (
            <>
              <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
                Import
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); createForm.resetFields(); }}>
                Tạo đơn
              </Button>
            </>
          )}
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Text type="secondary">Trạng thái đơn:</Text>
          <Select
            allowClear placeholder="Tất cả" style={{ width: 160 }}
            value={statusFilter} onChange={setStatusFilter}
            options={ORDER_STATUS_OPTIONS}
          />
          <Text type="secondary">Phê duyệt:</Text>
          <Select
            allowClear placeholder="Tất cả" style={{ width: 140 }}
            value={approvalFilter} onChange={setApprovalFilter}
            options={[
              { value: "PENDING", label: "Chờ duyệt" },
              { value: "APPROVED", label: "Đã duyệt" },
              { value: "REJECTED", label: "Từ chối" }
            ]}
          />
        </Space>
      </Card>

      <Card size="small">
        <Table
          size="small"
          loading={ordersQ.isLoading}
          rowKey="_id"
          columns={columns}
          dataSource={orders}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: pagination?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, s) => { setPage(p); setPageSize(s); }
          }}
        />
      </Card>

      {/* ── Tạo đơn ── */}
      <Modal
        open={createOpen}
        title={<Space><FileAddOutlined /> Tạo đơn hàng mới</Space>}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreateOk}
        confirmLoading={createM.isPending}
        destroyOnHidden
        width={600}
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="OrganizationID" label="Tổ chức" rules={[{ required: true }]}>
                <Select
                  showSearch optionFilterProp="label"
                  options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="OrderCode" label="Mã đơn hàng" rules={[{ required: true }]}>
                <Input placeholder="VD: ORD-2025-001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="CustomerCode" label="Mã khách hàng" rules={[{ required: true }]}>
                <Select
                  showSearch optionFilterProp="label"
                  options={customers.map((c) => ({ value: c.CustomerCode, label: `[${c.CustomerCode}] ${c.XName}` }))}
                  placeholder="Chọn hoặc nhập mã"
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="OrderDate" label="Ngày đặt hàng" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="TypeWay" label="Chiều vận chuyển" initialValue="FIRST_WAY">
                <Select options={[
                  { value: "FIRST_WAY", label: "Chiều đi (FIRST_WAY)" },
                  { value: "SECOND_WAY", label: "Chiều về (SECOND_WAY)" }
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="TimeWindow" label="Khung giờ giao (HH:mm-HH:mm)">
                <Input placeholder="VD: 08:00-17:00" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Hàng hóa" tooltip="Chọn sản phẩm và số lượng. Tổng tiền tự tính = Σ(Số lượng × Đơn giá sản phẩm)">
            <Form.List name="Items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Row gutter={6} key={field.key} style={{ marginBottom: 6 }}>
                      <Col span={13}>
                        <Form.Item {...field} name={[field.name, "ProductCode"]} rules={[{ required: true, message: "Chọn SP" }]} noStyle>
                          <Select
                            showSearch optionFilterProp="label" placeholder="Sản phẩm"
                            options={products.map((p) => ({
                              value: p.ProductCode,
                              label: `[${p.ProductCode}] ${p.XName} — ${(p.Price ?? 0).toLocaleString("vi-VN")}₫`
                            }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item {...field} name={[field.name, "NumberOfCases"]} rules={[{ required: true, message: "SL" }]} noStyle>
                          <InputNumber min={1} placeholder="Số lượng" style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ ProductCode: undefined, NumberOfCases: 1 })}>
                    Thêm sản phẩm
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const items = createForm.getFieldValue("Items") ?? [];
              const total = items.reduce((s, it) => {
                const p = productByCode[it?.ProductCode];
                return s + (Number(p?.Price) || 0) * (Number(it?.NumberOfCases) || 0);
              }, 0);
              return (
                <div style={{ textAlign: "right", padding: "8px 12px", background: "#fafafa", borderRadius: 4 }}>
                  <Text type="secondary">Tổng tiền tạm tính: </Text>
                  <Text strong style={{ fontSize: 16, color: "#1677ff" }}>{total.toLocaleString("vi-VN")} ₫</Text>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Đổi trạng thái ── */}
      <Modal
        open={statusModalOpen}
        title="Cập nhật trạng thái đơn hàng"
        onCancel={() => setStatusModalOpen(false)}
        onOk={onStatusOk}
        confirmLoading={changeStatusM.isPending}
        destroyOnHidden
      >
        <Form form={statusForm} layout="vertical" preserve={false}>
          <Form.Item name="OrderCode" label="Mã đơn hàng">
            <Input disabled />
          </Form.Item>
          <Form.Item name="ToStatus" label="Trạng thái mới" rules={[{ required: true }]}>
            <Select options={ORDER_STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="Note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Import ── */}
      <Modal
        open={uploadOpen}
        title="Import đơn hàng (Excel / JSON)"
        onCancel={() => { setUploadOpen(false); setFileList([]); }}
        onOk={onUpload}
        confirmLoading={uploadM.isPending}
        okText="Upload"
        destroyOnHidden
      >
        <div style={{ marginBottom: 16 }}>
          <Button onClick={downloadExcelTemplate}>Tải file Excel mẫu (Template)</Button>
        </div>
        <Upload
          accept=".xlsx,.xls,.json"
          maxCount={1}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: fl }) => setFileList(fl)}
        >
          <Button icon={<UploadOutlined />}>Chọn file Excel (.xlsx) hoặc JSON</Button>
        </Upload>
        <div style={{ marginTop: 12, color: "#888", fontSize: 12 }}>
          Excel: cột tiêu đề dòng 1 — OrderCode, CustomerCode, OrganizationID, OrderDate, TotalPrice.
        </div>
      </Modal>

      {/* ── Chi tiết ── */}
      <Drawer
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        title={`Chi tiết đơn: ${detailOrder?.OrderCode}`}
        width={480}
        extra={
          canManage && detailOrder?.ApprovalStatus === "PENDING" && (
            <Space>
              <Popconfirm title="Phê duyệt đơn?" onConfirm={() => { approveM.mutate({ OrderID: detailOrder._id, ToApprovalStatus: "APPROVED" }); setDetailOrder(null); }}>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}>Duyệt</Button>
              </Popconfirm>
              <Popconfirm title="Từ chối đơn?" onConfirm={() => { approveM.mutate({ OrderID: detailOrder._id, ToApprovalStatus: "REJECTED" }); setDetailOrder(null); }}>
                <Button size="small" danger icon={<CloseCircleOutlined />}>Từ chối</Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {detailOrder && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Mã đơn">{detailOrder.OrderCode}</Descriptions.Item>
              <Descriptions.Item label="Khách hàng">{detailOrder.CustomerCode}</Descriptions.Item>
              <Descriptions.Item label="Ngày đặt">{dayjs(detailOrder.OrderDate).format("DD/MM/YYYY")}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Badge color={ORDER_STATUS_COLOR[detailOrder.OrderStatus]} text={detailOrder.OrderStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="Kế hoạch">
                <Tag color={PLANNING_STATUS_COLOR[detailOrder.PlanningStatus]}>{detailOrder.PlanningStatus}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Phê duyệt">
                <Tag color={APPROVAL_STATUS_COLOR[detailOrder.ApprovalStatus]}>
                  {APPROVAL_STATUS_LABEL[detailOrder.ApprovalStatus] ?? detailOrder.ApprovalStatus}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Nguồn">{detailOrder.Source}</Descriptions.Item>
              <Descriptions.Item label="Khối lượng / Thể tích">
                <Text strong>{orderWeight(detailOrder).toLocaleString("vi-VN")} kg</Text>
                <Text type="secondary"> · {orderVolume(detailOrder).toFixed(3)} m³</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng tiền">{(detailOrder.TotalPrice ?? 0).toLocaleString("vi-VN")} ₫</Descriptions.Item>
            </Descriptions>

            {detailOrder.Items?.length > 0 && (
              <>
                <div style={{ marginTop: 16, fontWeight: 500 }}>Chi tiết hàng hóa</div>
                <Table
                  size="small"
                  rowKey={(_, i) => i}
                  dataSource={detailOrder.Items}
                  pagination={false}
                  style={{ marginTop: 8 }}
                  columns={[
                    {
                      title: "Sản phẩm", dataIndex: "ProductCode", width: 200,
                      render: (code) => {
                        const p = productByCode[code];
                        return (
                          <div>
                            <Text code>{code}</Text>
                            {p?.XName && <div style={{ fontSize: 11, color: "#888" }}>{p.XName}</div>}
                          </div>
                        );
                      }
                    },
                    {
                      title: "Hạng mục", key: "category", width: 110,
                      render: (_, it) => {
                        const p = productByCode[it.ProductCode];
                        const cat = p?.CategoryID ? categoryById[p.CategoryID] : null;
                        const label = cat?.CategoryType ?? p?.Category ?? "—";
                        return <Tag style={{ fontSize: 11 }}>{label}</Tag>;
                      }
                    },
                    { title: "Số lượng", dataIndex: "NumberOfCases", width: 70, align: "right" },
                    {
                      title: "Khối lượng", key: "weight", width: 90, align: "right",
                      render: (_, it) => {
                        const p = productByCode[it.ProductCode];
                        const kg = (Number(p?.WeightPerCase) || 0) * (Number(it.NumberOfCases) || 0);
                        return <Text style={{ fontSize: 12 }}>{kg.toLocaleString("vi-VN")} kg</Text>;
                      }
                    },
                    {
                      title: "Thành tiền", key: "subtotal", width: 110, align: "right",
                      render: (_, it) => {
                        const p = productByCode[it.ProductCode];
                        const sub = (Number(p?.Price) || 0) * (Number(it.NumberOfCases) || 0);
                        return <Text>{sub.toLocaleString("vi-VN")} ₫</Text>;
                      }
                    }
                  ]}
                />
              </>
            )}

            {detailOrder.StatusHistory?.length > 0 && (
              <>
                <div style={{ marginTop: 16, fontWeight: 500 }}>Lịch sử trạng thái</div>
                <Table
                  size="small"
                  rowKey={(_, i) => i}
                  dataSource={[...detailOrder.StatusHistory].reverse()}
                  pagination={false}
                  columns={[
                    { title: "Từ", dataIndex: "FromStatus", width: 120 },
                    { title: "Sang", dataIndex: "ToStatus", width: 130 },
                    { title: "Thời gian", dataIndex: "ChangedAt", render: (v) => dayjs(v).format("DD/MM HH:mm") }
                  ]}
                  style={{ marginTop: 8 }}
                />
              </>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
