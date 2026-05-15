import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  customerApi,
  customerGroupApi,
  productApi,
  productCategoryApi,
  serviceApi,
  vehicleApi
} from "../../api/masterData";
import { organizationApi } from "../../api/organization";
import { Permissions, usePermissions } from "../../utils/permissions";

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" }
];
const STATUS_COLOR = { Active: "green", Inactive: "default" };

/* ── Export Excel helper ── */
function exportXlsx(rows, fields, filename) {
  const data = rows.map((r) =>
    Object.fromEntries(fields.map((f) => [f.label, f.key.split(".").reduce((o, k) => o?.[k], r) ?? ""]))
  );
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}


function GeoButton() {
  const form = Form.useFormInstance();
  const { message } = App.useApp();
  const [geocoding, setGeocoding] = useState(false);

  async function geocode() {
    const address = form.getFieldValue("Address");
    if (!address?.trim()) { message.warning("Nhập địa chỉ trước"); return; }
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        { headers: { "Accept-Language": "vi,en" } }
      );
      const data = await res.json();
      if (data[0]) {
        form.setFieldsValue({
          Latitude:  parseFloat(parseFloat(data[0].lat).toFixed(6)),
          Longitude: parseFloat(parseFloat(data[0].lon).toFixed(6))
        });
        message.success("Đã lấy tọa độ");
      } else {
        message.warning("Không tìm thấy tọa độ — thử nhập địa chỉ đầy đủ hơn");
      }
    } catch {
      message.error("Lỗi kết nối geocoding");
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <Button size="small" icon={<EnvironmentOutlined />} loading={geocoding} onClick={geocode}>
      Tự động lấy tọa độ từ địa chỉ
    </Button>
  );
}

