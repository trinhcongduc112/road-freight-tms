import { CarOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, PhoneOutlined, WarningOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Badge, Button, Card, Col, DatePicker, Empty, Image, Input, Modal, Popconfirm, Row, Space, Statistic, Tag, Timeline, Tooltip, Typography, notification } from "antd";
import dayjs from "dayjs";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { tripApi } from "../../api/trip";

const { Text, Title } = Typography;
const { TextArea } = Input;

const palette = ["#ef4444", "#1677ff", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4"];
const taskColor = {
  DEPOT: "#111827",
  PENDING: "#94a3b8",
  EN_ROUTE: "#1677ff",
  ARRIVED: "#f59e0b",
  COMPLETED: "#16a34a",
  FAILED: "#dc2626"
};

async function fetchRoadRoute(points) {
  if (points.length < 2) return [];
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.routes?.[0]?.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng]);
  } catch {
    return [];
  }
}

async function fetchRoadSegments(points) {
  if (points.length < 2) return [];
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const fallback = [points[i], points[i + 1]];
    const roadLine = await fetchRoadRoute(fallback);
    segments.push(roadLine.length ? roadLine : fallback);
  }
  return segments;
}

function makeMarker(color, label, truck = false) {
  const html = truck
    ? `<div style="position:relative;width:38px;height:38px;border-radius:20px;background:${color};color:white;border:3px solid white;box-shadow:0 2px 10px rgba(15,23,42,.42);display:grid;place-items:center;font-size:18px">🚚<span style="position:absolute;right:-6px;top:-7px;background:#0f172a;color:#fff;border:2px solid #fff;border-radius:10px;min-width:18px;height:18px;display:grid;place-items:center;font-size:10px;font-weight:800">${label}</span></div>`
    : `<div style="width:34px;height:34px;border-radius:18px;background:${color};color:white;border:3px solid white;box-shadow:0 2px 8px rgba(15,23,42,.35);display:grid;place-items:center;font-weight:800;font-size:13px">${label}</div>`;
  return L.divIcon({
    className: "",
    iconSize: truck ? [38, 38] : [34, 34],
    iconAnchor: truck ? [19, 19] : [17, 17],
    html
  });
}

function positionsOf(trip) {
  const stops = (trip.Tasks ?? [])
    .filter((task) => Number.isFinite(Number(task.Latitude)) && Number.isFinite(Number(task.Longitude)))
    .map((task) => [Number(task.Latitude), Number(task.Longitude)]);
  if (Number.isFinite(Number(trip.DepotLatitude)) && Number.isFinite(Number(trip.DepotLongitude))) {
    const depot = [Number(trip.DepotLatitude), Number(trip.DepotLongitude)];
    return [depot, ...stops, depot];
  }
  return stops;
}

function stopPositionsOf(trip) {
  return (trip.Tasks ?? [])
    .filter((task) => Number.isFinite(Number(task.Latitude)) && Number.isFinite(Number(task.Longitude)))
    .map((task) => [Number(task.Latitude), Number(task.Longitude)]);
}

function FitBounds({ trips }) {
  const map = useMap();
  useEffect(() => {
    const positions = trips.flatMap(positionsOf);
    if (positions.length) map.fitBounds(positions, { padding: [35, 35], maxZoom: 12 });
  }, [map, trips]);
  return null;
}

function pct(trip) {
  const tasks = trip.Tasks ?? [];
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => ["COMPLETED", "FAILED"].includes(task.Status)).length / tasks.length) * 100);
}

function statusTag(status) {
  const label = {
    ASSIGNED: "Đã phân công",
    DRIVER_CONFIRMED: "Tài xế đã nhận",
    LOADING: "Đang soạn hàng ở kho",
    IN_PROGRESS: "Đang giao hàng",
    RETURNING: "Đang về kho",
    COMPLETED: "Đã về kho",
    CANCELLED: "Đã hủy"
  }[status] ?? status;
  const color = status === "COMPLETED" ? "green" : status === "IN_PROGRESS" ? "blue" : status === "RETURNING" ? "purple" : status === "LOADING" ? "gold" : status === "CANCELLED" ? "red" : "default";
  return <Tag color={color}>{label}</Tag>;
}

function formatDateTime(value) {
  if (!value) return "Chưa ghi nhận";
  return new Date(value).toLocaleString("vi-VN", { hour12: false });
}

