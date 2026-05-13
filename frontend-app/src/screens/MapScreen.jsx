import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView,
} from "react-native";
import * as Location from "expo-location";

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
export default function MapScreen({ route }) {
  const { route: trip } = route.params;
  const mapRef = useRef(null);
  const [locLoading, setLocLoading] = useState(true);

  const stops = (trip.Tasks ?? trip.Stops ?? [])
    .filter((s) => s.Latitude && s.Longitude)
    .sort((a, b) => a.StopIndex - b.StopIndex);

  useEffect(() => {
    if (!mapsAvailable) { setLocLoading(false); return; }
    (async () => {
      try { await Location.requestForegroundPermissionsAsync(); } catch {}
      setLocLoading(false);
    })();
  }, []);

  const depot = Number.isFinite(Number(trip.DepotLatitude)) && Number.isFinite(Number(trip.DepotLongitude))
    ? { Latitude: Number(trip.DepotLatitude), Longitude: Number(trip.DepotLongitude), CustomerName: trip.DepotName || "Kho", Status: "DEPOT" }
    : null;
  const routePoints = depot ? [depot, ...stops, depot] : stops;

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

  const fitAll = () => mapRef.current?.animateToRegion(getRegion(), 600);
  const polyline = routePoints.map((s) => ({ latitude: s.Latitude, longitude: s.Longitude }));

  return (
    <View style={{ flex: 1 }}>
      <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={getRegion()} showsUserLocation>
        <Polyline coordinates={polyline} strokeColor="#1677ff" strokeWidth={3} lineDashPattern={[6, 3]} />
        {routePoints.map((stop, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: stop.Latitude, longitude: stop.Longitude }}
            pinColor={stop.Status === "DEPOT" ? "#111827" : STATUS_COLOR[stop.Status ?? stop.StopStatus ?? "PENDING"]}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>
                  {stop.Status === "DEPOT" ? "Kho" : `${stop.StopIndex ?? i}. ${stop.CustomerName ?? stop.Address ?? `Điểm ${i}`}`}
                </Text>
                <Text style={styles.calloutSub}>{stop.Address ?? ""}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <TouchableOpacity style={styles.fitBtn} onPress={fitAll}>
        <Text style={styles.fitBtnText}>🗺 Hiển thị toàn lộ trình</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center:        { flex: 1, justifyContent: "center", alignItems: "center" },
  noData:        { color: "#888", fontSize: 15, textAlign: "center", padding: 24 },
  callout:       { minWidth: 180, padding: 8 },
  calloutTitle:  { fontWeight: "bold", fontSize: 14, marginBottom: 2 },
  calloutSub:    { fontSize: 12, color: "#666" },
  fitBtn:        { position: "absolute", bottom: 24, alignSelf: "center", backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24, elevation: 4 },
  fitBtnText:    { color: "#1677ff", fontWeight: "600", fontSize: 14 },

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
