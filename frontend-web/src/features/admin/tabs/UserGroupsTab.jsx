import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from "antd";
import * as XLSX from "xlsx";
import { useRef, useState } from "react";
import { organizationApi } from "../../../api/organization";
import { roleGroupApi } from "../../../api/roleGroup";
import { Permissions, usePermissions } from "../../../utils/permissions";

export default function UserGroupsTab() {
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const { can } = usePermissions();
  const canManage = can(Permissions.ROLE_MANAGE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef(null);

  const listQ    = useQuery({ queryKey: ["role-groups"], queryFn: () => roleGroupApi.list() });
  const orgsQ    = useQuery({ queryKey: ["organizations"], queryFn: organizationApi.list });
  const catalogQ = useQuery({ queryKey: ["role-groups", "catalog"], queryFn: roleGroupApi.catalog });

  const orgs        = orgsQ.data?.data ?? [];
  const orgMap      = Object.fromEntries(orgs.map((o) => [o._id, o]));
  const permissions = catalogQ.data?.data?.permissions ?? [];
  const kinds       = catalogQ.data?.data?.kinds ?? ["admin", "normal"];
  const allGroups   = listQ.data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["role-groups"] });

  const createM = useMutation({ mutationFn: roleGroupApi.create, onSuccess: () => { message.success("Đã tạo nhóm vai trò"); invalidate(); setModalOpen(false); form.resetFields(); }, onError: (e) => message.error(e.message) });
  const updateM = useMutation({ mutationFn: ({ id, payload }) => roleGroupApi.update(id, payload), onSuccess: () => { message.success("Đã cập nhật"); invalidate(); setModalOpen(false); }, onError: (e) => message.error(e.message) });
  const removeM = useMutation({ mutationFn: roleGroupApi.remove, onSuccess: () => { message.success("Đã xóa"); invalidate(); }, onError: (e) => message.error(e.message) });

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ Kind: "normal", Permissions: [] }); setModalOpen(true); };
  const openEdit   = (r) => { setEditing(r); form.setFieldsValue({ XCode: r.XCode, XName: r.XName, Kind: r.Kind, Permissions: r.Permissions, OrganizationID: r.OrganizationID }); setModalOpen(true); };

  const onSubmit = async () => {
    const v = await form.validateFields();
    if (editing) updateM.mutate({ id: editing._id, payload: { XName: v.XName, Kind: v.Kind, Permissions: v.Permissions } });
    else createM.mutate(v);
  };

  /* ── Export ── */
  function doExport() {
    const data = allGroups.map((r) => ({
      XCode: r.XCode, XName: r.XName, Kind: r.Kind,
      OrganizationID: r.OrganizationID,
      OrgCode: orgMap[r.OrganizationID]?.XCode ?? "",
      Permissions: (r.Permissions ?? []).join(",")
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RoleGroups");
    XLSX.writeFile(wb, "role-groups.xlsx");
  }

  /* ── Import ── */
  function downloadTemplate() {
    const fields = ["XCode","XName","Kind","OrganizationID"];
    const ws = XLSX.utils.json_to_sheet([Object.fromEntries(fields.map((f) => [f, ""]))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_role-groups.xlsx");
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
      const res = await roleGroupApi.import({ rows: importRows });
      const { created = 0, skipped = 0, errors = [] } = res?.data?.data ?? res?.data ?? {};
      setImportOpen(false);
      setImportRows([]);
      invalidate();
      modal.info({
        title: "Kết quả nhập Excel",
        content: (
          <div>
            <p>✅ Tạo mới: <b>{created}</b> nhóm vai trò</p>
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

  const columns = [
    { title: "Mã nhóm", dataIndex: "XCode", width: 140, render: (v) => <Tag color="purple">{v}</Tag> },
    { title: "Tên nhóm", dataIndex: "XName" },
    { title: "Loại", dataIndex: "Kind", width: 100, render: (v) => <Tag color={v === "admin" ? "red" : "blue"}>{v}</Tag> },
    { title: "Tổ chức", dataIndex: "OrganizationID", width: 180, render: (id) => { const o = orgMap[id]; return o ? <Tag>{o.XCode}</Tag> : "—"; } },
    {
      title: "Quyền", dataIndex: "Permissions",
      render: (perms) => (
        <Space size={4} wrap>
          {(perms ?? []).slice(0, 5).map((p) => <Tag key={p} style={{ marginBottom: 2 }}>{p}</Tag>)}
          {perms?.length > 5 && <Tag>+{perms.length - 5}</Tag>}
        </Space>
      )
    },
    canManage && {
      title: "Thao tác", width: 100, align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xóa nhóm vai trò?" onConfirm={() => removeM.mutate(r._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ].filter(Boolean);

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button icon={<DownloadOutlined />} onClick={doExport}>Xuất Excel</Button>
        {canManage && (
          <Button icon={<UploadOutlined />} onClick={() => { setImportOpen(true); setImportRows([]); }}>
            Nhập Excel
          </Button>
        )}
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm nhóm vai trò</Button>
        )}
      </div>

      <Card size="small">
        <Table size="small" rowKey="_id" loading={listQ.isLoading} columns={columns} dataSource={allGroups} pagination={{ pageSize: 10 }} />
      </Card>

      {/* Import modal */}
      <Modal open={importOpen} title="Nhập nhóm vai trò từ Excel"
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
              ✅ Đã đọc <b>{importRows.length}</b> dòng — cột OrganizationID phải là ObjectId của tổ chức
            </div>
          )}
        </Space>
      </Modal>

      {/* Create/Edit modal */}
      <Modal open={modalOpen} onCancel={() => setModalOpen(false)} onOk={onSubmit}
        title={editing ? `Sửa: ${editing.XCode}` : "Thêm nhóm vai trò"}
        confirmLoading={createM.isPending || updateM.isPending} width={600} destroyOnHidden>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="OrganizationID" label="Thuộc tổ chức" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" disabled={!!editing}
              options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
          </Form.Item>
          <Form.Item name="XCode" label="Mã nhóm (XCode)" rules={[{ required: true }]}>
            <Input placeholder="VD: PLANNER" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="XName" label="Tên nhóm" rules={[{ required: true }]}>
            <Input placeholder="VD: Nhân viên kế hoạch" />
          </Form.Item>
          <Form.Item name="Kind" label="Loại" initialValue="normal">
            <Select options={kinds.map((k) => ({ value: k, label: k === "admin" ? "Admin (CRUD toàn Org)" : "Normal (Org trực thuộc)" }))} />
          </Form.Item>
          <Form.Item name="Permissions" label="Quyền hạn" tooltip="Chọn '*' để cấp toàn quyền">
            <Select mode="multiple" placeholder="Chọn permission codes"
              options={permissions.map((p) => ({ value: p, label: p }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