// Thêm biến noPhotoRequired vào prop
function EvidenceThumbs({ photos = [], at, noPhotoRequired }) {
  if (!photos.length) {
    if (noPhotoRequired) {
      return <Text style={{ fontSize: 11, color: "#16a34a", fontWeight: "500" }}>✓ Đã xác nhận trên app</Text>;
    }
    return <Text type="secondary" style={{ fontSize: 11 }}>Chưa có ảnh xác minh</Text>;
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {/* PreviewGroup giúp sếp bấm mũi tên trái/phải để chuyển ảnh khi đang phóng to */}
      <Image.PreviewGroup>
        {photos.slice(0, 4).map((photo, index) => (
          <div key={index} style={{ position: "relative", width: 78, height: 58 }}>
            <Image
              src={photo}
              alt="Bằng chứng"
              width={78}
              height={58}
              style={{ objectFit: "cover", borderRadius: 6, border: "1px solid #dbe3ef" }}
            />
            <div style={{
              position: "absolute",
              left: 3,
              right: 3,
              bottom: 3,
              padding: "1px 3px",
              borderRadius: 3,
              background: "rgba(15,23,42,.72)",
              color: "#fff",
              fontSize: 8,
              lineHeight: "12px",
              pointerEvents: "none" // Giúp sếp click xuyên qua chữ để mở ảnh
            }}>
              {formatDateTime(at)}
            </div>
          </div>
        ))}
      </Image.PreviewGroup>
    </div>
  );
}

