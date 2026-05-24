import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { driverApi } from "../api/driver";

const TYPE_ICON = {
  MAINTENANCE_ASSIGNED: "🔧",
  TRIP_ASSIGNED: "🚛",
  TRIP_STATUS_CHANGED: "🔄",
  GENERAL: "🔔"
};

function NotificationCard({ item, onPress }) {
  const time = item.CreatedAt
    ? new Date(item.CreatedAt).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit"
      })
    : "";

  return (
    <TouchableOpacity
      style={[styles.card, !item.IsRead && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.iconCol}>
        <Text style={styles.icon}>{TYPE_ICON[item.Type] ?? "🔔"}</Text>
        {!item.IsRead && <View style={styles.dotUnread} />}
      </View>
      <View style={styles.contentCol}>
        <Text style={[styles.title, !item.IsRead && { fontWeight: "700" }]}>
          {item.Title}
        </Text>
        {item.Body ? <Text style={styles.body}>{item.Body}</Text> : null}
        <Text style={styles.time}>{time}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);

  const fetchNotifications = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await driverApi.getNotifications({ limit: 50 });
      setItems(res.data?.data?.items ?? []);
      setUnread(res.data?.data?.unread ?? 0);
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const handlePress = async (item) => {
    if (!item.IsRead) {
      try {
        await driverApi.markNotificationRead(item._id);
        setItems((prev) =>
          prev.map((x) => (x._id === item._id ? { ...x, IsRead: true } : x))
        );
        setUnread((c) => Math.max(0, c - 1));
      } catch { /* silent */ }
    }
    // Deep-link tới screen tương ứng nếu có
    if (item.Link?.startsWith("trip:")) {
      const id = item.Link.split(":")[1];
      navigation.navigate("RouteDetail", { routeId: id });
    } else if (item.Link?.startsWith("maintenance:")) {
      const id = item.Link.split(":")[1];
      navigation.navigate("MaintenanceDetail", { maintenanceId: id });
    } else if (item.Type === "MAINTENANCE_ASSIGNED" && item.Metadata?.maintenanceId) {
      navigation.navigate("MaintenanceDetail", { maintenanceId: item.Metadata.maintenanceId });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await driverApi.markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, IsRead: true })));
      setUnread(0);
    } catch (err) {
      Alert.alert("Lỗi", err.message);
    }
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: unread > 0 ? `Thông báo (${unread})` : "Thông báo",
      headerRight: () =>
        unread > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={{ marginRight: 12 }}>
            <Text style={{ color: "#fff", fontSize: 13 }}>Đánh dấu đã đọc</Text>
          </TouchableOpacity>
        ) : null
    });
  }, [navigation, unread]);

  if (loading) {
    return <ActivityIndicator size="large" color="#1677ff" style={{ marginTop: 60 }} />;
  }

  return (
    <View style={styles.root}>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
          <Text style={styles.emptyHint}>
            Khi quản lý phân chuyến hoặc lịch bảo dưỡng cho bạn,
            thông báo sẽ hiện ở đây.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it._id)}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <NotificationCard item={item} onPress={() => handlePress(item)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f7fa" },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 14,
    borderRadius: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }
  },
  cardUnread: {
    backgroundColor: "#e6f4ff",
    borderLeftWidth: 3,
    borderLeftColor: "#1677ff"
  },
  iconCol: {
    width: 40,
    alignItems: "center",
    justifyContent: "flex-start"
  },
  icon: { fontSize: 24 },
  dotUnread: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#ff4d4f",
    marginTop: 4
  },
  contentCol: { flex: 1, marginLeft: 8 },
  title: { fontSize: 15, color: "#1f1f1f", marginBottom: 2 },
  body: { fontSize: 13, color: "#595959", marginBottom: 4 },
  time: { fontSize: 11, color: "#8c8c8c" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: "#595959", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#8c8c8c", textAlign: "center" }
});
