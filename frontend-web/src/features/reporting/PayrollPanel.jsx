import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Card,
  DatePicker,
  Form,
  InputNumber,
  Modal,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  Tooltip,
  Typography,
  Empty,
  Button,
  Space
} from "antd";
import {
  DollarOutlined,
  TeamOutlined,
  CarOutlined,
  DownloadOutlined,
  SettingOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { payrollApi } from "../../api/payroll";

const { Text } = Typography;
const currency = (v) => `${(v ?? 0).toLocaleString("vi-VN")} đ`;

export default function PayrollPanel() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [month, setMonth] = useState(dayjs());
  const [configOpen, setConfigOpen] = useState(false);
  const [configForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["payroll-drivers", month.format("YYYY-MM")],
    queryFn: () => payrollApi.drivers({ month: month.format("YYYY-MM") })
  });

  const { data: configData } = useQuery({
    queryKey: ["payroll-config"],
    queryFn: () => payrollApi.getConfig()
  });

  const updateConfigM = useMutation({
    mutationFn: (body) => payrollApi.updateConfig(body),
    onSuccess: () => {
      message.success("Đã cập nhật cấu hình lương");
      setConfigOpen(false);
      qc.invalidateQueries({ queryKey: ["payroll-config"] });
      qc.invalidateQueries({ queryKey: ["payroll-drivers"] });
    },
    onError: (e) => message.error(e.message)
  });

  const openConfigModal = () => {
    configForm.setFieldsValue(configData?.config ?? {});
    setConfigOpen(true);
  };

  const items = data?.items ?? [];
  const totals = data?.totals ?? {};
  const config = data?.config ?? {};

  const handleExport = () => {
    if (items.length === 0) return;
    const rows = items.map((x) => ({
      "Mã TX": x.driverCode,
      "Tên tài xế": x.driverName,
      "SĐT": x.phone,
      "Tổng chuyến": x.stats.totalTrips,
      "Hoàn thành": x.stats.completed,
      "Huỷ": x.stats.cancelled,
      "Km": x.stats.totalDistanceKm,
      "COD thu (đ)": x.stats.totalCOD,
      "Lương cứng": x.breakdown.baseSalary,
      "Thưởng km": x.breakdown.kmBonus,
      "Thưởng chuyến": x.breakdown.completionBonus,
      "% COD": x.breakdown.codCommission,
      "Thực lĩnh": x.gross
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Luong-${month.format("YYYY-MM")}`);
    XLSX.writeFile(wb, `bang-luong-tai-xe-${month.format("YYYY-MM")}.xlsx`);
  };

  const columns = [
    { title: "Mã TX", dataIndex: "driverCode", width: 100 },
    { title: "Tên", dataIndex: "driverName", render: (v) => <Text strong>{v}</Text> },
    {
      title: "Nguồn", width: 90,
      render: () => <Tag color="blue">Nội bộ</Tag>
    },
    { title: "SĐT", dataIndex: "phone", width: 120 },
    {
      title: "Chuyến (HT/Tổng)",
      width: 130,
      render: (_, r) => (
        <Space>
          <Tag color="green">{r.stats.completed}</Tag>
          /
          <Tag>{r.stats.totalTrips}</Tag>
          {r.stats.cancelled > 0 && <Tag color="red">huỷ {r.stats.cancelled}</Tag>}
        </Space>
      )
    },
    {
      title: "Km",
      dataIndex: ["stats", "totalDistanceKm"],
      width: 100,
      align: "right",
      render: (v) => `${(v ?? 0).toLocaleString("vi-VN")} km`
    },
    {
      title: "COD thu",
      dataIndex: ["stats", "totalCOD"],
      width: 130,
      align: "right",
      render: currency
    },
    {
      title: "Lương cứng",
      dataIndex: ["breakdown", "baseSalary"],
      width: 130,
      align: "right",
      render: currency
    },
    {
      title: "Thưởng km",
      dataIndex: ["breakdown", "kmBonus"],
      width: 120,
      align: "right",
      render: (v) => <Text style={{ color: v > 0 ? "#52c41a" : undefined }}>{currency(v)}</Text>
    },
    {
      title: "Thưởng chuyến",
      dataIndex: ["breakdown", "completionBonus"],
      width: 130,
      align: "right",
      render: (v) => <Text style={{ color: v > 0 ? "#52c41a" : undefined }}>{currency(v)}</Text>
    },
    {
      title: "% COD",
      dataIndex: ["breakdown", "codCommission"],
      width: 110,
      align: "right",
      render: (v) => <Text style={{ color: v > 0 ? "#52c41a" : undefined }}>{currency(v)}</Text>
    },
    {
      title: "Thực lĩnh",
      dataIndex: "gross",
      width: 150,
      align: "right",
      fixed: "right",
      render: (v) => <Text strong style={{ color: "#1677ff", fontSize: 14 }}>{currency(v)}</Text>
    }
  ];

  const outsourcedExcluded = data?.outsourcedExcluded ?? 0;

  return (
    <div>
      {outsourcedExcluded > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <span>
              Bảng lương chỉ tính cho <b>{data?.driverCount ?? 0} tài xế nội bộ</b>.
              Đã loại trừ <b>{outsourcedExcluded} tài xế thuê ngoài (3PL)</b> — họ hưởng lương từ hãng vận chuyển, chi phí tính qua bảng giá Service.
            </span>
          }
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng quỹ lương tháng"
              value={totals.gross ?? 0}
              formatter={(v) => currency(v)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Số tài xế"
              value={data?.driverCount ?? 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng thưởng"
              value={(totals.kmBonus ?? 0) + (totals.completionBonus ?? 0) + (totals.codCommission ?? 0)}
              formatter={(v) => currency(v)}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tổng COD thu hộ"
              value={items.reduce((s, x) => s + (x.stats?.totalCOD ?? 0), 0)}
              formatter={(v) => currency(v)}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <span>Bảng lương + Hoa hồng tài xế</span>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: "normal" }}>
              (Lương cứng {currency(config.baseSalary)} · +{currency(config.perKmBonus)}/km vượt {config.kmThreshold}km · +{currency(config.perCompletedTrip)}/chuyến HT · {((config.codCommissionRate ?? 0) * 100).toFixed(1)}% COD · không phạt huỷ)
            </Text>
          </Space>
        }
        extra={
          <Space>
            <DatePicker
              picker="month"
              value={month}
              onChange={(d) => d && setMonth(d)}
              format="MM/YYYY"
              allowClear={false}
            />
            <Tooltip title="Tuỳ chỉnh công thức lương (lương cứng, thưởng, % COD...)">
              <Button icon={<SettingOutlined />} onClick={openConfigModal}>
                Cấu hình lương
              </Button>
            </Tooltip>
            <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={items.length === 0}>
              Xuất Excel
            </Button>
          </Space>
        }
      >
        {items.length === 0 && !isLoading ? (
          <Empty description="Không có dữ liệu lương cho tháng này" />
        ) : (
          <Table
            loading={isLoading}
            rowKey="driverID"
            size="small"
            columns={columns}
            dataSource={items}
            pagination={false}
            scroll={{ x: 1500 }}
            summary={() => totals.gross ? (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: "#fafafa", fontWeight: 700 }}>
                  <Table.Summary.Cell index={0} colSpan={7}>TỔNG CỘNG</Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">{currency(totals.baseSalary)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">{currency(totals.kmBonus)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={9} align="right">{currency(totals.completionBonus)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={10} align="right">{currency(totals.codCommission)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={11} align="right">
                    <Text strong style={{ color: "#1677ff", fontSize: 14 }}>{currency(totals.gross)}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            ) : null}
          />
        )}
      </Card>

      <Modal
        title={<Space><SettingOutlined /> Cấu hình lương tài xế</Space>}
        open={configOpen}
        onCancel={() => setConfigOpen(false)}
        onOk={() => configForm.submit()}
        confirmLoading={updateConfigM.isPending}
        width={560}
        okText="Lưu"
        cancelText="Huỷ"
      >
        <Form
          form={configForm}
          layout="vertical"
          onFinish={(values) => updateConfigM.mutate(values)}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Lương cứng / tháng (đ)"
                name="BaseSalary"
                rules={[{ required: true, type: "number", min: 0 }]}
                tooltip="Lương cố định trả mỗi tháng cho tài xế bất kể số chuyến"
              >
                <InputNumber
                  min={0}
                  step={500_000}
                  style={{ width: "100%" }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(v) => v.replace(/,/g, "")}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Ngưỡng km / tháng"
                name="KmThreshold"
                rules={[{ required: true, type: "number", min: 0 }]}
                tooltip="Chạy vượt ngưỡng này mới được tính thưởng km"
              >
                <InputNumber
                  min={0}
                  step={100}
                  style={{ width: "100%" }}
                  addonAfter="km"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Thưởng / km vượt (đ)"
                name="PerKmBonus"
                rules={[{ required: true, type: "number", min: 0 }]}
              >
                <InputNumber
                  min={0}
                  step={100}
                  style={{ width: "100%" }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(v) => v.replace(/,/g, "")}
                  addonAfter="đ/km"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Thưởng / chuyến hoàn thành (đ)"
                name="PerCompletedTrip"
                rules={[{ required: true, type: "number", min: 0 }]}
              >
                <InputNumber
                  min={0}
                  step={10_000}
                  style={{ width: "100%" }}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  parser={(v) => v.replace(/,/g, "")}
                  addonAfter="đ/chuyến"
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="Hoa hồng COD thu hộ (%)"
                name="CodCommissionRate"
                rules={[{ required: true, type: "number", min: 0, max: 1 }]}
                tooltip="Vd: 0.005 = 0.5%. Tài xế nhận % này trên tổng COD họ thu hộ"
              >
                <InputNumber
                  min={0}
                  max={1}
                  step={0.001}
                  style={{ width: "100%" }}
                  formatter={(v) => `${(v * 100).toFixed(2)}`}
                  parser={(v) => Number(v) / 100}
                  addonAfter="%"
                />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ padding: 12, background: "#f0f5ff", borderRadius: 6, fontSize: 12, color: "#0050b3" }}>
            💡 <b>Công thức:</b> Thực lĩnh = Lương cứng + (km vượt × thưởng/km) + (chuyến HT × thưởng/chuyến) + (COD × % hoa hồng)
            <br/>
            <b>Không phạt huỷ chuyến</b> — huỷ thường do planner/khách, không phải lỗi tài xế.
          </div>
        </Form>
      </Modal>
    </div>
  );
}
