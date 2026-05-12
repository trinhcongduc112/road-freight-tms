import {
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  PlusOutlined,
  RedoOutlined,
  SearchOutlined,
  UserAddOutlined
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip
} from "antd";
import { useMemo, useState } from "react";
import { organizationApi } from "../../api/organization";
import { roleGroupApi } from "../../api/roleGroup";
import { userApi } from "../../api/user";
import { Permissions, usePermissions } from "../../utils/permissions";

const STATUS_CONFIG = {
  ACTIVE:         { color: "green",   label: "Hoạt động" },
  PENDING_INVITE: { color: "orange",  label: "Chờ kích hoạt" },
  PENDING_VERIFY: { color: "blue",    label: "Chờ xác thực email" },
  LOCKED:         { color: "red",     label: "Bị khóa" }
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { can, isSuper } = usePermissions();
  const canManage = isSuper || can(Permissions.USER_MANAGE);

  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form] = Form.useForm();
  const [inviteForm] = Form.useForm();

  const usersQ = useQuery({ queryKey: ["users"], queryFn: () => userApi.list() });
  const orgsQ = useQuery({ queryKey: ["organizations"], queryFn: organizationApi.list });
  const rolesQ = useQuery({ queryKey: ["role-groups"], queryFn: () => roleGroupApi.list() });

  const orgs = orgsQ.data?.data ?? [];
  const roles = rolesQ.data?.data ?? [];
  const orgMap = Object.fromEntries(orgs.map((o) => [o._id, o]));
  const roleMap = Object.fromEntries(roles.map((r) => [r._id, r]));

  const watchedOrgIds   = Form.useWatch("OrganizationIDs", form)   ?? [];
  const watchedInviteOrg = Form.useWatch("OrganizationIDs", inviteForm) ?? [];
  const availableRoles  = roles.filter((r) => watchedOrgIds.map(String).includes(r.OrganizationID?.toString()));
  const inviteRoles     = roles.filter((r) => watchedInviteOrg.map(String).includes(r.OrganizationID?.toString()));

  const filtered = useMemo(() => {
    let list = usersQ.data?.data ?? [];
    if (orgFilter) list = list.filter((u) => u.OrganizationIDs?.map(String).includes(orgFilter));
    if (search) {
      const k = search.toLowerCase();
      list = list.filter((u) =>
        u.UserName?.toLowerCase().includes(k) ||
        u.Email?.toLowerCase().includes(k) ||
        u.XCode?.toLowerCase().includes(k)
      );
    }
    return list;
  }, [usersQ.data, search, orgFilter]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  /* ── Mutations ── */
  const createM = useMutation({
    mutationFn: userApi.create,
    onSuccess: () => { message.success("Đã tạo người dùng"); invalidate(); setModalOpen(false); form.resetFields(); },
    onError: (e) => message.error(e.message)
  });
  const inviteM = useMutation({
    mutationFn: userApi.invite,
    onSuccess: (res) => {
      message.success(`Đã gửi lời mời tới ${res.data?.Email}`);
      invalidate(); setInviteOpen(false); inviteForm.resetFields();
    },
    onError: (e) => message.error(e.message)
  });
  const resendInviteM = useMutation({
    mutationFn: userApi.resendInvitation,
    onSuccess: () => { message.success("Đã gửi lại lời mời"); invalidate(); },
    onError: (e) => message.error(e.message)
  });
  const updateM = useMutation({
    mutationFn: ({ id, payload }) => userApi.update(id, payload),
    onSuccess: () => { message.success("Đã cập nhật"); invalidate(); setModalOpen(false); },
    onError: (e) => message.error(e.message)
  });
  const removeM = useMutation({
    mutationFn: userApi.remove,
    onSuccess: () => { message.success("Đã xóa"); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ IsActive: true, OrganizationIDs: [] }); setModalOpen(true); };
  const openEdit = (u) => {
    setEditing(u);
    form.setFieldsValue({ XCode: u.XCode, UserName: u.UserName, Email: u.Email, OrganizationIDs: u.OrganizationIDs, RoleGroupID: u.RoleGroupID, IsActive: u.IsActive });
    setModalOpen(true);
  };

  const onSubmit = async () => {
    const v = await form.validateFields();
    if (editing) {
      const payload = { XCode: v.XCode, UserName: v.UserName, Email: v.Email, OrganizationIDs: v.OrganizationIDs, RoleGroupID: v.RoleGroupID || null, IsActive: v.IsActive };
      if (v.Password) payload.Password = v.Password;
      updateM.mutate({ id: editing._id, payload });
    } else {
      createM.mutate({ XCode: v.XCode, UserName: v.UserName, Email: v.Email, Password: v.Password, OrganizationIDs: v.OrganizationIDs, RoleGroupID: v.RoleGroupID || null });
    }
  };

  const onInvite = async () => {
    const v = await inviteForm.validateFields();
    inviteM.mutate({ XCode: v.XCode, UserName: v.UserName, Email: v.Email, FullName: v.FullName, Phone: v.Phone, OrganizationIDs: v.OrganizationIDs, RoleGroupID: v.RoleGroupID || null });
  };

  const columns = [
    {
      title: "Người dùng", width: 260,
      render: (_, u) => (
        <Space>
          <Avatar style={{ background: "#1677ff" }}>{u.UserName?.[0]?.toUpperCase()}</Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{u.UserName} {u.IsSuperAdmin && <Tag color="gold" style={{ fontSize: 10 }}>Super</Tag>}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{u.Email}</div>
          </div>
        </Space>
      )
    },
    { title: "Mã NV", dataIndex: "XCode", width: 100, render: (v) => v && <Tag>{v}</Tag> },
    {
      title: "Tổ chức", dataIndex: "OrganizationIDs",
      render: (ids) => (
        <Space size={4} wrap>
          {(ids ?? []).map((id) => { const o = orgMap[id]; return o ? <Tag key={id}>{o.XCode}</Tag> : null; })}
        </Space>
      )
    },
    {
      title: "Vai trò", dataIndex: "RoleGroupID", width: 180,
      render: (id) => { const r = roleMap[id]; return r ? <Tag color={r.Kind === "admin" ? "red" : "blue"}>{r.XCode}</Tag> : <Tag>—</Tag>; }
    },
    {
      title: "Trạng thái", dataIndex: "Status", width: 150,
      render: (v) => {
        const cfg = STATUS_CONFIG[v] ?? { color: "default", label: v };
        return <Badge color={cfg.color} text={cfg.label} />;
      },
      filters: Object.entries(STATUS_CONFIG).map(([v, c]) => ({ text: c.label, value: v })),
      onFilter: (val, rec) => rec.Status === val
    },
    canManage && {
      title: "", width: 120, align: "right",
      render: (_, u) => (
        <Space size={4}>
          {u.Status === "PENDING_INVITE" && (
            <Tooltip title="Gửi lại lời mời">
              <Button size="small" icon={<RedoOutlined />} loading={resendInviteM.isPending} onClick={() => resendInviteM.mutate(u._id)} />
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
      <div className="page-header">
        <div>
          <h2 className="title">Người dùng</h2>
          <p className="subtitle">Mỗi user thuộc về một hoặc nhiều tổ chức (BA 3.6.2)</p>
        </div>
        {canManage && (
          <Space>
            <Button icon={<UserAddOutlined />} onClick={() => { setInviteOpen(true); inviteForm.resetFields(); }}>
              Mời qua email
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tạo thủ công
            </Button>
          </Space>
        )}
      </div>

      <Card size="small">
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Tìm theo tên / email / mã" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 280 }} />
          <Select allowClear placeholder="Lọc theo tổ chức" style={{ width: 280 }} value={orgFilter} onChange={setOrgFilter}
            options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
        </div>
        <Table size="small" rowKey="_id" loading={usersQ.isLoading} columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} />
      </Card>

      {/* ── Invite Modal ── */}
      <Modal open={inviteOpen} title={<Space><MailOutlined /> Mời nhân viên qua email</Space>}
        onCancel={() => setInviteOpen(false)} onOk={onInvite}
        confirmLoading={inviteM.isPending} width={560} destroyOnClose>
        <p style={{ color: "#888", marginBottom: 16, fontSize: 13 }}>
          Hệ thống sẽ gửi email chứa link kích hoạt. Người dùng tự đặt mật khẩu, không cần admin biết.
        </p>
        <Form form={inviteForm} layout="vertical" preserve={false}>
          <Form.Item name="UserName" label="Tên đăng nhập" rules={[{ required: true, message: "Bắt buộc" }, { min: 3 }]}>
            <Input placeholder="driver01" />
          </Form.Item>
          <Form.Item name="Email" label="Email" rules={[{ required: true, type: "email", message: "Email không hợp lệ" }]}>
            <Input placeholder="driver01@company.vn" />
          </Form.Item>
          <Form.Item name="FullName" label="Họ tên (tùy chọn)">
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="XCode" label="Mã nhân viên (tùy chọn)">
            <Input placeholder="EMP-010" />
          </Form.Item>
          <Form.Item name="OrganizationIDs" label="Tổ chức" rules={[{ required: true, message: "Chọn ít nhất 1" }]}>
            <Select mode="multiple" showSearch optionFilterProp="label"
              options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
          </Form.Item>
          <Form.Item name="RoleGroupID" label="Nhóm vai trò" extra="Chỉ hiện nhóm thuộc tổ chức đã chọn">
            <Select allowClear showSearch optionFilterProp="label"
              options={inviteRoles.map((r) => ({ value: r._id, label: `[${r.XCode}] ${r.XName}` }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Create/Edit Modal ── */}
      <Modal open={modalOpen} title={editing ? `Sửa user: ${editing.UserName}` : "Tạo người dùng (có mật khẩu)"}
        onCancel={() => setModalOpen(false)} onOk={onSubmit}
        confirmLoading={createM.isPending || updateM.isPending} width={600} destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="XCode" label="Mã nhân viên (XCode)"><Input placeholder="EMP-005" /></Form.Item>
          <Form.Item name="UserName" label="Username" rules={[{ required: true }]}>
            <Input placeholder="username" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="Email" label="Email" rules={[{ required: true, type: "email" }]}>
            <Input placeholder="user@road-freight.io" />
          </Form.Item>
          <Form.Item name="Password" label={editing ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}
            rules={editing ? [] : [{ required: true, min: 6, message: "Tối thiểu 6 ký tự" }]}>
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Form.Item name="OrganizationIDs" label="Tổ chức" rules={[{ required: true, message: "Chọn ít nhất 1" }]}>
            <Select mode="multiple" showSearch optionFilterProp="label"
              options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))} />
          </Form.Item>
          <Form.Item name="RoleGroupID" label="Nhóm vai trò" extra="Chỉ hiện nhóm thuộc tổ chức đã chọn">
            <Select allowClear showSearch optionFilterProp="label"
              options={availableRoles.map((r) => ({ value: r._id, label: `[${r.XCode}] ${r.XName}` }))} />
          </Form.Item>
          {editing && (
            <Form.Item name="IsActive" label="Hoạt động" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
