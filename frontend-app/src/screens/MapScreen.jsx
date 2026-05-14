import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Alert,
} from "react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "@react-navigation/native";
import { driverApi } from "../api/driver";

// react-native-maps không có sẵn trong Expo Go — require lười để không crash app
let MapView, Marker, Polyline, Callout, mapsAvailable = false;
try {
  const Maps = require("react-native-maps");
  MapView   = Maps.default;
  Marker    = Maps.Marker;
  Polyline  = Maps.Polyline;
  Callout   = Maps.Callout;
  mapsAvailable = true;
} catch {
  mapsAvailable = false;
}

const STATUS_COLOR = {
  PENDING: "#faad14", EN_ROUTE: "#1677ff", ARRIVED: "#faad14",
  COMPLETED: "#52c41a", FAILED: "#ff4d4f",
};

/* Tài xế coi như "đã đến" khi cách điểm dừng ≤ 80m (city GPS) */
const ARRIVAL_RADIUS_M = 80;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
          * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Gọi OSRM public router để lấy hình dạng đường thực giữa các điểm.
 *  Trả về mảng [lat, lng]. Nếu fail, fallback về đường thẳng. */
async function fetchRoadRoute(points) {
  if (points.length < 2) return [];
  const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.routes?.[0]?.geometry?.coordinates ?? [])
      .map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  } catch {
    return [];
  }
}

