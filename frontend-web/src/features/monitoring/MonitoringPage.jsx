import { CarOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Col, Empty, Row, Space, Tag, Timeline, Typography } from "antd";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { tripApi } from "../../api/trip";

const { Text, Title } = Typography;

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

export default function MonitoringPage() {
  const tripsQ = useQuery({ queryKey: ["live-trips"], queryFn: () => tripApi.list(), refetchInterval: 5000 });
  const trips = tripsQ.data?.data ?? [];
  const [roadLines, setRoadLines] = useState({});
  const [tripOrder, setTripOrder] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [swapSourceId, setSwapSourceId] = useState(null);
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
        <Badge status="processing" text="Tự cập nhật 5 giây" />
      </div>

      <Row gutter={12}>
        <Col xs={24} lg={10}>
          <Card title="Timeline tài xế" loading={tripsQ.isLoading} style={{ minHeight: "calc(100vh - 220px)" }}>
            {!orderedTrips.length ? <Empty description="Chưa có chuyến đã khóa/chốt" /> : (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                  {orderedTrips.map((trip, idx) => {
                    const color = palette[idx % palette.length];
                    const active = selectedTrip?._id === trip._id;
                    const swapping = swapSourceId === trip._id;
                    return (
                      <button
                        key={trip._id}
                        type="button"
                        onClick={() => handleTripCardClick(trip._id)}
                        style={{
                          textAlign: "left",
                          border: `1px solid ${active ? color : "#dbe3ef"}`,
                          borderLeft: `4px solid ${color}`,
                          background: swapping ? "#fff7ed" : active ? "#f8fbff" : "#fff",
                          borderRadius: 8,
                          padding: 10,
                          cursor: "pointer",
                          boxShadow: active ? "0 4px 12px rgba(15,23,42,.12)" : "none"
                        }}
                        title="Bấm 1 xe, rồi bấm xe khác để đổi vị trí hiển thị"
                      >
                        <Space style={{ width: "100%", justifyContent: "space-between" }}>
                          <Text strong>{trip.VehicleCode}</Text>
                          <Text type="secondary">{pct(trip)}%</Text>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 12 }}>{trip.DriverName || trip.ServiceName || "Chưa gán"}</Text>
                        <br />
                        {statusTag(trip.Status)}
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
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {statusTag(selectedTrip.Status)}
                        <br />
                        <Text type="secondary">{pct(selectedTrip)}%</Text>
                      </div>
                    </Space>
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
                          <Space direction="vertical" size={0}>
                            <Text strong>{task.PlannedArrivalTime || "--:--"} · {task.CustomerName}</Text>
                            <Text type="secondary">{task.OrderCodes?.join(", ")}</Text>
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
    </div>
  );
}
