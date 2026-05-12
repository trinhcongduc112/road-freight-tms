import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const { Text } = Typography;

/* ── Dữ liệu mẫu: 3 xe chạy tuyến thật ở Hà Nội ── */
const MOCK_VEHICLES = [
  {
    id: "VH-001",
    name: "29A-12345",
    driver: "Nguyễn Văn An",
    phone: "0912 345 678",
    route: "RP-20250508-001",
    color: "#1677ff",
    // Tuyến: Mỹ Đình → Cầu Giấy → Hồ Tây → Hoàn Kiếm
    waypoints: [
      [21.0227, 105.7828], [21.0280, 105.7921], [21.0345, 105.8012],
      [21.0389, 105.8089], [21.0412, 105.8156], [21.0445, 105.8198],
      [21.0467, 105.8245], [21.0478, 105.8312], [21.0456, 105.8378],
      [21.0423, 105.8423], [21.0389, 105.8467], [21.0367, 105.8512],
    ],
  },
  {
    id: "VH-002",
    name: "30B-67890",
    driver: "Trần Thị Bình",
    phone: "0987 654 321",
    route: "RP-20250508-001",
    color: "#52c41a",
    // Tuyến: Hà Đông → Thanh Xuân → Đống Đa → Hai Bà Trưng
    waypoints: [
      [20.9712, 105.7823], [20.9789, 105.7934], [20.9856, 105.8023],
      [20.9923, 105.8112], [20.9978, 105.8198], [21.0034, 105.8267],
      [21.0089, 105.8323], [21.0134, 105.8378], [21.0178, 105.8423],
      [21.0212, 105.8456], [21.0245, 105.8489], [21.0278, 105.8512],
    ],
  },
  {
    id: "VH-003",
    name: "51C-11223",
    driver: "Lê Minh Cường",
    phone: "0903 111 222",
    route: "RP-20250508-002",
    color: "#fa8c16",
    // Tuyến: Long Biên → Hoàng Mai → Giáp Bát → Linh Đàm
    waypoints: [
      [21.0512, 105.8756], [21.0467, 105.8712], [21.0423, 105.8656],
      [21.0378, 105.8601], [21.0334, 105.8556], [21.0289, 105.8512],
      [21.0245, 105.8467], [21.0201, 105.8423], [21.0156, 105.8389],
      [21.0112, 105.8356], [21.0067, 105.8323], [21.0023, 105.8289],
    ],
  },
];

/* ── Icon xe theo màu ── */
function makeIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="36" height="36">
    <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
    <text x="20" y="26" text-anchor="middle" font-size="18" fill="white">🚛</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const ICONS = Object.fromEntries(MOCK_VEHICLES.map((v) => [v.id, makeIcon(v.color)]));

/* ── Tự fit bản đồ khi có dữ liệu ── */
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) map.fitBounds(positions, { padding: [40, 40] });
  }, []);
  return null;
}

