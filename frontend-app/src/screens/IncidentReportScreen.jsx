import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { driverApi } from "../api/driver";

const INCIDENT_TYPES = [
  { value: "BREAKDOWN",   label: "🔧 Hỏng xe",           desc: "Nổ lốp, chết máy, lỗi kỹ thuật…" },
  { value: "ACCIDENT",    label: "🚨 Tai nạn",           desc: "Va chạm giao thông" },
  { value: "TRAFFIC",     label: "🚧 Kẹt đường / tắc",   desc: "Tắc nghẽn, đường cấm tải, mưa lụt" },
  { value: "FUEL",        label: "⛽ Hết nhiên liệu",     desc: "Cần nạp xăng / dầu" },
  { value: "CARGO_ISSUE", label: "📦 Hàng hỏng / mất",   desc: "Hư hại trên đường, mất hàng" },
  { value: "WEATHER",     label: "🌧 Thời tiết xấu",      desc: "Bão, ngập, sương mù dày" },
  { value: "CUSTOMER",    label: "🙅 Khách từ chối",      desc: "Vắng nhà, không nhận hàng" },
  { value: "OTHER",       label: "❓ Khác",               desc: "Sự cố khác — mô tả chi tiết" }
];

const SEVERITY_OPTS = [
  { value: "LOW",      label: "Nhẹ",      color: "#10b981" },
  { value: "MEDIUM",   label: "Vừa",      color: "#f59e0b" },
  { value: "HIGH",     label: "Nặng",     color: "#ef4444" },
  { value: "CRITICAL", label: "Khẩn cấp", color: "#7c2d12" }
];

export default function IncidentReportScreen({ route, navigation }) {
  const { routeId, tripCode } = route.params;
  const [type, setType] = useState("BREAKDOWN");
  const [severity, setSeverity] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền", "Hãy bật quyền camera trong Cài đặt.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setPhotos((p) => [...p, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };
  const removePhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!description.trim() && type === "OTHER") {
      Alert.alert("Thiếu mô tả", "Mục 'Khác' bắt buộc phải có mô tả.");
      return;
    }
    setSubmitting(true);
    try {
      /* Try to grab current GPS so dispatcher sees where on the route this happened */
      let latitude = null, longitude = null;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      } catch { /* not critical */ }

      await driverApi.reportIncident(routeId, {
        type, severity,
        description: description.trim(),
        latitude, longitude,
        photos
      });
      Alert.alert(
        "Đã báo sự cố",
        "Bộ phận điều phối đã nhận được thông báo. Bạn có thể tiếp tục công việc.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>🚨 Báo sự cố</Text>
        <Text style={styles.headerSub}>Chuyến: {tripCode || routeId}</Text>
      </View>

      <Text style={styles.sectionLabel}>Loại sự cố</Text>
      <View style={styles.typeGrid}>
        {INCIDENT_TYPES.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.typeBtn, type === opt.value && styles.typeBtnActive]}
            onPress={() => setType(opt.value)}
          >
            <Text style={[styles.typeBtnLabel, type === opt.value && styles.typeBtnLabelActive]}>{opt.label}</Text>
            <Text style={styles.typeBtnDesc} numberOfLines={1}>{opt.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Mức độ</Text>
      <View style={styles.severityRow}>
        {SEVERITY_OPTS.map((s) => (
          <TouchableOpacity
            key={s.value}
            style={[styles.sevBtn, { borderColor: s.color }, severity === s.value && { backgroundColor: s.color }]}
            onPress={() => setSeverity(s.value)}
          >
            <Text style={[styles.sevText, { color: severity === s.value ? "#fff" : s.color }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Mô tả chi tiết</Text>
      <TextInput
        style={styles.textArea}
        multiline numberOfLines={5}
        placeholder="VD: Xe nổ lốp sau bên phải, đang đỗ tại km15 QL1A, cần cứu hộ…"
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.sectionLabel}>Ảnh hiện trường (tùy chọn)</Text>
      <View style={styles.photoRow}>
        {photos.map((src, i) => (
          <View key={i} style={styles.photoWrap}>
            <Image source={{ uri: src }} style={styles.photo} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < 4 && (
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
            <Text style={styles.addPhotoIcon}>+</Text>
            <Text style={styles.addPhotoText}>Chụp ảnh</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>📨 Gửi báo cáo</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#f0f2f5" },
  headerBox:    { backgroundColor: "#fff", margin: 12, borderRadius: 12, padding: 14, elevation: 2, borderLeftWidth: 4, borderLeftColor: "#ef4444" },
  headerTitle:  { fontSize: 18, fontWeight: "bold", color: "#0f172a" },
  headerSub:    { fontSize: 12, color: "#888", marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginLeft: 16, marginBottom: 8, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.4 },

  typeGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12 },
  typeBtn:      { width: "48.5%", backgroundColor: "#fff", borderRadius: 10, padding: 10, borderWidth: 1.5, borderColor: "#e5e7eb" },
  typeBtnActive:{ borderColor: "#1677ff", backgroundColor: "#eff6ff" },
  typeBtnLabel: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  typeBtnLabelActive: { color: "#1677ff" },
  typeBtnDesc:  { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  severityRow:  { flexDirection: "row", gap: 8, paddingHorizontal: 12 },
  sevBtn:       { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1.5, alignItems: "center", minHeight: 44, justifyContent: "center" },
  sevText:      { fontWeight: "700", fontSize: 13 },

  textArea:     { backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 10, padding: 12, minHeight: 96, fontSize: 14, color: "#222", textAlignVertical: "top", elevation: 1 },

  photoRow:     { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8 },
  photoWrap:    { position: "relative" },
  photo:        { width: 88, height: 88, borderRadius: 8 },
  removeBtn:    { position: "absolute", top: -6, right: -6, backgroundColor: "#ff4d4f", borderRadius: 10, width: 20, height: 20, justifyContent: "center", alignItems: "center" },
  removeText:   { color: "#fff", fontSize: 11, fontWeight: "bold" },
  addPhotoBtn:  { width: 88, height: 88, borderRadius: 8, borderWidth: 1.5, borderColor: "#d9d9d9", borderStyle: "dashed", justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  addPhotoIcon: { fontSize: 24, color: "#aaa" },
  addPhotoText: { fontSize: 11, color: "#aaa", marginTop: 2 },

  submitBtn:    { backgroundColor: "#ef4444", margin: 16, borderRadius: 12, padding: 16, alignItems: "center", elevation: 3 },
  submitText:   { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
