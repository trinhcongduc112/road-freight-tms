import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  TextInput
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { driverApi } from "../api/driver";

const TYPE_LABEL = {
  OIL_CHANGE: "🛢️ Thay dầu nhớt",
  TIRE_ROTATION: "🛞 Đảo lốp",
  BRAKE_CHECK: "🔧 Kiểm tra phanh",
  GENERAL: "🔍 Bảo dưỡng tổng quát",
  INSURANCE: "📄 Gia hạn bảo hiểm",
  REGISTRATION: "🚗 Gia hạn đăng kiểm",
  REPAIR: "⚙️ Sửa chữa đột xuất",
  OTHER: "📌 Bảo dưỡng"
};

const STATUS_LABEL = {
  SCHEDULED: { text: "Đã giao — chờ bạn nhận việc", color: "#1677ff" },
  ACKNOWLEDGED: { text: "Bạn đã nhận việc", color: "#13c2c2" },
  IN_PROGRESS: { text: "Đang thực hiện", color: "#fa8c16" },
  AWAITING_REVIEW: { text: "Đã hoàn thành — chờ quản lý duyệt", color: "#faad14" },
  COMPLETED: { text: "Đã hoàn tất", color: "#52c41a" },
  CANCELLED: { text: "Đã huỷ", color: "#bfbfbf" }
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function MaintenanceDetailScreen({ route, navigation }) {
  const { maintenanceId } = route.params ?? {};
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState([]); // base64 data URIs
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await driverApi.getMaintenanceDetail(maintenanceId);
      setDoc(res.data?.data);
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDetail(); }, [maintenanceId]);

  const handleAcknowledge = async () => {
    try {
      setSubmitting(true);
      const res = await driverApi.acknowledgeMaintenance(maintenanceId);
      setDoc(res.data?.data);
      Alert.alert("Đã nhận việc", "Bạn đã xác nhận sẽ thực hiện lịch bảo dưỡng này.");
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền camera", "Vui lòng cấp quyền truy cập máy ảnh trong Cài đặt.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setPhotos((p) => [...p, dataUri]);
    }
  };

  const handlePickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsMultipleSelection: true
    });
    if (!result.canceled) {
      const uris = (result.assets ?? [])
        .filter((a) => a.base64)
        .map((a) => `data:image/jpeg;base64,${a.base64}`);
      setPhotos((p) => [...p, ...uris]);
    }
  };

  const handleComplete = async () => {
    if (photos.length === 0) {
      Alert.alert("Thiếu ảnh", "Bạn cần chụp ít nhất 1 ảnh hoá đơn / xe sau bảo dưỡng để xác nhận hoàn thành.");
      return;
    }
    Alert.alert(
      "Xác nhận hoàn thành",
      `Gửi ${photos.length} ảnh cho quản lý duyệt?`,
      [
        { text: "Huỷ", style: "cancel" },
        {
          text: "Gửi",
          onPress: async () => {
            try {
              setSubmitting(true);
              const res = await driverApi.completeMaintenance(maintenanceId, {
                photos,
                note: note.trim()
              });
              setDoc(res.data?.data);
              setPhotos([]);
              setNote("");
              Alert.alert("Đã gửi", "Quản lý sẽ kiểm tra và duyệt hoàn thành.");
            } catch (err) {
              Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#1677ff" style={{ marginTop: 60 }} />;
  }
  if (!doc) return null;

  const status = STATUS_LABEL[doc.Status] ?? { text: doc.Status, color: "#888" };
  const isOverdue = doc.ScheduledDate && new Date(doc.ScheduledDate) < new Date() && doc.Status !== "COMPLETED";
  const canAck = ["SCHEDULED", "ACKNOWLEDGED"].includes(doc.Status) && !doc.DriverAcknowledgedAt;
  const canComplete = ["SCHEDULED", "ACKNOWLEDGED", "IN_PROGRESS"].includes(doc.Status);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.card}>
        <Text style={styles.title}>{TYPE_LABEL[doc.Type] ?? doc.Type}</Text>
        <Text style={styles.subtitle}>{doc.Title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: status.color + "22", borderColor: status.color }]}>
          <Text style={[styles.statusText, { color: status.color }]}>● {status.text}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>🚛 Xe:</Text>
          <Text style={styles.value}>{doc.VehicleCode}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>📅 Hạn:</Text>
          <Text style={[styles.value, isOverdue && { color: "#cf1322", fontWeight: "700" }]}>
            {formatDate(doc.ScheduledDate)}{isOverdue && " (đã quá hạn)"}
          </Text>
        </View>
        {doc.Vendor ? (
          <View style={styles.row}>
            <Text style={styles.label}>🏢 Nơi BD:</Text>
            <Text style={styles.value}>{doc.Vendor}</Text>
          </View>
        ) : null}
        {doc.Cost > 0 && (
          <View style={styles.row}>
            <Text style={styles.label}>💰 Chi phí:</Text>
            <Text style={styles.value}>{doc.Cost.toLocaleString("vi-VN")} đ</Text>
          </View>
        )}
        {doc.Description ? (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.label}>📝 Mô tả:</Text>
            <Text style={styles.descText}>{doc.Description}</Text>
          </View>
        ) : null}

        <View style={styles.timeline}>
          {doc.DriverAcknowledgedAt && (
            <Text style={styles.timelineItem}>
              ✓ Bạn đã nhận việc lúc {formatDateTime(doc.DriverAcknowledgedAt)}
            </Text>
          )}
          {doc.DriverCompletedAt && (
            <Text style={styles.timelineItem}>
              ✓ Bạn đã gửi hoàn thành lúc {formatDateTime(doc.DriverCompletedAt)}
            </Text>
          )}
          {doc.ApprovedAt && (
            <Text style={styles.timelineItem}>
              ✓ Quản lý đã duyệt lúc {formatDateTime(doc.ApprovedAt)}
            </Text>
          )}
        </View>
      </View>

      {/* Action 1: Nhận việc */}
      {canAck && (
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={handleAcknowledge}
          disabled={submitting}
        >
          <Text style={styles.btnText}>{submitting ? "Đang gửi..." : "✓ Nhận việc"}</Text>
        </TouchableOpacity>
      )}

      {/* Action 2: Upload ảnh + Hoàn thành */}
      {canComplete && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📷 Ảnh hoá đơn / xe sau bảo dưỡng</Text>
          <Text style={styles.help}>
            Sau khi đổ xong dầu / thay lốp / sửa xe, hãy chụp ảnh hoá đơn (và/hoặc xe) để gửi quản lý duyệt.
          </Text>

          <View style={styles.photosWrap}>
            {photos.map((src, i) => (
              <View key={i} style={styles.photoBox}>
                <Image source={{ uri: src }} style={styles.photoImg} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                >
                  <Text style={{ color: "#fff", fontSize: 12 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost, { flex: 1 }]} onPress={handleTakePhoto}>
              <Text style={styles.btnTextGhost}>📷 Chụp ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnGhost, { flex: 1 }]} onPress={handlePickFromGallery}>
              <Text style={styles.btnTextGhost}>🖼 Thư viện</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.noteInput}
            placeholder="Ghi chú (tuỳ chọn) — vd: đã thay nhớt + thay lọc gió"
            multiline
            value={note}
            onChangeText={setNote}
          />

          <TouchableOpacity
            style={[styles.btn, styles.btnSuccess, photos.length === 0 && { opacity: 0.5 }]}
            onPress={handleComplete}
            disabled={submitting || photos.length === 0}
          >
            <Text style={styles.btnText}>
              {submitting ? "Đang gửi..." : `✓ Hoàn thành (${photos.length} ảnh)`}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Đã hoàn thành — hiện ảnh đã gửi */}
      {(doc.Status === "AWAITING_REVIEW" || doc.Status === "COMPLETED") && doc.CompletionPhotos?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📷 Ảnh bạn đã gửi</Text>
          {doc.CompletionNote ? (
            <Text style={styles.descText}>Ghi chú: {doc.CompletionNote}</Text>
          ) : null}
          <View style={styles.photosWrap}>
            {doc.CompletionPhotos.map((src, i) => (
              <Image key={i} source={{ uri: src }} style={styles.photoImg} />
            ))}
          </View>
          {doc.Status === "AWAITING_REVIEW" && (
            <View style={styles.waitingBox}>
              <Text style={{ color: "#d48806", fontSize: 13 }}>
                ⏳ Đang chờ quản lý kiểm tra và duyệt hoàn thành...
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f7fa" },
  card: {
    backgroundColor: "#fff",
    margin: 12,
    padding: 16,
    borderRadius: 10,
    elevation: 1,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1f1f1f", marginBottom: 2 },
  subtitle: { fontSize: 14, color: "#595959", marginBottom: 12 },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  row: { flexDirection: "row", marginVertical: 3 },
  label: { width: 90, fontSize: 13, color: "#595959" },
  value: { flex: 1, fontSize: 14, color: "#1f1f1f" },
  descText: { fontSize: 13, color: "#1f1f1f", marginTop: 4, lineHeight: 18 },
  timeline: { marginTop: 12, padding: 10, backgroundColor: "#f0f5ff", borderRadius: 6 },
  timelineItem: { fontSize: 12, color: "#0050b3", marginVertical: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 6 },
  help: { fontSize: 12, color: "#8c8c8c", marginBottom: 10, lineHeight: 16 },
  photosWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  photoBox: { position: "relative" },
  photoImg: { width: 90, height: 90, borderRadius: 6, backgroundColor: "#f0f0f0" },
  removePhoto: {
    position: "absolute", top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#ff4d4f", alignItems: "center", justifyContent: "center"
  },
  noteInput: {
    borderWidth: 1, borderColor: "#d9d9d9", borderRadius: 6,
    padding: 10, marginBottom: 12, minHeight: 60, textAlignVertical: "top"
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 12,
    marginVertical: 6
  },
  btnPrimary: { backgroundColor: "#1677ff" },
  btnSuccess: { backgroundColor: "#52c41a", marginHorizontal: 0 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#1677ff", marginHorizontal: 0 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnTextGhost: { color: "#1677ff", fontSize: 14, fontWeight: "600" },
  waitingBox: { padding: 12, backgroundColor: "#fffbe6", borderRadius: 6, marginTop: 8 }
});