/* ── Generic CRUD tab ── */
function CrudTab({
  queryKey, listFn, createFn, updateFn, removeFn,
  codeField, columns, formFields, codeLabel, canWrite, orgs,
  exportFields, exportFilename, noOrgSelect,
  importFn, importTemplateFields
}) {
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  /* ── Import state ── */
  const [importOpen, setImportOpen]     = useState(false);
  const [importOrgId, setImportOrgId]   = useState(null);
  const [importRows, setImportRows]     = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useState(() => { const r = { current: null }; return r; })[0];

  function downloadTemplate() {
    if (!importTemplateFields) return;
    const ws = XLSX.utils.json_to_sheet([Object.fromEntries(importTemplateFields.map((f) => [f, ""]))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `template_${queryKey}.xlsx`);
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setImportRows(rows);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  async function submitImport() {
    if (!importOrgId) { message.warning("Chọn tổ chức trước"); return; }
    if (!importRows.length) { message.warning("Chưa chọn file"); return; }
    setImportLoading(true);
    try {
      const res = await importFn({ organizationId: importOrgId, rows: importRows });
      const { created = 0, skipped = 0, errors = [] } = res?.data ?? res ?? {};
      setImportOpen(false);
      setImportRows([]);
      qc.invalidateQueries({ queryKey: [queryKey] });
      modal.info({
        title: "Kết quả nhập Excel",
        content: (
          <div>
            <p>✅ Tạo mới: <b>{created}</b> bản ghi</p>
            <p>⏭ Bỏ qua (đã tồn tại): <b>{skipped}</b></p>
            {errors.length > 0 && (
              <><p>❌ Lỗi: <b>{errors.length}</b> dòng</p>
              <ul style={{ maxHeight: 120, overflow: "auto", fontSize: 12 }}>
                {errors.map((e, i) => <li key={i}>Dòng {e.row}: {e.reason}</li>)}
              </ul></>
            )}
          </div>
        )
      });
    } catch (e) {
      message.error(e.message);
    } finally {
      setImportLoading(false);
    }
  }

  const listQ = useQuery({ 
    queryKey: [queryKey, page, pageSize], 
    queryFn: () => listFn({ page, limit: pageSize }) 
  });
  const rows = listQ.data?.data ?? [];
  const pagination = listQ.data?.pagination;

  const filtered = useMemo(() => {
    if (!search) return rows;
    const k = search.toLowerCase();
    return rows.filter(
      (r) => r[codeField]?.toLowerCase().includes(k) || r.XName?.toLowerCase().includes(k)
    );
  }, [rows, search, codeField]);

  const invalidate = () => qc.invalidateQueries({ queryKey: [queryKey] });

  const createM = useMutation({ mutationFn: createFn, onSuccess: () => { message.success("Đã tạo"); invalidate(); closeModal(); }, onError: (e) => message.error(e.message) });
  const updateM = useMutation({ mutationFn: ({ id, payload }) => updateFn(id, payload), onSuccess: () => { message.success("Đã cập nhật"); invalidate(); closeModal(); }, onError: (e) => message.error(e.message) });
  const removeM = useMutation({ mutationFn: removeFn, onSuccess: () => { message.success("Đã xóa"); invalidate(); }, onError: (e) => message.error(e.message) });

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(record) { setEditing(record); setOpen(true); }
  function closeModal() { setOpen(false); setEditing(null); form.resetFields(); }

  /* Build initialValues from record so the modal pre-fills correctly. Re-keying
     the <Form> on editing._id forces a fresh mount with the new values. */
  const initialValues = editing
    ? { ...editing, LicenseExpiry: editing.LicenseExpiry ? dayjs(editing.LicenseExpiry) : undefined }
    : { Status: "Active" };

  async function onOk() {
    const values = await form.validateFields();
    if (values.LicenseExpiry) values.LicenseExpiry = values.LicenseExpiry.toISOString();
    if (editing) {
      const { OrganizationID: _o, ...payload } = values;
      updateM.mutate({ id: editing._id, payload });
    } else {
      createM.mutate(values);
    }
  }

  const actionCol = canWrite ? {
    title: "Thao tác", width: 90, align: "right",
    render: (_, record) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
        <Popconfirm title="Xóa bản ghi này?" onConfirm={() => removeM.mutate(record._id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )
  } : null;

  return (
    <Card size="small" extra={
      <Space>
        <Input size="small" allowClear prefix={<SearchOutlined />} placeholder="Tìm theo mã / tên"
          value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
        {exportFields && (
          <Button size="small" icon={<DownloadOutlined />}
            onClick={() => exportXlsx(filtered, exportFields, exportFilename ?? `${queryKey}.xlsx`)}>
            Xuất Excel
          </Button>
        )}
        {canWrite && importFn && (
          <Button size="small" icon={<UploadOutlined />} onClick={() => { setImportOpen(true); setImportRows([]); setImportOrgId(null); }}>
            Nhập Excel
          </Button>
        )}
        {canWrite && (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm mới
          </Button>
        )}
      </Space>
    }>
      <Table size="small" loading={listQ.isLoading} rowKey="_id"
        columns={[...columns, actionCol].filter(Boolean)}
        dataSource={pagination ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize)}
        pagination={{
          current: page, pageSize,
          total: pagination?.total ?? filtered.length,
          showSizeChanger: true,
          onChange: (p, s) => { setPage(p); setPageSize(s); }
        }}
      />

      {/* Create / Edit modal */}
      <Modal open={open} title={editing ? `Sửa: ${editing[codeField] ?? editing.GroupCode}` : "Thêm mới"}
        onCancel={closeModal} onOk={onOk}
        confirmLoading={createM.isPending || updateM.isPending} destroyOnHidden width={520}>
        <Form key={editing?._id ?? "new"} form={form} layout="vertical" initialValues={initialValues}>
          {!editing && !noOrgSelect && (
            <Form.Item name="OrganizationID" label="Tổ chức" rules={[{ required: true, message: "Bắt buộc" }]}>
              <Select showSearch optionFilterProp="label" placeholder="Chọn tổ chức"
                options={(orgs ?? []).map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
            </Form.Item>
          )}
          <Form.Item name={codeField} label={codeLabel} rules={[{ required: true, message: "Bắt buộc" }]}>
            <Input placeholder="VD: CUST-001" style={{ textTransform: "uppercase" }} />
          </Form.Item>
          <Form.Item name="XName" label="Tên" rules={[{ required: true, message: "Bắt buộc" }]}>
            <Input />
          </Form.Item>
          {formFields}
          <Form.Item name="Status" label="Trạng thái" initialValue="Active">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Excel modal */}
      <Modal open={importOpen} title="Nhập dữ liệu từ Excel"
        onCancel={() => setImportOpen(false)}
        onOk={submitImport} okText="Nhập dữ liệu"
        confirmLoading={importLoading} destroyOnHidden width={480}>
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>1. Chọn tổ chức</div>
            <Select style={{ width: "100%" }} showSearch optionFilterProp="label" placeholder="Chọn tổ chức"
              value={importOrgId} onChange={setImportOrgId}
              options={(orgs ?? []).map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>2. Tải file Excel lên</div>
            <Space>
              <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
                Chọn file (.xlsx)
              </Button>
              {importTemplateFields && (
                <Button size="small" icon={<DownloadOutlined />} onClick={downloadTemplate}>
                  Tải mẫu
                </Button>
              )}
            </Space>
            <input ref={(el) => { fileInputRef.current = el; }} type="file" accept=".xlsx,.xls"
              style={{ display: "none" }} onChange={onFileChange} />
          </div>
          {importRows.length > 0 && (
            <div style={{ padding: "8px 12px", background: "#f6ffed", borderRadius: 6, border: "1px solid #b7eb8f" }}>
              ✅ Đã đọc <b>{importRows.length}</b> dòng dữ liệu — nhấn "Nhập dữ liệu" để xác nhận
            </div>
          )}
        </Space>
      </Modal>
    </Card>
  );
}

/* ── Page ── */
export default function MasterDataPage() {
  const { can, isSuper } = usePermissions();
  const canCustomer = isSuper || can(Permissions.CUSTOMER_MANAGE);
  const canProduct  = isSuper || can(Permissions.PRODUCT_MANAGE);
  const canVehicle  = isSuper || can(Permissions.VEHICLE_MANAGE);
  const canService  = isSuper || can(Permissions.SERVICE_MANAGE);

  const orgsQ   = useQuery({ queryKey: ["organizations"],     queryFn: organizationApi.list });
  const groupsQ = useQuery({ queryKey: ["customer-groups"],   queryFn: customerGroupApi.list });
  const catsQ   = useQuery({ queryKey: ["product-categories"], queryFn: () => productCategoryApi.list({ limit: 500 }) });
  const orgs   = orgsQ.data?.data ?? [];
  const groups = groupsQ.data?.data ?? [];
  const cats   = catsQ.data?.data  ?? [];
  const groupByCode = Object.fromEntries(groups.map((g) => [g.GroupCode, g]));

  const statusCol = { title: "Trạng thái", dataIndex: "Status", width: 100, render: (v) => <Tag color={STATUS_COLOR[v] ?? "default"}>{v}</Tag> };

  const tabs = [
    {
      key: "customers", label: "Khách hàng",
      children: (
        <CrudTab
          queryKey="customers" listFn={customerApi.list} createFn={customerApi.create}
          updateFn={customerApi.update} removeFn={customerApi.remove}
          codeField="CustomerCode" codeLabel="Mã khách hàng" canWrite={canCustomer} orgs={orgs}
          exportFields={[
            { label: "Mã KH", key: "CustomerCode" }, { label: "Tên", key: "XName" },
            { label: "Nhóm", key: "CustomerGroup" }, { label: "Địa chỉ", key: "Address" },
            { label: "SĐT", key: "Phone" }, { label: "Email", key: "Email" },
            { label: "Trạng thái", key: "Status" }
          ]}
          exportFilename="customers.xlsx"
          importFn={customerApi.import}
          importTemplateFields={["CustomerCode","XName","CustomerGroup","Address","Latitude","Longitude","Phone","Email","OpenTime","CloseTime","ServiceTime"]}
          columns={[
            { title: "Mã KH", dataIndex: "CustomerCode", width: 130, render: (v) => <Tag color="blue">{v}</Tag> },
            { title: "Tên", dataIndex: "XName" },
            {
              title: "Nhóm", dataIndex: "CustomerGroup", width: 170,
              render: (v) => v ? <Tag>{groupByCode[v]?.XName ?? v}</Tag> : <span style={{ color: "#8c8c8c" }}>—</span>
            },
            { title: "SĐT", dataIndex: "Phone", width: 120 },
            statusCol
          ]}
          formFields={
            <>
              <Form.Item name="CustomerGroup" label="Nhóm khách hàng">
                <Select allowClear showSearch optionFilterProp="label" placeholder="Chọn nhóm"
                  options={groups.map((g) => ({ value: g.GroupCode, label: `[${g.GroupCode}] ${g.XName}` }))} />
              </Form.Item>
              <Form.Item name="Address" label="Địa chỉ"><Input.TextArea rows={2} /></Form.Item>
              <Form.Item label="Tọa độ" tooltip="Cần cho tối ưu tuyến đường">
                <Space.Compact style={{ width: "100%" }}>
                  <Form.Item name="Latitude" noStyle>
                    <InputNumber placeholder="Vĩ độ (VD: 10.7769)" style={{ width: "50%" }} step={0.0001} />
                  </Form.Item>
                  <Form.Item name="Longitude" noStyle>
                    <InputNumber placeholder="Kinh độ (VD: 106.7009)" style={{ width: "50%" }} step={0.0001} />
                  </Form.Item>
                </Space.Compact>
                <div style={{ marginTop: 6 }}><GeoButton /></div>
              </Form.Item>
              <Form.Item name="Phone" label="Số điện thoại"><Input /></Form.Item>
              <Form.Item name="Email" label="Email"><Input type="email" /></Form.Item>
              <Form.Item name="OpenTime" label="Giờ mở cửa"><Input placeholder="08:00" /></Form.Item>
              <Form.Item name="CloseTime" label="Giờ đóng cửa"><Input placeholder="22:00" /></Form.Item>
              <Form.Item name="ServiceTime" label="Thời gian dừng giao (phút)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </>
          }
        />
      )
    },
    {
      key: "customer-groups", label: "Nhóm KH",
      children: (
        <CrudTab
          queryKey="customer-groups" listFn={customerGroupApi.list} createFn={customerGroupApi.create}
          updateFn={customerGroupApi.update} removeFn={customerGroupApi.remove}
          codeField="GroupCode" codeLabel="Mã nhóm" canWrite={canCustomer} orgs={orgs}
          exportFields={[
            { label: "Mã nhóm", key: "GroupCode" }, { label: "Tên nhóm", key: "XName" },
            { label: "Mô tả", key: "Description" }, { label: "Trạng thái", key: "Status" }
          ]}
          exportFilename="customer-groups.xlsx"
          importFn={customerGroupApi.import}
          importTemplateFields={["GroupCode","XName","Description"]}
          columns={[
            { title: "Mã nhóm", dataIndex: "GroupCode", width: 150, render: (v) => <Tag color="blue">{v}</Tag> },
            { title: "Tên nhóm", dataIndex: "XName" },
            { title: "Mô tả", dataIndex: "Description" },
            statusCol
          ]}
          formFields={
            <Form.Item name="Description" label="Mô tả">
              <Input.TextArea rows={2} />
            </Form.Item>
          }
        />
      )
    },
    {
      key: "product-categories", label: "Nhóm SP",
      children: (
        <CrudTab
          queryKey="product-categories" listFn={productCategoryApi.list} createFn={productCategoryApi.create}
          updateFn={productCategoryApi.update} removeFn={productCategoryApi.remove}
          codeField="CategoryCode" codeLabel="Mã nhóm SP" canWrite={canProduct} orgs={orgs}
          exportFields={[
            { label: "Mã nhóm", key: "CategoryCode" }, { label: "Tên", key: "XName" },
            { label: "Loại", key: "CategoryType" },
            { label: "TG bốc dỡ/thùng (phút)", key: "UnloadTimePerUnit" },
            { label: "Cho chồng hàng", key: "AllowedTopLoad" },
            { label: "Trạng thái", key: "Status" }
          ]}
          exportFilename="product-categories.xlsx"
          importFn={productCategoryApi.import}
          importTemplateFields={["CategoryCode","XName","CategoryType","UnloadTimePerUnit","AllowedTopLoad"]}
          columns={[
            { title: "Mã nhóm", dataIndex: "CategoryCode", width: 140, render: (v) => <Tag color="purple">{v}</Tag> },
            { title: "Tên nhóm", dataIndex: "XName" },
            { title: "Loại", dataIndex: "CategoryType", width: 110, render: (v) => <Tag>{v}</Tag> },
            { title: "TG bốc dỡ (phút)", dataIndex: "UnloadTimePerUnit", width: 140 },
            { title: "Chồng hàng", dataIndex: "AllowedTopLoad", width: 100, render: (v) => <Tag color={v ? "green" : "red"}>{v ? "Cho phép" : "Không"}</Tag> },
            statusCol
          ]}
          formFields={
            <>
              <Form.Item name="CategoryType" label="Loại hàng hoá" initialValue="OTHER">
                <Select options={[
                  { value: "FOOD",        label: "Thực phẩm" },
                  { value: "BEVERAGE",    label: "Đồ uống" },
                  { value: "ELECTRONICS", label: "Điện tử" },
                  { value: "APPAREL",     label: "Thời trang" },
                  { value: "PHARMA",      label: "Dược phẩm" },
                  { value: "CHEMICALS",   label: "Hoá chất" },
                  { value: "OTHER",       label: "Khác" }
                ]} />
              </Form.Item>
              <Form.Item name="UnloadTimePerUnit" label="Thời gian bốc dỡ/thùng (phút)" initialValue={0}>
                <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="AllowedTopLoad" label="Cho phép chồng hàng lên trên" initialValue={true}>
                <Select options={[{ value: true, label: "Cho phép" }, { value: false, label: "Không cho phép" }]} />
              </Form.Item>
            </>
          }
        />
      )
    },
    {
      key: "products", label: "Sản phẩm",
      children: (
        <CrudTab
          queryKey="products" listFn={productApi.list} createFn={productApi.create}
          updateFn={productApi.update} removeFn={productApi.remove}
          codeField="ProductCode" codeLabel="Mã sản phẩm" canWrite={canProduct} orgs={orgs}
          exportFields={[
            { label: "Mã SP", key: "ProductCode" }, { label: "Tên", key: "XName" },
            { label: "ĐVT", key: "Unit" },
            { label: "KG/thùng", key: "WeightPerCase" }, { label: "Đơn giá", key: "Price" },
            { label: "Trạng thái", key: "Status" }
          ]}
          exportFilename="products.xlsx"
          importFn={productApi.import}
          importTemplateFields={["ProductCode","XName","CategoryCode","Unit","WeightPerCase","VolumePerCase","ItemsPerCase","Price"]}
          columns={[
            { title: "Mã SP", dataIndex: "ProductCode", width: 130, render: (v) => <Tag color="purple">{v}</Tag> },
            { title: "Tên", dataIndex: "XName" },
            { title: "Nhóm SP", dataIndex: "CategoryID", width: 140,
              render: (v) => { const c = cats.find((x) => x._id === v); return c ? <Tag color="blue">{c.XName}</Tag> : null; } },
            { title: "ĐVT", dataIndex: "Unit", width: 70 },
            { title: "KG/thùng", dataIndex: "WeightPerCase", width: 100 },
            statusCol
          ]}
          formFields={
            <>
              <Form.Item name="CategoryID" label="Nhóm sản phẩm">
                <Select allowClear showSearch optionFilterProp="label" placeholder="Chọn nhóm SP"
                  options={cats.map((c) => ({ value: c._id, label: `[${c.CategoryCode}] ${c.XName}` }))} />
              </Form.Item>
              <Form.Item name="Unit" label="Đơn vị tính" initialValue="pcs">
                <Input placeholder="pcs, kg, lít..." />
              </Form.Item>
              <Form.Item name="WeightPerCase" label="Khối lượng/thùng (kg)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="VolumePerCase" label="Thể tích/thùng (m³)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="ItemsPerCase" label="Số lượng/thùng" initialValue={1}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="Price" label="Đơn giá (VND)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
              </Form.Item>
            </>
          }
        />
      )
    },
    {
      key: "vehicles", label: "Phương tiện",
      children: (
        <CrudTab
          queryKey="vehicles" listFn={vehicleApi.list} createFn={vehicleApi.create}
          updateFn={vehicleApi.update} removeFn={vehicleApi.remove}
          codeField="VehicleCode" codeLabel="Mã xe" canWrite={canVehicle} orgs={orgs}
          exportFields={[
            { label: "Mã xe", key: "VehicleCode" }, { label: "Tên", key: "XName" },
            { label: "Biển số", key: "LicensePlate" }, { label: "Loại", key: "VehicleType" },
            { label: "Tải trọng(kg)", key: "MaxWeight" }, { label: "Thể tích(m³)", key: "MaxVolume" },
            { label: "Trạng thái", key: "Status" }
          ]}
          exportFilename="vehicles.xlsx"
          importFn={vehicleApi.import}
          importTemplateFields={["VehicleCode","XName","LicensePlate","VehicleType","MaxWeight","MaxVolume","MaxCases","FixedCost","CostPerKm","AvgSpeedKmh","LoadingTime","UnloadingTimePerStop"]}
          columns={[
            { title: "Mã xe", dataIndex: "VehicleCode", width: 120, render: (v) => <Tag color="cyan">{v}</Tag> },
            { title: "Tên / Mô tả", dataIndex: "XName" },
            { title: "Biển số", dataIndex: "LicensePlate", width: 120 },
            { title: "Loại", dataIndex: "VehicleType", width: 80 },
            { title: "Tải(kg)", dataIndex: "MaxWeight", width: 90 },
            statusCol
          ]}
          formFields={
            <>
              <Form.Item name="LicensePlate" label="Biển số xe"><Input placeholder="29B-12345" /></Form.Item>
              <Form.Item name="VehicleType" label="Loại xe" initialValue="TRUCK">
                <Select options={[
                  { value: "TRUCK",      label: "Truck — Xe tải" },
                  { value: "SEMI_TRUCK", label: "Semi-truck — Xe đầu kéo" },
                  { value: "TRAILER",    label: "Trailer — Xe rơ-moóc" },
                  { value: "BIKE",       label: "Bike — Xe máy" }
                ]} />
              </Form.Item>
              <Form.Item name="MaxWeight" label="Tải trọng tối đa (kg)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="MaxVolume" label="Thể tích tối đa (m³)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="MaxCases" label="Số thùng tối đa" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="FixedCost" label="Chi phí cố định/ngày (VND)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
              </Form.Item>
              <Form.Item name="CostPerKm" label="Chi phí/km (VND)" initialValue={0}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="AvgSpeedKmh" label="Tốc độ trung bình (km/h)" initialValue={40} tooltip="Dùng để tính thời gian di chuyển giữa các điểm">
                <InputNumber min={1} max={120} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="LoadingTime" label="Thời gian bốc hàng tại kho (phút)" initialValue={30} tooltip="Thời gian xếp hàng lên xe trước khi xuất phát">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="UnloadingTimePerStop" label="Thời gian dỡ hàng tại mỗi điểm (phút)" initialValue={15} tooltip="Thời gian giao hàng & ký xác nhận tại 1 khách">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </>
          }
        />
      )
    },
    {
      key: "services", label: "Dịch vụ 3PL",
      children: (
        <CrudTab
          queryKey="services" listFn={serviceApi.list} createFn={serviceApi.create}
          updateFn={serviceApi.update} removeFn={serviceApi.remove}
          codeField="ServiceCode" codeLabel="Mã dịch vụ" canWrite={canService} orgs={orgs}
          exportFields={[
            { label: "Mã DV", key: "ServiceCode" }, { label: "Tên", key: "XName" },
            { label: "Nhà vận chuyển", key: "Carrier" }, { label: "Loại", key: "ServiceType" },
            { label: "Giá cố định", key: "FlatRate" }, { label: "Giá/km", key: "PricePerKm" },
            { label: "Giá/kg", key: "PricePerKg" }, { label: "Giá/m³", key: "PricePerCBM" },
            { label: "Phí tối thiểu", key: "MinCharge" }, { label: "Phụ phí nhiên liệu (%)", key: "FuelSurchargePercent" },
            { label: "Trạng thái", key: "Status" }
          ]}
          exportFilename="services-3pl.xlsx"
          importFn={serviceApi.import}
          importTemplateFields={["ServiceCode","XName","Carrier","ServiceType","FlatRate","PricePerKm","PricePerKg","PricePerCBM","MinCharge","FuelSurchargePercent"]}
          columns={[
            { title: "Mã DV", dataIndex: "ServiceCode", width: 120, render: (v) => <Tag color="geekblue">{v}</Tag> },
            { title: "Tên dịch vụ", dataIndex: "XName" },
            { title: "Nhà vận chuyển", dataIndex: "Carrier", width: 150 },
            { title: "Loại", dataIndex: "ServiceType", width: 100, render: (v) => <Tag>{v}</Tag> },
            { title: "Giá cố định", dataIndex: "FlatRate", width: 120, render: (v) => (v || 0).toLocaleString("vi-VN") + " ₫" },
            { title: "Giá/km", dataIndex: "PricePerKm", width: 100, render: (v) => (v || 0).toLocaleString("vi-VN") },
            { title: "Phí tối thiểu", dataIndex: "MinCharge", width: 120, render: (v) => (v || 0).toLocaleString("vi-VN") + " ₫" },
            statusCol
          ]}
          formFields={
            <>
              <Form.Item name="Carrier" label="Nhà vận chuyển (3PL)">
                <Input placeholder="VD: Giao Hàng Nhanh, DHL, Kerry Express..." />
              </Form.Item>
              <Form.Item name="ServiceType" label="Loại dịch vụ" initialValue="FTL">
                <Select options={[
                  { value: "FTL",          label: "FTL — Full Truck Load (thuê nguyên xe)" },
                  { value: "LTL",          label: "LTL — Less Than Truck Load (ghép hàng)" },
                  { value: "EXPRESS",      label: "Express — Giao nhanh" },
                  { value: "LAST_MILE",    label: "Last Mile — Giao chặng cuối" },
                  { value: "REFRIGERATED", label: "Refrigerated — Dây chuyền lạnh" },
                  { value: "OTHER",        label: "Khác" }
                ]} />
              </Form.Item>
              <Form.Item name="Description" label="Mô tả / Tuyến đường áp dụng">
                <Input.TextArea rows={2} placeholder="VD: Nội thành HCM, HCM → HN..." />
              </Form.Item>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <Form.Item name="FlatRate" label="Giá cố định/chuyến (₫)" initialValue={0} style={{ marginBottom: 8 }}>
                  <InputNumber min={0} style={{ width: "100%" }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
                </Form.Item>
                <Form.Item name="MinCharge" label="Phí tối thiểu/chuyến (₫)" initialValue={0} style={{ marginBottom: 8 }}>
                  <InputNumber min={0} style={{ width: "100%" }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
                </Form.Item>
                <Form.Item name="PricePerKm" label="Giá theo km (₫/km)" initialValue={0} style={{ marginBottom: 8 }}>
                  <InputNumber min={0} style={{ width: "100%" }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
                </Form.Item>
                <Form.Item name="PricePerKg" label="Giá theo khối lượng (₫/kg)" initialValue={0} style={{ marginBottom: 8 }}>
                  <InputNumber min={0} style={{ width: "100%" }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
                </Form.Item>
                <Form.Item name="PricePerCBM" label="Giá theo thể tích (₫/m³)" initialValue={0} style={{ marginBottom: 8 }}>
                  <InputNumber min={0} style={{ width: "100%" }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
                </Form.Item>
                <Form.Item name="FuelSurchargePercent" label="Phụ phí nhiên liệu (%)" initialValue={0} style={{ marginBottom: 8 }}>
                  <InputNumber min={0} max={100} step={0.5} style={{ width: "100%" }} />
                </Form.Item>
              </div>
            </>
          }
        />
      )
    }
  ];

  // AI Agent deep-link: ?tab=customers|vehicles|products|...
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabKeys = tabs.map((t) => t.key);
  const urlTab = searchParams.get("tab");
  const activeKey = validTabKeys.includes(urlTab) ? urlTab : "customers";

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="title">Master Data</h2>
          <p className="subtitle">Khách hàng · Nhóm KH · Nhóm SP · Sản phẩm · Phương tiện · Dịch vụ</p>
        </div>
      </div>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => setSearchParams({ tab: key }, { replace: true })}
        items={tabs}
        type="card"
      />
    </>
  );
}
