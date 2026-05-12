import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag
} from "antd";
import { useState } from "react";
import { organizationApi } from "../../api/organization";
import { roleGroupApi } from "../../api/roleGroup";
import { Permissions, usePermissions } from "../../utils/permissions";

export default function RoleGroupsPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { can } = usePermissions();
  const canManage = can(Permissions.ROLE_MANAGE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const listQ = useQuery({ queryKey: ["role-groups"], queryFn: () => roleGroupApi.list() });
  const orgsQ = useQuery({ queryKey: ["organizations"], queryFn: organizationApi.list });
  const catalogQ = useQuery({ queryKey: ["role-groups", "catalog"], queryFn: roleGroupApi.catalog });

  const orgs = orgsQ.data?.data ?? [];
  const orgMap = Object.fromEntries(orgs.map((o) => [o._id, o]));
  const permissions = catalogQ.data?.data?.permissions ?? [];
  const kinds = catalogQ.data?.data?.kinds ?? ["admin", "normal"];

  const createM = useMutation({
    mutationFn: roleGroupApi.create,
    onSuccess: () => {
      message.success("Đã tạo nhóm vai trò");
      queryClient.invalidateQueries({ queryKey: ["role-groups"] });
      setModalOpen(false);
      form.resetFields();
    },
    onError: (e) => message.error(e.message)
  });

  const updateM = useMutation({
    mutationFn: ({ id, payload }) => roleGroupApi.update(id, payload),
    onSuccess: () => {
      message.success("Đã cập nhật");
      queryClient.invalidateQueries({ queryKey: ["role-groups"] });
      setModalOpen(false);
    },
    onError: (e) => message.error(e.message)
  });

  const removeM = useMutation({
    mutationFn: roleGroupApi.remove,
    onSuccess: () => {
      message.success("Đã xóa");
      queryClient.invalidateQueries({ queryKey: ["role-groups"] });
    },
    onError: (e) => message.error(e.message)
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ Kind: "normal", Permissions: [] });
    setModalOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      XCode: r.XCode,
      XName: r.XName,
      Kind: r.Kind,
      Permissions: r.Permissions,
      OrganizationID: r.OrganizationID
    });
    setModalOpen(true);
  };

  const onSubmit = async () => {
    const v = await form.validateFields();
    if (editing) {
      updateM.mutate({
        id: editing._id,
        payload: { XName: v.XName, Kind: v.Kind, Permissions: v.Permissions }
      });
    } else {
      createM.mutate(v);
    }
  };

  const columns = [
    { title: "Mã", dataIndex: "XCode", width: 130, render: (v) => <Tag color="purple">{v}</Tag> },
    { title: "Tên vai trò", dataIndex: "XName" },
    {
      title: "Loại",
      dataIndex: "Kind",
      width: 100,
      render: (v) => <Tag color={v === "admin" ? "red" : "blue"}>{v}</Tag>,
      filters: [
        { text: "Admin", value: "admin" },
        { text: "Normal", value: "normal" }
      ],
      onFilter: (val, rec) => rec.Kind === val
    },
    {
      title: "Tổ chức",
      dataIndex: "OrganizationID",
      width: 220,
      render: (id) => {
        const o = orgMap[id];
        return o ? <Tag>{o.XCode}</Tag> : id;
      }
    },
    {
      title: "Quyền",
      dataIndex: "Permissions",
      render: (perms) => (
        <Space size={4} wrap>
          {(perms ?? []).slice(0, 5).map((p) => (
            <Tag key={p} style={{ marginBottom: 2 }}>
              {p}
            </Tag>
          ))}
          {perms?.length > 5 && <Tag>+{perms.length - 5}</Tag>}
        </Space>
      )
    },
    canManage && {
      title: "Thao tác",
      width: 100,
      align: "right",
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Xóa?" onConfirm={() => removeM.mutate(r._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ].filter(Boolean);

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="title">Nhóm vai trò (RoleGroup)</h2>
          <p className="subtitle">
            BA 3.1.3 — Admin Group / Normal Group + Permissions theo từng phân hệ
          </p>
        </div>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm nhóm vai trò
          </Button>
        )}
      </div>

      <Card size="small">
        <Table
          size="small"
          rowKey="_id"
          loading={listQ.isLoading}
          columns={columns}
          dataSource={listQ.data?.data ?? []}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={onSubmit}
        title={editing ? `Sửa: ${editing.XCode}` : "Thêm nhóm vai trò"}
        confirmLoading={createM.isPending || updateM.isPending}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="OrganizationID"
            label="Thuộc tổ chức"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              disabled={!!editing}
              options={orgs.map((o) => ({
                value: o._id,
                label: `[${o.XCode}] ${o.XName}`
              }))}
            />
          </Form.Item>
          <Form.Item
            name="XCode"
            label="Mã nhóm (XCode)"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Input placeholder="VD: PLANNER" disabled={!!editing} />
          </Form.Item>
          <Form.Item
            name="XName"
            label="Tên nhóm (XName)"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Input placeholder="VD: Nhân viên kế hoạch" />
          </Form.Item>
          <Form.Item name="Kind" label="Loại nhóm" initialValue="normal">
            <Select
              options={kinds.map((k) => ({
                value: k,
                label: k === "admin" ? "Admin (CRUD cả Org con)" : "Normal (chỉ Org trực thuộc)"
              }))}
            />
          </Form.Item>
          <Form.Item
            name="Permissions"
            label="Quyền hạn"
            tooltip="Chọn '*' để cấp toàn quyền"
          >
            <Select
              mode="multiple"
              placeholder="Chọn permission codes"
              options={permissions.map((p) => ({ value: p, label: p }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
