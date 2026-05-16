import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  CarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DragOutlined,
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
  App, Badge, Button, Card, Col, Collapse, DatePicker,
  Empty, Form, Input, Modal, Popconfirm, Row, Select, Alert,
  Space, Table, Tag, Tooltip, Typography
} from "antd";
import { SwapOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { routePlanApi } from "../../api/routePlan";
import { vehicleApi, driverApi, serviceApi } from "../../api/masterData";
import { organizationApi } from "../../api/organization";
import { useAuthStore } from "../../store/authStore";
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
const ROUTE_STATUS_META = {
  PLANNED: { label: "Planned", color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  LOCKED: { label: "Locked", color: "#b45309", bg: "#fffbeb", border: "#fbbf24" },
  FINALIZED: { label: "Finalized", color: "#15803d", bg: "#f0fdf4", border: "#86efac" }
};
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

// Auto-fit map to markers
function FitBounds({ points, fitKey }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [18, 18], maxZoom: 12 });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [fitKey, map]);
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

function bearingDegrees(from, to) {
  const lat1 = from[0] * Math.PI / 180;
  const lat2 = to[0] * Math.PI / 180;
  const dLng = (to[1] - from[1]) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function routeArrow(linePts, color, opacity = 1) {
  if (!Array.isArray(linePts) || linePts.length < 2) return null;
  const mid = Math.max(1, Math.floor(linePts.length / 2));
  const from = linePts[mid - 1];
  const to = linePts[mid];
  const angle = bearingDegrees(from, to);
  return {
    position: to,
    icon: L.divIcon({
      className: "",
      html: `<div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:14px solid ${color};transform:rotate(${angle}deg);opacity:${opacity};filter:drop-shadow(0 1px 2px rgba(0,0,0,.55));"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    })
  };
}

function RouteStatusPill({ status }) {
  const meta = ROUTE_STATUS_META[status] ?? { label: status, color: "#374151", bg: "#f9fafb", border: "#d1d5db" };
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      height: 22,
      padding: "0 8px",
      borderRadius: 999,
      border: `1px solid ${meta.border}`,
      background: meta.bg,
      color: meta.color,
      fontSize: 11,
      fontWeight: 700,
      lineHeight: "20px",
      whiteSpace: "nowrap",
      flexShrink: 0
    }}>
      {meta.label.toUpperCase()}
    </span>
  );
}

export default function PlanningPage() {
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const { isSuper } = usePermissions();
  const user = useAuthStore((s) => s.user);

  const [searchParams, setSearchParams] = useSearchParams();
  const [orgId, setOrgId]             = useState(null);
  // AI Agent deep-link: ?date=YYYY-MM-DD, ?autoCreate=1
  const [planDate, setPlanDate]       = useState(() => {
    const q = searchParams.get("date");
    if (q) {
      const d = dayjs(q);
      if (d.isValid()) return d;
    }
    return dayjs().hour() >= 18 ? dayjs().add(1, "day") : dayjs();
  });

  // Sync planDate khi URL ?date thay đổi (vd nhảy từ AI Agent lần 2 với date khác)
  useEffect(() => {
    const q = searchParams.get("date");
    if (!q) return;
    const d = dayjs(q);
    if (d.isValid() && !d.isSame(planDate, "day")) setPlanDate(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [mapPoints, setMapPoints]     = useState({});  // { routeId: [ [lat,lng], ... ] }
  const [roadLines, setRoadLines]     = useState({});
  const [geocoding, setGeocoding]     = useState(false);
  const [createOpen, setCreateOpen]   = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [assignOrderOpen, setAssignOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [highlightRouteId, setHighlightRouteId] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const fullscreenMapRef = useRef(null);
  const [createForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [vehicleForm] = Form.useForm();

  const orgsQ    = useQuery({ queryKey: ["organizations"], queryFn: organizationApi.list });
  const orgs     = orgsQ.data?.data ?? [];
  const depotOptions = orgs.filter((o) => o.OrgType === "DEPOT" && o.Latitude != null && o.Longitude != null);
  const activeOrg = depotOptions.find((o) => String(o._id) === String(orgId)) ?? null;

  /* Resolve depot: route planning is anchored to a real DEPOT, never to a branch/org. */
  function findDepotOrg(rootOrg, allOrgs) {
    if (!rootOrg) return null;
    const isDepot = (o) => o.OrgType === "DEPOT" && o.Latitude != null && o.Longitude != null;
    if (isDepot(rootOrg)) return rootOrg;
    let frontier = [String(rootOrg._id)];
    const seen = new Set(frontier);
    while (frontier.length) {
      const children = allOrgs.filter((o) => frontier.includes(String(o.Parent ?? "")));
      if (!children.length) break;
      const next = [];
      for (const c of children) {
        if (isDepot(c)) return c;
        const key = String(c._id);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(key);
        }
      }
      frontier = next;
    }
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
  const routesSignature = routes.map((r) =>
    `${r._id}:${r.VehicleCode}:${(r.Stops ?? []).map((s) => `${s.StopIndex}-${s.CustomerCode}-${s.Latitude ?? ""}-${s.Longitude ?? ""}-${(s.OrderCodes ?? []).join(",")}`).join(">")}`
  ).join("|");
  const shouldDrawDepot = !!activePlan && routes.length > 0 && !!depot;
  const depotTimelineLabel = depotOrg?.XCode ?? "Kho";

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

  function updateRouteCache(routeId, updatedRoute) {
    if (!activePlan?._id || !updatedRoute) return;
    qc.setQueryData(["route-plan-detail", activePlan._id], (old) => {
      if (!old?.data?.routes) return old;
      return {
        ...old,
        data: {
          ...old.data,
          routes: old.data.routes.map((route) =>
            route._id === routeId
              ? { ...route, ...updatedRoute, Stops: route.Stops }
              : route
          )
        }
      };
    });
  }

  const assignRouteM = useMutation({
    mutationFn: ({ routeId, payload }) => routePlanApi.assignRoute(activePlan._id, routeId, payload),
    onSuccess: (res, vars) => {
      const updatedRoute = res.data;
      if (!updatedRoute) {
        invalidate();
        return;
      }
      updateRouteCache(vars.routeId, updatedRoute);
      message.success("Đã cập nhật phân công");
      const geometryChanged = vars.payload?.vehicleId || vars.payload?.shift;
      if (geometryChanged) {
        invalidate();
      } else {
        qc.invalidateQueries({ queryKey: ["route-plans"] });
        qc.invalidateQueries({ queryKey: ["unplanned-orders"] });
      }
    },
    onError: (e) => message.error(e.response?.data?.message || e.message)
  });

  const displayMapPoints = useMemo(() => {
    const result = {};
    for (const route of routes) {
      const cachedByKey = new Map((mapPoints[route._id] ?? []).map((pt) => [pt.key, pt]));
      result[route._id] = (route.Stops ?? []).map((stop) => {
        const key = `${route._id}-${stop.StopIndex}-${stop.CustomerCode}-${(stop.OrderCodes ?? []).join(",")}`;
        const cached = cachedByKey.get(key);
        const hasCoord = stop.Latitude != null && stop.Longitude != null;
        const coord = hasCoord ? [Number(stop.Latitude), Number(stop.Longitude)] : cached?.latlng;
        if (!coord) return null;
        return {
          latlng: coord,
          label: stop.StopIndex,
          code: stop.CustomerCode,
          customerName: stop.CustomerName,
          customerGroup: stop.CustomerGroup,
          phone: stop.Phone,
          address: stop.Address,
          arrival: stop.PlannedArrivalTime,
          departure: stop.PlannedDepartureTime,
          serviceTime: stop.PlannedServiceTime,
          key,
          orders: stop.Orders ?? cached?.orders ?? []
        };
      }).filter(Boolean);
    }
    return result;
  }, [routes, mapPoints]);

  useEffect(() => {
    if (!orgs.length) return;
    if (orgId && depotOptions.some((o) => String(o._id) === String(orgId))) return;
    const userOrgIds = (user?.OrganizationIDs ?? []).map((id) => String(id?._id ?? id));
    const userDepot = depotOptions.find((o) => {
      const parentId = String(o.Parent?._id ?? o.Parent ?? "");
      const pathIds = (o.Path ?? []).map((id) => String(id?._id ?? id));
      return userOrgIds.includes(String(o._id)) || userOrgIds.includes(parentId) || pathIds.some((id) => userOrgIds.includes(id));
    });
    setOrgId((userDepot ?? depotOptions[0])?._id ?? null);
  }, [depotOptions, orgs.length, orgId, user]);
  useEffect(() => { setActivePlanId(null); setMapPoints({}); }, [orgId, planDate]);

  /* Fix Leaflet rendering inside Modal — invalidate size after the modal mounts */
  useEffect(() => {
    if (!fullscreenOpen) return;
    const t = setTimeout(() => {
      const m = fullscreenMapRef.current;
      if (!m) return;
      m.invalidateSize();
      const pts = Object.values(displayMapPoints).flatMap((arr) => arr.map((p) => p.latlng));
      if (pts.length >= 2) m.fitBounds(pts, { padding: [40, 40] });
      else if (pts.length === 1) m.setView(pts[0], 13);
    }, 300);
    return () => clearTimeout(t);
  }, [fullscreenOpen, displayMapPoints]);

  // Build map points — use stored lat/lng if available, fall back to Nominatim geocoding
  useEffect(() => {
    setRoadLines({});
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
          if (coord) {
            pts.push({
              latlng: coord,
              label: stop.StopIndex,
              code: stop.CustomerCode,
              customerName: stop.CustomerName,
              customerGroup: stop.CustomerGroup,
              phone: stop.Phone,
              address: stop.Address,
              arrival: stop.PlannedArrivalTime,
              departure: stop.PlannedDepartureTime,
              serviceTime: stop.PlannedServiceTime,
              key: `${route._id}-${stop.StopIndex}-${stop.CustomerCode}-${(stop.OrderCodes ?? []).join(",")}`,
              orders: stop.Orders ?? []
            });
          }
        }
        result[route._id] = pts;
      }
      setMapPoints(result);
      setGeocoding(false);
    })();
  }, [routesSignature]);

  useEffect(() => {
    if (!shouldDrawDepot || !routes.length) { setRoadLines({}); return; }
    (async () => {
      const result = {};
      await Promise.all(routes.map(async (route) => {
        const pts = displayMapPoints[route._id] ?? [];
        const fallback = pts.length ? [depot, ...pts.map((p) => p.latlng), depot] : [];
        const roadSegments = await fetchRoadSegments(fallback);
        result[route._id] = roadSegments.length ? roadSegments : (fallback.length ? [fallback] : []);
      }));
      setRoadLines(result);
    })();
  }, [depot?.[0], depot?.[1], displayMapPoints, routes, shouldDrawDepot]);

  function invalidate() {
    setMapPoints({});
    setRoadLines({});
    qc.invalidateQueries({ queryKey: ["route-plans"] });
    qc.invalidateQueries({ queryKey: ["route-plan-detail"] });
    qc.invalidateQueries({ queryKey: ["unplanned-orders"] });
  }

  const createPlanM = useMutation({
    mutationFn: (vals) => routePlanApi.create({
      OrganizationID: orgId, PlanDate: planDate.format("YYYY-MM-DD"),
      PlanName: vals.PlanName, Notes: vals.Notes, Shift: vals.Shift ?? "FULL_DAY"
    }),
    onSuccess: async (res) => {
      const created = res?.data ?? res;
      message.success(`Đã tạo ${created.PlanCode} — đang tự động tối ưu tuyến...`);
      const newPlanId = created._id;
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

  // AI Agent auto-create: ?autoCreate=1 + orgId + planDate ready → tự fire createPlan 1 lần.
  useEffect(() => {
    if (searchParams.get("autoCreate") !== "1") return;
    if (!orgId || !planDate || createPlanM.isPending) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("autoCreate");
      next.delete("date");
      return next;
    }, { replace: true });
    const planName = `Kế hoạch ${planDate.format("DD/MM/YYYY")} (AI Agent)`;
    createPlanM.mutate({ PlanName: planName, Shift: "FULL_DAY", Notes: "Tạo bởi AI Agent" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, planDate, searchParams]);

  const addVehicleM = useMutation({
    mutationFn: ({ vehicleId }) => routePlanApi.addRoute(activePlan._id, { VehicleID: vehicleId }),
    onSuccess: () => { message.success("Đã thêm xe"); setAddVehicleOpen(false); vehicleForm.resetFields(); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const removeRouteM = useMutation({
    mutationFn: (routeId) => routePlanApi.removeRoute(activePlan._id, routeId),
    onSuccess: () => { message.success("Đã xóa lộ trình"); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const removePlanM = useMutation({
    mutationFn: (planId) => routePlanApi.remove(planId),
    onSuccess: () => {
      message.success("Đã xóa kế hoạch");
      setActivePlanId(null);
      setMapPoints({});
      invalidate();
    },
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

  const reorderOrderM = useMutation({
    mutationFn: ({ orderId, toRouteId, toIndex }) =>
      routePlanApi.reorderOrder(activePlan._id, { orderId, toRouteId, toIndex }),
    onSuccess: () => { message.success("Đã cập nhật lộ trình"); invalidate(); },
    onError: (e) => message.error(e.response?.data?.message || e.message)
  });

  const removeOrderM = useMutation({
    mutationFn: ({ routeId, orderId }) => routePlanApi.removeOrder(activePlan._id, routeId, orderId),
    onSuccess: () => { message.success("Đã gỡ đơn"); invalidate(); },
    onError: (e) => message.error(e.message)
  });

  const lockM = useMutation({
    mutationFn: (rId) => routePlanApi.lock(activePlan._id, rId),
    onSuccess: (res, rId) => {
      updateRouteCache(rId, res.data);
      message.success("Đã khóa route");
      qc.invalidateQueries({ queryKey: ["route-plans"] });
      qc.invalidateQueries({ queryKey: ["unplanned-orders"] });
    },
    onError: (e) => message.error(e.message)
  });
  const unlockM = useMutation({
    mutationFn: (rId) => routePlanApi.unlock(activePlan._id, rId),
    onSuccess: (res, rId) => {
      updateRouteCache(rId, res.data);
      message.success("Đã mở khóa route");
      qc.invalidateQueries({ queryKey: ["route-plans"] });
      qc.invalidateQueries({ queryKey: ["unplanned-orders"] });
    },
    onError: (e) => message.error(e.message)
  });
  const finalizeM = useMutation({
    mutationFn: (rId) => routePlanApi.finalize(activePlan._id, rId),
    onSuccess: (res, rId) => {
      const route = res.data?.route ?? res.data;
      updateRouteCache(rId, route);
      qc.invalidateQueries({ queryKey: ["route-plans"] });
      qc.invalidateQueries({ queryKey: ["unplanned-orders"] });
      message.success("Đã chốt lộ trình");
    },
    onError: (e) => message.error(e.message)
  });

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

  const cannotOptimizeEmptyPlan = !!activePlan && routes.length === 0 && unplanned.length === 0;


  function handleRouteDrop(e, route, toIndex = route.Stops?.length ?? 0) {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    try {
      const payload = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (payload.source === "unplanned") {
        addOrderM.mutate({ routeId: route._id, orderId: payload.orderId, customerCode: payload.customerCode });
      } else if (payload.orderId) {
        reorderOrderM.mutate({ orderId: payload.orderId, toRouteId: route._id, toIndex });
      }
    } catch { /* ignore */ }
  }

  function isRouteDropTarget(routeId) {
    return dragState && dropTarget?.routeId === String(routeId);
  }

  function renderDropSlot(route, index, isDisabled) {
    const active = dragState && dropTarget?.routeId === String(route._id) && dropTarget?.index === index;
    return (
      <div
        onDragOver={(e) => {
          if (isDisabled) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          setDropTarget({ routeId: String(route._id), index });
        }}
        onDrop={(e) => {
          if (isDisabled) return;
          handleRouteDrop(e, route, index);
        }}
        style={{
          width: active ? 42 : 14,
          height: 82,
          borderRadius: 8,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "width .16s ease, background .16s ease, border-color .16s ease",
          background: active ? "#dbeafe" : "transparent",
          border: active ? "2px dashed #2563eb" : "2px dashed transparent"
        }}
      >
        {active && <span style={{ width: 4, height: 52, borderRadius: 999, background: "#2563eb" }} />}
      </div>
    );
  }

  function renderStopPopup(pt, route, color) {
    return (
      <div style={{ minWidth: 240 }}>
        <strong>{pt.customerName || pt.code}</strong>
        <br />
        <Text type="secondary">{pt.code}{pt.customerGroup ? ` · ${pt.customerGroup}` : ""}</Text>
        {pt.address && <><br />{pt.address}</>}
        {pt.phone && <><br />{pt.phone}</>}
        {pt.arrival && <><br />Dừng giao: <strong>{pt.arrival}{pt.departure ? ` - ${pt.departure}` : ""}</strong></>}
        {pt.serviceTime ? <><br />Thời gian dỡ/giao: <strong>{pt.serviceTime} phút</strong></> : null}
        <div style={{ marginTop: 8 }}>
          <Tag color={color}>{route.VehicleCode}</Tag>
        </div>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {(pt.orders ?? []).map((order) => (
            <div key={order._id} style={{ borderTop: "1px solid #f0f0f0", paddingTop: 6 }}>
              <Tag color="blue" style={{ marginBottom: 4 }}>{order.OrderCode}</Tag>
              {(order.Items ?? []).slice(0, 4).map((item) => (
                <div key={`${order._id}-${item.ProductCode}`} style={{ fontSize: 12 }}>
                  {item.ProductName ?? item.ProductCode} × {item.NumberOfCases ?? 0}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function openAssign(order) { setSelectedOrder(order); assignForm.resetFields(); setAssignOrderOpen(true); }
  async function onAssignOk() {
    const { routeId } = await assignForm.validateFields();
    addOrderM.mutate({ routeId, orderId: selectedOrder._id, customerCode: selectedOrder.CustomerCode });
  }

  // Build all map points for display
  const allMapPoints = Object.values(displayMapPoints).flatMap((pts) => pts.map((p) => p.latlng));
  const visibleMapPoints = shouldDrawDepot && allMapPoints.length ? [depot, ...allMapPoints] : allMapPoints;
  const mapFitKey = visibleMapPoints.map(([lat, lng]) => `${lat},${lng}`).join("|");


  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="title">Lập kế hoạch</h2>
          <p className="subtitle">Planner phân công đơn hàng vào xe và kiểm tra lộ trình trước khi chốt kế hoạch</p>
        </div>
      </div>

      {/* ── Selector bar ── */}
      <Card size="small" style={{ marginBottom:12 }}>
        <Row gutter={[12,8]} align="middle">
          <Col>
            <Text type="secondary">Kho lập kế hoạch:</Text>
          </Col>
          <Col>
            <Select
              style={{ width:300 }}
              value={orgId}
              placeholder="Chọn kho có tọa độ"
              onChange={(v) => { setOrgId(v); setActivePlanId(null); }}
              options={depotOptions.map((o) => ({ value: o._id, label: `[${o.XCode}] ${o.XName}` }))}
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col>
            <Text type="secondary">Ngày chạy:</Text>
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
        <Empty description="Chọn kho để bắt đầu" />
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
                  <FitBounds points={visibleMapPoints} fitKey={mapFitKey} />
                  {shouldDrawDepot && (
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
                    const pts = displayMapPoints[r._id] ?? [];
                    const lineSegments = roadLines[r._id] ?? [shouldDrawDepot && pts.length ? [depot, ...pts.map((p) => p.latlng), depot] : pts.map((p) => p.latlng)];
                    return (
                      <span key={r._id}>
	                        {pts.map((pt) => (
	                          <Marker key={pt.key} position={pt.latlng} icon={createColoredIcon(color, pt.label)}>
	                            <Popup>{renderStopPopup(pt, r, color)}</Popup>
	                          </Marker>
	                        ))}
                        {lineSegments.map((linePts, i) => linePts.length >= 2 && (
                          <span key={i}>
                            <Polyline positions={linePts} color="#111827" weight={8} opacity={0.35} />
                            <Polyline positions={linePts} color={color} weight={5} opacity={0.96} />
                            {(() => {
                              const arrow = routeArrow(linePts, color);
                              return arrow ? <Marker position={arrow.position} icon={arrow.icon} interactive={false} /> : null;
                            })()}
                          </span>
                        ))}
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
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Không có đơn đã duyệt chờ lập kế hoạch trong tổ chức/ngày này
                    </Text>
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
                  {activePlan.Status !== "FINALIZED" && (
                    <Popconfirm
                      title="Xóa kế hoạch này?"
                      description="Các đơn trong kế hoạch sẽ quay về trạng thái chờ lập kế hoạch. Kế hoạch đã hoàn tất thì không xóa được."
                      onConfirm={() => removePlanM.mutate(activePlan._id)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} loading={removePlanM.isPending}>
                        Xóa kế hoạch
                      </Button>
                    </Popconfirm>
                  )}
                  <Tooltip title={cannotOptimizeEmptyPlan ? "Không có đơn đã duyệt chờ lập kế hoạch trong tổ chức/ngày này" : "Tự động phân tuyến"}>
                    <Button size="small" type="primary" icon={<NodeIndexOutlined />}
                      loading={optimizeM.isPending}
                      disabled={activePlan.Status === "FINALIZED" || cannotOptimizeEmptyPlan}
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
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  {cannotOptimizeEmptyPlan && (
                    <Alert
                      type="warning"
                      showIcon
                      message="Chưa thể lên lộ trình"
                      description="Tổ chức/ngày đang chọn không có đơn hàng đã duyệt ở trạng thái chờ lập kế hoạch. Hãy duyệt đơn trong màn Đơn hàng, chọn đúng ngày đặt hàng, hoặc tạo thêm đơn cho tổ chức này."
                    />
                  )}
                  <Empty description="Chưa có lộ trình — nhấn '+ Xe' để thêm lộ trình thủ công" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </Space>
              ) : (
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  {routes.map((r, rIdx) => {
                    const color = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
                    const isLocked = r.Status === "LOCKED";
                    const isFinalized = r.Status === "FINALIZED";
                    const totalOrders = r.Stops?.reduce((s, st) => s + (st.OrderCodes?.length ?? 0), 0) ?? 0;
                    const driver = drivers.find((d) => String(d._id) === String(r.DriverID?._id ?? r.DriverID ?? ""));
                    const service = services.find((s) => String(s._id) === String(r.ServiceID?._id ?? r.ServiceID ?? ""));
                    const vehicleId = String(r.VehicleID?._id ?? r.VehicleID ?? "");
                    const vehicleCode = r.VehicleCode || r.VehicleID?.VehicleCode || "Chưa chọn xe";
                    const selectedDepotId = String(orgId ?? "");

	                    function onRowDragOver(e) {
	                      if (isLocked || isFinalized) return;
	                      e.preventDefault();
	                      e.dataTransfer.dropEffect = "move";
	                      if (dragState) setDropTarget({ routeId: String(r._id), index: r.Stops?.length ?? 0 });
	                    }
	                    function onRowDrop(e) {
	                      if (isLocked || isFinalized) return;
	                      handleRouteDrop(e, r);
	                    }

                    /* Vehicles available to swap into this route: Active + same org +
                       not already used by another route in this plan. */
                    const usedVehicleIds = new Set(routes.filter((rr) => rr._id !== r._id).map((rr) => String(rr.VehicleID?._id ?? rr.VehicleID)));
                    const swappableVehicles = vehicles.filter((v) =>
                      v.Status === "Active" &&
                      String(v.OrganizationID?._id ?? v.OrganizationID ?? "") === selectedDepotId &&
                      !usedVehicleIds.has(String(v._id))
                    );

                    return (
                      <div
                        key={r._id}
                        onDragOver={onRowDragOver}
                        onDrop={onRowDrop}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null);
                        }}
                        className="route-row"
                        style={{
                          display: "flex", alignItems: "stretch",
                          border: `1px solid ${isRouteDropTarget(r._id) ? "#2563eb" : isLocked ? "#ffd591" : isFinalized ? "#b7eb8f" : "#e5e7eb"}`,
                          borderLeft: `5px solid ${color}`,
                          borderRadius: 8, background: isRouteDropTarget(r._id) ? "#eff6ff" : "#fff",
                          boxShadow: isRouteDropTarget(r._id) ? "0 8px 20px rgba(37,99,235,0.16)" : "0 1px 2px rgba(0,0,0,0.04)",
                          transition: "box-shadow .15s, border-color .15s",
                          overflow: "hidden"
                        }}
                      >
                        {/* LEFT panel: vehicle + assignment */}
	                        <div style={{ width: 360, padding: "10px 12px", borderRight: "1px solid #f0f0f0", flexShrink: 0, background: "#fafbfc" }}>
	                          {/* Header row: vehicle + actions */}
	                          <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
	                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
		                            <Space size={8} align="center" style={{ minWidth: 0, flex: 1 }}>
		                              <CarOutlined style={{ color, fontSize: 16, flexShrink: 0 }} />
		                              {!isLocked && !isFinalized ? (
	                                <Select
	                                  size="small"
	                                  showSearch optionFilterProp="label"
	                                  value={vehicleId || undefined}
	                                  onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { vehicleId: v } })}
                                  options={[
                                    ...(vehicleId ? [{ value: vehicleId, label: `${vehicleCode} · xe hiện tại` }] : []),
                                    ...swappableVehicles.map((v) => ({
                                      value: String(v._id),
                                      label: `${v.VehicleCode} · ${v.MaxWeight}kg / ${v.MaxVolume}m³`
                                    }))
                                  ]}
	                                  style={{ width: 220, fontWeight: 600 }}
	                                  dropdownStyle={{ minWidth: 280 }}
	                                />
	                              ) : (
	                                <Text strong>{vehicleCode}</Text>
	                              )}
		                              <RouteStatusPill status={r.Status} />
	                            </Space>
	                            </div>
	                            <Space size={6} onClick={(e) => e.stopPropagation()} wrap>
	                              {!isLocked && !isFinalized && (
	                                <Popconfirm title="Khóa route này?" onConfirm={() => lockM.mutate(r._id)}>
	                                  <Button size="small" icon={<LockOutlined />}>Khóa lộ trình</Button>
	                                </Popconfirm>
	                              )}
	                              {isLocked && (
	                                <>
	                                  <Popconfirm title="Mở khóa?" onConfirm={() => unlockM.mutate(r._id)}>
	                                    <Button size="small" icon={<UnlockOutlined />}>Mở khóa</Button>
	                                  </Popconfirm>
	                                  <Popconfirm title="Finalize route?" onConfirm={() => finalizeM.mutate(r._id)}>
	                                    <Button size="small" icon={<CheckCircleOutlined />} style={{ color: "#52c41a" }}>Hoàn tất</Button>
	                                  </Popconfirm>
	                                  <Popconfirm title="Xóa lộ trình đã khóa này?" description="Các đơn trong route sẽ quay về trạng thái chờ lập kế hoạch." onConfirm={() => removeRouteM.mutate(r._id)}>
	                                    <Button size="small" danger icon={<DeleteOutlined />}>Xóa lộ trình</Button>
	                                  </Popconfirm>
	                                </>
	                              )}
	                              {!isLocked && !isFinalized && (
	                                <Popconfirm title="Xóa lộ trình này?" onConfirm={() => removeRouteM.mutate(r._id)}>
	                                  <Button size="small" danger icon={<DeleteOutlined />}>Xóa lộ trình</Button>
	                                </Popconfirm>
	                              )}
	                            </Space>
                          </div>

                          {/* Stats row */}
	                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, max-content)", gap: "6px 10px", fontSize: 11, color: "#6b7280", marginBottom: 8, whiteSpace: "nowrap" }}>
	                            <span>{totalOrders} đơn</span>
	                            <span>{r.Stops?.length ?? 0} điểm</span>
	                            <span>{r.TotalDistance ?? 0} km</span>
	                            <span>{r.TotalWeight ?? 0} kg</span>
                          </div>
                          {r.PlannedStartTime && r.PlannedReturnTime && (
                            <div style={{ fontSize: 11, color: "#374151", marginBottom: 8 }}>
                              Chạy: <b>{r.PlannedStartTime}</b> - <b>{r.PlannedReturnTime}</b>
                            </div>
                          )}

                          <div style={{
                            marginBottom: 8,
                            padding: "7px 8px",
                            border: "1px solid #e5e7eb",
                            borderRadius: 6,
                            background: "#fff",
                            fontSize: 11,
                            color: "#374151"
                          }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Vận hành: </Text>
                            {r.IsOutsourced ? (
                              service ? (
                                <Tag color="purple" style={{ marginLeft: 4 }}>
                                  3PL · {service.Carrier || service.XName} ({service.ServiceCode})
                                </Tag>
                              ) : (
                                <Tag color="red" style={{ marginLeft: 4 }}>3PL · Chưa chọn dịch vụ</Tag>
                              )
                            ) : driver ? (
                              <Tag color="green" style={{ marginLeft: 4 }}>
                                Tài xế · {driver.XName ?? driver.FullName} ({driver.DriverCode})
                              </Tag>
                            ) : (
                              <Tag color="red" style={{ marginLeft: 4 }}>Nội bộ · Chưa chọn tài xế</Tag>
                            )}
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
                        <div style={{ flex: 1, padding: "10px 12px", overflowX: "auto", display: "flex", alignItems: "center", gap: 4, minWidth: 0, background: isRouteDropTarget(r._id) ? "#f8fbff" : "#fff", transition: "background .16s ease" }}>
	                          <div title={depotOrg?.XName ?? "Kho"} style={{ background: "#111827", color: "#fde68a", padding: "7px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap", border: "1px solid #374151" }}>
	                            Kho {depotTimelineLabel}
                          </div>
                          {(r.Stops ?? []).length === 0 ? (
                            <div style={{ flex: 1, padding: "16px 12px", border: "2px dashed #d9d9d9", borderRadius: 6, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
	                              Kéo đơn từ panel "Đơn chưa phân công" hoặc từ xe khác vào đây
                            </div>
                          ) : (
	                            r.Stops.map((stop) => {
	                              const slotIndex = Math.max(0, (stop.StopIndex ?? 1) - 1);
	                              const stopActive = dragState && dropTarget?.routeId === String(r._id) && dropTarget?.index === slotIndex;
	                              return (
	                              <div key={stop.StopIndex} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                <span style={{ color: "#9ca3af", fontSize: 16 }}>→</span>
                                {renderDropSlot(r, slotIndex, isLocked || isFinalized)}
                                <div style={{
                                  border: `1.5px solid ${stopActive ? "#2563eb" : color}`,
                                  background: stopActive ? "#eff6ff" : "#fff",
                                  borderRadius: 8,
                                  padding: "6px 10px",
                                  minWidth: 140,
                                  boxShadow: stopActive ? "0 8px 18px rgba(37,99,235,0.18)" : "0 1px 2px rgba(0,0,0,0.05)",
                                  transform: stopActive ? "translateY(-2px)" : "none",
                                  transition: "background .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease"
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
                                      ⏰ {stop.PlannedArrivalTime}{stop.PlannedDepartureTime ? ` - ${stop.PlannedDepartureTime}` : ""}
                                      {stop.PlannedServiceTime ? ` · dỡ ${stop.PlannedServiceTime}p` : ""}
                                    </div>
                                  )}
                                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
		                                    {stop.OrderCodes?.map((code, i) => {
		                                      const orderId = String(stop.OrderIDs?.[i] ?? "");
		                                      const canDragOrder = !isLocked && !isFinalized && !!orderId;
		                                      return (
		                                      <Tooltip key={code} title={canDragOrder ? "Kéo sang xe khác hoặc đổi vị trí trong lộ trình" : ""}>
		                                        <div
		                                          draggable={canDragOrder}
		                                          onDragStart={(e) => {
		                                            e.stopPropagation();
		                                            if (!canDragOrder) {
		                                              e.preventDefault();
		                                              return;
		                                            }
		                                            setDragState({ orderId, code, fromRouteId: String(r._id) });
		                                            setDropTarget({ routeId: String(r._id), index: slotIndex });
		                                            e.dataTransfer.setData("text/plain", JSON.stringify({ orderId, fromRouteId: r._id, source: "route" }));
		                                            e.dataTransfer.effectAllowed = "move";
		                                          }}
		                                          onDragEnd={() => {
		                                            setDragState(null);
		                                            setDropTarget(null);
		                                          }}
		                                          style={{
		                                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
		                                            cursor: canDragOrder ? "grab" : "default",
		                                            background: dragState?.orderId === orderId ? "#2563eb" : "#f8fafc",
		                                            border: `1px solid ${dragState?.orderId === orderId ? "#1d4ed8" : "#bfdbfe"}`,
		                                            borderRadius: 6, padding: "3px 6px",
		                                            opacity: dragState?.orderId === orderId ? 0.72 : 1,
		                                            transform: dragState?.orderId === orderId ? "scale(0.98)" : "none",
		                                            transition: "background .14s ease, border-color .14s ease, opacity .14s ease, transform .14s ease"
		                                          }}
		                                        >
		                                          <Space size={4} style={{ minWidth: 0 }}>
		                                            {!isLocked && !isFinalized && <DragOutlined style={{ color: dragState?.orderId === orderId ? "#fff" : "#1d4ed8", fontSize: 11, flexShrink: 0 }} />}
		                                            <span style={{ fontSize: 10, fontFamily: "monospace", color: dragState?.orderId === orderId ? "#fff" : "#1d4ed8", whiteSpace: "nowrap" }}>{code}</span>
		                                          </Space>
		                                          {!isLocked && !isFinalized && (
	                                            <Popconfirm title={`Gỡ ${code}?`} onConfirm={() => removeOrderM.mutate({ routeId: r._id, orderId: stop.OrderIDs?.[i] })}>
	                                              <Button type="text" danger size="small" icon={<DeleteOutlined />} style={{ height: 16, width: 16, padding: 0, fontSize: 10 }} />
	                                            </Popconfirm>
	                                          )}
		                                        </div>
		                                      </Tooltip>
		                                    );
		                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                            })
                          )}
                          {r.Stops?.length > 0 && (
                            <>
                              <span style={{ color: "#9ca3af", fontSize: 16 }}>→</span>
                              {renderDropSlot(r, r.Stops.length, isLocked || isFinalized)}
	                              <div title={depotOrg?.XName ?? "Kho"} style={{ background: "#111827", color: "#fde68a", padding: "7px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap", border: "1px solid #374151" }}>
	                                Kho {depotTimelineLabel}
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
	              { value: "FULL_DAY",  label: "Cả ngày — xe chạy từ 08:00 đến 17:30" }
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
                .filter((v) => String(v.OrganizationID?._id ?? v.OrganizationID ?? "") === String(orgId ?? ""))
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
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Big map */}
          <div style={{ flex: 1, position: "relative", minWidth: 0, minHeight: 0 }}>
            <MapContainer ref={fullscreenMapRef} center={DEFAULT_CENTER} zoom={12} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={visibleMapPoints} fitKey={mapFitKey} />
              {shouldDrawDepot && (
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
                const pts = displayMapPoints[r._id] ?? [];
                const dim = highlightRouteId && highlightRouteId !== r._id ? 0.25 : 1;
                const lineSegments = roadLines[r._id] ?? [shouldDrawDepot && pts.length
                  ? [depot, ...pts.map((p) => p.latlng), depot]
                  : pts.map((p) => p.latlng)];
                return (
                  <span key={r._id}>
	                    {pts.map((pt) => (
	                      <Marker key={pt.key} position={pt.latlng} icon={createColoredIcon(color, pt.label)} opacity={dim}>
	                        <Popup>{renderStopPopup(pt, r, color)}</Popup>
	                      </Marker>
	                    ))}
                    {lineSegments.map((linePts, i) => linePts.length >= 2 && (
                      <span key={i}>
                        <Polyline positions={linePts} color="#111827" weight={highlightRouteId === r._id ? 10 : 8} opacity={dim * 0.35} />
                        <Polyline positions={linePts} color={color} weight={highlightRouteId === r._id ? 7 : 5} opacity={dim * 0.96} />
                        {(() => {
                          const arrow = routeArrow(linePts, color, dim);
                          return arrow ? <Marker position={arrow.position} icon={arrow.icon} interactive={false} opacity={dim} /> : null;
                        })()}
                      </span>
                    ))}
                  </span>
                );
              })}
            </MapContainer>
          </div>

          {/* Route detail panel */}
          <div style={{ height: 310, borderTop: "1px solid #e5e7eb", overflow: "auto", padding: 8, background: "#f8fafc" }}>
            <Space direction="vertical" size={6} style={{ minWidth: "100%" }}>
              {routes.map((r, rIdx) => {
                const color = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
                const driver = drivers.find((d) => String(d._id) === String(r.DriverID?._id ?? r.DriverID ?? ""));
                const service = services.find((s) => String(s._id) === String(r.ServiceID?._id ?? r.ServiceID ?? ""));
                const totalOrders = r.Stops?.reduce((s, st) => s + (st.OrderCodes?.length ?? 0), 0) ?? 0;
                const isHi = highlightRouteId === r._id;
                const isLocked = r.Status === "LOCKED";
                const isFinalized = r.Status === "FINALIZED";
                const vehicleId = String(r.VehicleID?._id ?? r.VehicleID ?? "");
                const vehicleCode = r.VehicleCode || r.VehicleID?.VehicleCode || "Chưa chọn xe";
                const selectedDepotId = String(orgId ?? "");
                const usedVehicleIds = new Set(routes.filter((rr) => rr._id !== r._id).map((rr) => String(rr.VehicleID?._id ?? rr.VehicleID)));
                const swappableVehicles = vehicles.filter((v) =>
                  v.Status === "Active" &&
                  String(v.OrganizationID?._id ?? v.OrganizationID ?? "") === selectedDepotId &&
                  !usedVehicleIds.has(String(v._id))
                );
                return (
                  <div
                    key={r._id}
                    onDragOver={(e) => {
                      if (isLocked || isFinalized) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragState) setDropTarget({ routeId: String(r._id), index: r.Stops?.length ?? 0 });
                    }}
                    onDrop={(e) => {
                      if (isLocked || isFinalized) return;
                      handleRouteDrop(e, r);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null);
                    }}
                    style={{
                      display: "flex",
                      minWidth: "100%",
                      border: `1px solid ${isRouteDropTarget(r._id) ? "#2563eb" : isHi ? color : "#e5e7eb"}`,
                      borderLeft: `5px solid ${color}`,
                      borderRadius: 8,
                      background: isRouteDropTarget(r._id) ? "#eff6ff" : "#fff",
                      boxShadow: isRouteDropTarget(r._id) ? "0 8px 20px rgba(37,99,235,0.16)" : isHi ? `0 6px 18px ${color}33` : "0 1px 2px rgba(15,23,42,.06)",
                      overflow: "hidden",
                      cursor: "pointer"
                    }}
                    onClick={() => setHighlightRouteId(isHi ? null : r._id)}
                  >
                    <div style={{ width: 360, padding: "10px 12px", borderRight: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <Space size={8} style={{ marginBottom: 6 }} wrap>
                        <CarOutlined style={{ color, fontSize: 16 }} />
                        {!isLocked && !isFinalized ? (
                          <Select
                            size="small"
                            showSearch
                            optionFilterProp="label"
                            value={vehicleId || undefined}
                            onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { vehicleId: v } })}
                            options={[
                              ...(vehicleId ? [{ value: vehicleId, label: `${vehicleCode} · xe hiện tại` }] : []),
                              ...swappableVehicles.map((v) => ({
                                value: String(v._id),
                                label: `${v.VehicleCode} · ${v.MaxWeight}kg / ${v.MaxVolume}m³`
                              }))
                            ]}
                            style={{ width: 210 }}
                          />
                        ) : (
                          <Text strong>{vehicleCode}</Text>
                        )}
                        <RouteStatusPill status={r.Status} />
                      </Space>
                      <div style={{ fontSize: 11, color: "#475569", display: "grid", gap: 3 }}>
                        <span>{totalOrders} đơn · {r.Stops?.length ?? 0} điểm · {r.TotalDistance ?? 0} km</span>
                        <span>Chạy: <b>{r.PlannedStartTime ?? "--:--"}</b> - <b>{r.PlannedReturnTime ?? "--:--"}</b></span>
                        <span style={{ color: !r.IsOutsourced && !driver ? "#dc2626" : "#475569" }}>
                          {r.IsOutsourced ? "3PL" : "Nội bộ"}
                          {driver ? ` · ${driver.XName ?? driver.FullName}` : !r.IsOutsourced ? " · Chưa chọn tài xế" : ""}
                        </span>
                        <span style={{ color: "#1677ff", fontWeight: 700 }}>{(r.EstimatedCost ?? 0).toLocaleString("vi-VN")} ₫</span>
                      </div>
                      {!isLocked && !isFinalized && (
                        <Space direction="vertical" size={6} style={{ width: "100%", marginTop: 8 }}>
                          <Select
                            size="small"
                            style={{ width: "100%" }}
                            value={r.Shift ?? "MORNING"}
                            onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { shift: v } })}
                            options={[
                              { value: "MORNING", label: "Ca sáng (08:00-12:00)" },
                              { value: "AFTERNOON", label: "Ca chiều (13:30-17:30)" },
                              { value: "FULL_DAY", label: "Cả ngày (08:00-17:30)" }
                            ]}
                          />
                          <div style={{ display: "flex", gap: 4 }}>
                            <Select
                              size="small"
                              style={{ width: 90 }}
                              value={!!r.IsOutsourced}
                              onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { isOutsourced: v } })}
                              options={[
                                { value: false, label: "Nội bộ" },
                                { value: true, label: "3PL" }
                              ]}
                            />
                            {!r.IsOutsourced ? (
                              <Select
                                size="small"
                                style={{ flex: 1, minWidth: 0 }}
                                showSearch
                                optionFilterProp="label"
                                allowClear
                                placeholder="Chọn tài xế"
                                value={driver?._id}
                                onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { driverId: v ?? null } })}
                                options={drivers.map((d) => ({ value: d._id, label: `[${d.DriverCode}] ${d.XName ?? d.FullName ?? ""}` }))}
                              />
                            ) : (
                              <Select
                                size="small"
                                style={{ flex: 1, minWidth: 0 }}
                                showSearch
                                optionFilterProp="label"
                                allowClear
                                placeholder="Chọn 3PL"
                                value={service?._id}
                                onChange={(v) => assignRouteM.mutate({ routeId: r._id, payload: { serviceId: v ?? null } })}
                                options={services.filter((s) => s.Status === "Active").map((s) => ({ value: s._id, label: `${s.Carrier} (${s.ServiceCode})` }))}
                              />
                            )}
                          </div>
                          <Space size={6} wrap>
                            <Popconfirm title="Khóa route này?" onConfirm={() => lockM.mutate(r._id)}>
                              <Button size="small" icon={<LockOutlined />}>Khóa lộ trình</Button>
                            </Popconfirm>
                            <Popconfirm title="Xóa lộ trình này?" onConfirm={() => removeRouteM.mutate(r._id)}>
                              <Button size="small" danger icon={<DeleteOutlined />}>Xóa lộ trình</Button>
                            </Popconfirm>
                          </Space>
                        </Space>
                      )}
                      {isLocked && (
                        <Space size={6} wrap style={{ marginTop: 8 }}>
                          <Popconfirm title="Mở khóa?" onConfirm={() => unlockM.mutate(r._id)}>
                            <Button size="small" icon={<UnlockOutlined />}>Mở khóa</Button>
                          </Popconfirm>
                          <Popconfirm title="Chốt hoàn tất route?" onConfirm={() => finalizeM.mutate(r._id)}>
                            <Button size="small" icon={<CheckCircleOutlined />} style={{ color: "#52c41a" }}>Hoàn tất</Button>
                          </Popconfirm>
                          <Popconfirm title="Xóa lộ trình đã khóa này?" description="Các đơn trong route sẽ quay về trạng thái chờ lập kế hoạch." onConfirm={() => removeRouteM.mutate(r._id)}>
                            <Button size="small" danger icon={<DeleteOutlined />}>Xóa lộ trình</Button>
                          </Popconfirm>
                        </Space>
                      )}
                    </div>
                    <div style={{ flex: 1, overflowX: "auto", padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div style={{ background: "#111827", color: "#fde68a", padding: "8px 11px", borderRadius: 6, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                        Kho {depotTimelineLabel}
                      </div>
                      {(r.Stops ?? []).map((stop) => {
                        const slotIndex = Math.max(0, (stop.StopIndex ?? 1) - 1);
                        const stopActive = dragState && dropTarget?.routeId === String(r._id) && dropTarget?.index === slotIndex;
                        return (
                        <span key={`${r._id}-${stop.StopIndex}`} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          <span style={{ color, fontSize: 18, fontWeight: 800 }}>→</span>
                          {renderDropSlot(r, slotIndex, isLocked || isFinalized)}
                          <div style={{
                            border: `2px solid ${stopActive ? "#2563eb" : color}`,
                            borderRadius: 8,
                            padding: "7px 10px",
                            minWidth: 150,
                            background: stopActive ? "#eff6ff" : "#fff",
                            boxShadow: stopActive ? "0 8px 18px rgba(37,99,235,0.18)" : "none"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ background: color, color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
                                {stop.StopIndex}
                              </span>
                              <Text strong style={{ fontSize: 12 }}>{stop.CustomerCode}</Text>
                            </div>
                            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                              {stop.PlannedArrivalTime ?? "--:--"}{stop.PlannedDepartureTime ? ` - ${stop.PlannedDepartureTime}` : ""}
                              {stop.PlannedServiceTime ? ` · dỡ ${stop.PlannedServiceTime}p` : ""}
                            </div>
                            <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 3 }}>
                              {(stop.OrderCodes ?? []).map((code, i) => {
                                const orderId = String(stop.OrderIDs?.[i] ?? "");
                                const canDragOrder = !isLocked && !isFinalized && !!orderId;
                                return (
                                  <div
                                    key={code}
                                    draggable={canDragOrder}
                                    onDragStart={(e) => {
                                      e.stopPropagation();
                                      if (!canDragOrder) {
                                        e.preventDefault();
                                        return;
                                      }
                                      setDragState({ orderId, code, fromRouteId: String(r._id) });
                                      setDropTarget({ routeId: String(r._id), index: slotIndex });
                                      e.dataTransfer.setData("text/plain", JSON.stringify({ orderId, fromRouteId: r._id, source: "route" }));
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragEnd={() => {
                                      setDragState(null);
                                      setDropTarget(null);
                                    }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      cursor: canDragOrder ? "grab" : "default",
                                      background: dragState?.orderId === orderId ? "#2563eb" : "#eff6ff",
                                      border: `1px solid ${dragState?.orderId === orderId ? "#1d4ed8" : "#bfdbfe"}`,
                                      borderRadius: 6,
                                      padding: "2px 5px",
                                      fontSize: 10,
                                      color: dragState?.orderId === orderId ? "#fff" : "#1d4ed8"
                                    }}
                                  >
                                    {canDragOrder && <DragOutlined style={{ fontSize: 10 }} />}
                                    <span style={{ fontFamily: "monospace" }}>{code}</span>
                                    {canDragOrder && (
                                      <Popconfirm title={`Gỡ ${code}?`} onConfirm={() => removeOrderM.mutate({ routeId: r._id, orderId })}>
                                        <Button type="text" danger size="small" icon={<DeleteOutlined />} style={{ height: 14, width: 14, padding: 0, fontSize: 9 }} />
                                      </Popconfirm>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </span>
                      );
                      })}
                      {(r.Stops ?? []).length > 0 && (
                        <>
                          <span style={{ color, fontSize: 18, fontWeight: 800 }}>→</span>
                          {renderDropSlot(r, r.Stops.length, isLocked || isFinalized)}
                          <div style={{ background: "#111827", color: "#fde68a", padding: "8px 11px", borderRadius: 6, fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                            Kho {depotTimelineLabel}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </Space>
          </div>
        </div>
      </Modal>
    </>
  );
}