function TripEvidencePanel({ trip }) {
  const stages = [
    // Gắn thêm noPhotoRequired: true vào 2 mốc này
    { label: "Nhận chuyến", at: trip.ConfirmedAt, photos: trip.ConfirmPhotos, color: "blue", noPhotoRequired: true },
    { label: "Soạn hàng", at: trip.LoadingStartedAt, photos: trip.LoadingPhotos, color: "gold" },
    { label: "Xuất kho", at: trip.StartedAt, photos: trip.StartPhotos, color: "green" },
    { label: "Về kho", at: trip.ReturnedAt, photos: trip.ReturnPhotos, color: "purple" },
    { label: "Kết thúc", at: trip.CompletedAt, photos: trip.FinishPhotos, color: "cyan", noPhotoRequired: true }
  ].filter((stage) => stage.at || stage.photos?.length);

  if (!stages.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <Text strong style={{ fontSize: 12 }}>Bằng chứng mốc chuyến</Text>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8, marginTop: 6 }}>
        {stages.map((stage) => (
          <div key={stage.label} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: 8, background: "#fff" }}>
            <Tag color={stage.color} style={{ marginBottom: 4 }}>{stage.label}</Tag>
            <div style={{ fontSize: 11, color: "#475569" }}>{formatDateTime(stage.at)}</div>
            {/* Truyền cờ noPhotoRequired xuống đây */}
            <EvidenceThumbs photos={stage.photos ?? []} at={stage.at} noPhotoRequired={stage.noPhotoRequired} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskProofModal({ task, onClose }) {
  const signaturePaths = task?.SignatureImage?.startsWith("svg:")
    ? task.SignatureImage.slice(4).split("|").filter(Boolean)
    : [];
  return (
    <Modal
      open={Boolean(task)}
      title={task ? `ePOD · ${task.CustomerName || `Điểm ${task.StopIndex}`}` : "ePOD"}
      onCancel={onClose}
      footer={null}
      width={760}
    >
      {!task ? null : (
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Space wrap>
            <Tag color={task.Status === "COMPLETED" ? "green" : task.Status === "FAILED" ? "red" : "blue"}>{task.Status}</Tag>
            <Text type="secondary">Đơn: {task.OrderCodes?.join(", ") || "—"}</Text>
          </Space>
          <Text><b>Địa chỉ:</b> {task.Address || "—"}</Text>
          <Text><b>Đã đến:</b> {formatDateTime(task.ArrivedAt)}</Text>
          <Text><b>Hoàn thành:</b> {formatDateTime(task.CompletedAt)}</Text>
          <Text><b>Thất bại:</b> {formatDateTime(task.FailedAt)}</Text>
          {task.DriverNote && <Text><b>Ghi chú tài xế:</b> {task.DriverNote}</Text>}
          <div>
            <Text strong>Ảnh giao hàng</Text>
            <EvidenceThumbs photos={task.PodImages ?? []} at={task.CompletedAt || task.FailedAt} />
          </div>
          <div>
            <Text strong>Chữ ký khách hàng</Text>
            {task.SignatureImage ? (
              <div style={{ marginTop: 6, padding: 10, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" }}>
                {task.SignatureImage.startsWith("data:image") ? (
                  <img src={task.SignatureImage} alt="" style={{ maxWidth: "100%", maxHeight: 220 }} />
                ) : signaturePaths.length ? (
                  <svg viewBox="0 0 360 180" style={{ width: "100%", maxWidth: 420, height: 180, background: "#fafafa" }}>
                    {signaturePaths.map((d, index) => (
                      <path key={index} d={d} stroke="#111827" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    ))}
                  </svg>
                ) : (
                  <Text code style={{ whiteSpace: "normal" }}>{task.SignatureImage.slice(0, 180)}...</Text>
                )}
              </div>
            ) : (
              <Text type="secondary" style={{ display: "block", marginTop: 4 }}>Chưa có chữ ký</Text>
            )}
          </div>
        </Space>
      )}
    </Modal>
  );
}

function DriverChatModal({ trip, open, onClose }) {
  const { message: msg } = App.useApp();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const messagesQ = useQuery({
    queryKey: ["driver-messages", trip?._id],
    queryFn: () => tripApi.listMessages(trip._id),
    enabled: open && Boolean(trip?._id),
    refetchInterval: open ? 2500 : false
  });
  const sendM = useMutation({
    mutationFn: () => tripApi.sendMessage(trip._id, { text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["driver-messages", trip?._id] });
      msg.success("Đã gửi tin nhắn");
    },
    onError: (e) => msg.error(e.message)
  });
  const messages = messagesQ.data?.data ?? [];

  return (
    <Modal
      open={open}
      title={`Chat tài xế · ${trip?.VehicleCode || ""}`}
      onCancel={onClose}
      footer={null}
      width={520}
    >
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <Text type="secondary">
          {trip?.DriverName || "Tài xế"} {trip?.DriverPhone ? `· ${trip.DriverPhone}` : ""}
        </Text>
        <div style={{ height: 340, overflowY: "auto", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
          {!messages.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có tin nhắn" />
          ) : messages.map((item) => {
            const mine = item.SenderType === "DISPATCHER";
            return (
              <div key={item._id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
                <div style={{
                  maxWidth: "78%",
                  background: mine ? "#1d4ed8" : "#fff",
                  color: mine ? "#fff" : "#0f172a",
                  border: "1px solid #dbe3ef",
                  borderRadius: 8,
                  padding: "7px 9px"
                }}>
                  <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{item.Text}</div>
                  <div style={{ fontSize: 10, opacity: 0.72, marginTop: 3 }}>
                    {item.SenderName || item.SenderType} · {formatDateTime(item.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <TextArea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập tin nhắn cho tài xế..."
          maxLength={2000}
        />
        <Button type="primary" disabled={!text.trim()} loading={sendM.isPending} onClick={() => sendM.mutate()}>
          Gửi vào app tài xế
        </Button>
      </Space>
    </Modal>
  );
}

function samePoint(a, b) {
  return a && b && Math.abs(a[0] - b[0]) < 0.00001 && Math.abs(a[1] - b[1]) < 0.00001;
}

function offsetPoint(point, index) {
  if (!point) return point;
  const angle = (index * 72) * Math.PI / 180;
  const delta = 0.00028;
  return [point[0] + Math.sin(angle) * delta, point[1] + Math.cos(angle) * delta];
}

function interpolatePoint(from, to, ratio) {
  if (!from || !to) return from || to || null;
  return [
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio
  ];
}

function routePointAt(points, stopIndex, ratio) {
  if (!points.length) return null;
  const targetIndex = Math.min(Math.max(Number(stopIndex) || 1, 1), points.length - 1);
  const from = points[targetIndex - 1] ?? points[0];
  const to = points[targetIndex] ?? points[points.length - 1];
  return interpolatePoint(from, to, ratio);
}

function inferredVehiclePosition(trip, points) {
  if (trip.LastLatitude && trip.LastLongitude) {
    return { position: [Number(trip.LastLatitude), Number(trip.LastLongitude)], source: "GPS thật" };
  }
  if (!points.length) return { position: null, source: "Chưa có tọa độ" };

  const tasks = trip.Tasks ?? [];
  if (["ASSIGNED", "DRIVER_CONFIRMED", "LOADING"].includes(trip.Status)) {
    return { position: points[0], source: "Đang ở kho" };
  }
  if (trip.Status === "RETURNING") {
    return { position: routePointAt(points, Math.max(tasks.length + 1, 1), 0.65), source: "Đang về kho" };
  }
  if (trip.Status === "COMPLETED") {
    return { position: points[points.length - 1], source: "Đã về kho" };
  }

  const active = tasks.find((task) => ["EN_ROUTE", "ARRIVED"].includes(task.Status));
  if (active) {
    return {
      position: routePointAt(points, active.StopIndex, active.Status === "ARRIVED" ? 1 : 0.62),
      source: active.Status === "ARRIVED" ? `Đã đến điểm ${active.StopIndex}` : `Đang tới điểm ${active.StopIndex}`
    };
  }

  const closedCount = tasks.filter((task) => ["COMPLETED", "FAILED"].includes(task.Status)).length;
  if (closedCount > 0) {
    const nextStop = Math.min(closedCount + 1, tasks.length);
    return { position: routePointAt(points, nextStop, 0.35), source: `Sau điểm ${closedCount}` };
  }
  return { position: routePointAt(points, 1, 0.18), source: "Đã xuất kho" };
}

const INCIDENT_TYPE_LABEL = {
  BREAKDOWN: "🔧 Hỏng xe",
  ACCIDENT: "🚨 Tai nạn",
  TRAFFIC: "🚧 Kẹt đường",
  FUEL: "⛽ Hết nhiên liệu",
  CARGO_ISSUE: "📦 Hàng hỏng/mất",
  WEATHER: "🌧 Thời tiết",
  CUSTOMER: "🙅 Khách từ chối",
  DEVIATION: "🧭 Đi sai lộ trình",
  OTHER: "❓ Khác"
};
const INCIDENT_SEVERITY_COLOR = {
  LOW: "green", MEDIUM: "orange", HIGH: "red", CRITICAL: "magenta"
};

export default function MonitoringPage() {
  const qc = useQueryClient();
  // Lấy thêm notification từ App context của Ant Design
  const { message: msg, notification } = App.useApp();

  /* Lọc theo ngày — mặc định hôm nay. Nếu để trống → server trả toàn bộ
     chuyến đang chạy. */
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const dateParam = selectedDate?.format("YYYY-MM-DD");
  const tripsQ = useQuery({
    queryKey: ["live-trips", dateParam],
    queryFn: () => tripApi.list(dateParam ? { date: dateParam } : undefined),
    refetchInterval: 5000
  });
  const trips = tripsQ.data?.data ?? [];

  /* Realtime incidents (poll every 4s — could swap to socket later) */
  const incidentsQ = useQuery({
    queryKey: ["live-incidents"],
    queryFn: () => tripApi.listIncidents({ status: "OPEN" }),
    refetchInterval: 4000
  });
  const incidents = incidentsQ.data?.data ?? [];

  /* Tin nhắn chưa đọc từ tài xế (poll mỗi 3s). Khi tổng tin chưa đọc tăng so
     với lần check trước → kêu beep + show notification toast cho dispatcher. */
  const unreadQ = useQuery({
    queryKey: ["driver-message-unread"],
    queryFn: () => tripApi.unreadMessageCounts(),
    refetchInterval: 3000
  });
  const unreadByTrip = useMemo(() => {
    const map = {};
    (unreadQ.data?.data ?? []).forEach((row) => { map[row.TripID] = row.count; });
    return map;
  }, [unreadQ.data]);
  const totalUnread = useMemo(
    () => Object.values(unreadByTrip).reduce((s, n) => s + n, 0),
    [unreadByTrip]
  );
  /* Trip nào đã được dispatcher mở chat → bỏ qua khỏi badge cho đến khi
     có tin mới hơn. Lưu dạng { tripId: lastSeenCount } */
  const [seenCounts, setSeenCounts] = useState({});
  const prevTotalUnreadRef = useRef(0);
  
  useEffect(() => {
    const prev = prevTotalUnreadRef.current;
    
    // Đã bỏ && prev !== 0, chỉ cần có tin nhắn mới là báo
    if (totalUnread > prev) {
      notification.info({
        message: '💬 Có tin nhắn mới',
        description: `Tài xế vừa gửi thêm ${totalUnread - prev} tin nhắn báo cáo trên app.`,
        placement: 'topRight',
        duration: 5,
      });
    }
    
    prevTotalUnreadRef.current = totalUnread;
  }, [totalUnread, notification]);

  const unreadFor = (tripId) => {
    const total = unreadByTrip[tripId] ?? 0;
    const seen = seenCounts[tripId] ?? 0;
    return Math.max(0, total - seen);
  };

  /* End-of-day reconciliation: tổng đơn đã giao / thất bại / tiền COD đã thu */
  const endOfDayStats = useMemo(() => {
    let delivered = 0, failed = 0, pending = 0, codCollected = 0;
    trips.forEach((t) => {
      (t.Tasks ?? []).forEach((task) => {
        if (task.Status === "COMPLETED") delivered += 1;
        else if (task.Status === "FAILED") failed += 1;
        else pending += 1;
        codCollected += Number(task.CashCollected ?? 0);
      });
    });
    return { delivered, failed, pending, codCollected, totalTrips: trips.length };
  }, [trips]);

  const ackM = useMutation({
    mutationFn: ({ id, status, note }) => tripApi.updateIncident(id, { status, dispatcherNote: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["live-incidents"] });
      msg.success("Đã cập nhật sự cố");
    },
    onError: (e) => msg.error(e.response?.data?.message ?? e.message)
  });
  const [roadLines, setRoadLines] = useState({});
  const [tripOrder, setTripOrder] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [swapSourceId, setSwapSourceId] = useState(null);
  const [selectedTaskProof, setSelectedTaskProof] = useState(null);
  const [chatTrip, setChatTrip] = useState(null);
  const routeSignature = useMemo(() => trips.map((trip) => {
    const points = positionsOf(trip).map((p) => p.join(",")).join("|");
    return `${trip._id}:${points}`;
  }).join(";"), [trips]);
  const center = [21.0285, 105.8542];

  useEffect(() => {
    setTripOrder((prev) => {
      const ids = trips.map((trip) => trip._id);
      return [...prev.filter((id) => ids.includes(id)), ...ids.filter((id) => !prev.includes(id))];
    });
    if (!selectedTripId && trips[0]?._id) setSelectedTripId(trips[0]._id);
    if (selectedTripId && trips.length && !trips.some((trip) => trip._id === selectedTripId)) setSelectedTripId(trips[0]._id);
  }, [trips, selectedTripId]);

  const orderedTrips = useMemo(() => {
    const byId = new Map(trips.map((trip) => [trip._id, trip]));
    return [
      ...tripOrder.map((id) => byId.get(id)).filter(Boolean),
      ...trips.filter((trip) => !tripOrder.includes(trip._id))
    ];
  }, [trips, tripOrder]);
  const selectedTrip = orderedTrips.find((trip) => trip._id === selectedTripId) ?? orderedTrips[0];
  const liveEntries = useMemo(() => orderedTrips.map((trip, idx) => {
    const points = positionsOf(trip);
    return {
      idx,
      tripId: trip._id,
      ...inferredVehiclePosition(trip, points)
    };
  }), [orderedTrips]);

  function handleTripCardClick(tripId) {
    if (swapSourceId && swapSourceId !== tripId) {
      setTripOrder((prev) => {
        const next = [...prev];
        const a = next.indexOf(swapSourceId);
        const b = next.indexOf(tripId);
        if (a !== -1 && b !== -1) [next[a], next[b]] = [next[b], next[a]];
        return next;
      });
      setSwapSourceId(null);
      setSelectedTripId(tripId);
      return;
    }
    setSelectedTripId(tripId);
    setSwapSourceId((current) => current === tripId ? null : tripId);
  }

  useEffect(() => {
    if (!trips.length) {
      setRoadLines({});
      return undefined;
    }
    let alive = true;
    (async () => {
      const result = {};
      await Promise.all(trips.map(async (trip) => {
        const points = positionsOf(trip);
        const segments = await fetchRoadSegments(points);
        result[trip._id] = segments.length ? segments : (points.length ? [points] : []);
      }));
      if (alive) setRoadLines(result);
    })();
    return () => { alive = false; };
  }, [routeSignature]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="title">Live Dispatch</h2>
          <p className="subtitle">Theo dõi tài xế, trạng thái điểm giao và vị trí GPS theo lộ trình đã chốt</p>
        </div>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>Ngày:</Text>
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            format="DD/MM/YYYY"
            allowClear={false}
            style={{ width: 140 }}
          />
          <Button size="small" onClick={() => setSelectedDate(dayjs())}>
            Hôm nay
          </Button>
          {incidents.length > 0 && (
            <Badge count={incidents.length} offset={[-4, 4]}>
              <Tag icon={<WarningOutlined />} color="red" style={{ fontSize: 13, padding: "4px 10px", margin: 0 }}>
                Cảnh báo mở
              </Tag>
            </Badge>
          )}
          {totalUnread > 0 && (
            <Badge count={totalUnread} offset={[-4, 4]}>
              <Tag color="blue" style={{ fontSize: 13, padding: "4px 10px", margin: 0 }}>
                💬 Tin từ tài xế
              </Tag>
            </Badge>
          )}
          <Badge status="processing" text="Tự cập nhật" />
        </Space>
      </div>

      {/* ── End-of-day reconciliation ── */}
      {trips.length > 0 && (
        <Card size="small" styles={{ body: { padding: "10px 14px" } }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Text strong style={{ fontSize: 13 }}>
                📊 Tổng kết {selectedDate?.format("DD/MM/YYYY")}
              </Text>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                · {endOfDayStats.totalTrips} chuyến · cập nhật realtime
              </Text>
            </Col>
            <Col><Statistic title="Đã giao" value={endOfDayStats.delivered} valueStyle={{ color: "#16a34a", fontSize: 18 }} /></Col>
            <Col><Statistic title="Thất bại" value={endOfDayStats.failed} valueStyle={{ color: "#dc2626", fontSize: 18 }} /></Col>
            <Col><Statistic title="Đang giao" value={endOfDayStats.pending} valueStyle={{ color: "#f59e0b", fontSize: 18 }} /></Col>
            <Col><Statistic title="Tiền COD thu" value={endOfDayStats.codCollected} suffix="₫" valueStyle={{ color: "#1677ff", fontSize: 18 }} formatter={(v) => Number(v).toLocaleString("vi-VN")} /></Col>
          </Row>
        </Card>
      )}

      {/* ── Alerts panel (incident feed) ── */}
      {incidents.length > 0 && (
        <Card
          size="small"
          style={{ borderLeft: "4px solid #ef4444", background: "#fff7f7" }}
          styles={{ body: { padding: "8px 12px" } }}
        >
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            <Space>
              <WarningOutlined style={{ color: "#dc2626" }} />
              <Text strong style={{ color: "#dc2626" }}>
                {incidents.length} cảnh báo / sự cố đang mở
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                · Tự cập nhật mỗi 4 giây · click "Tiếp nhận" hoặc "Đã xử lý" để xóa khỏi danh sách
              </Text>
            </Space>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 8 }}>
              {incidents.map((inc) => (
                <div
                  key={inc._id}
                  style={{
                    background: "#fff",
                    border: `1px solid ${inc.Severity === "CRITICAL" ? "#dc2626" : "#fecaca"}`,
                    borderLeft: `4px solid ${inc.Severity === "CRITICAL" ? "#7c2d12" : inc.Severity === "HIGH" ? "#dc2626" : inc.Severity === "MEDIUM" ? "#f59e0b" : "#10b981"}`,
                    borderRadius: 6,
                    padding: "8px 10px"
                  }}
                >
                  <Space style={{ width: "100%", justifyContent: "space-between" }} size={4}>
                    <Space size={6}>
                      <Text strong style={{ fontSize: 13 }}>
                        {INCIDENT_TYPE_LABEL[inc.Type] ?? inc.Type}
                      </Text>
                      <Tag color={INCIDENT_SEVERITY_COLOR[inc.Severity]} style={{ margin: 0, fontSize: 10 }}>
                        {inc.Severity}
                      </Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      {new Date(inc.ReportedAt).toLocaleTimeString("vi-VN")}
                    </Text>
                  </Space>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                    🚛 <b>{inc.VehicleCode}</b> · {inc.DriverName || "—"}
                    {inc.Type === "DEVIATION" && inc.DeviationDistance > 0 && (
                      <Text type="secondary"> · lệch {inc.DeviationDistance}m</Text>
                    )}
                  </div>
                  {inc.Description && (
                    <Text style={{ fontSize: 12, color: "#0f172a", display: "block", marginTop: 4 }}>
                      {inc.Description}
                    </Text>
                  )}
                  {inc.Photos?.length > 0 && (
                    <div style={{ display: "flex", gap: 4, marginTop: 6, overflowX: "auto" }}>
                      {inc.Photos.slice(0, 4).map((p, i) => (
                        <img key={i} src={p} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4, border: "1px solid #e5e7eb" }} />
                      ))}
                    </div>
                  )}
                  <Space size={4} style={{ marginTop: 6, flexWrap: "wrap" }}>
                    {/* Liên hệ tài xế — yêu cầu nghiệp vụ khi có cảnh báo */}
                    {(() => {
                      const tripForIncident = trips.find((t) => String(t._id) === String(inc.TripID));
                      const phone = tripForIncident?.DriverPhone;
                      return phone ? (
                        <a href={`tel:${phone}`}>
                          <Button size="small" type="primary" icon={<PhoneOutlined />}>
                            Gọi {phone}
                          </Button>
                        </a>
                      ) : null;
                    })()}
                    <Tooltip title="Đã thấy, đang xử lý">
                      <Button size="small" type="primary" ghost loading={ackM.isPending}
                        onClick={() => ackM.mutate({ id: inc._id, status: "ACKNOWLEDGED" })}>
                        Tiếp nhận
                      </Button>
                    </Tooltip>
                    <Popconfirm title="Đánh dấu đã xử lý xong?" onConfirm={() => ackM.mutate({ id: inc._id, status: "RESOLVED" })}>
                      <Button size="small" style={{ color: "#16a34a", borderColor: "#86efac" }}>Đã xử lý</Button>
                    </Popconfirm>
                    <Popconfirm title="Bỏ qua cảnh báo này?" onConfirm={() => ackM.mutate({ id: inc._id, status: "DISMISSED" })}>
                      <Button size="small" type="text" danger>Bỏ qua</Button>
                    </Popconfirm>
                  </Space>
                </div>
              ))}
            </div>
          </Space>
        </Card>
      )}

      <Row gutter={12}>
        <Col xs={24} lg={10}>
          <Card title="Timeline tài xế" loading={tripsQ.isLoading} style={{ minHeight: "calc(100vh - 220px)" }}>
            {!orderedTrips.length ? <Empty description="Chưa có chuyến đã khóa/chốt" /> : (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
                  {orderedTrips.map((trip, idx) => {
                    const color = palette[idx % palette.length];
                    const active = selectedTrip?._id === trip._id;
                    const swapping = swapSourceId === trip._id;
                    const planDate = trip.PlanDate ? new Date(trip.PlanDate).toLocaleDateString("vi-VN") : null;
                    return (
                      <button
                        key={trip._id}
                        type="button"
                        onClick={() => handleTripCardClick(trip._id)}
                        style={{
                          textAlign: "left",
                          border: `1px solid ${active ? color : "#e2e8f0"}`,
                          background: swapping ? "#fff7ed" : active ? "#f8fbff" : "#fff",
                          borderRadius: 10,
                          padding: 12,
                          cursor: "pointer",
                          boxShadow: active ? "0 8px 18px rgba(15,23,42,.12)" : "0 1px 2px rgba(15,23,42,.04)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          minHeight: 126,
                          position: "relative",
                          overflow: "hidden"
                        }}
                        title="Bấm 1 xe, rồi bấm xe khác để đổi vị trí hiển thị"
                      >
                        <div style={{ position: "absolute", inset: "0 auto 0 0", width: 4, background: color }} />
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <Text strong style={{ display: "block", fontSize: 14, lineHeight: "20px" }}>
                              {trip.VehicleCode}
                            </Text>
                            <Text type="secondary" style={{ display: "block", fontSize: 12, lineHeight: "18px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {trip.DriverName || trip.ServiceName || "Chưa gán"}
                            </Text>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <Text strong style={{ display: "block", color, fontSize: 16, lineHeight: "20px" }}>{pct(trip)}%</Text>
                            <Text type="secondary" style={{ fontSize: 10 }}>hoàn tất</Text>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: "auto" }}>
                          <span style={{ minWidth: 0 }}>{statusTag(trip.Status)}</span>
                          {planDate && (
                            <Text style={{
                              flexShrink: 0,
                              fontSize: 11,
                              lineHeight: "18px",
                              color: "#475569",
                              background: "#f1f5f9",
                              border: "1px solid #e2e8f0",
                              borderRadius: 999,
                              padding: "1px 8px",
                              whiteSpace: "nowrap"
                            }}>
                              {planDate}
                            </Text>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedTrip && (
                  <Card size="small" style={{ borderLeft: `4px solid ${palette[Math.max(orderedTrips.findIndex((trip) => trip._id === selectedTrip._id), 0) % palette.length]}` }}>
                    <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
                      <div>
                        <Text strong>{selectedTrip.VehicleCode}</Text>
                        <br />
                        <Text type="secondary">{selectedTrip.IsOutsourced ? selectedTrip.ServiceName || selectedTrip.ServiceCode : selectedTrip.DriverName || "Chưa gán tài xế"}</Text>
                        {selectedTrip.PlanDate && (
                          <>
                            <br />
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              📅 {new Date(selectedTrip.PlanDate).toLocaleDateString("vi-VN")}
                            </Text>
                          </>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {statusTag(selectedTrip.Status)}
                        <br />
                        <Text type="secondary">{pct(selectedTrip)}%</Text>
                      </div>
                    </Space>
                    {/* Liên hệ tài xế nhanh — yêu cầu nghiệp vụ dispatcher khi thấy sai lệch */}
                    {selectedTrip.DriverPhone && !selectedTrip.IsOutsourced && (
                      <div style={{ marginTop: 10, padding: 8, background: "#f8fafc", borderRadius: 6, display: "flex", gap: 8, alignItems: "center" }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>📞 SĐT tài xế:</Text>
                        <Text code style={{ fontSize: 12 }}>{selectedTrip.DriverPhone}</Text>
                        <a href={`tel:${selectedTrip.DriverPhone}`} style={{ marginLeft: "auto" }}>
                          <Button size="small" type="primary" icon={<PhoneOutlined />}>Gọi</Button>
                        </a>
                        <a href={`sms:${selectedTrip.DriverPhone}`}>
                          <Button size="small">SMS</Button>
                        </a>
                        <Badge count={unreadFor(selectedTrip._id)} offset={[-4, 4]} size="small">
                          <Button
                            size="small"
                            type={unreadFor(selectedTrip._id) > 0 ? "primary" : "default"}
                            onClick={() => {
                              setChatTrip(selectedTrip);
                              setSeenCounts((prev) => ({
                                ...prev,
                                [selectedTrip._id]: unreadByTrip[selectedTrip._id] ?? 0
                              }));
                            }}
                          >
                            {unreadFor(selectedTrip._id) > 0 ? "💬 Trả lời" : "Chat app"}
                          </Button>
                        </Badge>
                      </div>
                    )}
                    <TripEvidencePanel trip={selectedTrip} />
                    <Timeline style={{ marginTop: 14 }} items={[
                      {
                        color: selectedTrip.Status === "LOADING" ? "orange" : "gray",
                        dot: <CarOutlined />,
                        children: <Text strong>{selectedTrip.PlannedStartTime || "--:--"} · Xuất kho {selectedTrip.DepotName || selectedTrip.DepotCode || ""}</Text>
                      },
                      ...(selectedTrip.Tasks ?? []).map((task) => ({
                        color: task.Status === "FAILED" ? "red" : task.Status === "COMPLETED" ? "green" : task.Status === "ARRIVED" ? "orange" : task.Status === "EN_ROUTE" ? "blue" : "gray",
                        dot: task.Status === "COMPLETED" ? <CheckCircleOutlined /> : task.Status === "FAILED" ? <ExclamationCircleOutlined /> : <ClockCircleOutlined />,
                        children: (
                          <Space direction="vertical" size={2}>
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0, height: "auto", fontWeight: 700 }}
                              onClick={() => setSelectedTaskProof(task)}
                            >
                              {task.PlannedArrivalTime || "--:--"} · {task.CustomerName}
                            </Button>
                            <Text type="secondary">{task.OrderCodes?.join(", ")}</Text>
                            {(task.CompletedAt || task.FailedAt || task.PodImages?.length || task.SignatureImage) && (
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                ePOD: {formatDateTime(task.CompletedAt || task.FailedAt)}
                              </Text>
                            )}
                          </Space>
                        )
                      })),
                      {
                        color: selectedTrip.Status === "RETURNING" || selectedTrip.Status === "COMPLETED" ? "purple" : "gray",
                        dot: <CarOutlined />,
                        children: <Text strong>{selectedTrip.PlannedReturnTime || "--:--"} · Về kho {selectedTrip.DepotName || selectedTrip.DepotCode || ""}</Text>
                      }
                    ]} />
                  </Card>
                )}
              </Space>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card size="small" title="Live Map" styles={{ body: { padding: 0, height: "calc(100vh - 220px)", minHeight: 520 } }}>
            <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitBounds trips={trips} />
              {orderedTrips.map((trip, idx) => {
                const color = palette[idx % palette.length];
                const points = positionsOf(trip);
                const stopPoints = stopPositionsOf(trip);
                const lineSegments = roadLines[trip._id] ?? (points.length ? [points] : []);
                const liveEntry = liveEntries.find((entry) => entry.tripId === trip._id);
                const rawLivePos = liveEntry?.position;
                const sameLiveEntries = liveEntries.filter((entry) => samePoint(entry.position, rawLivePos));
                const overlapIndex = sameLiveEntries.findIndex((entry) => entry.tripId === trip._id);
                const overlapsDepot = samePoint(rawLivePos, points[0]);
                const livePos = sameLiveEntries.length > 1 || overlapsDepot ? offsetPoint(rawLivePos, overlapIndex + 1) : rawLivePos;
                return (
                  <Fragment key={trip._id}>
                    {lineSegments.map((linePts, segmentIdx) => linePts.length > 1 && (
                      <Fragment key={`${trip._id}-line-${segmentIdx}`}>
                        <Polyline positions={linePts} color="#111827" weight={10} opacity={0.28} />
                        <Polyline positions={linePts} color={color} weight={6} opacity={0.95} />
                      </Fragment>
                    ))}
                    {points[0] && (
                      <Marker position={points[0]} icon={makeMarker(taskColor.DEPOT, "Kho")}>
                        <Popup>
                          <Text strong>{trip.DepotName || trip.DepotCode || "Kho"}</Text><br />
                          <Text>{trip.DepotAddress}</Text>
                        </Popup>
                      </Marker>
                    )}
                    {stopPoints.map((pos, pointIdx) => {
                      const task = trip.Tasks[pointIdx];
                      return (
                        <Marker key={`${trip._id}-${task.StopIndex}`} position={pos} icon={makeMarker(taskColor[task.Status] ?? color, task.StopIndex)}>
                          <Popup>
                            <Text strong>{task.CustomerName}</Text><br />
                            <Text>{task.Address}</Text><br />
                            <Text type="secondary">{task.OrderCodes?.join(", ")}</Text><br />
                            <Tag color={task.Status === "COMPLETED" ? "green" : task.Status === "FAILED" ? "red" : "blue"}>{task.Status}</Tag>
                          </Popup>
                        </Marker>
                      );
                    })}
                    {livePos && (
                      <Marker position={livePos} icon={makeMarker(color, `${idx + 1}`, true)} zIndexOffset={1000 + idx}>
                        <Popup>
                          <Text strong>{trip.VehicleCode}</Text><br />
                          <Text>{trip.IsOutsourced ? trip.ServiceName || trip.ServiceCode : trip.DriverName}</Text><br />
                          <Text type="secondary">{trip.LastGpsAt ? `GPS ${new Date(trip.LastGpsAt).toLocaleTimeString("vi-VN")}` : liveEntry?.source}</Text>
                        </Popup>
                      </Marker>
                    )}
                  </Fragment>
                );
              })}
            </MapContainer>
          </Card>
        </Col>
      </Row>
      <TaskProofModal task={selectedTaskProof} onClose={() => setSelectedTaskProof(null)} />
      <DriverChatModal
        trip={chatTrip}
        open={Boolean(chatTrip)}
        onClose={() => {
          // Đóng chat → đánh dấu đã thấy hết tin của trip này
          if (chatTrip?._id) {
            setSeenCounts((prev) => ({
              ...prev,
              [chatTrip._id]: unreadByTrip[chatTrip._id] ?? 0
            }));
          }
          setChatTrip(null);
        }}
      />
    </div>
  );
}
