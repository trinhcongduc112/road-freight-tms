import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { driverApi } from "../api/driver";
import StatusBadge from "../components/StatusBadge";

const ACTIONS = [
  { status: "EN_ROUTE", label: "🚀 Đang tới",  color: "#1677ff", action: "en-route" },
  { status: "ARRIVED", label: "📍 Đã đến",    color: "#faad14", action: "arrive" },
  { status: "COMPLETED",   label: "✅ Hoàn thành",    color: "#52c41a", action: "complete" },
  { status: "FAILED",      label: "❌ Giao thất bại", color: "#ff4d4f", action: "fail" },
];

export default function StopDetailScreen({ route, navigation }) {
  const { routeId, stop: initStop, stopIndex, onRefresh } = route.params;
  const [stop,    setStop]    = useState(initStop);
  const [loading, setLoading] = useState(false);
  const isClosed = ["COMPLETED", "FAILED"].includes(stop.Status);

  const refreshStop = useCallback(async () => {
    try {
      const res = await driverApi.getRoute(routeId);
      const updated = res.data.data?.Tasks?.find((s) => s.StopIndex === stopIndex);
      if (updated) setStop(updated);
      onRefresh?.();
    } catch {
      // Giữ dữ liệu hiện tại nếu refresh nền lỗi.
    }
  }, [routeId, stopIndex, onRefresh]);

  useFocusEffect(useCallback(() => { refreshStop(); }, [refreshStop]));

  const updateStatus = (status) => {
    const action = ACTIONS.find((a) => a.status === status);
    const label = action?.label ?? status;
    Alert.alert(
      "Cập nhật trạng thái",
      `Xác nhận "${label}" cho điểm dừng này?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận",
          onPress: async () => {
            setLoading(true);
            try {
              if (isClosed) {
                Alert.alert("Không thể cập nhật", "Điểm dừng này đã được xử lý trước đó.");
                return;
              }
              const res = await driverApi.updateStop(routeId, stopIndex, { action: action?.action, status, reason: "Khác" });
              // Tìm lại stop đã cập nhật từ response
              const updated = res.data.data?.Tasks?.find((s) => s.StopIndex === stopIndex);
              if (updated) setStop(updated);
              onRefresh?.();
              Alert.alert("Thành công", `Đã cập nhật trạng thái: ${label}`);
            } catch (err) {
              const message = err.response?.data?.message === "Task already closed"
                ? "Điểm dừng này đã được xử lý trước đó. Tôi đã tải lại trạng thái mới nhất."
                : err.response?.data?.message ?? err.message;
              await refreshStop();
              Alert.alert("Lỗi", message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const orders = stop.Orders ?? stop.OrderCodes?.map((code) => ({ OrderCode: code })) ?? [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Stop header */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={2}>
            📍 {stop.CustomerName ?? stop.Address ?? `Điểm dừng ${stopIndex}`}
          </Text>
          <StatusBadge status={stop.Status ?? "PENDING"} style={{ marginLeft: 8 }} />
        </View>
        {stop.Address && <Text style={styles.address}>{stop.Address}</Text>}
        {stop.EstimatedArrival && (
          <Text style={styles.meta}>
            🕐 ETA: {new Date(stop.EstimatedArrival).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        )}
      </View>

      {/* Đơn hàng */}
      <Text style={styles.sectionTitle}>Đơn hàng ({orders.length})</Text>
      {orders.length === 0 ? (
        <Text style={styles.noOrder}>Không có đơn hàng nào tại điểm này.</Text>
      ) : (
        orders.map((order, i) => (
          <View key={order._id ?? i} style={styles.orderCard}>
            <Text style={styles.orderCode}>#{order.OrderCode ?? order._id?.slice(-6)}</Text>
            <Text style={styles.orderMeta}>
              👤 Khách: {order.CustomerName ?? order.CustomerID ?? "—"}
            </Text>
            {order.TotalWeight > 0 && (
              <Text style={styles.orderMeta}>⚖️ Khối lượng: {order.TotalWeight} kg</Text>
            )}
            {order.Note && <Text style={styles.orderNote}>📝 {order.Note}</Text>}
          </View>
        ))
      )}

      {/* ePOD button */}
      <TouchableOpacity
        style={[styles.podBtn, isClosed && styles.disabledBtn]}
        disabled={isClosed}
        onPress={() => navigation.navigate("POD", { routeId, stop, stopIndex })}
      >
        <Text style={styles.podBtnText}>📸 Chụp ảnh & Ký xác nhận (ePOD)</Text>
      </TouchableOpacity>

      {/* Action buttons */}
      <Text style={styles.sectionTitle}>Cập nhật trạng thái</Text>
      {loading && <ActivityIndicator color="#1677ff" style={{ marginVertical: 12 }} />}
      {!loading && ACTIONS.map((a) => (
        <TouchableOpacity
          key={a.status}
          style={[styles.actionBtn, { borderColor: a.color, opacity: stop.Status === a.status || isClosed ? 0.4 : 1 }]}
          onPress={() => updateStatus(a.status)}
          disabled={stop.Status === a.status || isClosed}
        >
          <Text style={[styles.actionBtnText, { color: a.color }]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: "#f0f2f5" },
  card:          { backgroundColor: "#fff", margin: 12, borderRadius: 12, padding: 16, elevation: 2 },
  row:           { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  title:         { flex: 1, fontSize: 16, fontWeight: "bold", color: "#1a1a1a" },
  address:       { fontSize: 13, color: "#666", marginBottom: 6 },
  meta:          { fontSize: 13, color: "#888" },
  sectionTitle:  { fontSize: 14, fontWeight: "bold", color: "#555", marginLeft: 16, marginBottom: 6, marginTop: 8 },
  noOrder:       { textAlign: "center", color: "#aaa", marginTop: 8, marginBottom: 8 },
  orderCard:     { backgroundColor: "#fff", marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 14, elevation: 1, borderLeftWidth: 3, borderLeftColor: "#1677ff" },
  orderCode:     { fontWeight: "bold", color: "#1677ff", fontSize: 15, marginBottom: 4 },
  orderMeta:     { fontSize: 13, color: "#555", marginBottom: 2 },
  orderNote:     { fontSize: 12, color: "#888", fontStyle: "italic", marginTop: 4 },
  podBtn:        { backgroundColor: "#fff7e6", borderRadius: 10, margin: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#faad14" },
  podBtnText:    { color: "#d48806", fontWeight: "bold", fontSize: 14 },
  disabledBtn:   { opacity: 0.45 },
  actionBtn:     { borderWidth: 1.5, borderRadius: 10, marginHorizontal: 12, marginBottom: 10, padding: 14, alignItems: "center" },
  actionBtnText: { fontWeight: "bold", fontSize: 15 },
});
