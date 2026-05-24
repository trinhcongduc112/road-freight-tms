import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  MailOutlined,
  PlusOutlined,
  RedoOutlined,
  SearchOutlined,
  UploadOutlined
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App, Avatar, Badge, Button, Card, Form, Input, Modal,
  Popconfirm, Select, Space, Switch, Table, Tag, Tooltip
} from "antd";
import * as XLSX from "xlsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { organizationApi } from "../../../api/organization";
import { roleGroupApi } from "../../../api/roleGroup";
import { userApi } from "../../../api/user";
import { Permissions, usePermissions } from "../../../utils/permissions";

const FUNCTION_ROLE_OPTIONS = [
  { value: "IT_ADMIN",           label: "IT Admin — Quản trị hệ thống" },
  { value: "PLANNER",            label: "Planner — Lập kế hoạch" },
  { value: "DISPATCHER",         label: "Dispatcher — Điều phối" },
  { value: "PLANNER_DISPATCHER", label: "Planner & Dispatcher" },
  { value: "ACCOUNTANT",         label: "Accountant — Kế toán" },
  { value: "DRIVER",             label: "Driver — Tài xế" },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: "TRUCK",      label: "Truck — Xe tải" },
  { value: "SEMI_TRUCK", label: "Semi-truck — Xe đầu kéo" },
  { value: "TRAILER",    label: "Trailer — Xe rơ-moóc" },
  { value: "BIKE",       label: "Bike — Xe máy" }
];

const STATUS_CONFIG = {
  ACTIVE:         { color: "green",  label: "Hoạt động" },
  PENDING_INVITE: { color: "orange", label: "Chờ kích hoạt" },
  PENDING_VERIFY: { color: "blue",   label: "Chờ xác thực" },
  LOCKED:         { color: "red",    label: "Bị khóa" }
};

const ROLE_COLOR = {
  IT_ADMIN: "red", PLANNER: "blue", DISPATCHER: "cyan",
  PLANNER_DISPATCHER: "geekblue", ACCOUNTANT: "purple", DRIVER: "orange"
};
const ROLE_LABEL = {
  IT_ADMIN: "IT Admin", PLANNER: "Planner", DISPATCHER: "Dispatcher",
  PLANNER_DISPATCHER: "Planner & Disp.", ACCOUNTANT: "Kế toán", DRIVER: "Driver"
};

function exportXlsx(rows, fields, filename) {
  const data = rows.map((r) =>
    Object.fromEntries(fields.map((f) => [f.label, Array.isArray(r[f.key]) ? r[f.key].join(",") : (r[f.key] ?? "")]))
  );
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Users");
  XLSX.writeFile(wb, filename);
}

