import { DeleteOutlined, DownloadOutlined, EditOutlined, EnvironmentOutlined, PlusOutlined, SearchOutlined, UploadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App, Button, Card, Col, Empty, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Table, Tag, Tree
} from "antd";
import * as XLSX from "xlsx";
import { useMemo, useRef, useState } from "react";
import { organizationApi } from "../../../api/organization";
import { Permissions, usePermissions } from "../../../utils/permissions";

const ORG_TYPE_OPTIONS = [
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "BRANCH",       label: "Branch" },
  { value: "DEPOT",        label: "Depot" }
];

function nextOrgType(parent) {
  if (!parent) return "MANUFACTURER";
  if (parent.OrgType === "MANUFACTURER") return "BRANCH";
  if (parent.OrgType === "BRANCH") return "DEPOT";
  return null;
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

function buildTreeData(roots) {
  const walk = (nodes) =>
    nodes.map((n) => ({
      key: n._id,
      title: (
        <span>
          <Tag color="blue" style={{ fontSize: 11 }}>{n.XCode}</Tag>
          {n.XName}
        </span>
      ),
      raw: n,
      children: n.children?.length ? walk(n.children) : undefined
    }));
  return walk(roots ?? []);
}

function exportXlsx(rows, filename) {
  const data = rows.map((r) => ({
    XCode: r.XCode, XName: r.XName, OrgType: r.OrgType, Address: r.Address ?? "",
    Latitude: r.Latitude ?? "", Longitude: r.Longitude ?? "",
    OpenTime: r.OpenTime ?? "", CloseTime: r.CloseTime ?? "", Status: r.Status
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Organizations");
  XLSX.writeFile(wb, filename);
}

export default function OrganizationsTab() {
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const { can } = usePermissions();
  const canManage = can(Permissions.ORG_MANAGE);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [creatingParentId, setCreatingParentId] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef(null);

  function downloadTemplate() {
    const fields = ["XCode","XName","OrgType","Address","Latitude","Longitude","OpenTime","CloseTime"];
    const ws = XLSX.utils.json_to_sheet([Object.fromEntries(fields.map((f) => [f, ""]))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_organizations.xlsx");
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      setImportRows(XLSX.utils.sheet_to_json(ws, { defval: "" }));
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  async function submitImport() {
    if (!importRows.length) { message.warning("Chưa chọn file"); return; }
    setImportLoading(true);
    try {
      const res = await organizationApi.import({ rows: importRows });
      const { created = 0, skipped = 0, errors = [] } = res?.data?.data ?? res?.data ?? {};
      setImportOpen(false);
      setImportRows([]);
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      modal.info({
        title: "Kết quả nhập Excel",
        content: (
          <div>
            <p>✅ Tạo mới: <b>{created}</b> tổ chức</p>
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
    } catch (e) { message.error(e.message); }
    finally { setImportLoading(false); }
  }

  const listQ = useQuery({ queryKey: ["organizations"], queryFn: organizationApi.list });
  const treeQ = useQuery({ queryKey: ["organizations", "tree"], queryFn: organizationApi.tree });

  const orgs       = listQ.data?.data ?? [];
  const treeRoots  = treeQ.data?.data ?? [];
  const parentOrg = creatingParentId ? orgs.find((o) => o._id === creatingParentId) : null;
  const allowedCreateType = nextOrgType(parentOrg);

  const filtered = useMemo(() => {
    if (!search) return orgs;
    const k = search.toLowerCase();
    return orgs.filter(
      (o) => o.XCode.toLowerCase().includes(k) || o.XName.toLowerCase().includes(k) || o.Address?.toLowerCase().includes(k)
    );
  }, [orgs, search]);

  const createM = useMutation({
    mutationFn: organizationApi.create,
    onSuccess: () => { message.success("Đã tạo tổ chức"); queryClient.invalidateQueries({ queryKey: ["organizations"] }); setModalOpen(false); setEditing(null); setCreatingParentId(undefined); form.resetFields(); },
    onError: (err) => message.error(err.message)
  });

  const updateM = useMutation({
    mutationFn: ({ id, payload }) => organizationApi.update(id, payload),
    onSuccess: () => { message.success("Đã cập nhật"); queryClient.invalidateQueries({ queryKey: ["organizations"] }); setModalOpen(false); setEditing(null); setCreatingParentId(undefined); form.resetFields(); },
    onError: (err) => message.error(err.message)
  });

  const removeM = useMutation({
    mutationFn: organizationApi.remove,
    onSuccess: () => { message.success("Đã xóa"); queryClient.invalidateQueries({ queryKey: ["organizations"] }); },
    onError: (err) => message.error(err.message)
  });

  const openCreate = (parentId) => {
    setEditing(null); setCreatingParentId(parentId); setModalOpen(true);
  };

  const openEdit = (org) => {
    setEditing(org); setCreatingParentId(undefined); setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); setCreatingParentId(undefined); form.resetFields(); };

  /* Build initialValues for Form. Re-keying the Form on editing._id forces fresh
     mount with the new values (fixes "modal opens empty when editing" bug). */
  const initialValues = editing
    ? {
        XCode: editing.XCode, XName: editing.XName, OrgType: editing.OrgType,
        Address: editing.Address,
        Latitude: editing.Latitude ?? null, Longitude: editing.Longitude ?? null,
        OpenTime: editing.OpenTime ?? null, CloseTime: editing.CloseTime ?? null,
        Status: editing.Status
      }
    : { Status: "Active", ParentID: creatingParentId, OrgType: allowedCreateType };

  const onSubmit = async () => {
    const values = await form.validateFields();
    /* Lat/lng + opening hours only meaningful for DEPOT — strip otherwise */
    const isDepot = values.OrgType === "DEPOT";
    const coords = {
      Latitude:  isDepot ? (values.Latitude  ?? null) : null,
      Longitude: isDepot ? (values.Longitude ?? null) : null,
      OpenTime:  isDepot ? (values.OpenTime  || null) : null,
      CloseTime: isDepot ? (values.CloseTime || null) : null
    };
    if (editing) {
      updateM.mutate({ id: editing._id, payload: { XName: values.XName, OrgType: values.OrgType, Address: values.Address, Status: values.Status, ...coords } });
    } else {
      createM.mutate({ XCode: values.XCode, XName: values.XName, OrgType: values.OrgType, Address: values.Address, Status: values.Status, ParentID: values.ParentID || null, ...coords });
    }
  };

  const orgTypeOptions = editing
    ? ORG_TYPE_OPTIONS
    : ORG_TYPE_OPTIONS.filter((option) => option.value === allowedCreateType);

  const columns = [
    { title: "Mã", dataIndex: "XCode", width: 160, render: (v) => <Tag color="blue">{v}</Tag> },
    { title: "Tên tổ chức", dataIndex: "XName" },
    { title: "Loại", dataIndex: "OrgType", width: 150, render: (v) => <span style={{ whiteSpace: "nowrap" }}>{v}</span> },
    { title: "Địa chỉ", dataIndex: "Address", ellipsis: true },
    { title: "Trạng thái", dataIndex: "Status", width: 120, render: (v) => <Tag color={v === "Active" ? "green" : "default"}>{v}</Tag> },
    canManage && {
      title: "Thao tác", width: 100, align: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          {record.OrgType !== "MANUFACTURER" && (
            <Popconfirm title="Xóa tổ chức này?" onConfirm={() => removeM.mutate(record._id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ].filter(Boolean);

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button icon={<DownloadOutlined />} onClick={() => exportXlsx(filtered, "organizations.xlsx")}>
          Xuất Excel
        </Button>
        {canManage && (
          <Button icon={<UploadOutlined />} onClick={() => { setImportOpen(true); setImportRows([]); }}>
            Nhập Excel
          </Button>
        )}
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>Thêm tổ chức gốc</Button>
        )}
      </div>
      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card title="Cây tổ chức" size="small">
            {treeQ.isLoading ? "Đang tải..." : treeRoots.length === 0 ? (
              <Empty description="Chưa có dữ liệu" />
            ) : (
              <Tree
                treeData={buildTreeData(treeRoots)}
                defaultExpandAll
                blockNode
                titleRender={(node) => (
                  <Space size={4}>
                    {node.title}
                    {canManage && nextOrgType(node.raw) && (
                      <Button size="small" type="link" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); openCreate(node.raw._id); }}>con</Button>
                    )}
                  </Space>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card size="small"
            title={<Space><span>Danh sách</span><Tag>{filtered.length}</Tag></Space>}
            extra={<Input size="small" allowClear prefix={<SearchOutlined />} placeholder="Tìm theo mã / tên" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />}
          >
            <Table size="small" loading={listQ.isLoading} rowKey="_id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} />
          </Card>
        </Col>
      </Row>

      {/* Import Excel modal */}
      <Modal open={importOpen} title="Nhập tổ chức từ Excel"
        onCancel={() => setImportOpen(false)}
        onOk={submitImport} okText="Nhập dữ liệu"
        confirmLoading={importLoading} destroyOnHidden width={480}>
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>Tải file Excel lên</div>
            <Space>
              <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
                Chọn file (.xlsx)
              </Button>
              <Button size="small" icon={<DownloadOutlined />} onClick={downloadTemplate}>
                Tải mẫu
              </Button>
            </Space>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls"
              style={{ display: "none" }} onChange={onFileChange} />
          </div>
          {importRows.length > 0 && (
            <div style={{ padding: "8px 12px", background: "#f6ffed", borderRadius: 6, border: "1px solid #b7eb8f" }}>
              ✅ Đã đọc <b>{importRows.length}</b> dòng — OrgType mặc định là <code>DEPOT</code> nếu để trống
            </div>
          )}
        </Space>
      </Modal>

      <Modal open={modalOpen} title={editing ? `Sửa: ${editing.XCode}` : "Thêm tổ chức mới"}
        onCancel={closeModal} onOk={onSubmit}
        confirmLoading={createM.isPending || updateM.isPending} destroyOnHidden width={540}>
        <Form key={editing?._id ?? `new-${creatingParentId ?? "root"}`} form={form} layout="vertical" initialValues={initialValues}>
          {!editing && creatingParentId !== undefined && (
            <Form.Item name="ParentID" label="Tổ chức cha">
              <Select allowClear placeholder="Chọn tổ chức cha" showSearch optionFilterProp="label"
                options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))}
                disabled />
            </Form.Item>
          )}
          <Form.Item name="XCode" label="Mã (XCode)" rules={[{ required: true }]}
            tooltip={editing ? "Mã tổ chức là khóa định danh hệ thống (gắn với role admin AD-{CODE} và phân cấp tổ chức) — không sửa được sau khi tạo." : null}>
            <Input placeholder="VD: DEPOT-HN" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="XName" label="Tên tổ chức" rules={[{ required: true }]}>
            <Input placeholder="VD: Kho Hà Nội" />
          </Form.Item>
          <Form.Item name="OrgType" label="Loại tổ chức" rules={[{ required: true }]}>
            <Select options={orgTypeOptions} disabled={!editing} />
          </Form.Item>
          <Form.Item name="Address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
          {/* Lat/lng + opening hours: only relevant for DEPOT (kho). Hidden for branch / shipper / manufacturer. */}
          <Form.Item shouldUpdate={(prev, curr) => prev.OrgType !== curr.OrgType} noStyle>
            {({ getFieldValue }) => getFieldValue("OrgType") === "DEPOT" && (
              <>
                <Form.Item label="Tọa độ" tooltip="Tọa độ kho — bắt buộc để optimizer tính tuyến">
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
                <Form.Item label="Khung giờ hoạt động kho">
                  <Space.Compact style={{ width: "100%" }}>
                    <Form.Item name="OpenTime" noStyle>
                      <Input placeholder="Mở: 08:00" style={{ width: "50%" }} />
                    </Form.Item>
                    <Form.Item name="CloseTime" noStyle>
                      <Input placeholder="Đóng: 22:00" style={{ width: "50%" }} />
                    </Form.Item>
                  </Space.Compact>
                </Form.Item>
              </>
            )}
          </Form.Item>
          <Form.Item name="Status" label="Trạng thái" initialValue="Active">
            <Select options={[{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