// ── Fallback UI khi không có native map module ───────────────────────────
function StopListFallback({ stops }) {
  return (
    <ScrollView style={styles.fallbackRoot} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.warnBox}>
        <Text style={styles.warnTitle}>Bản đồ nhúng chưa khả dụng</Text>
        <Text style={styles.warnText}>
          Môi trường Expo hiện tại chưa nạp được native map module. Danh sách điểm dừng vẫn hiển thị trong app;
          để xem bản đồ nhúng đầy đủ cần chạy Android emulator/dev build có react-native-maps.
        </Text>
      </View>

      {stops.map((s, i) => (
        <View key={i} style={styles.stopBox}>
          <View style={[styles.dot, { backgroundColor: STATUS_COLOR[s.Status ?? s.StopStatus ?? "PENDING"] }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.stopName}>
              {i + 1}. {s.CustomerName ?? s.Address ?? `Điểm ${i + 1}`}
            </Text>
            {s.Address && <Text style={styles.stopAddr}>{s.Address}</Text>}
            {s.Latitude && s.Longitude && (
              <Text style={styles.stopCoord}>
                📍 {s.Latitude.toFixed(5)}, {s.Longitude.toFixed(5)}
              </Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Component chính ─────────────────────────────────────────────────────
export default function MapScreen({ route, navigation }) {
  const { route: initialTrip } = route.params;
  /* Giữ trip trong state để re-fetch được khi quay lại từ StopDetail/POD.
     route.params chỉ là snapshot lúc navigate, không tự cập nhật khi stop xong. */
  const [trip, setTrip] = useState(initialTrip);
  const tripId = initialTrip._id ?? initialTrip.RouteID;

  const mapRef = useRef(null);
  const watchSubRef = useRef(null);
  const promptedStopRef = useRef(new Set()); // tránh prompt POD nhiều lần cho cùng 1 stop

  const [locLoading, setLocLoading] = useState(true);
  const [follow, setFollow] = useState(true);
  const [me, setMe] = useState(null);          // { latitude, longitude }
  const [roadPath, setRoadPath] = useState([]); // [{latitude, longitude}, ...]
  const [routeLoading, setRouteLoading] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);

  /* Mỗi lần screen được focus (vd quay lại từ StopDetail sau khi giao xong),
     gọi lại API để lấy trạng thái mới nhất của trip. */
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await driverApi.getRoute(tripId);
        const fresh = res?.data?.data ?? res?.data;
        if (!cancelled && fresh) setTrip(fresh);
      } catch {
        // Im lặng — nếu fail giữ data cũ, không phá vỡ UI
      }
    })();
    return () => { cancelled = true; };
  }, [tripId]));

  /* Android react-native-maps: custom <View> markers cần tracksViewChanges=true
     để đo layout. Trước đây tắt sau 1.5s để tiết kiệm pin, nhưng trên thiết bị
     chậm marker không kịp render → biến mất. Với ~10 markers, giữ true là OK. */
  const [tracksChanges, setTracksChanges] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const stops = useMemo(() =>
    (trip.Tasks ?? trip.Stops ?? [])
      .filter((s) => s.Latitude && s.Longitude)
      .sort((a, b) => a.StopIndex - b.StopIndex)
  , [trip]);

  /* Bật lại tracksViewChanges mỗi khi: (a) map ready, (b) số lượng stops đổi,
     (c) status bất kỳ stop nào đổi (PENDING → COMPLETED → marker đổi màu+icon).
     Giữ true trong 3s để Android kịp đo lại View bên trong Marker, sau đó tắt
     để tiết kiệm pin. */
  const stopStatusKey = useMemo(
    () => stops.map((s) => `${s.StopIndex}:${s.Status ?? s.StopStatus ?? "P"}`).join("|"),
    [stops]
  );
  useEffect(() => {
    if (!mapReady) return;
    setTracksChanges(true);
    const t = setTimeout(() => setTracksChanges(false), 3000);
    return () => clearTimeout(t);
  }, [mapReady, stopStatusKey]);

  const depot = (Number.isFinite(Number(trip.DepotLatitude)) && Number.isFinite(Number(trip.DepotLongitude)))
    ? {
        Latitude:    Number(trip.DepotLatitude),
        Longitude:   Number(trip.DepotLongitude),
        CustomerName: trip.DepotName || "Kho",
        Address:     trip.DepotAddress || "",
        Status:      "DEPOT"
      }
    : null;
  const routePoints = depot ? [depot, ...stops, depot] : stops;

  /* GPS hợp lý = vị trí tài xế nằm trong bbox của lộ trình ± 100 km. Nếu không
     (vd Android emulator để mặc định ở California), khoảng cách haversine từ
     `me` → điểm đến sẽ ra ~11800 km — vô nghĩa. Khi đó fallback sang khoảng
     cách của chặng (từ điểm trước → điểm này) để hiển thị số có ý nghĩa. */
  const GPS_SANITY_BUFFER_KM = 100;
  const isGpsSane = useMemo(() => {
    if (!me || routePoints.length === 0) return false;
    const lats = routePoints.map((p) => p.Latitude);
    const lngs = routePoints.map((p) => p.Longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    // 1 độ vĩ độ ~ 111 km, kinh độ ~ 111*cos(lat) km. Dùng 111 cho đơn giản.
    const bufDeg = GPS_SANITY_BUFFER_KM / 111;
    return me.latitude  >= minLat - bufDeg && me.latitude  <= maxLat + bufDeg
        && me.longitude >= minLng - bufDeg && me.longitude <= maxLng + bufDeg;
  }, [me, routePoints]);

  /* "Điểm đến hiện tại" phụ thuộc vào trạng thái chuyến:
     - Trước khi xuất kho (ASSIGNED / DRIVER_CONFIRMED / LOADING) → kho để bốc hàng
     - Đang giao (IN_PROGRESS) → điểm dừng PENDING / EN_ROUTE / ARRIVED đầu tiên
     - Về kho (RETURNING) → kho để kết thúc
     - COMPLETED / CANCELLED → null (không cần điều hướng) */
  const currentDestination = useMemo(() => {
    const tripStatus = trip.Status;
    if (["ASSIGNED", "DRIVER_CONFIRMED", "LOADING"].includes(tripStatus)) {
      return depot ? {
        ...depot,
        phase: "DEPOT_LOAD",
        title: "Bốc hàng tại kho",
        subtitle: depot.CustomerName,
        emoji: "🏭"
      } : null;
    }
    if (tripStatus === "RETURNING") {
      return depot ? {
        ...depot,
        phase: "DEPOT_RETURN",
        title: "Quay về kho",
        subtitle: depot.CustomerName,
        emoji: "🏭"
      } : null;
    }
    if (tripStatus === "IN_PROGRESS") {
      const next = stops.find((s) => !["COMPLETED", "FAILED"].includes(s.Status ?? s.StopStatus));
      if (!next) {
        return depot ? { ...depot, phase: "DEPOT_RETURN", title: "Đã giao xong → quay về kho", subtitle: depot.CustomerName, emoji: "🏭" } : null;
      }
      return {
        ...next,
        phase: "STOP",
        title: `Điểm #${next.StopIndex} · ${next.CustomerName ?? next.Address ?? "—"}`,
        subtitle: next.Address ?? "",
        emoji: "📍"
      };
    }
    return null;
  }, [trip.Status, depot, stops]);

  /* Bắt đầu watch GPS của tài xế để hiển thị marker "tôi" + auto-trigger POD */
  useEffect(() => {
    if (!mapsAvailable) { setLocLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Cần quyền vị trí", "Bật quyền vị trí để xem bản đồ điều hướng.");
          setLocLoading(false);
          return;
        }
        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        setMe({ latitude: initial.coords.latitude, longitude: initial.coords.longitude });

        watchSubRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 5000 },
          (loc) => {
            const pos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setMe(pos);
          }
        );
      } catch (err) {
        Alert.alert("Lỗi định vị", String(err?.message ?? err));
      } finally {
        if (!cancelled) setLocLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      watchSubRef.current?.remove?.();
    };
  }, []);

  /* Khi GPS đổi: nếu follow mode bật → kéo camera theo. Nếu tới gần điểm đến
     hiện tại (STOP, không phải kho) → prompt mở POD. Chỉ prompt 1 lần / stop. */
  useEffect(() => {
    if (!me) return;
    if (follow && mapRef.current) {
      mapRef.current.animateCamera({ center: me, zoom: 16 }, { duration: 500 });
    }
    if (!currentDestination || currentDestination.phase !== "STOP") return;
    const dist = haversineMeters(me.latitude, me.longitude, currentDestination.Latitude, currentDestination.Longitude);
    const stopKey = String(currentDestination.StopIndex);
    if (dist <= ARRIVAL_RADIUS_M && !promptedStopRef.current.has(stopKey)) {
      promptedStopRef.current.add(stopKey);
      Alert.alert(
        "Đã đến điểm dừng",
        `Bạn đang ở gần ${currentDestination.CustomerName ?? currentDestination.Address ?? `điểm ${currentDestination.StopIndex}`}.\nMở màn hình ePOD để chụp ảnh + lấy chữ ký?`,
        [
          { text: "Để sau", style: "cancel" },
          {
            text: "Mở ePOD",
            onPress: () => navigation.navigate("POD", {
              routeId: trip._id ?? trip.RouteID,
              stop: currentDestination,
              stopIndex: currentDestination.StopIndex
            })
          }
        ]
      );
    }
  }, [me, currentDestination, follow]);

  /* Pan camera tới điểm đến khi bấm vào banner */
  const focusOnDestination = () => {
    if (!currentDestination || !mapRef.current) return;
    setFollow(false);
    mapRef.current.animateCamera({
      center: { latitude: currentDestination.Latitude, longitude: currentDestination.Longitude },
      zoom: 15
    }, { duration: 600 });
  };

  /* Lấy đường đi thực qua OSRM (depot → từng stop → depot) khi stops sẵn sàng */
  useEffect(() => {
    if (!routePoints.length) return;
    let cancelled = false;
    (async () => {
      setRouteLoading(true);
      const pts = routePoints.map((s) => ({ latitude: s.Latitude, longitude: s.Longitude }));
      const path = await fetchRoadRoute(pts);
      if (cancelled) return;
      setRoadPath(path);
      setRouteLoading(false);
    })();
    return () => { cancelled = true; };
  }, [trip._id, stops.length]);  // re-fetch when trip or stop count changes

  if (!mapsAvailable) return <StopListFallback stops={stops} />;

  if (locLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1677ff" />
      </View>
    );
  }

  if (stops.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.noData}>📍 Chuyến này chưa có tọa độ điểm dừng.</Text>
      </View>
    );
  }

  const getRegion = () => {
    const lats = routePoints.map((s) => s.Latitude);
    const lngs = routePoints.map((s) => s.Longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude:       (minLat + maxLat) / 2,
      longitude:      (minLng + maxLng) / 2,
      latitudeDelta:  Math.max(maxLat - minLat, 0.01) * 1.4,
      longitudeDelta: Math.max(maxLng - minLng, 0.01) * 1.4,
    };
  };

  const fitAll = () => {
    setFollow(false);
    mapRef.current?.animateToRegion(getRegion(), 600);
  };

  /* Fallback polyline = đường thẳng nếu OSRM chưa trả về */
  const fallbackLine = routePoints.map((s) => ({ latitude: s.Latitude, longitude: s.Longitude }));
  const polyline = roadPath.length >= 2 ? roadPath : fallbackLine;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={getRegion()}
        showsUserLocation
        showsMyLocationButton={false}
        onMapReady={() => setMapReady(true)}
        onPanDrag={() => setFollow(false)}
      >
        {/* Đường đi thực — màu đậm khi OSRM trả về, mảnh-nét đứt khi fallback */}
        <Polyline
          coordinates={polyline}
          strokeColor={roadPath.length >= 2 ? "#1677ff" : "#94a3b8"}
          strokeWidth={roadPath.length >= 2 ? 5 : 3}
          lineDashPattern={roadPath.length >= 2 ? undefined : [6, 4]}
        />

        {/* Kho — luôn dùng marker tùy chỉnh để hiện rõ icon 🏭 đen-vàng */}
        {depot && (
          <Marker
            key={`depot-${mapReady ? "ready" : "init"}`}
            coordinate={{ latitude: depot.Latitude, longitude: depot.Longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksChanges}
            zIndex={500}
          >
            <View style={styles.depotMarker}>
              <Text style={styles.depotMarkerIcon}>🏭</Text>
            </View>
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>🏭 {depot.CustomerName || "Kho"}</Text>
                {depot.Address ? <Text style={styles.calloutSub}>{depot.Address}</Text> : null}
                <Text style={styles.calloutSubMuted}>Điểm xuất phát & quay về</Text>
              </View>
            </Callout>
          </Marker>
        )}

        {/* Các điểm dừng giao hàng */}
        {stops.map((stop, i) => {
          const stopStatus = stop.Status ?? stop.StopStatus ?? "PENDING";
          const isCurrent = currentDestination?.phase === "STOP" && currentDestination.StopIndex === stop.StopIndex;
          const isCompleted = stopStatus === "COMPLETED";
          const isFailed = stopStatus === "FAILED";
          return (
            <Marker
              key={`stop-${stop.StopIndex ?? i}-${stopStatus}-${mapReady ? "ready" : "init"}`}
              coordinate={{ latitude: stop.Latitude, longitude: stop.Longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={tracksChanges}
              zIndex={isCurrent ? 400 : isCompleted ? 200 : 100}
            >
              <View style={[
                styles.stopMarker,
                { backgroundColor: STATUS_COLOR[stopStatus] ?? "#94a3b8" },
                isCurrent && styles.stopMarkerCurrent,
                isCompleted && styles.stopMarkerCompleted
              ]}>
                <Text style={styles.stopMarkerLabel}>
                  {isCompleted ? "✓" : isFailed ? "✕" : (stop.StopIndex ?? i + 1)}
                </Text>
              </View>
              <Callout
                onPress={() => navigation.navigate("POD", {
                  routeId: trip._id ?? trip.RouteID,
                  stop, stopIndex: stop.StopIndex
                })}
              >
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>
                    #{stop.StopIndex} · {stop.CustomerName ?? stop.Address ?? `Điểm ${i + 1}`}
                  </Text>
                  {stop.Address ? <Text style={styles.calloutSub}>{stop.Address}</Text> : null}
                  {stop.PlannedArrivalTime ? <Text style={styles.calloutSub}>⏰ Dự kiến {stop.PlannedArrivalTime}</Text> : null}
                  <Text style={styles.calloutLink}>Bấm để mở ePOD ›</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Banner điểm đến hiện tại — luôn hiển thị (kể cả khi chưa có GPS) */}
      {currentDestination && (
        <TouchableOpacity activeOpacity={0.85} onPress={focusOnDestination} style={[
          styles.nextBanner,
          currentDestination.phase !== "STOP" && styles.nextBannerDepot
        ]}>
          <Text style={[styles.nextLabel, currentDestination.phase !== "STOP" && styles.nextLabelDepot]}>
            {currentDestination.phase === "DEPOT_LOAD"   ? "Bước 1 · Xuất phát từ kho" :
             currentDestination.phase === "DEPOT_RETURN" ? "Bước cuối · Về kho" :
             `Điểm kế tiếp · #${currentDestination.StopIndex}`}
          </Text>
          <Text style={styles.nextName} numberOfLines={1}>
            {currentDestination.emoji} {currentDestination.subtitle || currentDestination.title}
          </Text>
          <Text style={styles.nextMeta}>
            {(() => {
              if (!me) return "Đang chờ GPS…";
              if (isGpsSane) {
                const km = haversineMeters(me.latitude, me.longitude, currentDestination.Latitude, currentDestination.Longitude) / 1000;
                return `${km.toFixed(2)} km từ chỗ bạn`;
              }
              // GPS không hợp lệ (vd emulator) → khoảng cách của chặng kế tiếp
              const prev = (() => {
                if (currentDestination.phase === "DEPOT_LOAD") return null;
                if (currentDestination.phase === "DEPOT_RETURN") {
                  const lastDone = [...stops].reverse().find((s) => ["COMPLETED", "FAILED"].includes(s.Status ?? s.StopStatus));
                  return lastDone ?? depot;
                }
                // STOP: tìm điểm trước (đã xong gần nhất) hoặc depot
                const idx = stops.findIndex((s) => s.StopIndex === currentDestination.StopIndex);
                if (idx > 0) return stops[idx - 1];
                return depot;
              })();
              if (!prev) return "—";
              const legKm = haversineMeters(prev.Latitude, prev.Longitude, currentDestination.Latitude, currentDestination.Longitude) / 1000;
              return `${legKm.toFixed(2)} km chặng này (GPS chưa định vị)`;
            })()}
            {currentDestination.PlannedArrivalTime ? ` · ⏰ ${currentDestination.PlannedArrivalTime}` : ""}
            {"  ›  Bấm để xem"}
          </Text>
        </TouchableOpacity>
      )}

      {routeLoading && (
        <View style={styles.loadingChip}>
          <ActivityIndicator size="small" color="#1677ff" />
          <Text style={{ marginLeft: 8, color: "#555", fontSize: 12 }}>Đang tải đường đi thực…</Text>
        </View>
      )}

      {/* ── Bottom sheet: lộ trình + danh sách điểm dừng ─────────────── */}
      <View style={[styles.sheet, panelExpanded && styles.sheetExpanded]}>
        {/* Handle bar (tap to toggle) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setPanelExpanded((e) => !e)}
          style={styles.sheetHandle}
        >
          <View style={styles.handleBar} />
          <View style={styles.handleRow}>
            <Text style={styles.handleTitle}>
              {panelExpanded ? "▼" : "▲"} Lộ trình hôm nay
            </Text>
            {(() => {
              const done = stops.filter((s) => ["COMPLETED", "FAILED"].includes(s.Status ?? s.StopStatus)).length;
              const pct = stops.length ? Math.round((done / stops.length) * 100) : 0;
              return (
                <View style={styles.progressChip}>
                  <Text style={styles.progressText}>{done}/{stops.length} điểm</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })()}
          </View>
        </TouchableOpacity>

        {/* Action buttons (luôn hiển thị) */}
        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={[styles.actionBtn, follow && styles.actionBtnActive]}
            onPress={() => setFollow((f) => !f)}
          >
            <Text style={[styles.actionText, follow && styles.actionTextActive]}>
              {follow ? "🎯 Bám theo tôi" : "📍 Bật bám theo"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={fitAll}>
            <Text style={styles.actionText}>🗺 Toàn lộ trình</Text>
          </TouchableOpacity>
        </View>

        {/* Stops list — chỉ render khi expanded */}
        {panelExpanded && (
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator>
            {/* Depot start */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (!depot || !mapRef.current) return;
                setFollow(false);
                mapRef.current.animateCamera({
                  center: { latitude: depot.Latitude, longitude: depot.Longitude }, zoom: 15
                }, { duration: 500 });
              }}
              style={styles.sheetRowDepot}
            >
              <View style={styles.sheetDepotBubble}>
                <Text style={{ fontSize: 18 }}>🏭</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowTitle}>Xuất phát từ kho</Text>
                <Text style={styles.sheetRowSub} numberOfLines={1}>
                  {depot?.CustomerName ?? trip.DepotName ?? "Kho"}{depot?.Address ? ` · ${depot.Address}` : ""}
                </Text>
              </View>
              <Text style={styles.sheetRowArrow}>›</Text>
            </TouchableOpacity>

            {/* Numbered stops — click → StopDetail screen (POD + cập nhật trạng thái) */}
            {stops.map((stop, i) => {
              const status = stop.Status ?? stop.StopStatus ?? "PENDING";
              const isCurrent = currentDestination?.phase === "STOP" && currentDestination.StopIndex === stop.StopIndex;
              // Chỉ hiển thị khoảng cách từ chỗ tài xế khi GPS hợp lệ (trong bbox lộ trình)
              const distFromMe = (me && isGpsSane)
                ? haversineMeters(me.latitude, me.longitude, stop.Latitude, stop.Longitude) / 1000
                : null;
              return (
                <TouchableOpacity
                  key={`row-${stop.StopIndex ?? i}`}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate("StopDetail", {
                    routeId: trip._id ?? trip.RouteID,
                    stop,
                    stopIndex: stop.StopIndex
                  })}
                  style={[styles.sheetRow, isCurrent && styles.sheetRowCurrent]}
                >
                  <View style={[styles.sheetBubble, { backgroundColor: STATUS_COLOR[status] ?? "#94a3b8" }]}>
                    <Text style={styles.sheetBubbleText}>{stop.StopIndex ?? i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                      <Text style={styles.sheetRowTitle} numberOfLines={1}>
                        {stop.CustomerName ?? stop.Address ?? `Điểm ${stop.StopIndex}`}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[status] ?? "#94a3b8" }]}>
                        <Text style={styles.statusPillText}>{status}</Text>
                      </View>
                    </View>
                    <Text style={styles.sheetRowSub} numberOfLines={1}>
                      {stop.Address || "—"}
                    </Text>
                    <Text style={styles.sheetRowMeta}>
                      {stop.PlannedArrivalTime ? `⏰ ${stop.PlannedArrivalTime}` : ""}
                      {stop.OrderCodes?.length ? ` · 📦 ${stop.OrderCodes.length} đơn` : ""}
                      {distFromMe != null ? ` · ${distFromMe.toFixed(1)} km` : ""}
                    </Text>
                  </View>
                  <Text style={styles.sheetRowArrow}>›</Text>
                </TouchableOpacity>
              );
            })}

            {/* Depot return */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (!depot || !mapRef.current) return;
                setFollow(false);
                mapRef.current.animateCamera({
                  center: { latitude: depot.Latitude, longitude: depot.Longitude }, zoom: 15
                }, { duration: 500 });
              }}
              style={styles.sheetRowDepot}
            >
              <View style={styles.sheetDepotBubble}>
                <Text style={{ fontSize: 18 }}>🏭</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetRowTitle}>Quay về kho</Text>
                <Text style={styles.sheetRowSub} numberOfLines={1}>
                  Kết thúc chuyến tại kho · giao nốt giấy tờ + chốt KPI
                </Text>
              </View>
              <Text style={styles.sheetRowArrow}>›</Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center:        { flex: 1, justifyContent: "center", alignItems: "center" },
  noData:        { color: "#888", fontSize: 15, textAlign: "center", padding: 24 },

  callout:       { minWidth: 220, padding: 8 },
  calloutTitle:  { fontWeight: "bold", fontSize: 14, marginBottom: 2 },
  calloutSub:    { fontSize: 12, color: "#666" },
  calloutSubMuted: { fontSize: 11, color: "#9ca3af", marginTop: 4, fontStyle: "italic" },
  calloutLink:   { fontSize: 12, color: "#1677ff", marginTop: 6, fontWeight: "600" },

  depotMarker:   { width: 44, height: 44, borderRadius: 10, backgroundColor: "#1f2937", borderWidth: 3, borderColor: "#facc15", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 4, elevation: 6 },
  depotMarkerIcon: { fontSize: 22 },

  stopMarker:    { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center", borderWidth: 2.5, borderColor: "#fff", elevation: 4, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 3 },
  stopMarkerCurrent: { borderColor: "#1677ff", borderWidth: 3.5, width: 36, height: 36, borderRadius: 18 },
  stopMarkerCompleted: { borderColor: "#bbf7d0", borderWidth: 3 },
  stopMarkerLabel: { color: "#fff", fontWeight: "800", fontSize: 13 },

  nextBanner:      { position: "absolute", top: 12, left: 12, right: 12, backgroundColor: "#fff", borderRadius: 12, padding: 12, elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, borderLeftWidth: 4, borderLeftColor: "#1677ff" },
  nextBannerDepot: { borderLeftColor: "#facc15", backgroundColor: "#fffbeb" },
  nextLabel:       { fontSize: 11, color: "#1677ff", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  nextLabelDepot:  { color: "#92400e" },
  nextName:        { fontSize: 15, fontWeight: "700", color: "#0f172a", marginTop: 2 },
  nextMeta:        { fontSize: 12, color: "#666", marginTop: 4 },

  actionBtn:     { flex: 1, backgroundColor: "#fff", paddingVertical: 11, borderRadius: 24, alignItems: "center", elevation: 3, borderWidth: 1, borderColor: "#e5e7eb" },
  actionBtnActive: { backgroundColor: "#1677ff", borderColor: "#1677ff" },
  actionText:    { color: "#0f172a", fontWeight: "600", fontSize: 13 },
  actionTextActive: { color: "#fff" },

  loadingChip:   { position: "absolute", top: 80, alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, elevation: 3 },

  /* ── Bottom sheet ──────────────────────────────────────────────── */
  sheet:           { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 6, elevation: 12, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, maxHeight: 130 },
  sheetExpanded:   { maxHeight: "55%" },

  sheetHandle:     { paddingVertical: 4, alignItems: "stretch" },
  handleBar:       { alignSelf: "center", width: 44, height: 4, borderRadius: 3, backgroundColor: "#d1d5db", marginBottom: 6 },
  handleRow:       { paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  handleTitle:     { fontWeight: "700", fontSize: 14, color: "#0f172a" },
  handleMeta:      { fontSize: 11, color: "#6b7280" },

  progressChip:    { flexDirection: "row", alignItems: "center", gap: 6 },
  progressText:    { fontSize: 11, fontWeight: "700", color: "#16a34a" },
  progressTrack:   { width: 80, height: 5, borderRadius: 3, backgroundColor: "#e5e7eb", overflow: "hidden" },
  progressFill:    { height: "100%", backgroundColor: "#22c55e", borderRadius: 3 },

  sheetActions:    { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },

  sheetList:       { flex: 1, paddingHorizontal: 12 },
  sheetRow:        { flexDirection: "row", alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: "#e5e7eb" },
  sheetRowCurrent: { borderColor: "#1677ff", borderWidth: 2, backgroundColor: "#eff6ff" },
  sheetRowDepot:   { flexDirection: "row", alignItems: "center", backgroundColor: "#fffbeb", borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: "#fde68a" },

  sheetBubble:     { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginRight: 10 },
  sheetBubbleText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  sheetDepotBubble:{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 10, backgroundColor: "#1f2937", borderWidth: 2, borderColor: "#facc15" },

  sheetRowTitle:   { fontSize: 14, fontWeight: "700", color: "#0f172a", maxWidth: "75%" },
  sheetRowSub:     { fontSize: 12, color: "#64748b", marginTop: 1 },
  sheetRowMeta:    { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  sheetRowArrow:   { fontSize: 22, color: "#94a3b8", marginLeft: 6 },

  statusPill:      { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8, marginLeft: 8 },
  statusPillText:  { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },

  fallbackRoot:  { flex: 1, backgroundColor: "#f0f2f5" },
  warnBox:       { backgroundColor: "#fff7e6", borderColor: "#ffd591", borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 16 },
  warnTitle:     { fontWeight: "bold", color: "#d46b08", marginBottom: 6, fontSize: 14 },
  warnText:      { color: "#874d00", fontSize: 13, lineHeight: 18 },
  stopBox:       { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff", padding: 14, borderRadius: 10, marginBottom: 8, elevation: 1 },
  dot:           { width: 14, height: 14, borderRadius: 7, marginRight: 12, marginTop: 4 },
  stopName:      { fontSize: 14, fontWeight: "bold", color: "#222", marginBottom: 3 },
  stopAddr:      { fontSize: 12, color: "#888", marginBottom: 3 },
  stopCoord:     { fontSize: 11, color: "#1677ff" },
});