function UserFormFields({ watchRoles, orgs, roleGroups, editing }) {
  return (
    <>
      <Form.Item name="XCode" label="Mã nhân viên"><Input placeholder="EMP-005" /></Form.Item>
      <Form.Item name="FullName" label="Họ tên"><Input placeholder="Nguyễn Văn A" /></Form.Item>
      <Form.Item name="UserName" label="Username" rules={editing ? [] : [{ required: true }]}>
        <Input placeholder="username" disabled={!!editing} />
      </Form.Item>
      <Form.Item name="Email" label="Email" rules={[{ required: true, type: "email" }]}><Input /></Form.Item>
      <Form.Item name="Phone" label="Số điện thoại"><Input /></Form.Item>
      <Form.Item
        name="Password"
        label={editing ? "Mật khẩu mới (trống = không đổi)" : "Mật khẩu"}
        rules={editing ? [] : [{ required: true, min: 6 }]}
      >
        <Input.Password placeholder="••••••••" />
      </Form.Item>
      <Form.Item name="OrganizationIDs" label="Tổ chức" rules={[{ required: true, message: "Chọn ít nhất 1" }]}>
        <Select mode="multiple" showSearch optionFilterProp="label"
          options={(orgs ?? []).map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
      </Form.Item>
      <Form.Item name="RoleGroupID" label="Nhóm vai trò" rules={editing?.IsSuperAdmin ? [] : [{ required: true, message: "Chọn nhóm vai trò" }]}>
        <Select allowClear showSearch optionFilterProp="label" placeholder="Chọn nhóm vai trò"
          options={(roleGroups ?? []).map((g) => ({ value: g._id, label: `[${g.XCode}] ${g.XName}` }))} />
      </Form.Item>
      <Form.Item name="FunctionRoles" label="Phân quyền" rules={[{ required: true, message: "Chọn ít nhất 1 quyền" }]}>
        <Select mode="multiple" options={FUNCTION_ROLE_OPTIONS} placeholder="Chọn vai trò" />
      </Form.Item>
      {watchRoles?.includes("DRIVER") && (
        <Form.Item name="AllowedVehicleTypes" label="Loại xe được phép lái"
          rules={[{ required: true, message: "Chọn ít nhất 1 loại xe cho tài xế" }]}>
          <Select mode="multiple" options={VEHICLE_TYPE_OPTIONS} placeholder="Chọn loại xe" />
        </Form.Item>
      )}
      {editing && (
        <Form.Item name="IsActive" label="Hoạt động" valuePropName="checked">
          <Switch />
        </Form.Item>
      )}
    </>
  );
}

export default function UsersTab() {
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const { can, isSuper } = usePermissions();
  const canManage = isSuper || can(Permissions.USER_MANAGE);

  const [search, setSearch]       = useState("");
  const [orgFilter, setOrgFilter] = useState();
  const [editing, setEditing]     = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importOrgId, setImportOrgId] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [form] = Form.useForm();
  const [inviteForm] = Form.useForm();

  const watchRoles       = Form.useWatch("FunctionRoles", form) ?? [];
  const watchInviteRoles = Form.useWatch("FunctionRoles", inviteForm) ?? [];

  const usersQ = useQuery({ queryKey: ["users"], queryFn: () => userApi.list() });
  const orgsQ  = useQuery({ queryKey: ["organizations"], queryFn: organizationApi.list });
  const roleGroupsQ = useQuery({ queryKey: ["role-groups"], queryFn: () => roleGroupApi.list() });
  const orgs   = orgsQ.data?.data ?? [];
  const roleGroups = roleGroupsQ.data?.data ?? [];
  const orgMap = Object.fromEntries(orgs.map((o) => [o._id, o]));
  const roleGroupMap = Object.fromEntries(roleGroups.map((g) => [String(g._id), g]));

  const filtered = useMemo(() => {
    let list = usersQ.data?.data ?? [];
    if (orgFilter) list = list.filter((u) => u.OrganizationIDs?.map(String).includes(orgFilter));
    if (search) {
      const k = search.toLowerCase();
      list = list.filter((u) => u.UserName?.toLowerCase().includes(k) || u.Email?.toLowerCase().includes(k) || u.FullName?.toLowerCase().includes(k));
    }
    return list;
  }, [usersQ.data, search, orgFilter]);
  const displayRows = filtered.map((u) => {
    const roleGroupId = String(u.RoleGroupID?._id ?? u.RoleGroupID ?? "");
    return { ...u, RoleGroupName: roleGroupMap[roleGroupId]?.XName ?? "" };
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createM  = useMutation({ mutationFn: userApi.create, onSuccess: () => { message.success("Đã tạo người dùng"); invalidate(); setModalOpen(false); form.resetFields(); }, onError: (e) => message.error(e.message) });
  const inviteM  = useMutation({ mutationFn: userApi.invite, onSuccess: (res) => { message.success(`Đã gửi lời mời tới ${res.data?.data?.Email}`); invalidate(); setInviteOpen(false); inviteForm.resetFields(); }, onError: (e) => message.error(e.message) });
  const resendM  = useMutation({ mutationFn: userApi.resendInvitation, onSuccess: () => { message.success("Đã gửi lại lời mời"); invalidate(); }, onError: (e) => message.error(e.message) });
  const updateM  = useMutation({ mutationFn: ({ id, payload }) => userApi.update(id, payload), onSuccess: () => { message.success("Đã cập nhật"); invalidate(); setModalOpen(false); }, onError: (e) => message.error(e.message) });
  const removeM  = useMutation({ mutationFn: userApi.remove, onSuccess: () => { message.success("Đã xóa"); invalidate(); }, onError: (e) => message.error(e.message) });

  useEffect(() => {
    if (!modalOpen) return;
    if (editing) {
      form.setFieldsValue({
        XCode: editing.XCode, FullName: editing.FullName, UserName: editing.UserName,
        Email: editing.Email, Phone: editing.Phone,
        OrganizationIDs: editing.OrganizationIDs,
        RoleGroupID: editing.RoleGroupID?._id ?? editing.RoleGroupID,
        FunctionRoles: editing.FunctionRoles ?? [],
        AllowedVehicleTypes: editing.AllowedVehicleTypes ?? [],
        IsActive: editing.IsActive
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ IsActive: true, OrganizationIDs: [], RoleGroupID: undefined, FunctionRoles: [], AllowedVehicleTypes: [] });
    }
  }, [modalOpen, editing]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setModalOpen(true);
  };

  const onSubmit = async () => {
    const v = await form.validateFields();
    if (editing) {
      const p = {
        XCode: v.XCode, FullName: v.FullName, UserName: v.UserName,
        Email: v.Email, Phone: v.Phone,
        OrganizationIDs: v.OrganizationIDs,
        RoleGroupID: v.RoleGroupID || null,
        FunctionRoles: v.FunctionRoles,
        AllowedVehicleTypes: v.AllowedVehicleTypes ?? [],
        IsActive: v.IsActive
      };
      if (v.Password) p.Password = v.Password;
      updateM.mutate({ id: editing._id, payload: p });
    } else {
      createM.mutate({
        XCode: v.XCode, FullName: v.FullName, UserName: v.UserName,
        Email: v.Email, Phone: v.Phone, Password: v.Password,
        OrganizationIDs: v.OrganizationIDs,
        RoleGroupID: v.RoleGroupID || null,
        FunctionRoles: v.FunctionRoles,
        AllowedVehicleTypes: v.AllowedVehicleTypes ?? []
      });
    }
  };

  const onInvite = async () => {
    const v = await inviteForm.validateFields();
    inviteM.mutate({
      XCode: v.XCode, UserName: v.UserName, Email: v.Email,
      FullName: v.FullName, Phone: v.Phone,
      Password: v.Password || undefined,
      OrganizationIDs: v.OrganizationIDs,
      RoleGroupID: v.RoleGroupID || null,
      FunctionRoles: v.FunctionRoles ?? [],
      AllowedVehicleTypes: v.AllowedVehicleTypes ?? []
    });
  };

  /* ── Import Excel ── */
  function downloadTemplate() {
    const fields = ["UserName","Email","FullName","XCode","Phone","Password","OrganizationID","RoleGroupCode","FunctionRoles","AllowedVehicleTypes"];
    const ws = XLSX.utils.json_to_sheet([Object.fromEntries(fields.map((f) => [f, ""]))]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_users.xlsx");
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
    if (!importRows.length) { message.warning("Chưa chọn file"); return; }
    setImportLoading(true);
    try {
      const res = await userApi.import({ rows: importRows, defaultOrganizationId: importOrgId });
      const { created = 0, skipped = 0, errors = [] } = res?.data?.data ?? res?.data ?? {};
      setImportOpen(false);
      setImportRows([]);
      invalidate();
      modal.info({
        title: "Kết quả nhập Excel",
        content: (
          <div>
            <p>✅ Tạo mới: <b>{created}</b> tài khoản</p>
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

  const columns = [
    {
      title: "Người dùng", width: 260,
      render: (_, u) => (
        <Space>
          <Avatar style={{ background: "#1677ff" }}>{u.UserName?.[0]?.toUpperCase()}</Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>
              {u.UserName} {u.IsSuperAdmin && <Tag color="gold" style={{ fontSize: 10 }}>Super</Tag>}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{u.Email}</div>
          </div>
        </Space>
      )
    },
    {
      title: "Họ tên", dataIndex: "FullName", width: 180,
      render: (v) => v || <Tag>—</Tag>
    },
    { title: "Mã NV", dataIndex: "XCode", width: 90, render: (v) => v && <Tag>{v}</Tag> },
    {
      title: "Tổ chức", dataIndex: "OrganizationIDs", width: 140,
      render: (ids) => (
        <Space size={4} wrap>
          {(ids ?? []).map((id) => { const o = orgMap[id]; return o ? <Tag key={id}>{o.XCode}</Tag> : null; })}
        </Space>
      )
    },
    {
      title: "Phân quyền", dataIndex: "FunctionRoles",
      render: (roles) => (
        <Space size={4} wrap>
          {(roles ?? []).map((r) => <Tag key={r} color={ROLE_COLOR[r] ?? "default"}>{ROLE_LABEL[r] ?? r}</Tag>)}
          {(!roles || roles.length === 0) && <Tag>—</Tag>}
        </Space>
      )
    },
    {
      title: "Nhóm vai trò", dataIndex: "RoleGroupID", width: 190,
      render: (id) => {
        const key = String(id?._id ?? id ?? "");
        const group = roleGroupMap[key];
        return group ? <Tag color="geekblue">{group.XName}</Tag> : <Tag>—</Tag>;
      }
    },
    {
      title: "Loại xe", dataIndex: "AllowedVehicleTypes", width: 150,
      render: (types) => (
        <Space size={4} wrap>
          {(types ?? []).map((t) => <Tag key={t} color="cyan" style={{ fontSize: 11 }}>{t}</Tag>)}
        </Space>
      )
    },
    {
      title: "Trạng thái", dataIndex: "Status", width: 140,
      render: (v) => { const cfg = STATUS_CONFIG[v] ?? { color: "default", label: v }; return <Badge color={cfg.color} text={cfg.label} />; }
    },
    canManage && {
      title: "", width: 110, align: "right",
      render: (_, u) => (
        <Space size={4}>
          {u.Status === "PENDING_INVITE" && (
            <Tooltip title="Gửi lại lời mời">
              <Button size="small" icon={<RedoOutlined />} loading={resendM.isPending} onClick={() => resendM.mutate(u._id)} />
            </Tooltip>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(u)} />
          <Popconfirm title="Xóa user?" onConfirm={() => removeM.mutate(u._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={u.IsSuperAdmin} />
          </Popconfirm>
        </Space>
      )
    }
  ].filter(Boolean);

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Space>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm tên / email" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 220 }} />
          <Select allowClear placeholder="Lọc theo tổ chức" style={{ width: 220 }} value={orgFilter} onChange={setOrgFilter}
            options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
        </Space>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={() => exportXlsx(displayRows, [
            { label: "Username", key: "UserName" }, { label: "Họ tên", key: "FullName" },
            { label: "Email", key: "Email" }, { label: "Mã NV", key: "XCode" },
            { label: "Nhóm vai trò", key: "RoleGroupName" }, { label: "Phân quyền", key: "FunctionRoles" }, { label: "Loại xe", key: "AllowedVehicleTypes" },
            { label: "Trạng thái", key: "Status" }
          ], "users.xlsx")}>
            Xuất Excel
          </Button>
          {canManage && (
            <Button icon={<UploadOutlined />} onClick={() => { setImportOpen(true); setImportRows([]); setImportOrgId(null); }}>
              Nhập Excel
            </Button>
          )}
          {canManage && (
            <Button icon={<MailOutlined />} onClick={() => { setInviteOpen(true); inviteForm.resetFields(); }}>
              Mời qua email
            </Button>
          )}
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo tài khoản</Button>
          )}
        </Space>
      </div>

      <Card size="small">
        <Table size="small" rowKey="_id" loading={usersQ.isLoading || roleGroupsQ.isLoading} columns={columns} dataSource={displayRows} pagination={{ pageSize: 10 }} />
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} title={editing ? `Sửa: ${editing.UserName}` : "Tạo tài khoản"}
        onCancel={() => setModalOpen(false)} onOk={onSubmit}
        confirmLoading={createM.isPending || updateM.isPending} width={560}>
        <Form form={form} layout="vertical" preserve={false}>
          <UserFormFields watchRoles={watchRoles} orgs={orgs} roleGroups={roleGroups} editing={editing} />
        </Form>
      </Modal>

      {/* Invite Modal */}
      <Modal open={inviteOpen} title={<Space><MailOutlined /> Mời nhân viên qua email</Space>}
        onCancel={() => setInviteOpen(false)} onOk={onInvite}
        confirmLoading={inviteM.isPending} width={560} destroyOnHidden>
        <Form form={inviteForm} layout="vertical" preserve={false}>
          <Form.Item name="UserName" label="Tên đăng nhập" rules={[{ required: true }, { min: 3 }]}><Input placeholder="driver01" /></Form.Item>
          <Form.Item name="Email" label="Email" rules={[{ required: true, type: "email" }]}><Input /></Form.Item>
          <Form.Item name="FullName" label="Họ tên (tùy chọn)"><Input /></Form.Item>
          <Form.Item name="XCode" label="Mã nhân viên (tùy chọn)"><Input placeholder="EMP-010" /></Form.Item>
          <Form.Item
            name="Password"
            label="Mật khẩu"
            extra="Để trống → gửi email để nhân viên tự đặt mật khẩu. Điền vào → kích hoạt tài khoản ngay, không cần email."
          >
            <Input.Password placeholder="Tối thiểu 6 ký tự (tùy chọn)" />
          </Form.Item>
          <Form.Item name="OrganizationIDs" label="Tổ chức" rules={[{ required: true, message: "Chọn ít nhất 1" }]}>
            <Select mode="multiple" showSearch optionFilterProp="label"
              options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
          </Form.Item>
          <Form.Item name="RoleGroupID" label="Nhóm vai trò" rules={[{ required: true, message: "Chọn nhóm vai trò" }]}>
            <Select allowClear showSearch optionFilterProp="label" placeholder="Chọn nhóm vai trò"
              options={roleGroups.map((g) => ({ value: g._id, label: `[${g.XCode}] ${g.XName}` }))} />
          </Form.Item>
          <Form.Item name="FunctionRoles" label="Phân quyền">
            <Select mode="multiple" options={FUNCTION_ROLE_OPTIONS} placeholder="Chọn vai trò" />
          </Form.Item>
          {watchInviteRoles?.includes("DRIVER") && (
            <Form.Item name="AllowedVehicleTypes" label="Loại xe được phép lái">
              <Select mode="multiple" options={VEHICLE_TYPE_OPTIONS} placeholder="Chọn loại xe" />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal open={importOpen} title="Nhập tài khoản từ Excel"
        onCancel={() => setImportOpen(false)}
        onOk={submitImport} okText="Nhập dữ liệu"
        confirmLoading={importLoading} destroyOnHidden width={500}>
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>1. Tổ chức mặc định (nếu file không có OrganizationID)</div>
            <Select style={{ width: "100%" }} showSearch optionFilterProp="label" allowClear
              placeholder="Chọn tổ chức mặc định (tùy chọn)"
              value={importOrgId} onChange={setImportOrgId}
              options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
          </div>
          <div>
            <div style={{ marginBottom: 6, fontWeight: 500 }}>2. Tải file Excel lên</div>
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
              ✅ Đã đọc <b>{importRows.length}</b> dòng — mật khẩu mặc định <code>Abc@12345</code> nếu không điền cột Password
            </div>
          )}
        </Space>
      </Modal>

    </>
  );
}
