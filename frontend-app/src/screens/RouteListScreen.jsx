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
  const [unreadCount, setUnreadCount] = useState(0);
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

  const fetchUnreadCount = async () => {
    try {
      const res = await driverApi.getUnreadCount();
      setUnreadCount(res.data?.data?.count ?? 0);
    } catch { /* silent */ }
  };

  // Reload mỗi lần màn hình được focus
  useFocusEffect(useCallback(() => {
    fetchRoutes();
    fetchUnreadCount();
    // Poll unread count mỗi 20s khi đang ở màn này
    const id = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(id);
  }, []));

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: logout },
    ]);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", gap: 12, marginRight: 4, alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Notifications")}
            style={{ position: "relative", paddingHorizontal: 4 }}
          >
            <Text style={{ color: "#fff", fontSize: 18 }}>🔔</Text>
            {unreadCount > 0 && (
              <View style={{
                position: "absolute",
                top: -2, right: -6,
                backgroundColor: "#ff4d4f",
                borderRadius: 10,
                minWidth: 18,
                height: 18,
                paddingHorizontal: 4,
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("DriverMessages")}>
            <Text style={{ color: "#fff", fontSize: 14 }}>Tin nhắn</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={{ color: "#fff", fontSize: 14 }}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      ),
      headerTitle: `Xin chào, ${user?.FullName || user?.UserName || "Tài xế"}`,
    });
  }, [navigation, user, unreadCount]);

  if (loading) {
    return <ActivityIndicator size="large" color="#1677ff" style={{ marginTop: 60 }} />;
  }

  return (
    <View style={styles.root}>
      <FlatList
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
        contentContainerStyle={[routes.length === 0 && styles.emptyContainer, { paddingBottom: 96 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Chưa có chuyến đi nào được phân công.</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AIChat")}
        activeOpacity={0.85}
        accessibilityLabel="Mở trợ lý AI"
      >
        <Text style={styles.fabIcon}>💬</Text>
      </TouchableOpacity>
    </View>
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
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1677ff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabIcon: { fontSize: 26, color: "#fff" },
});
