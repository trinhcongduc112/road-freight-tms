import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Card,
  Input,
  Button,
  Result,
  Spin,
  Tag,
  Timeline,
  Empty,
  Typography,
  Space,
  Image,
  Statistic
} from "antd";
import {
  SearchOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { trackByOrderCode } from "../../api/tracking";

const { Title, Text, Paragraph } = Typography;

const truckIcon = new L.DivIcon({
  className: "truck-marker",
  html: `<div style="font-size:24px;background:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #1677ff">🚚</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const stopIcon = new L.DivIcon({
  className: "stop-marker",
  html: `<div style="font-size:18px;background:#52c41a;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">📍</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const STATUS_LABELS = {
  OPEN: { color: "blue", text: "Đã tiếp nhận" },
  PICKED_PACKED: { color: "cyan", text: "Đã đóng gói" },
  SHIPPED: { color: "geekblue", text: "Đang vận chuyển" },
  DELIVERED: { color: "green", text: "Đã giao thành công" },
  CANCELLED: { color: "red", text: "Đã hủy" },
  REJECTED: { color: "red", text: "Từ chối nhận" }
};

const TRIP_STATUS_LABELS = {
  ASSIGNED: "Đã phân chuyến",
  DRIVER_CONFIRMED: "Tài xế đã xác nhận",
  LOADING: "Đang soạn hàng",
  IN_PROGRESS: "Đang vận chuyển",
  RETURNING: "Đang về kho",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy"
};

export default function TrackingPage() {
  const { orderCode: codeFromUrl } = useParams();
  const navigate = useNavigate();
  const [inputCode, setInputCode] = useState(codeFromUrl ?? "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTracking = async (code) => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const result = await trackByOrderCode(code);
      setData(result);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Không tìm thấy đơn");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (codeFromUrl) fetchTracking(codeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  // Auto-refresh mỗi 15s nếu trip đang IN_PROGRESS
  useEffect(() => {
    if (!data?.trip || data.trip.status !== "IN_PROGRESS") return;
    const id = setInterval(() => {
      fetchTracking(codeFromUrl ?? inputCode);
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.trip?.status, codeFromUrl, inputCode]);

  const handleSearch = () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;
    navigate(`/track/${code}`);
  };

  const mapCenter = useMemo(() => {
    const t = data?.trip;
    if (t?.currentLocation) return [t.currentLocation.latitude, t.currentLocation.longitude];
    if (t?.stop?.address && data?.trip?.currentLocation == null) {
      // fallback Hà Nội nếu không có toạ độ
      return [21.0285, 105.8542];
    }
    return [21.0285, 105.8542];
  }, [data]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0f4ff 0%, #e6f7ff 100%)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, color: "#0050b3" }}>
            <CarOutlined /> Theo dõi đơn hàng
          </Title>
          <Text type="secondary">Road Freight TMS — Real-time shipment tracking</Text>
        </div>

        {/* Search bar */}
        <Card style={{ marginBottom: 16, borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              size="large"
              placeholder="Nhập mã đơn hàng (vd: SO-2025-0001)"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              maxLength={32}
            />
            <Button type="primary" size="large" onClick={handleSearch} loading={loading}>
              Tra cứu
            </Button>
          </Space.Compact>
          <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
            Mã đơn được cấp khi đặt hàng, có thể tìm trong email/SMS xác nhận.
          </div>
        </Card>

        {loading && (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" tip="Đang tra cứu..." />
          </Card>
        )}

        {error && !loading && (
          <Result
            status="404"
            title="Không tìm thấy đơn hàng"
            subTitle={error}
            extra={<Button type="primary" onClick={() => { setError(null); setInputCode(""); }}>Thử lại</Button>}
          />
        )}

        {data && !loading && (
          <>
            {/* Order summary */}
            <Card
              style={{ marginBottom: 16, borderRadius: 12 }}
              title={
                <Space>
                  <Text strong>{data.order.code}</Text>
                  <Tag color={STATUS_LABELS[data.order.status]?.color}>
                    {STATUS_LABELS[data.order.status]?.text ?? data.order.status}
                  </Tag>
                </Space>
              }
              extra={
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={() => fetchTracking(codeFromUrl ?? inputCode)}
                >
                  Làm mới
                </Button>
              }
            >
              {data.eta && (
                <Statistic
                  title={<><ClockCircleOutlined /> Trạng thái dự kiến</>}
                  value={data.eta.label}
                  valueStyle={{ fontSize: 20, color: "#0050b3" }}
                />
              )}
              {data.trip && (
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                  <div>
                    <Text type="secondary">Mã chuyến</Text>
                    <div><Text strong>{data.trip.tripCode}</Text></div>
                  </div>
                  <div>
                    <Text type="secondary">Trạng thái chuyến</Text>
                    <div><Tag color="processing">{TRIP_STATUS_LABELS[data.trip.status] ?? data.trip.status}</Tag></div>
                  </div>
                  {data.trip.vehicle && (
                    <div>
                      <Text type="secondary">Biển xe</Text>
                      <div><Text strong>{data.trip.vehicle}</Text></div>
                    </div>
                  )}
                  {data.trip.driver && (
                    <div>
                      <Text type="secondary">Tài xế</Text>
                      <div>
                        <Text strong>{data.trip.driver.name}</Text>
                        {data.trip.driver.phone && (
                          <a
                            href={`tel:${data.trip.driver.phone}`}
                            style={{ marginLeft: 8 }}
                          >
                            <PhoneOutlined /> {data.trip.driver.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Map */}
            {data.trip?.currentLocation && (
              <Card style={{ marginBottom: 16, borderRadius: 12, overflow: "hidden" }} bodyStyle={{ padding: 0 }}>
                <div style={{ height: 380 }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap'
                    />
                    <Marker
                      position={[data.trip.currentLocation.latitude, data.trip.currentLocation.longitude]}
                      icon={truckIcon}
                    >
                      <Popup>
                        <div>
                          <Text strong>{data.trip.vehicle || "Xe vận chuyển"}</Text>
                          <div>Tốc độ: {Math.round(data.trip.currentLocation.speed || 0)} km/h</div>
                          <div style={{ fontSize: 11, color: "#999" }}>
                            Cập nhật: {new Date(data.trip.currentLocation.updatedAt).toLocaleTimeString("vi-VN")}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
                <div style={{ padding: "8px 16px", background: "#fafafa", fontSize: 12, color: "#666", display: "flex", alignItems: "center", gap: 6 }}>
                  <EnvironmentOutlined /> Vị trí xe cập nhật mỗi 5 giây. Bản đồ tự làm mới mỗi 15s.
                </div>
              </Card>
            )}

            {/* Stop info */}
            {data.trip?.stop && (
              <Card title="Điểm giao hàng" style={{ marginBottom: 16, borderRadius: 12 }}>
                <Paragraph>
                  <EnvironmentOutlined /> {data.trip.stop.address}
                </Paragraph>
                {data.trip.stop.plannedArrival && (
                  <Text type="secondary">Dự kiến đến: <Text strong>{data.trip.stop.plannedArrival}</Text></Text>
                )}
                {data.trip.stop.completedAt && (
                  <div style={{ marginTop: 8 }}>
                    <CheckCircleOutlined style={{ color: "#52c41a" }} /> Đã giao lúc{" "}
                    <Text strong>{new Date(data.trip.stop.completedAt).toLocaleString("vi-VN")}</Text>
                  </div>
                )}
                {data.trip.stop.podImages?.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary">Bằng chứng giao hàng (ePOD):</Text>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {data.trip.stop.podImages.map((img, i) => (
                        <Image key={i} src={img} width={100} height={100} style={{ objectFit: "cover", borderRadius: 8 }} />
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Timeline */}
            <Card title="Lịch sử trạng thái" style={{ borderRadius: 12 }}>
              {data.timeline.length === 0 ? (
                <Empty description="Chưa có hoạt động" />
              ) : (
                <Timeline
                  items={[...data.timeline].reverse().map((t) => ({
                    color: t.status === "DELIVERED" ? "green" : t.status === "CANCELLED" ? "red" : "blue",
                    children: (
                      <div>
                        <Text strong>{STATUS_LABELS[t.status]?.text ?? t.status}</Text>
                        <div style={{ fontSize: 12, color: "#999" }}>
                          {new Date(t.at).toLocaleString("vi-VN")}
                        </div>
                        {t.note && <div style={{ fontSize: 13, marginTop: 4 }}>{t.note}</div>}
                      </div>
                    )
                  }))}
                />
              )}
            </Card>
          </>
        )}

        <div style={{ textAlign: "center", marginTop: 32, fontSize: 12, color: "#999" }}>
          © Road Freight TMS · <Link to="/login">Đăng nhập hệ thống</Link>
        </div>
      </div>
    </div>
  );
}