/* ── Component chính ── */
export default function MonitoringPage() {
  const [simulating, setSimulating] = useState(false);
  // stepIdx[vehicleId] = index hiện tại trên waypoints
  const [stepIdx, setStepIdx] = useState(
    Object.fromEntries(MOCK_VEHICLES.map((v) => [v.id, 0]))
  );
  const [status, setStatus] = useState(
    Object.fromEntries(MOCK_VEHICLES.map((v) => [v.id, "Chờ giao"]))
  );
  const [speed] = useState(
    Object.fromEntries(MOCK_VEHICLES.map((v) => [v.id, Math.floor(30 + Math.random() * 30)]))
  );
  const intervalRef = useRef(null);

  useEffect(() => {
    if (simulating) {
      setStatus(Object.fromEntries(MOCK_VEHICLES.map((v) => [v.id, "Đang giao"])));
      intervalRef.current = setInterval(() => {
        setStepIdx((prev) => {
          const next = { ...prev };
          MOCK_VEHICLES.forEach((v) => {
            const maxStep = v.waypoints.length - 1;
            if (next[v.id] < maxStep) next[v.id] = next[v.id] + 1;
          });
          return next;
        });
      }, 1200);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [simulating]);

  // Khi tất cả xe đến cuối → tự dừng
  useEffect(() => {
    const allDone = MOCK_VEHICLES.every(
      (v) => stepIdx[v.id] >= v.waypoints.length - 1
    );
    if (allDone && simulating) {
      setSimulating(false);
      setStatus(Object.fromEntries(MOCK_VEHICLES.map((v) => [v.id, "Đã giao xong"])));
    }
  }, [stepIdx, simulating]);

  function reset() {
    setSimulating(false);
    setStepIdx(Object.fromEntries(MOCK_VEHICLES.map((v) => [v.id, 0])));
    setStatus(Object.fromEntries(MOCK_VEHICLES.map((v) => [v.id, "Chờ giao"])));
  }

  const allPositions = MOCK_VEHICLES.flatMap((v) => v.waypoints);
  const center = [21.0245, 105.8412];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="title">Giám sát xe thời gian thực</h2>
          <p className="subtitle">Mô phỏng 3 xe giao hàng trên bản đồ Hà Nội</p>
        </div>
        <Space>
          <Button onClick={reset} disabled={simulating}>Reset</Button>
          <Button
            type="primary"
            danger={simulating}
            onClick={() => setSimulating((s) => !s)}
          >
            {simulating ? "⏸ Dừng giả lập" : "▶ Bắt đầu giả lập"}
          </Button>
          <Badge
            status={simulating ? "processing" : "default"}
            text={simulating ? "Đang chạy..." : "Chờ"}
          />
        </Space>
      </div>

      {/* ── KPI strip ── */}
      <Row gutter={12}>
        {MOCK_VEHICLES.map((v) => (
          <Col key={v.id} xs={24} sm={8}>
            <Card size="small" style={{ borderLeft: `4px solid ${v.color}` }}>
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <div>
                  <Text strong>{v.name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{v.driver}</Text>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Tag color={status[v.id] === "Đang giao" ? "blue" : status[v.id] === "Đã giao xong" ? "green" : "default"}>
                    {status[v.id]}
                  </Tag>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {Math.round((stepIdx[v.id] / (v.waypoints.length - 1)) * 100)}% lộ trình
                    · {speed[v.id]} km/h
                  </Text>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Bản đồ ── */}
      <Card size="small" styles={{ body: { padding: 0, height: "calc(100vh - 280px)", minHeight: 420 } }}>
        <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={allPositions} />

          {MOCK_VEHICLES.map((v) => {
            const pos = v.waypoints[stepIdx[v.id]];
            const traveled = v.waypoints.slice(0, stepIdx[v.id] + 1);
            const remaining = v.waypoints.slice(stepIdx[v.id]);
            return (
              <span key={v.id}>
                {/* Đường đã đi — đậm */}
                {traveled.length > 1 && (
                  <Polyline positions={traveled} color={v.color} weight={4} opacity={0.9} />
                )}
                {/* Đường còn lại — nhạt, nét đứt */}
                {remaining.length > 1 && (
                  <Polyline positions={remaining} color={v.color} weight={2} opacity={0.4} dashArray="6 6" />
                )}
                {/* Marker xe */}
                <Marker position={pos} icon={ICONS[v.id]}>
                  <Popup minWidth={180}>
                    <strong style={{ color: v.color }}>{v.name}</strong><br />
                    <Text>Tài xế: {v.driver}</Text><br />
                    <Text type="secondary">{v.phone}</Text><br />
                    <Text type="secondary">Chuyến: {v.route}</Text><br />
                    <Tag color={status[v.id] === "Đang giao" ? "blue" : status[v.id] === "Đã giao xong" ? "green" : "default"} style={{ marginTop: 4 }}>
                      {status[v.id]}
                    </Tag>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Vận tốc: {speed[v.id]} km/h<br />
                      Tiến độ: {Math.round((stepIdx[v.id] / (v.waypoints.length - 1)) * 100)}%<br />
                      Tọa độ: {pos[0].toFixed(4)}, {pos[1].toFixed(4)}
                    </Text>
                  </Popup>
                </Marker>
              </span>
            );
          })}
        </MapContainer>
      </Card>
    </div>
  );
}
