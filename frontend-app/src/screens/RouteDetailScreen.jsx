import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
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
            {stop.CustomerName ?? stop.Address ?? `Điểm ${index + 1}`}
          </Text>
          <Text style={styles.stopAddress} numberOfLines={2}>{stop.Address ?? "—"}</Text>
          <Text style={styles.stopOrders}>
            {stop.OrderCodes?.join(", ") || `${stop.OrderIDs?.length ?? 0} đơn hàng`}
          </Text>
        </View>
        <StatusBadge status={stop.Status ?? "PENDING"} style={{ marginLeft: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function RouteDetailScreen({ route, navigation }) {
  const { routeId } = route.params;
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

  useFocusEffect(useCallback(() => { fetchDetail(); }, [routeId]));

  const runAction = async (fn, success) => {
    setActionLoading(true);
    try {
      const res = await fn();
      setDetail(res.data.data);
      Alert.alert("Thành công", success);
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#1677ff" style={{ marginTop: 60 }} />;
  if (!detail) return null;

  const stops     = detail.Tasks ?? [];
  const completed = stops.filter((s) => ["COMPLETED", "FAILED"].includes(s.Status)).length;
  const date      = detail.PlanDate
    ? new Date(detail.PlanDate).toLocaleDateString("vi-VN")
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
          <Text style={styles.infoLabel}>Tài xế:</Text>
          <Text style={styles.infoValue}>{detail.DriverName || "—"}</Text>
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
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionBtn} disabled={actionLoading || detail.Status !== "ASSIGNED"} onPress={() => runAction(() => driverApi.confirmTrip(routeId), "Đã xác nhận kế hoạch")}>
            <Text style={styles.actionText}>✅ Nhận chuyến</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} disabled={actionLoading || !["ASSIGNED", "DRIVER_CONFIRMED"].includes(detail.Status)} onPress={() => runAction(() => driverApi.startLoading(routeId), "Đang soạn hàng tại kho")}>
            <Text style={styles.actionText}>📦 Soạn hàng</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} disabled={actionLoading || ["IN_PROGRESS", "RETURNING", "COMPLETED"].includes(detail.Status)} onPress={() => runAction(() => driverApi.startTrip(routeId), "Đã xuất kho đi giao")}>
            <Text style={styles.actionText}>🚚 Xuất kho</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} disabled={actionLoading || completed < stops.length || detail.Status === "COMPLETED"} onPress={() => runAction(() => driverApi.returnTrip(routeId), "Đang về kho")}>
            <Text style={styles.actionText}>↩️ Về kho</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.doneBtn]} disabled={actionLoading || detail.Status !== "RETURNING"} onPress={() => runAction(() => driverApi.finishTrip(routeId), "Đã kết thúc chuyến tại kho")}>
            <Text style={styles.doneText}>🏁 Kết thúc</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Danh sách điểm dừng ({stops.length})</Text>

      <FlatList
        data={[...stops].sort((a, b) => a.StopIndex - b.StopIndex)}
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
  actionGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  actionBtn:   { backgroundColor: "#eef6ff", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: "#bfdbfe" },
  actionText:  { color: "#1677ff", fontWeight: "700", fontSize: 12 },
  doneBtn:     { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  doneText:    { color: "#16a34a", fontWeight: "700", fontSize: 12 },
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
