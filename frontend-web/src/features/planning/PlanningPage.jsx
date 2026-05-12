import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  CarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  FullscreenOutlined,
  LockOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  SendOutlined,
  UnlockOutlined
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App, Badge, Button, Card, Col, Collapse, DatePicker, Dropdown,
  Empty, Form, Input, Modal, Popconfirm, Row, Select,
  Space, Table, Tag, Tooltip, Typography
} from "antd";
import { SwapOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { routePlanApi } from "../../api/routePlan";
import { vehicleApi, driverApi, serviceApi } from "../../api/masterData";
import { organizationApi } from "../../api/organization";
import { usePermissions } from "../../utils/permissions";

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

const { Text } = Typography;

const PLAN_STATUS_COLOR  = { DRAFT: "blue", LOCKED: "orange", FINALIZED: "green" };
const ROUTE_STATUS_COLOR = { PLANNED: "blue", LOCKED: "orange", FINALIZED: "green" };
const ROUTE_COLORS = ["#e74c3c","#2980b9","#27ae60","#8e44ad","#f39c12","#16a085","#c0392b","#2c3e50"];

// Hà Nội default center
const DEFAULT_CENTER = [21.0285, 105.8542];

// Geocode address via Nominatim (free, no key needed)
async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ", Việt Nam")}&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "vi" } });
    const data = await res.json();
    if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { /* ignore */ }
  return null;
}

// Auto-fit map to markers
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [points, map]);
  return null;
}

// Route color legend
function createColoredIcon(color, label) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.4)">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

