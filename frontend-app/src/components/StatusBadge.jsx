import React from "react";
import { View, Text, StyleSheet } from "react-native";

const STATUS_MAP = {
  PENDING:     { label: "Chờ xuất phát", color: "#faad14", bg: "#fffbe6" },
  ASSIGNED:    { label: "Đã phân công",  color: "#1677ff", bg: "#e6f4ff" },
  DRIVER_CONFIRMED: { label: "Tài xế đã nhận", color: "#13c2c2", bg: "#e6fffb" },
  LOADING:     { label: "Đang bốc hàng", color: "#d48806", bg: "#fff7e6" },
  RETURNING:   { label: "Đang về kho",   color: "#722ed1", bg: "#f9f0ff" },
  EN_ROUTE:    { label: "Đang tới",      color: "#1677ff", bg: "#e6f4ff" },
  ARRIVED:     { label: "Đã đến",        color: "#d48806", bg: "#fff7e6" },
  IN_PROGRESS: { label: "Đang giao",     color: "#1677ff", bg: "#e6f4ff" },
  COMPLETED:   { label: "Hoàn thành",    color: "#52c41a", bg: "#f6ffed" },
  FAILED:      { label: "Thất bại",      color: "#ff4d4f", bg: "#fff2f0" },
  FINALIZED:   { label: "Đã chốt",       color: "#722ed1", bg: "#f9f0ff" },
  SKIPPED:     { label: "Bỏ qua",        color: "#8c8c8c", bg: "#f5f5f5" },
};

export default function StatusBadge({ status, style }) {
  const cfg = STATUS_MAP[status] ?? { label: status, color: "#8c8c8c", bg: "#f5f5f5" };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.color }, style]}>
      <Text style={[styles.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, alignSelf: "flex-start" },
  text:  { fontSize: 12, fontWeight: "600" },
});
