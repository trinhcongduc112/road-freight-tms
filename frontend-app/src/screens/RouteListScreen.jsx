import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { driverApi } from "../api/driver";
import { useAuthStore } from "../store/authStore";
import StatusBadge from "../components/StatusBadge";

function RouteCard({ item, onPress }) {
  const date = item.PlanDate
    ? new Date(item.PlanDate).toLocaleDateString("vi-VN")
    : "—";
  const stops     = item.Tasks?.length ?? 0;
  const completed = item.Tasks?.filter((s) => ["COMPLETED", "FAILED"].includes(s.Status)).length ?? 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <Text style={styles.vehicleCode}>🚛 {item.VehicleCode ?? "—"}</Text>
        <StatusBadge status={item.Status} />
      </View>
      <Text style={styles.planCode}>
        Chuyến: {item.TripCode ?? "—"}
      </Text>
      <Text style={styles.meta}>📅 Ngày: {date}</Text>
      <Text style={styles.meta}>👤 Tài xế: {item.DriverName || "—"}</Text>
      <Text style={styles.meta}>📍 Điểm dừng: {completed}/{stops} hoàn thành</Text>
      {item.TotalDistance > 0 && (
        <Text style={styles.meta}>🛣 Tổng quãng đường: {item.TotalDistance} km</Text>
      )}

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: stops > 0 ? `${(completed / stops) * 100}%` : "0%" }]} />
      </View>
    </TouchableOpacity>
  );
}

export default function RouteListScreen({ navigation }) {
  const [routes,    setRoutes]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, logout } = useAuthStore();

  const fetchRoutes = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await driverApi.getRoutes();
      setRoutes(res.data.data ?? []);
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload mỗi lần màn hình được focus
  useFocusEffect(useCallback(() => { fetchRoutes(); }, []));

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: logout },
    ]);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={{ marginRight: 4 }}>
          <Text style={{ color: "#fff", fontSize: 14 }}>Đăng xuất</Text>
        </TouchableOpacity>
      ),
      headerTitle: `Xin chào, ${user?.FullName || user?.UserName || "Tài xế"}`,
    });
  }, [navigation, user]);

  if (loading) {
    return <ActivityIndicator size="large" color="#1677ff" style={{ marginTop: 60 }} />;
  }

  return (
    <FlatList
      style={styles.root}
      data={routes}
      keyExtractor={(r) => r._id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => fetchRoutes(true)} colors={["#1677ff"]} />
      }
      renderItem={({ item }) => (
        <RouteCard
          item={item}
          onPress={() => navigation.navigate("RouteDetail", { routeId: item._id })}
        />
      )}
      contentContainerStyle={routes.length === 0 && styles.emptyContainer}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Chưa có chuyến đi nào được phân công.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: "#f0f2f5" },
  card:            { backgroundColor: "#fff", margin: 12, marginBottom: 0, borderRadius: 12, padding: 16, elevation: 3, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardTop:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  vehicleCode:     { fontSize: 17, fontWeight: "bold", color: "#1a1a1a" },
  planCode:        { fontSize: 13, color: "#555", marginBottom: 6 },
  meta:            { fontSize: 13, color: "#666", marginBottom: 3 },
  progressBg:      { height: 5, backgroundColor: "#f0f0f0", borderRadius: 3, marginTop: 10 },
  progressFill:    { height: 5, backgroundColor: "#52c41a", borderRadius: 3 },
  emptyContainer:  { flex: 1, justifyContent: "center", alignItems: "center" },
  empty:           { alignItems: "center", paddingTop: 80 },
  emptyIcon:       { fontSize: 52, marginBottom: 12 },
  emptyText:       { color: "#999", fontSize: 15, textAlign: "center" },
});