// Depot icon — distinct shape so planner sees the warehouse origin/return point
const DEPOT_ICON = L.divIcon({
  className: "",
  html: `<div style="background:#1f2937;color:#facc15;border-radius:6px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid #facc15;box-shadow:0 2px 6px rgba(0,0,0,.5)">🏭</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

export default function PlanningPage() {
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const { isSuper } = usePermissions();

  const [orgId, setOrgId]             = useState(null);
  const [planDate, setPlanDate]       = useState(dayjs());
  const [activePlanId, setActivePlanId] = useState(null);
  const [mapPoints, setMapPoints]     = useState({});  // { routeId: [ [lat,lng], ... ] }
  const [geocoding, setGeocoding]     = useState(false);
  const [createOpen, setCreateOpen]   = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [assignOrderOpen, setAssignOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [highlightRouteId, setHighlightRouteId] = useState(null);
  const fullscreenMapRef = useRef(null);
  const [createForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [vehicleForm] = Form.useForm();

  const orgsQ    = useQuery({ queryKey: ["organizations"], queryFn: organizationApi.list });
  const orgs     = orgsQ.data?.data ?? [];
  const activeOrg = orgs.find((o) => o._id === orgId);

  /* Resolve depot: prefer a DEPOT-type descendant of activeOrg with valid coords */
  function findDepotOrg(rootOrg, allOrgs) {
    if (!rootOrg) return null;
    const isDepot = (o) => o.OrgType === "DEPOT" && o.Latitude != null && o.Longitude != null;
    if (isDepot(rootOrg)) return rootOrg;
    let frontier = [String(rootOrg._id)];
    const seen = new Set(frontier);
    while (frontier.length) {
      const children = allOrgs.filter((o) => frontier.includes(String(o.Parent ?? "")));
      if (!children.length) break;
      for (const c of children) {
        if (isDepot(c)) return c;
        seen.add(String(c._id));
      }
      frontier = children.map((c) => String(c._id)).filter((id) => !seen.has(id));
    }
    if (rootOrg.Latitude != null && rootOrg.Longitude != null) return rootOrg;
    return null;
  }
  const depotOrg = findDepotOrg(activeOrg, orgs);
  const depot = depotOrg ? [depotOrg.Latitude, depotOrg.Longitude] : null;

  const plansQ   = useQuery({
    queryKey: ["route-plans", orgId, planDate?.format("YYYY-MM-DD")],
    queryFn: () => routePlanApi.list({
      from: planDate?.startOf("day").toISOString(),
      to:   planDate?.endOf("day").toISOString(),
      ...(orgId ? { organizationId: orgId } : {})
    }),
    enabled: !!orgId && !!planDate
  });
  const plans      = plansQ.data?.data ?? [];
  const activePlan = plans.find((p) => p._id === activePlanId) ?? plans[0] ?? null;

  const planDetailQ = useQuery({
    queryKey: ["route-plan-detail", activePlan?._id],
    queryFn:  () => routePlanApi.get(activePlan._id),
    enabled:  !!activePlan?._id
  });
  const planDetail = planDetailQ.data?.data;
  const routes     = planDetail?.routes ?? [];

  const unplannedQ = useQuery({
    queryKey: ["unplanned-orders", orgId, planDate?.format("YYYY-MM-DD")],
    queryFn:  () => routePlanApi.unplannedOrders({ organizationId: orgId, date: planDate?.format("YYYY-MM-DD") }),
    enabled:  !!orgId
  });
  const unplanned = unplannedQ.data?.data ?? [];

  const vehiclesQ = useQuery({ queryKey: ["vehicles"], queryFn: () => vehicleApi.list(), enabled: !!orgId });
  const vehicles  = vehiclesQ.data?.data ?? [];
  const driversQ  = useQuery({ queryKey: ["drivers"], queryFn: () => driverApi.list(), enabled: !!orgId });
  const drivers   = driversQ.data?.data ?? [];
  const servicesQ = useQuery({ queryKey: ["services"], queryFn: () => serviceApi.list(), enabled: !!orgId });
  const services  = servicesQ.data?.data ?? [];

  const assignRouteM = useMutation({
    mutationFn: ({ routeId, payload }) => routePlanApi.assignRoute(activePlan._id, routeId, payload),
    onSuccess: () => { message.success("Đã cập nhật phân công"); invalidate(); },
    onError: (e) => message.error(e.response?.data?.message || e.message)
  });

  useEffect(() => { if (orgs.length && !orgId) setOrgId(orgs[0]._id); }, [orgs, orgId]);
  useEffect(() => { setActivePlanId(null); setMapPoints({}); }, [orgId, planDate]);

  /* Fix Leaflet rendering inside Modal — invalidate size after the modal mounts */
  useEffect(() => {
    if (!fullscreenOpen) return;
    const t = setTimeout(() => {
      const m = fullscreenMapRef.current;
      if (!m) return;
      m.invalidateSize();
      const pts = Object.values(mapPoints).flatMap((arr) => arr.map((p) => p.latlng));
      if (pts.length >= 2) m.fitBounds(pts, { padding: [40, 40] });
      else if (pts.length === 1) m.setView(pts[0], 13);
    }, 300);
    return () => clearTimeout(t);
  }, [fullscreenOpen, mapPoints]);

  // Build map points — use stored lat/lng if available, fall back to Nominatim geocoding
  useEffect(() => {
    if (!routes.length) { setMapPoints({}); return; }
    (async () => {
      setGeocoding(true);
      const result = {};
      for (const route of routes) {
        const pts = [];
        for (const stop of (route.Stops ?? [])) {
          let coord = null;
          if (stop.Latitude && stop.Longitude) {
            coord = [stop.Latitude, stop.Longitude];
          } else {
            coord = await geocodeAddress(stop.Address);
          }
          if (coord) pts.push({ latlng: coord, label: stop.StopIndex, code: stop.CustomerCode, address: stop.Address, arrival: stop.PlannedArrivalTime });
        }
        result[route._id] = pts;
      }
      setMapPoints(result);
      setGeocoding(false);
    })();
  }, [routes]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["route-plans"] });
    qc.invalidateQueries({ queryKey: ["route-plan-detail"] });
    qc.invalidateQueries({ queryKey: ["unplanned-orders"] });
  }

  const createPlanM = useMutation({
    mutationFn: (vals) => routePlanApi.create({
      OrganizationID: orgId, PlanDate: planDate.toISOString(),
      PlanName: vals.PlanName, Notes: vals.Notes, Shift: vals.Shift ?? "FULL_DAY"
    }),
    onSuccess: async (res) => {
      message.success(`Đã tạo ${res.data.PlanCode} — đang tự động tối ưu tuyến...`);
      const newPlanId = res.data._id;
      setActivePlanId(newPlanId);
      setCreateOpen(false);
      createForm.resetFields();
      invalidate();
      /* Auto-run the optimizer so the planner immediately sees a populated plan
         instead of an empty shell. Errors (e.g. no orders) just toast and leave
         the empty plan in place — user can still add vehicles + retry. */
      try {
        const opt = await routePlanApi.optimize(newPlanId);
        const { routesCreated, ordersPlanned, skipped } = opt.data ?? {};
        if (routesCreated > 0) {
          message.success(`Đã tạo ${routesCreated} lộ trình · phân công ${ordersPlanned} đơn${skipped?.length ? ` · bỏ qua ${skipped.length}` : ""}`);
        }
        invalidate();
      } catch (e) {
        message.warning(`Kế hoạch đã tạo nhưng tối ưu thất bại: ${e.response?.data?.message || e.message}. Bạn có thể bấm "Tối ưu tuyến" để thử lại.`);
      }
    },
    onError: (e) => message.error(e.message)
  });

  const addVehicleM = useMutation({
    mutationFn: ({ vehicleId }) => routePlanApi.addRoute(activePlan._id, { VehicleID: vehicleId }),
    onSuccess: () => { message.success("Đã thêm xe"); setAddVehicleOpen(false); vehicleForm.resetFields(); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const removeRouteM = useMutation({
    mutationFn: (routeId) => routePlanApi.removeRoute(activePlan._id, routeId),
    onSuccess: () => { message.success("Đã xóa xe"); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const addOrderM = useMutation({
    mutationFn: ({ routeId, orderId, customerCode }) =>
      routePlanApi.addOrder(activePlan._id, routeId, { OrderID: orderId, CustomerCode: customerCode }),
    onSuccess: () => { message.success("Đã gán đơn"); setAssignOrderOpen(false); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const moveOrderM = useMutation({
    mutationFn: ({ orderId, toRouteId }) => routePlanApi.moveOrder(activePlan._id, { orderId, toRouteId }),
    onSuccess: () => { message.success("Đã chuyển đơn sang xe khác"); invalidate(); },
    onError: (e) => message.error(e.response?.data?.message || e.message)
  });

  const removeOrderM = useMutation({
    mutationFn: ({ routeId, orderId }) => routePlanApi.removeOrder(activePlan._id, routeId, orderId),
    onSuccess: () => { message.success("Đã gỡ đơn"); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const lockM     = useMutation({ mutationFn: (rId) => routePlanApi.lock(activePlan._id, rId),     onSuccess: () => { message.success("Đã khóa route");    invalidate(); }, onError: (e) => message.error(e.message) });
  const unlockM   = useMutation({ mutationFn: (rId) => routePlanApi.unlock(activePlan._id, rId),   onSuccess: () => { message.success("Đã mở khóa route"); invalidate(); }, onError: (e) => message.error(e.message) });
  const finalizeM = useMutation({ mutationFn: (rId) => routePlanApi.finalize(activePlan._id, rId), onSuccess: () => { message.success("Route finalized");   invalidate(); }, onError: (e) => message.error(e.message) });

  const optimizeM = useMutation({
    mutationFn: () => routePlanApi.optimize(activePlan._id),
    onSuccess: (res) => {
      invalidate();
      const { routesCreated, ordersPlanned, skipped, routes: rts } = res.data ?? {};
      modal.success({
        title: "Tối ưu hoàn tất!",
        width: 480,
        content: (
          <div>
            <p>Thuật toán: <b>Nearest Neighbor + 2-opt (Phase 1)</b></p>
            <p>✅ Đã tạo <b>{routesCreated}</b> lộ trình · phân công <b>{ordersPlanned}</b> đơn</p>
            {rts?.map((r) => (
              <div key={r._id} style={{ fontSize: 12, margin: "2px 0" }}>
                🚛 {r.VehicleCode} — {r.Stops} điểm · {r.TotalDistance} km · {r.TotalWeight} kg
              </div>
            ))}
            {skipped?.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 4 }}>
                <p style={{ color: "#d46b08", margin: 0, fontWeight: 500 }}>⚠ Bỏ qua {skipped.length} đơn:</p>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: 18, fontSize: 12 }}>
                  {skipped.map((s, i) => (
                    <li key={i}><b>{s.code}</b>: <span style={{ color: "#666" }}>{s.reason}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      });
    },
    onError: (e) => message.error(e.response?.data?.message || e.message)
  });

  function openAssign(order) { setSelectedOrder(order); assignForm.resetFields(); setAssignOrderOpen(true); }
  async function onAssignOk() {
    const { routeId } = await assignForm.validateFields();
    addOrderM.mutate({ routeId, orderId: selectedOrder._id, customerCode: selectedOrder.CustomerCode });
  }

  // Build all map points for display
  const allMapPoints = Object.values(mapPoints).flatMap((pts) => pts.map((p) => p.latlng));


  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="title">Lập kế hoạch (Dispatch)</h2>
          <p className="subtitle">Phân công đơn hàng vào xe — xem lộ trình trên bản đồ trước khi chốt</p>
        </div>
      </div>

      {/* ── Selector bar ── */}
      <Card size="small" style={{ marginBottom:12 }}>
        <Row gutter={[12,8]} align="middle">
          <Col>
            <Text type="secondary">Tổ chức:</Text>
          </Col>
          <Col>
            <Select style={{ width:220 }} value={orgId} onChange={(v) => { setOrgId(v); setActivePlanId(null); }}
              options={orgs.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))}
              showSearch optionFilterProp="label" />
          </Col>
          <Col>
            <Text type="secondary">Ngày:</Text>
          </Col>
          <Col>
            <DatePicker value={planDate} onChange={setPlanDate} format="DD/MM/YYYY" allowClear={false} />
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} disabled={!orgId || !planDate}
              onClick={() => { createForm.resetFields(); setCreateOpen(true); }}>
              Tạo kế hoạch mới
            </Button>
          </Col>

          {/* Plan tabs — multiple plans per day */}
          {plans.length > 0 && (
            <Col flex="auto">
              <Space wrap>
                {plans.map((p) => (
                  <Tag
                    key={p._id}
                    color={activePlan?._id === p._id ? PLAN_STATUS_COLOR[p.Status] : "default"}
                    style={{ cursor:"pointer", padding:"2px 10px", fontSize:12 }}
                    onClick={() => setActivePlanId(p._id)}
                  >
                    {p.PlanName ? `${p.PlanName} (${p.PlanCode})` : p.PlanCode} · {p.Status}
                  </Tag>
                ))}
              </Space>
            </Col>
          )}
        </Row>
      </Card>

      {!orgId ? (
        <Empty description="Chọn tổ chức để bắt đầu" />
      ) : (
        <>
          {/* ── TOP ROW: Big map on left, unplanned orders side panel on right ── */}
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col xs={24} lg={18}>
              <Card size="small"
                title={
                  <Space>
                    <EnvironmentOutlined />
                    <span>Bản đồ lộ trình</span>
                    {geocoding && <Text type="secondary" style={{ fontSize:11 }}>Đang định vị địa chỉ...</Text>}
                  </Space>
                }
                extra={
                  <Tooltip title="Phóng to bản đồ">
                    <Button size="small" icon={<FullscreenOutlined />} onClick={() => setFullscreenOpen(true)} disabled={!routes.length}>
                      Phóng to
                    </Button>
                  </Tooltip>
                }
                bodyStyle={{ padding:0 }}>
                <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height:"55vh", width:"100%", borderRadius:"0 0 8px 8px" }}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitBounds points={depot ? [depot, ...allMapPoints] : allMapPoints} />
                  {depot && (
                    <Marker position={depot} icon={DEPOT_ICON}>
                      <Popup>
                    <strong>🏭 {depotOrg?.XName ?? "Kho"}</strong>
                    {depotOrg?.XCode && <><br /><Tag color="blue" style={{ fontSize: 11 }}>{depotOrg.XCode}</Tag></>}
                    {depotOrg?.Address && <><br />{depotOrg.Address}</>}
                    <br />Điểm xuất phát & quay về
                  </Popup>
                    </Marker>
                  )}
                  {routes.map((r, rIdx) => {
                    const color = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
                    const pts = mapPoints[r._id] ?? [];
                    const linePts = depot && pts.length ? [depot, ...pts.map((p) => p.latlng), depot] : pts.map((p) => p.latlng);
                    return (
                      <span key={r._id}>
                        {pts.map((pt, i) => (
                          <Marker key={i} position={pt.latlng} icon={createColoredIcon(color, pt.label)}>
                            <Popup>
                              <strong>{pt.code}</strong><br />{pt.address}<br />
                              {pt.arrival && <span>⏰ {pt.arrival}<br /></span>}
                              <Tag color={color} style={{ marginTop:4 }}>{r.VehicleCode}</Tag>
                            </Popup>
                          </Marker>
                        ))}
                        {linePts.length >= 2 && (
                          <Polyline positions={linePts} color={color} weight={3} opacity={0.8}
                            dashArray={r.Status === "PLANNED" ? "6 4" : undefined} />
                        )}
                      </span>
                    );
                  })}
                </MapContainer>
                {routes.length > 0 && (
                  <div style={{ padding:"6px 12px", display:"flex", flexWrap:"wrap", gap:8, borderTop:"1px solid #f0f0f0" }}>
                    {routes.map((r, rIdx) => (
                      <Space key={r._id} size={4}>
                        <span style={{ display:"inline-block", width:12, height:4, background:ROUTE_COLORS[rIdx % ROUTE_COLORS.length], borderRadius:2 }} />
                        <Text style={{ fontSize:11 }}>{r.VehicleCode}</Text>
                      </Space>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={6}>
              <Card size="small" style={{ height:"100%" }}
                title={<Space>Đơn chưa phân công<Tag color="red">{unplanned.length}</Tag></Space>}
                loading={unplannedQ.isLoading}>
                {!activePlan && (
                  <div style={{ color:"#faad14", fontSize:12, marginBottom:8 }}>← Chọn hoặc tạo kế hoạch để gán đơn</div>
                )}
                <div style={{ maxHeight: "calc(55vh - 50px)", overflowY: "auto" }}>
                  {unplanned.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>Tất cả đơn đã phân công ✓</Text>
                  ) : (
                    unplanned.map((o) => (
                      <div
                        key={o._id}
                        draggable={!!activePlan}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", JSON.stringify({ orderId: o._id, customerCode: o.CustomerCode, source: "unplanned" }));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        style={{ background: "#fff", border: "1px dashed #d9d9d9", borderRadius: 4, padding: "4px 8px", marginBottom: 4, cursor: activePlan ? "grab" : "default", fontSize: 12 }}
                      >
                        <Tag color="blue" style={{ fontSize: 10 }}>{o.OrderCode}</Tag>
                        <Text style={{ fontSize: 11 }}>{o.CustomerCode}</Text>
                        <Text type="secondary" style={{ fontSize: 10, marginLeft: 4 }}>{dayjs(o.OrderDate).format("DD/MM")}</Text>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* ── BOTTOM: Vehicle timeline rows (Abivin-style) ── */}
          {!activePlan ? (
            <Empty description="Chưa có kế hoạch — nhấn 'Tạo kế hoạch mới'" />
          ) : (
            <Card size="small"
              title={
                <Space>
                  <CarOutlined />
                  <span>{activePlan.PlanName || activePlan.PlanCode}</span>
                  <Tag color={PLAN_STATUS_COLOR[activePlan.Status]}>{activePlan.Status}</Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>· Kéo-thả đơn giữa các xe để phân tuyến lại</Text>
                </Space>
              }
              extra={
                <Space size={4}>
                  <Tooltip title="Tự động phân tuyến">
                    <Button size="small" type="primary" icon={<NodeIndexOutlined />}
                      loading={optimizeM.isPending} disabled={activePlan.Status === "FINALIZED"}
                      onClick={() => optimizeM.mutate()}>
                      Tối ưu tuyến
                    </Button>
                  </Tooltip>
                  <Button size="small" type="dashed" icon={<CarOutlined />}
                    onClick={() => { setAddVehicleOpen(true); vehicleForm.resetFields(); }}
                    disabled={activePlan.Status === "FINALIZED"}>
                    + Xe
                  </Button>
                </Space>
              }
              loading={planDetailQ.isLoading}
              bodyStyle={{ padding: 8 }}>
              {routes.length === 0 ? (
                <Empty description="Chưa có xe — nhấn '+ Xe' để thêm" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  {routes.map((r, rIdx) => {
                    const color = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
                    const isLocked = r.Status === "LOCKED";
                    const isFinalized = r.Status === "FINALIZED";
                    const totalOrders = r.Stops?.reduce((s, st) => s + (st.OrderCodes?.length ?? 0), 0) ?? 0;
                    const driver = drivers.find((d) => d._id === (r.DriverID?._id ?? r.DriverID));

                    function onRowDragOver(e) {
                      if (isLocked || isFinalized) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                    function onRowDrop(e) {
                      if (isLocked || isFinalized) return;
                      e.preventDefault();
                      try {
                        const payload = JSON.parse(e.dataTransfer.getData("text/plain"));
                        if (payload.source === "unplanned") {
                          addOrderM.mutate({ routeId: r._id, orderId: payload.orderId, customerCode: payload.customerCode });
                        } else if (payload.fromRouteId && payload.fromRouteId !== r._id) {
                          moveOrderM.mutate({ orderId: payload.orderId, toRouteId: r._id });
                        }
                      } catch { /* ignore */ }
                    }

                    /* Vehicles available to swap into this route: Active + same org +
                       not already used by another route in this plan. */
                    const usedVehicleIds = new Set(routes.filter((rr) => rr._id !== r._id).map((rr) => String(rr.VehicleID?._id ?? rr.VehicleID)));
                    const swappableVehicles = vehicles.filter((v) =>
                      v.Status === "Active" && !usedVehicleIds.has(String(v._id))
                    );

                    return (
                      <div
                        key={r._id}
                        onDragOver={onRowDragOver}
                        onDrop={onRowDrop}
                        className="route-row"
                        style={{
                          display: "flex", alignItems: "stretch",
                          border: `1px solid ${isLocked ? "#ffd591" : isFinalized ? "#b7eb8f" : "#e5e7eb"}`,
                          borderLeft: `5px solid ${color}`,
                          borderRadius: 8, background: "#fff",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                          transition: "box-shadow .15s, border-color .15s",
                          overflow: "hidden"
                        }}
                      >
                        {/* LEFT panel: vehicle + assignment */}
                        <div style={{ width: 320, padding: "10px 12px", borderRight: "1px solid #f0f0f0", flexShrink: 0, background: "#fafbfc" }}>
                          {/* Header row: vehicle + actions */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <Space size={6} align="center">
                              <CarOutlined style={{ color, fontSize: 16 }} />
                              {!isLocked && !isFinalized ? (
                                <Select
                                  size="small" variant="borderless"
                                  showSearch optionFilterProp="label"
                                  value={String(r.VehicleID?._id ?? r.VehicleID ?? "")}
                                  onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { vehicleId: v } })}
                                  options={[
                                    { value: String(r.VehicleID?._id ?? r.VehicleID), label: r.VehicleCode },
                                    ...swappableVehicles.map((v) => ({
                                      value: String(v._id),
                                      label: `${v.VehicleCode} · ${v.MaxWeight}kg / ${v.MaxVolume}m³`
                                    }))
                                  ]}
                                  style={{ minWidth: 140, fontWeight: 600 }}
                                  dropdownStyle={{ minWidth: 280 }}
                                />
                              ) : (
                                <Text strong>{r.VehicleCode}</Text>
                              )}
                              <Tag color={ROUTE_STATUS_COLOR[r.Status]} style={{ fontSize: 10, margin: 0 }}>{r.Status}</Tag>
                            </Space>
                            <Space size={0} onClick={(e) => e.stopPropagation()}>
                              {!isLocked && !isFinalized && (
                                <Popconfirm title="Khóa route này?" onConfirm={() => lockM.mutate(r._id)}>
                                  <Tooltip title="Khóa"><Button size="small" type="text" icon={<LockOutlined />} /></Tooltip>
                                </Popconfirm>
                              )}
                              {isLocked && (
                                <>
                                  <Popconfirm title="Mở khóa?" onConfirm={() => unlockM.mutate(r._id)}>
                                    <Tooltip title="Mở khóa"><Button size="small" type="text" icon={<UnlockOutlined />} /></Tooltip>
                                  </Popconfirm>
                                  <Popconfirm title="Finalize route?" onConfirm={() => finalizeM.mutate(r._id)}>
                                    <Tooltip title="Hoàn tất"><Button size="small" type="text" icon={<CheckCircleOutlined />} style={{ color: "#52c41a" }} /></Tooltip>
                                  </Popconfirm>
                                </>
                              )}
                              {!isLocked && !isFinalized && (
                                <Popconfirm title="Xóa xe khỏi kế hoạch?" onConfirm={() => removeRouteM.mutate(r._id)}>
                                  <Tooltip title="Xóa"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
                                </Popconfirm>
                              )}
                            </Space>
                          </div>

                          {/* Stats row */}
                          <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                            <span>📦 {totalOrders} đơn</span>
                            <span>📍 {r.Stops?.length ?? 0} điểm</span>
                            <span>🛣 {r.TotalDistance ?? 0} km</span>
                            <span>⚖ {r.TotalWeight ?? 0} kg</span>
                          </div>

                          {!isLocked && !isFinalized && (
                            <Space direction="vertical" size={6} style={{ width: "100%" }}>
                              <Select
                                size="small" style={{ width: "100%" }}
                                value={r.Shift ?? "MORNING"}
                                onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { shift: v } })}
                                options={[
                                  { value: "MORNING",   label: "🌅 Ca sáng (08:00–12:00)" },
                                  { value: "AFTERNOON", label: "🌇 Ca chiều (13:30–17:30)" },
                                  { value: "FULL_DAY",  label: "☀ Cả ngày (08:00–17:30)" }
                                ]}
                              />
                              <div style={{ display: "flex", gap: 4 }}>
                                <Select
                                  size="small" style={{ width: 90 }}
                                  value={!!r.IsOutsourced}
                                  onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { isOutsourced: v } })}
                                  options={[
                                    { value: false, label: "Nội bộ" },
                                    { value: true, label: "3PL" }
                                  ]}
                                />
                                {!r.IsOutsourced ? (
                                  <Select
                                    size="small" style={{ flex: 1, minWidth: 0 }}
                                    showSearch optionFilterProp="label" allowClear placeholder="Chọn tài xế"
                                    value={driver?._id}
                                    onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { driverId: v ?? null } })}
                                    options={drivers.map((d) => ({ value: d._id, label: `[${d.DriverCode}] ${d.XName ?? d.FullName ?? ""}` }))}
                                  />
                                ) : (
                                  <Select
                                    size="small" style={{ flex: 1, minWidth: 0 }}
                                    showSearch optionFilterProp="label" allowClear placeholder="Chọn 3PL"
                                    value={services.find((s) => s._id === (r.ServiceID?._id ?? r.ServiceID))?._id}
                                    onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { serviceId: v ?? null } })}
                                    options={services.filter((s) => s.Status === "Active").map((s) => ({ value: s._id, label: `${s.Carrier} (${s.ServiceCode})` }))}
                                  />
                                )}
                              </div>
                            </Space>
                          )}

                          {/* Cost row */}
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Chi phí ước tính</Text>
                            <Text strong style={{ color: "#1677ff", fontSize: 14 }}>
                              {(r.EstimatedCost ?? 0).toLocaleString("vi-VN")} ₫
                            </Text>
                          </div>
                        </div>

                        {/* RIGHT panel: horizontal stops timeline */}
                        <div style={{ flex: 1, padding: "10px 12px", overflowX: "auto", display: "flex", alignItems: "center", gap: 6, minWidth: 0, background: "#fff" }}>
                          <div style={{ background: "#1f2937", color: "#facc15", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
                            🏭 Kho
                          </div>
                          {(r.Stops ?? []).length === 0 ? (
                            <div style={{ flex: 1, padding: "16px 12px", border: "2px dashed #d9d9d9", borderRadius: 6, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                              ⬇ Kéo đơn từ panel "Đơn chưa phân công" hoặc xe khác vào đây
                            </div>
                          ) : (
                            r.Stops.map((stop) => (
                              <div key={stop.StopIndex} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                <span style={{ color: "#9ca3af", fontSize: 16 }}>→</span>
                                <div style={{
                                  border: `1.5px solid ${color}`,
                                  background: "#fff",
                                  borderRadius: 8,
                                  padding: "6px 10px",
                                  minWidth: 140,
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                    <span style={{
                                      background: color, color: "#fff", borderRadius: "50%",
                                      width: 20, height: 20, display: "inline-flex",
                                      alignItems: "center", justifyContent: "center",
                                      fontSize: 11, fontWeight: 700
                                    }}>
                                      {stop.StopIndex}
                                    </span>
                                    <Text strong style={{ fontSize: 12 }}>{stop.CustomerCode}</Text>
                                  </div>
                                  {stop.PlannedArrivalTime && (
                                    <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4 }}>
                                      ⏰ {stop.PlannedArrivalTime}
                                    </div>
                                  )}
                                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    {stop.OrderCodes?.map((code, i) => (
                                      <div
                                        key={code}
                                        draggable={!isLocked && !isFinalized}
                                        onDragStart={(e) => {
                                          e.stopPropagation();
                                          e.dataTransfer.setData("text/plain", JSON.stringify({ orderId: stop.OrderIDs?.[i], fromRouteId: r._id, source: "route" }));
                                          e.dataTransfer.effectAllowed = "move";
                                        }}
                                        style={{
                                          display: "flex", alignItems: "center", justifyContent: "space-between",
                                          cursor: !isLocked && !isFinalized ? "grab" : "default",
                                          background: "#f0f9ff", border: "1px solid #bae0ff",
                                          borderRadius: 4, padding: "1px 6px"
                                        }}
                                      >
                                        <span style={{ fontSize: 10, fontFamily: "monospace", color: "#1677ff" }}>{code}</span>
                                        {!isLocked && !isFinalized && (
                                          <Popconfirm title={`Gỡ ${code}?`} onConfirm={() => removeOrderM.mutate({ routeId: r._id, orderId: stop.OrderIDs?.[i] })}>
                                            <Button type="text" danger size="small" icon={<DeleteOutlined />} style={{ height: 14, width: 14, padding: 0, fontSize: 10 }} />
                                          </Popconfirm>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                          {r.Stops?.length > 0 && (
                            <>
                              <span style={{ color: "#9ca3af", fontSize: 16 }}>→</span>
                              <div style={{ background: "#1f2937", color: "#facc15", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
                                🏭 Kho
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Space>
              )}
            </Card>
          )}
        </>
      )}

      {/* ── Modal: Tạo kế hoạch mới ── */}
      <Modal open={createOpen} title="Tạo kế hoạch vận chuyển"
        onCancel={() => setCreateOpen(false)}
        onOk={async () => { const v = await createForm.validateFields(); createPlanM.mutate(v); }}
        confirmLoading={createPlanM.isPending} destroyOnClose>
        <Form form={createForm} layout="vertical" preserve={false} initialValues={{ Shift: "FULL_DAY" }}>
          <Form.Item name="Shift" label="Khung giờ giao hàng" rules={[{ required: true }]}
            tooltip="Quyết định thời điểm xuất phát của các xe trong kế hoạch này">
            <Select options={[
              { value: "MORNING",   label: "Ca sáng — xuất phát 08:00, dự kiến quay về trước 12:00" },
              { value: "AFTERNOON", label: "Ca chiều — xuất phát 13:30, dự kiến quay về trước 17:30" },
              { value: "FULL_DAY",  label: "Cả ngày — xe luân phiên ca sáng / ca chiều" }
            ]} />
          </Form.Item>
          <Form.Item name="PlanName" label="Tên kế hoạch (tùy chọn)" extra="VD: 'Ca sáng tuần 19', 'Giao đặc biệt'...">
            <Input placeholder="Để trống sẽ dùng mã RP-..." />
          </Form.Item>
          <Form.Item name="Notes" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="Ghi chú cho kế hoạch này" />
          </Form.Item>
        </Form>
        <div style={{ color:"#6b7280", fontSize:12 }}>
          Ngày: <strong>{planDate?.format("DD/MM/YYYY")}</strong> · sau khi tạo, hệ thống tự chạy tối ưu tuyến cho đơn PENDING.
        </div>
      </Modal>

      {/* ── Modal: Thêm xe ── */}
      <Modal open={addVehicleOpen} title="Thêm xe vào kế hoạch"
        onCancel={() => setAddVehicleOpen(false)}
        onOk={async () => { const { vehicleId } = await vehicleForm.validateFields(); addVehicleM.mutate({ vehicleId }); }}
        confirmLoading={addVehicleM.isPending} destroyOnClose>
        <Form form={vehicleForm} layout="vertical" preserve={false}>
          <Form.Item name="vehicleId" label="Chọn xe" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Chọn xe tải"
              options={vehicles
                .filter((v) => v.Status === "Active")
                .filter((v) => !routes.some((r) => r.VehicleID?._id === v._id || r.VehicleCode === v.VehicleCode))
                .map((v) => ({ value: v._id, label: `[${v.VehicleCode}] ${v.XName} · ${v.LicensePlate} · ${v.MaxWeight}kg` }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Gán đơn ── */}
      <Modal open={assignOrderOpen} title={`Gán đơn: ${selectedOrder?.OrderCode}`}
        onCancel={() => setAssignOrderOpen(false)} onOk={onAssignOk}
        confirmLoading={addOrderM.isPending} destroyOnClose>
        <Form form={assignForm} layout="vertical" preserve={false}>
          <div style={{ marginBottom:12 }}>
            <Text type="secondary">Khách hàng: </Text>
            <Tag color="purple">{selectedOrder?.CustomerCode}</Tag>
          </div>
          <Form.Item name="routeId" label="Chọn xe nhận đơn" rules={[{ required: true }]}>
            <Select placeholder="Chọn xe"
              options={routes
                .filter((r) => r.Status === "PLANNED")
                .map((r) => ({
                  value: r._id,
                  label: `[${r.VehicleCode}] ${r.VehicleID?.XName ?? ""} · ${r.Stops?.reduce((s, st) => s + (st.OrderCodes?.length ?? 0), 0) ?? 0} đơn`
                }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal: Fullscreen map + route assignment ── */}
      <Modal
        open={fullscreenOpen}
        onCancel={() => { setFullscreenOpen(false); setHighlightRouteId(null); }}
        footer={null}
        width="98vw"
        style={{ top: 12 }}
        styles={{ body: { padding: 0, height: "92vh" } }}
        title={<Space><EnvironmentOutlined /><span>Bản đồ lộ trình — chế độ toàn màn hình</span></Space>}
        destroyOnHidden
      >
        <div style={{ display: "flex", height: "100%" }}>
          {/* LEFT: Big map */}
          <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
            <MapContainer ref={fullscreenMapRef} center={DEFAULT_CENTER} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={depot ? [depot, ...allMapPoints] : allMapPoints} />
              {depot && (
                <Marker position={depot} icon={DEPOT_ICON}>
                  <Popup>
                    <strong>🏭 {depotOrg?.XName ?? "Kho"}</strong>
                    {depotOrg?.XCode && <><br /><Tag color="blue" style={{ fontSize: 11 }}>{depotOrg.XCode}</Tag></>}
                    {depotOrg?.Address && <><br />{depotOrg.Address}</>}
                    <br />Điểm xuất phát & quay về
                  </Popup>
                </Marker>
              )}
              {routes.map((r, rIdx) => {
                const color = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
                const pts = mapPoints[r._id] ?? [];
                const dim = highlightRouteId && highlightRouteId !== r._id ? 0.25 : 1;
                const linePts = depot && pts.length
                  ? [depot, ...pts.map((p) => p.latlng), depot]
                  : pts.map((p) => p.latlng);
                return (
                  <span key={r._id}>
                    {pts.map((pt, i) => (
                      <Marker key={i} position={pt.latlng} icon={createColoredIcon(color, pt.label)} opacity={dim}>
                        <Popup>
                          <strong>{pt.code}</strong><br />{pt.address}<br />
                          {pt.arrival && <span>⏰ {pt.arrival}<br /></span>}
                          <Tag color={color}>{r.VehicleCode}</Tag>
                        </Popup>
                      </Marker>
                    ))}
                    {linePts.length >= 2 && (
                      <Polyline
                        positions={linePts}
                        color={color}
                        weight={highlightRouteId === r._id ? 6 : 4}
                        opacity={dim * 0.85}
                      />
                    )}
                  </span>
                );
              })}
            </MapContainer>
          </div>

          {/* RIGHT: Route detail panel */}
          <div style={{ width: 420, borderLeft: "1px solid #f0f0f0", overflowY: "auto", padding: 12 }}>
            <Text strong style={{ fontSize: 14 }}>Phân công lộ trình</Text>
            <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              Click vào 1 lộ trình để xem chi tiết và chốt tài xế / xe / 3PL.
            </p>
            <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
              {routes.map((r, rIdx) => {
                const color = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
                const driver = drivers.find((d) => d._id === (r.DriverID?._id ?? r.DriverID));
                const service = services.find((s) => s._id === (r.ServiceID?._id ?? r.ServiceID));
                const isHi = highlightRouteId === r._id;
                return (
                  <Card
                    key={r._id} size="small"
                    style={{ borderLeft: `4px solid ${color}`, background: isHi ? "#f0f8ff" : "#fff", cursor: "pointer" }}
                    onClick={() => setHighlightRouteId(isHi ? null : r._id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Space>
                        <CarOutlined style={{ color }} />
                        <Text strong>{r.VehicleCode}</Text>
                        <Tag color={r.IsOutsourced ? "purple" : "blue"} style={{ fontSize: 10 }}>
                          {r.IsOutsourced ? "Thuê ngoài" : "Xe nội bộ"}
                        </Tag>
                      </Space>
                      <Tag color={ROUTE_STATUS_COLOR[r.Status]} style={{ fontSize: 10 }}>{r.Status}</Tag>
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                      {r.Stops?.length ?? 0} điểm · {r.TotalDistance ?? 0} km · {r.TotalWeight ?? 0} kg
                    </div>

                    {isHi && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #ddd" }} onClick={(e) => e.stopPropagation()}>
                        <Form layout="vertical" size="small">
                          <Form.Item label="Loại vận hành" style={{ marginBottom: 8 }}>
                            <Select
                              value={r.IsOutsourced}
                              onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { isOutsourced: v } })}
                              options={[
                                { value: false, label: "Xe nội bộ (tự chở)" },
                                { value: true,  label: "Thuê ngoài (3PL)" }
                              ]}
                            />
                          </Form.Item>
                          {!r.IsOutsourced ? (
                            <Form.Item label="Tài xế" style={{ marginBottom: 8 }}>
                              <Select
                                showSearch optionFilterProp="label" allowClear placeholder="Chọn tài xế"
                                value={driver?._id}
                                onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { driverId: v ?? null } })}
                                options={drivers.map((d) => ({
                                  value: d._id,
                                  label: `[${d.DriverCode}] ${d.XName ?? d.FullName ?? ""}`
                                }))}
                              />
                            </Form.Item>
                          ) : (
                            <Form.Item label="Dịch vụ 3PL" style={{ marginBottom: 8 }}>
                              <Select
                                showSearch optionFilterProp="label" allowClear placeholder="Chọn nhà vận chuyển"
                                value={service?._id}
                                onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { serviceId: v ?? null } })}
                                options={services
                                  .filter((s) => s.Status === "Active")
                                  .map((s) => ({ value: s._id, label: `[${s.ServiceCode}] ${s.XName} — ${s.Carrier}` }))}
                              />
                            </Form.Item>
                          )}
                          <div style={{ background: "#fafafa", padding: 8, borderRadius: 4, fontSize: 12 }}>
                            <Text type="secondary">Chi phí ước tính:</Text>{" "}
                            <Text strong style={{ color: "#1677ff" }}>
                              {(r.EstimatedCost ?? 0).toLocaleString("vi-VN")} ₫
                            </Text>
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Đơn hàng trong lộ trình:</Text>
                            <ul style={{ paddingLeft: 18, fontSize: 11, margin: "4px 0 0 0" }}>
                              {r.Stops?.map((st, i) => (
                                <li key={i}>
                                  <b>{st.CustomerCode}</b>
                                  {st.OrderCodes?.length ? ` — ${st.OrderCodes.join(", ")}` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </Form>
                      </div>
                    )}
                  </Card>
                );
              })}
            </Space>
          </div>
        </div>
      </Modal>
    </>
  );
}
