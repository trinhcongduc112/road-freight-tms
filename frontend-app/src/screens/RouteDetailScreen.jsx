import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { driverApi } from "../api/driver";
import StatusBadge from "../components/StatusBadge";

function StopCard({ stop, index, onPress }) {
  return (
    <TouchableOpacity style={styles.stopCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.stopRow}>
        <View style={styles.indexBubble}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stopName} numberOfLines={1}>
            {stop.LocationName ?? stop.Address ?? `Điểm ${index + 1}`}
          </Text>
          <Text style={styles.stopAddress} numberOfLines={2}>{stop.Address ?? "—"}</Text>
          <Text style={styles.stopOrders}>
            {stop.OrderIDs?.length ?? 0} đơn hàng
          </Text>
        </View>
        <StatusBadge status={stop.StopStatus ?? "PENDING"} style={{ marginLeft: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function RouteDetailScreen({ route, navigation }) {
  const { routeId } = route.params;
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = async () => {
    try {
      const res = await driverApi.getRoute(routeId);
      setDetail(res.data.data);
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, []);

  if (loading) return <ActivityIndicator size="large" color="#1677ff" style={{ marginTop: 60 }} />;
  if (!detail) return null;

  const stops     = detail.Stops ?? [];
  const completed = stops.filter((s) => s.StopStatus === "COMPLETED").length;
  const date      = detail.RoutePlanID?.Date
    ? new Date(detail.RoutePlanID.Date).toLocaleDateString("vi-VN")
    : "—";

  return (
    <View style={styles.root}>
      {/* Header info */}
      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Xe:</Text>
          <Text style={styles.infoValue}>🚛 {detail.VehicleCode ?? "—"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Ngày:</Text>
          <Text style={styles.infoValue}>{date}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tiến độ:</Text>
          <Text style={styles.infoValue}>{completed}/{stops.length} điểm hoàn thành</Text>
        </View>
        {detail.TotalDistance > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Quãng đường:</Text>
            <Text style={styles.infoValue}>{detail.TotalDistance} km</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => navigation.navigate("Map", { route: detail })}
        >
          <Text style={styles.mapBtnText}>🗺 Xem bản đồ lộ trình</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Danh sách điểm dừng ({stops.length})</Text>

      <FlatList
        data={stops.sort((a, b) => a.StopIndex - b.StopIndex)}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <StopCard
            stop={item}
            index={index}
            onPress={() =>
              navigation.navigate("StopDetail", {
                routeId,
                stop: item,
                stopIndex: item.StopIndex,
                onRefresh: fetchDetail,
              })
            }
          />
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Chưa có điểm dừng nào.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#f0f2f5" },
  infoBox:     { backgroundColor: "#fff", margin: 12, borderRadius: 12, padding: 16, elevation: 2 },
  infoRow:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  infoLabel:   { color: "#888", fontSize: 13, fontWeight: "500" },
  infoValue:   { color: "#222", fontSize: 13, fontWeight: "600" },
  mapBtn:      { backgroundColor: "#e6f4ff", borderRadius: 8, padding: 10, alignItems: "center", marginTop: 8 },
  mapBtnText:  { color: "#1677ff", fontWeight: "600", fontSize: 14 },
  sectionTitle:{ fontSize: 14, fontWeight: "bold", color: "#555", marginLeft: 16, marginBottom: 4, marginTop: 4 },
  stopCard:    { backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 14, elevation: 2 },
  stopRow:     { flexDirection: "row", alignItems: "center" },
  indexBubble: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1677ff", justifyContent: "center", alignItems: "center", marginRight: 12 },
  indexText:   { color: "#fff", fontWeight: "bold", fontSize: 13 },
  stopName:    { fontSize: 15, fontWeight: "bold", color: "#222", marginBottom: 2 },
  stopAddress: { fontSize: 12, color: "#888", marginBottom: 4 },
  stopOrders:  { fontSize: 12, color: "#1677ff", fontWeight: "500" },
  empty:       { textAlign: "center", marginTop: 40, color: "#aaa" },
});
