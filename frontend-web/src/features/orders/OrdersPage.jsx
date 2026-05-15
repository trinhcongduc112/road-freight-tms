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
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { orderApi } from "../../api/order";
import { organizationApi } from "../../api/organization";
import { customerApi, productApi, productCategoryApi } from "../../api/masterData";
import { useLanguage } from "../../i18n.jsx";
import { Permissions, usePermissions } from "../../utils/permissions";

const { Text } = Typography;

function downloadExcelTemplate() {
  const wsData = [
    ["OrganizationCode", "OrderCode", "CustomerCode", "OrderDate", "TypeWay", "ProductCode", "NumberOfCases"],
    ["DEMO-KHO-DN", "ORD-TEST-001", "DEMO-KH-01", "2026-05-13", "FIRST_WAY", "DEMO-P-BEV-001", 10],
    ["DEMO-KHO-DN", "ORD-TEST-001", "DEMO-KH-01", "2026-05-13", "FIRST_WAY", "DEMO-P-BEV-002", 5],
    ["DEMO-KHO-DN", "ORD-TEST-002", "DEMO-KH-02", "2026-05-13", "FIRST_WAY", "DEMO-P-FOD-001", 8]
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
const ORDER_STATUS_OPTIONS = [
  { value: "OPEN", label: "OPEN" }, { value: "PICKED_PACKED", label: "PICKED_PACKED" },
  { value: "SHIPPED", label: "SHIPPED" }, { value: "DELIVERED", label: "DELIVERED" },
  { value: "CANCELLED", label: "CANCELLED" }, { value: "REJECTED", label: "REJECTED" }
];

export default function OrdersPage() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { can, isSuper } = usePermissions();
  const { language, t } = useLanguage();
  const canManage = isSuper || can(Permissions.ORDER_MANAGE);
  const locale = language === "vi" ? "vi-VN" : "en-US";
  const approvalStatusLabel = {
    PENDING: t("orders.status.pending"),
    APPROVED: t("orders.status.approved"),
    REJECTED: t("orders.status.rejected")
  };
  const approvalStatusOptions = [
    { value: "PENDING", label: t("orders.status.pending") },
    { value: "APPROVED", label: t("orders.status.approved") },
    { value: "REJECTED", label: t("orders.status.rejected") }
  ];

  // AI Agent deep-link: ?approvalStatus, ?customerKeyword, ?dateFrom, ?dateTo
  const [searchParams, setSearchParams] = useSearchParams();
  const initialApproval = (() => {
    const v = searchParams.get("approvalStatus");
    return ["PENDING", "APPROVED", "REJECTED"].includes(v) ? v : undefined;
  })();
  const initialCustomerKw = searchParams.get("customerKeyword") ?? "";
  const initialDateRange = (() => {
    const from = searchParams.get("dateFrom");
    const to = searchParams.get("dateTo");
    if (!from && !to) return null;
    const a = from ? dayjs(from) : null;
    const b = to ? dayjs(to) : a;
    if (a?.isValid() && b?.isValid()) return [a.startOf("day"), b.endOf("day")];
    if (a?.isValid()) return [a.startOf("day"), a.endOf("day")];
    return null;
  })();
  const consumedQueryRef = useRef(false);

  const [statusFilter, setStatusFilter] = useState(undefined);
  const [approvalFilter, setApprovalFilter] = useState(initialApproval);
  const [productFilter, setProductFilter] = useState(initialCustomerKw);
  const [dateRange, setDateRange] = useState(initialDateRange);

  // Dọn URL sau khi đã consume — user đổi filter sau đó không bị stuck deep-link
  useEffect(() => {
    if (consumedQueryRef.current) return;
    if (initialApproval || initialCustomerKw || initialDateRange) {
      consumedQueryRef.current = true;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("approvalStatus");
        next.delete("customerKeyword");
        next.delete("dateFrom");
        next.delete("dateTo");
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    queryKey: ["orders", statusFilter, approvalFilter, productFilter, dateRange?.[0]?.format("YYYY-MM-DD"), dateRange?.[1]?.format("YYYY-MM-DD"), page, pageSize],
    queryFn: () => {
      const params = { page, limit: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (approvalFilter) params.approvalStatus = approvalFilter;
      if (productFilter.trim()) params.product = productFilter.trim();
      if (dateRange?.[0]) params.dateFrom = dateRange[0].format("YYYY-MM-DD");
      if (dateRange?.[1]) params.dateTo = dateRange[1].format("YYYY-MM-DD");
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

  function setFilterValue(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  function orderProductSummary(order) {
    const items = order?.Items ?? [];
    if (!items.length) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
    return (
      <Space direction="vertical" size={2} style={{ maxWidth: 360 }}>
        {items.slice(0, 3).map((it) => {
          const product = productByCode[it.ProductCode];
          return (
            <div key={`${order._id}-${it.ProductCode}`} style={{ lineHeight: 1.25 }}>
              <Text style={{ fontSize: 12 }}>{product?.XName ?? it.ProductCode}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}> · {it.NumberOfCases ?? 0} {t("orders.unit.case")}</Text>
            </div>
          );
        })}
        {items.length > 3 && <Text type="secondary" style={{ fontSize: 11 }}>{t("orders.moreProducts", { count: items.length - 3 })}</Text>}
      </Space>
    );
  }

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
    onSuccess: () => { message.success(t("orders.message.created")); invalidate(); setCreateOpen(false); createForm.resetFields(); },
    onError: (e) => message.error(e.message)
  });

  const changeStatusM = useMutation({
    mutationFn: orderApi.changeStatus,
    onSuccess: () => { message.success(t("orders.message.statusUpdated")); invalidate(); setStatusModalOpen(false); },
    onError: (e) => message.error(e.message)
  });

  const approveM = useMutation({
    mutationFn: orderApi.approve,
    onSuccess: () => { message.success(t("orders.message.approvalUpdated")); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const uploadM = useMutation({
    mutationFn: (formData) => orderApi.upload(formData),
    onSuccess: (res) => {
      const result = res.data ?? {};
      const createdCount = result.createdCount ?? 0;
      const errorCount = result.errorCount ?? 0;
      if (errorCount > 0) {
        Modal.warning({
          title: t("orders.modal.importTitle"),
          content: (
            <Space direction="vertical" size={4}>
              <Text>Đã tạo {createdCount} đơn, lỗi {errorCount} dòng/đơn.</Text>
              {(result.errors ?? []).slice(0, 8).map((err) => (
                <Text key={`${err.row ?? err.orderCode}-${err.message}`} type="danger" style={{ fontSize: 12 }}>
                  {err.orderCode ? `${err.orderCode}: ` : err.row ? `Dòng ${err.row}: ` : ""}{err.message}
                </Text>
              ))}
            </Space>
          )
        });
      } else {
        message.success(t("orders.message.importSuccess", { count: createdCount }));
      }
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
    statusForm.setFieldsValue({
      OrderCode: order.OrderCode,
      ToStatus: order.OrderStatus,
      Note: ""
    });
    setStatusModalOpen(true);
  }

  async function onStatusOk() {
    const values = await statusForm.validateFields();
    changeStatusM.mutate({
      OrderID: targetOrder._id,
      ToStatus: values.ToStatus,
      Note: values.Note
    });
  }

  async function onUpload() {
    if (!fileList.length) return message.warning(t("orders.message.chooseFile"));
    const formData = new FormData();
    formData.append("file", fileList[0].originFileObj);
    uploadM.mutate(formData);
  }

  const columns = [
    {
      title: t("orders.col.orderCode"), dataIndex: "OrderCode", width: 150,
      render: (v) => <Tag color="blue">{v}</Tag>
    },
    {
      title: t("orders.col.customer"), dataIndex: "CustomerCode", width: 130,
      render: (v) => <Text code>{v}</Text>
    },
    {
      title: t("orders.col.products"), key: "products", width: 360,
      render: (_, rec) => orderProductSummary(rec)
    },
    {
      title: t("orders.col.orderDate"), dataIndex: "OrderDate", width: 105,
      render: (v) => dayjs(v).format("DD/MM/YYYY")
    },
    {
      title: t("orders.col.status"), dataIndex: "OrderStatus", width: 130,
      render: (v) => <Badge color={ORDER_STATUS_COLOR[v] ?? "default"} text={v} />
    },
    {
      title: t("orders.col.planning"), dataIndex: "PlanningStatus", width: 105,
      render: (v) => <Tag color={PLANNING_STATUS_COLOR[v] ?? "default"} style={{ fontSize: 11 }}>{v}</Tag>
    },
    {
      title: t("orders.col.approval"), dataIndex: "ApprovalStatus", width: 120,
      render: (v) => (
        <Tag color={APPROVAL_STATUS_COLOR[v] ?? "default"} style={{ fontSize: 11 }}>
          {approvalStatusLabel[v] ?? v}
        </Tag>
      ),
      filters: approvalStatusOptions.map((item) => ({ text: item.label, value: item.value })),
      onFilter: (val, rec) => rec.ApprovalStatus === val
    },
    {
      title: t("orders.col.category"), key: "categories", width: 150,
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
      title: t("orders.col.weight"), key: "weight", width: 110, align: "right",
      render: (_, rec) => {
        const kg = orderWeight(rec);
        const m3 = orderVolume(rec);
        return (
          <div style={{ lineHeight: 1.3 }}>
            <Text strong style={{ fontSize: 12 }}>{kg.toLocaleString(locale)} kg</Text>
            <div style={{ fontSize: 10, color: "#888" }}>{m3.toFixed(3)} m³</div>
          </div>
        );
      }
    },
    {
      title: t("orders.col.total"), dataIndex: "TotalPrice", width: 120, align: "right",
      render: (v) => <Text strong>{(v ?? 0).toLocaleString(locale)} ₫</Text>
    },
    {
      title: t("orders.col.actions"), width: 160, align: "right",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title={t("orders.action.detail")}>
            <Button size="small" icon={<InfoCircleOutlined />} onClick={() => setDetailOrder(record)} />
          </Tooltip>
          {canManage && record.ApprovalStatus === "PENDING" && (
            <>
              <Tooltip title={t("orders.action.approve")}>
                <Popconfirm
                  title={t("orders.confirm.approveOrder")}
                  onConfirm={() => approveM.mutate({ OrderID: record._id, ToApprovalStatus: "APPROVED" })}
                >
                  <Button size="small" icon={<CheckCircleOutlined />} style={{ color: "#52c41a", borderColor: "#52c41a" }} />
                </Popconfirm>
              </Tooltip>
              <Tooltip title={t("orders.action.reject")}>
                <Popconfirm
                  title={t("orders.confirm.rejectOrder")}
                  onConfirm={() => approveM.mutate({ OrderID: record._id, ToApprovalStatus: "REJECTED" })}
                >
                  <Button size="small" danger icon={<CloseCircleOutlined />} />
                </Popconfirm>
              </Tooltip>
            </>
          )}
          {canManage && (
            <Tooltip title={t("orders.action.changeStatus")}>
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
          <h2 className="title">{t("orders.title")}</h2>
          <p className="subtitle">{t("orders.subtitle")}</p>
        </div>
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportXlsx(orders, [
              { key: "OrderCode", label: t("orders.col.orderCode") },
              { key: "CustomerCode", label: t("orders.col.customer") },
              { key: "OrderDate", label: t("orders.col.orderDate") },
              { key: "OrderStatus", label: t("orders.col.status") },
              { key: "ApprovalStatus", label: t("orders.col.approval") },
              { key: "PlanningStatus", label: t("orders.col.planning") },
              { key: "TotalPrice", label: t("orders.col.total") }
            ], `orders_${new Date().toISOString().slice(0, 10)}.xlsx`)}
            disabled={orders.length === 0}
          >
            {t("orders.export")}
          </Button>
          {canManage && (
            <>
              <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
                {t("orders.import")}
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); createForm.resetFields(); }}>
                {t("orders.create")}
              </Button>
            </>
          )}
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Text type="secondary">{t("orders.filter.status")}</Text>
	          <Select
	            allowClear placeholder={t("orders.filter.all")} style={{ width: 160 }}
	            value={statusFilter} onChange={setFilterValue(setStatusFilter)}
	            options={ORDER_STATUS_OPTIONS}
	          />
	          <Text type="secondary">{t("orders.filter.approval")}</Text>
	          <Select
	            allowClear placeholder={t("orders.filter.all")} style={{ width: 140 }}
	            value={approvalFilter} onChange={setFilterValue(setApprovalFilter)}
	            options={approvalStatusOptions}
	          />
	          <Text type="secondary">{t("orders.filter.date")}</Text>
	          <DatePicker.RangePicker
	            allowClear
	            format="DD/MM/YYYY"
	            value={dateRange}
	            onChange={setFilterValue(setDateRange)}
	          />
	          <Input.Search
	            allowClear
	            placeholder={t("orders.filter.searchProduct")}
	            style={{ width: 260 }}
	            value={productFilter}
	            onChange={(e) => {
	              setProductFilter(e.target.value);
	              setPage(1);
	            }}
	            onSearch={(value) => {
	              setProductFilter(value);
	              setPage(1);
	            }}
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
        title={<Space><FileAddOutlined /> {t("orders.modal.createTitle")}</Space>}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreateOk}
        confirmLoading={createM.isPending}
        destroyOnHidden
        width={600}
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="OrganizationID" label={t("orders.form.organization")} rules={[{ required: true }]}>
                <Select
                  showSearch optionFilterProp="label"
                  options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="OrderCode" label={t("orders.form.orderCode")} rules={[{ required: true }]}>
                <Input placeholder="VD: ORD-2025-001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="CustomerCode" label={t("orders.form.customerCode")} rules={[{ required: true }]}>
                <Select
                  showSearch optionFilterProp="label"
                  options={customers.map((c) => ({ value: c.CustomerCode, label: `[${c.CustomerCode}] ${c.XName}` }))}
                  placeholder={t("orders.form.chooseOrEnterCode")}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="OrderDate" label={t("orders.form.orderDate")} rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="TypeWay" label={t("orders.form.typeWay")} initialValue="FIRST_WAY">
            <Select options={[
              { value: "FIRST_WAY", label: t("orders.form.firstWay") },
              { value: "SECOND_WAY", label: t("orders.form.secondWay") }
            ]} />
          </Form.Item>
          <Form.Item label={t("orders.form.goods")} tooltip={t("orders.form.goodsTooltip")}>
            <Form.List name="Items">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Row gutter={6} key={field.key} style={{ marginBottom: 6 }}>
                      <Col span={13}>
                        <Form.Item {...field} name={[field.name, "ProductCode"]} rules={[{ required: true, message: t("orders.form.chooseProduct") }]} noStyle>
	                          <Select
	                            showSearch
	                            optionFilterProp="label"
	                            filterOption={(input, option) => String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
	                            placeholder={t("orders.form.searchProduct")}
	                            options={products.map((p) => ({
                              value: p.ProductCode,
                              label: `[${p.ProductCode}] ${p.XName} — ${(p.Price ?? 0).toLocaleString(locale)}₫`
                            }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item {...field} name={[field.name, "NumberOfCases"]} rules={[{ required: true, message: t("orders.form.quantityShort") }]} noStyle>
                          <InputNumber min={1} placeholder={t("orders.form.quantity")} style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                      <Col span={3}>
                        <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ ProductCode: undefined, NumberOfCases: 1 })}>
                    {t("orders.form.addProduct")}
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
                  <Text type="secondary">{t("orders.form.estimatedTotal")}</Text>
                  <Text strong style={{ fontSize: 16, color: "#1677ff" }}>{total.toLocaleString(locale)} ₫</Text>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Đổi trạng thái ── */}
      <Modal
        open={statusModalOpen}
        title={t("orders.modal.statusTitle")}
        onCancel={() => setStatusModalOpen(false)}
        onOk={onStatusOk}
        confirmLoading={changeStatusM.isPending}
        destroyOnHidden
      >
        <Form form={statusForm} layout="vertical" preserve={false}>
          <Form.Item name="OrderCode" label={t("orders.form.orderCode")}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="ToStatus" label={t("orders.form.newStatus")} rules={[{ required: true }]}>
            <Select options={ORDER_STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="Note" label={t("orders.form.note")}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Import ── */}
      <Modal
        open={uploadOpen}
        title={t("orders.modal.importTitle")}
        onCancel={() => { setUploadOpen(false); setFileList([]); }}
        onOk={onUpload}
        confirmLoading={uploadM.isPending}
        okText="Upload"
        destroyOnHidden
      >
        <div style={{ marginBottom: 16 }}>
          <Button onClick={downloadExcelTemplate}>{t("orders.modal.downloadTemplate")}</Button>
        </div>
        <Upload
          accept=".xlsx,.xls,.json"
          maxCount={1}
          fileList={fileList}
          beforeUpload={() => false}
          onChange={({ fileList: fl }) => setFileList(fl)}
        >
          <Button icon={<UploadOutlined />}>{t("orders.modal.chooseImportFile")}</Button>
        </Upload>
        <div style={{ marginTop: 12, color: "#888", fontSize: 12 }}>
          {t("orders.modal.importHint")}
        </div>
      </Modal>

      {/* ── Chi tiết ── */}
      <Drawer
        open={!!detailOrder}
        onClose={() => setDetailOrder(null)}
        title={t("orders.drawer.title", { code: detailOrder?.OrderCode })}
        width={480}
        extra={
          canManage && detailOrder?.ApprovalStatus === "PENDING" && (
            <Space>
              <Popconfirm title={t("orders.confirm.approveShort")} onConfirm={() => { approveM.mutate({ OrderID: detailOrder._id, ToApprovalStatus: "APPROVED" }); setDetailOrder(null); }}>
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}>{t("orders.drawer.approve")}</Button>
              </Popconfirm>
              <Popconfirm title={t("orders.confirm.rejectShort")} onConfirm={() => { approveM.mutate({ OrderID: detailOrder._id, ToApprovalStatus: "REJECTED" }); setDetailOrder(null); }}>
                <Button size="small" danger icon={<CloseCircleOutlined />}>{t("orders.action.reject")}</Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        {detailOrder && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t("orders.col.orderCode")}>{detailOrder.OrderCode}</Descriptions.Item>
              <Descriptions.Item label={t("orders.col.customer")}>{detailOrder.CustomerCode}</Descriptions.Item>
              <Descriptions.Item label={t("orders.col.orderDate")}>{dayjs(detailOrder.OrderDate).format("DD/MM/YYYY")}</Descriptions.Item>
              <Descriptions.Item label="Chiều vận chuyển">{detailOrder.TypeWay}</Descriptions.Item>
              <Descriptions.Item label="Khung giờ">{detailOrder.TimeWindow || "—"}</Descriptions.Item>
              <Descriptions.Item label="Thời gian phục vụ">{detailOrder.ServiceTime ?? 0} phút</Descriptions.Item>
              <Descriptions.Item label={t("orders.col.status")}>
                <Badge color={ORDER_STATUS_COLOR[detailOrder.OrderStatus]} text={detailOrder.OrderStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="Fulfillment">
                <Tag>{detailOrder.FulfillmentStatus}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("orders.col.planning")}>
                <Tag color={PLANNING_STATUS_COLOR[detailOrder.PlanningStatus]}>{detailOrder.PlanningStatus}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("orders.col.approval")}>
                <Tag color={APPROVAL_STATUS_COLOR[detailOrder.ApprovalStatus]}>
                  {approvalStatusLabel[detailOrder.ApprovalStatus] ?? detailOrder.ApprovalStatus}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("orders.desc.volumeWeight")}>
                <Text strong>{orderWeight(detailOrder).toLocaleString(locale)} kg</Text>
                <Text type="secondary"> · {orderVolume(detailOrder).toFixed(3)} m³</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Dịch vụ / Thu hộ">
                {(detailOrder.TotalServicePrice ?? 0).toLocaleString(locale)} ₫
                <Text type="secondary"> · {(detailOrder.NumberCollected ?? 0).toLocaleString(locale)} ₫</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Cờ đơn">
                <Space>
                  {detailOrder.PickupOrder && <Tag color="blue">Pickup</Tag>}
                  {detailOrder.SplittedOrder && <Tag color="purple">Splitted</Tag>}
                  {!detailOrder.PickupOrder && !detailOrder.SplittedOrder && <Text type="secondary">—</Text>}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t("orders.col.total")}>{(detailOrder.TotalPrice ?? 0).toLocaleString(locale)} ₫</Descriptions.Item>
            </Descriptions>

            {detailOrder.Items?.length > 0 && (
              <>
                <div style={{ marginTop: 16, fontWeight: 500 }}>{t("orders.drawer.goodsDetail")}</div>
                <Table
                  size="small"
                  rowKey={(_, i) => i}
                  dataSource={detailOrder.Items}
                  pagination={false}
                  style={{ marginTop: 8 }}
                  columns={[
                    {
                      title: t("orders.col.products"), dataIndex: "ProductCode", width: 200,
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
                      title: t("orders.col.category"), key: "category", width: 110,
                      render: (_, it) => {
                        const p = productByCode[it.ProductCode];
                        const cat = p?.CategoryID ? categoryById[p.CategoryID] : null;
                        const label = cat?.CategoryType ?? p?.Category ?? "—";
                        return <Tag style={{ fontSize: 11 }}>{label}</Tag>;
                      }
                    },
                    {
                      title: t("orders.col.quantity"), key: "quantity", width: 90, align: "right",
                      render: (_, it) => (
                        <div>
                          <Text>{it.NumberOfCases ?? 0} thùng</Text>
                          {!!it.NumberOfItems && <div style={{ fontSize: 11, color: "#888" }}>{it.NumberOfItems} lẻ</div>}
                        </div>
                      )
                    },
                    {
                      title: "Đã giao", key: "delivered", width: 90, align: "right",
                      render: (_, it) => (
                        <div>
                          <Text>{it.NumberOfCasesDelivered ?? 0} thùng</Text>
                          {!!it.NumberOfItemsDelivered && <div style={{ fontSize: 11, color: "#888" }}>{it.NumberOfItemsDelivered} lẻ</div>}
                        </div>
                      )
                    },
                    {
                      title: t("orders.col.weight"), key: "weight", width: 90, align: "right",
                      render: (_, it) => {
                        const p = productByCode[it.ProductCode];
                        const kg = (Number(p?.WeightPerCase) || 0) * (Number(it.NumberOfCases) || 0);
                        return <Text style={{ fontSize: 12 }}>{kg.toLocaleString(locale)} kg</Text>;
                      }
                    },
                    {
                      title: t("orders.col.subtotal"), key: "subtotal", width: 110, align: "right",
                      render: (_, it) => {
                        const p = productByCode[it.ProductCode];
                        const sub = (Number(p?.Price) || 0) * (Number(it.NumberOfCases) || 0);
                        return <Text>{sub.toLocaleString(locale)} ₫</Text>;
                      }
                    }
                  ]}
                />
              </>
            )}

            {detailOrder.StatusHistory?.length > 0 && (
              <>
                <div style={{ marginTop: 16, fontWeight: 500 }}>{t("orders.drawer.statusHistory")}</div>
                <Table
                  size="small"
                  rowKey={(_, i) => i}
                  dataSource={[...detailOrder.StatusHistory].reverse()}
                  pagination={false}
                  columns={[
                    { title: t("orders.col.from"), dataIndex: "FromStatus", width: 120 },
                    { title: t("orders.col.to"), dataIndex: "ToStatus", width: 130 },
                    { title: t("orders.col.time"), dataIndex: "ChangedAt", render: (v) => dayjs(v).format("DD/MM HH:mm") }
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
