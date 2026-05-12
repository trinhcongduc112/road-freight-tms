import { DeleteOutlined, EditOutlined, EnvironmentOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Col,
  Empty,
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
  Tree,
  Typography
} from "antd";
import { useMemo, useState } from "react";
import { organizationApi } from "../../api/organization";
import { Permissions, usePermissions } from "../../utils/permissions";

const { Text } = Typography;

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
          <Tag color="blue" style={{ fontSize: 11 }}>
            {n.XCode}
          </Tag>
          {n.XName}
        </span>
      ),
      raw: n,
      children: n.children?.length ? walk(n.children) : undefined
    }));
  return walk(roots ?? []);
}

export default function OrganizationsPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { can } = usePermissions();
  const canManage = can(Permissions.ORG_MANAGE);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [creatingParentId, setCreatingParentId] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const listQ = useQuery({ queryKey: ["organizations"], queryFn: organizationApi.list });
  const treeQ = useQuery({ queryKey: ["organizations", "tree"], queryFn: organizationApi.tree });

  const orgs = listQ.data?.data ?? [];
  const treeRoots = treeQ.data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search) return orgs;
    const k = search.toLowerCase();
    return orgs.filter(
      (o) =>
        o.XCode.toLowerCase().includes(k) ||
        o.XName.toLowerCase().includes(k) ||
        o.Address?.toLowerCase().includes(k)
    );
  }, [orgs, search]);

  const createM = useMutation({
    mutationFn: organizationApi.create,
    onSuccess: () => {
      message.success("Đã tạo tổ chức");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setModalOpen(false);
      form.resetFields();
    },
    onError: (err) => message.error(err.message)
  });

  const updateM = useMutation({
    mutationFn: ({ id, payload }) => organizationApi.update(id, payload),
    onSuccess: () => {
      message.success("Đã cập nhật");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setModalOpen(false);
      form.resetFields();
    },
    onError: (err) => message.error(err.message)
  });

  const removeM = useMutation({
    mutationFn: organizationApi.remove,
    onSuccess: () => {
      message.success("Đã xóa");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (err) => message.error(err.message)
  });

  const openCreate = (parentId) => {
    setEditing(null);
    setCreatingParentId(parentId);
    setModalOpen(true);
    form.resetFields();
    form.setFieldsValue({ Status: "Active", ParentID: parentId });
  };

  const openEdit = (org) => {
    setEditing(org);
    setCreatingParentId(undefined);
    setModalOpen(true);
    form.setFieldsValue({
      XCode:     org.XCode,
      XName:     org.XName,
      OrgType:   org.OrgType,
      Address:   org.Address,
      Latitude:  org.Latitude  ?? null,
      Longitude: org.Longitude ?? null,
      OpenTime:  org.OpenTime  ?? null,
      CloseTime: org.CloseTime ?? null,
      Status:    org.Status
    });
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    const coords = {
      Latitude:  values.Latitude  ?? null,
      Longitude: values.Longitude ?? null,
      OpenTime:  values.OpenTime  || null,
      CloseTime: values.CloseTime || null
    };
    if (editing) {
      updateM.mutate({
        id: editing._id,
        payload: { XName: values.XName, OrgType: values.OrgType, Address: values.Address, Status: values.Status, ...coords }
      });
    } else {
      createM.mutate({
        XCode: values.XCode, XName: values.XName, OrgType: values.OrgType,
        Address: values.Address, Status: values.Status, ParentID: values.ParentID || null,
        ...coords
      });
    }
  };

  const columns = [
    {
      title: "Mã",
      dataIndex: "XCode",
      width: 160,
      render: (v) => <Tag color="blue">{v}</Tag>
    },
    { title: "Tên tổ chức", dataIndex: "XName" },
    { title: "Loại", dataIndex: "OrgType", width: 150, render: (v) => <span style={{ whiteSpace: "nowrap" }}>{v}</span> },
    { title: "Địa chỉ", dataIndex: "Address", ellipsis: true },
    {
      title: "Trạng thái",
      dataIndex: "Status",
      width: 120,
      render: (v) => <Tag color={v === "Active" ? "green" : "default"}>{v}</Tag>,
      filters: [
        { text: "Active", value: "Active" },
        { text: "Inactive", value: "Inactive" }
      ],
      onFilter: (val, rec) => rec.Status === val
    },
    canManage && {
      title: "Thao tác",
      width: 120,
      align: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm
            title="Xóa tổ chức này?"
            description="Không thể xóa nếu còn tổ chức con."
            onConfirm={() => removeM.mutate(record._id)}
          >
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
          <h2 className="title">Tổ chức</h2>
          <p className="subtitle">
            Quản lý cây tổ chức (Organization tree) — Multi-tenant theo BA 3.1.1
          </p>
        </div>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
            Thêm tổ chức gốc
          </Button>
        )}
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card title="Cây tổ chức" size="small" className="org-tree-card">
            {treeQ.isLoading ? (
              "Đang tải..."
            ) : treeRoots.length === 0 ? (
              <Empty description="Chưa có dữ liệu" />
            ) : (
              <Tree
                treeData={buildTreeData(treeRoots)}
                defaultExpandAll
                blockNode
                titleRender={(node) => (
                  <Space size={4}>
                    {node.title}
                    {canManage && (
                      <Button
                        size="small"
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreate(node.raw._id);
                        }}
                      >
                        con
                      </Button>
                    )}
                  </Space>
                )}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            size="small"
            title={
              <Space>
                <span>Danh sách phẳng</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  ({filtered.length} tổ chức)
                </Text>
              </Space>
            }
            extra={
              <Input
                size="small"
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Tìm theo mã / tên / địa chỉ"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240 }}
              />
            }
          >
            <Table
              size="small"
              loading={listQ.isLoading}
              rowKey="_id"
              columns={columns}
              dataSource={filtered}
              pagination={{ pageSize: 10, showSizeChanger: false }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        open={modalOpen}
        title={editing ? `Sửa tổ chức: ${editing.XCode}` : "Thêm tổ chức mới"}
        onCancel={() => setModalOpen(false)}
        onOk={onSubmit}
        confirmLoading={createM.isPending || updateM.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          {!editing && (
            <Form.Item
              name="ParentID"
              label="Tổ chức cha (để trống để tạo Org gốc)"
            >
              <Select
                allowClear
                placeholder="Chọn tổ chức cha"
                options={orgs.map((o) => ({
                  value: o._id,
                  label: `[${o.XCode}] ${o.XName}`
                }))}
                showSearch
                optionFilterProp="label"
                disabled={creatingParentId !== undefined}
              />
            </Form.Item>
          )}
          <Form.Item
            name="XCode"
            label="Mã tổ chức (XCode)"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Input placeholder="VD: VROUTE-DN" disabled={!!editing} />
          </Form.Item>
          <Form.Item
            name="XName"
            label="Tên tổ chức (XName)"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Input placeholder="VD: VRoute - Chi nhánh Đà Nẵng" />
          </Form.Item>
          <Form.Item name="OrgType" label="Loại tổ chức (OrgType)" rules={[{ required: true, message: "Bắt buộc" }]}>
            <Select
              allowClear
              placeholder="Chọn loại"
              options={[
                { value: "MANUFACTURER", label: "Manufacturer" },
                { value: "BRANCH",       label: "Branch" },
                { value: "DEPOT",        label: "Depot" },
                { value: "SHIPPER",      label: "Deliverer" }
              ]}
            />
          </Form.Item>
          <Form.Item name="Address" label="Địa chỉ">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Tọa độ" tooltip="Bắt buộc với DEPOT/SUN/CROSSDOCK để tối ưu tuyến đường">
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
          <Form.Item label="Khung giờ hoạt động">
            <Space.Compact style={{ width: "100%" }}>
              <Form.Item name="OpenTime" noStyle>
                <Input placeholder="Mở: 08:00" style={{ width: "50%" }} />
              </Form.Item>
              <Form.Item name="CloseTime" noStyle>
                <Input placeholder="Đóng: 22:00" style={{ width: "50%" }} />
              </Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="Status" label="Trạng thái" initialValue="Active">
            <Select
              options={[
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
