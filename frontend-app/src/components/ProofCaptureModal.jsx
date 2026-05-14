import React, { useState } from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Image, ScrollView, ActivityIndicator, Alert, TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

/* Modal chụp ảnh xác minh dùng chung cho:
   Nhận chuyến / Soạn hàng / Xuất kho / Về kho / Kết thúc.

   - Mỗi ảnh sau khi chụp được dán watermark "DD/MM/YYYY HH:mm" góc dưới phải
     bằng cách render qua <View overlay> rồi chụp lại — đơn giản: lưu base64
     gốc + thời điểm chụp trong meta. UI preview luôn hiện timestamp ở dưới.
   - Bấm "Gửi" → onSubmit({ photos: ["data:image/jpeg;base64,..."], note, odometer? }) */
export default function ProofCaptureModal({
  visible, onClose, onSubmit,
  title = "Chụp ảnh xác minh",
  subtitle = "Vui lòng chụp ít nhất 1 ảnh để xác nhận đã thực hiện",
  minPhotos = 1,
  maxPhotos = 4,
  showOdometer = false,
  showNote = true,
  submitText = "Gửi xác nhận",
  submitColor = "#1677ff",
}) {
  const [photos,    setPhotos]    = useState([]); // [{ uri, base64, capturedAt }]
  const [note,      setNote]      = useState("");
  const [odometer,  setOdometer]  = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setPhotos([]); setNote(""); setOdometer(""); setSubmitting(false);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền camera", "Hãy bật quyền camera trong Cài đặt.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setPhotos((p) => [...p, {
        uri:         result.assets[0].uri,
        base64:      `data:image/jpeg;base64,${result.assets[0].base64}`,
        capturedAt:  new Date()
      }]);
    }
  };
  const removePhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (photos.length < minPhotos) {
      Alert.alert("Thiếu ảnh", `Cần ít nhất ${minPhotos} ảnh xác minh.`);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        photos: photos.map((p) => p.base64),
        capturedAts: photos.map((p) => p.capturedAt.toISOString())
      };
      if (showNote && note.trim()) payload.note = note.trim();
      if (showOdometer && odometer.trim()) payload.odometer = Number(odometer.replace(/[^\d]/g, "")) || null;
      await onSubmit(payload);
      reset();
      onClose();
    } catch (err) {
      Alert.alert("Lỗi", err?.response?.data?.message ?? err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <ScrollView style={{ maxHeight: "60%" }} contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={styles.sectionLabel}>📸 Ảnh ({photos.length}/{maxPhotos})</Text>
            <View style={styles.photoRow}>
              {photos.map((p, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photo} />
                  {/* Timestamp watermark hiển thị overlay góc dưới phải */}
                  <View style={styles.stampBox}>
                    <Text style={styles.stampText}>
                      {p.capturedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      {"  "}
                      {p.capturedAt.toLocaleDateString("vi-VN")}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(i)}>
                    <Text style={styles.removeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < maxPhotos && (
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                  <Text style={styles.addPhotoIcon}>📷</Text>
                  <Text style={styles.addPhotoText}>Chụp ảnh</Text>
                </TouchableOpacity>
              )}
            </View>

            {showOdometer && (
              <>
                <Text style={styles.sectionLabel}>🛣 Số km đồng hồ công-tơ-mét (tùy chọn)</Text>
                <TextInput
                  style={styles.input}
                  value={odometer} onChangeText={setOdometer}
                  placeholder="VD: 124530"
                  keyboardType="numeric"
                />
              </>
            )}

            {showNote && (
              <>
                <Text style={styles.sectionLabel}>📝 Ghi chú (tùy chọn)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 64, textAlignVertical: "top" }]}
                  value={note} onChangeText={setNote}
                  placeholder="VD: Đã kiểm tra đầy đủ 12 thùng…"
                  multiline
                />
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: submitColor }, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{submitText}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, maxHeight: "90%" },
  handle:       { alignSelf: "center", width: 44, height: 4, borderRadius: 3, backgroundColor: "#d1d5db", marginBottom: 10 },
  title:        { fontSize: 18, fontWeight: "bold", color: "#0f172a" },
  subtitle:     { fontSize: 13, color: "#64748b", marginTop: 4, marginBottom: 14 },

  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#475569", marginBottom: 6, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.3 },
  photoRow:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoWrap:    { position: "relative" },
  photo:        { width: 96, height: 96, borderRadius: 8 },
  stampBox:     { position: "absolute", bottom: 4, left: 4, right: 4, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  stampText:    { color: "#fde68a", fontSize: 9, fontWeight: "600", textAlign: "center" },
  removeBtn:    { position: "absolute", top: -6, right: -6, backgroundColor: "#ef4444", borderRadius: 10, width: 20, height: 20, justifyContent: "center", alignItems: "center" },
  removeText:   { color: "#fff", fontSize: 11, fontWeight: "bold" },
  addPhotoBtn:  { width: 96, height: 96, borderRadius: 8, borderWidth: 1.5, borderColor: "#d9d9d9", borderStyle: "dashed", justifyContent: "center", alignItems: "center", backgroundColor: "#f9fafb" },
  addPhotoIcon: { fontSize: 26, color: "#94a3b8" },
  addPhotoText: { fontSize: 11, color: "#64748b", marginTop: 2 },

  input:        { backgroundColor: "#f8fafc", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0f172a", borderWidth: 1, borderColor: "#e2e8f0" },

  footer:       { flexDirection: "row", gap: 8, marginTop: 12 },
  cancelBtn:    { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", backgroundColor: "#fff" },
  cancelText:   { color: "#475569", fontWeight: "600", fontSize: 14 },
  submitBtn:    { flex: 2, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  submitText:   { color: "#fff", fontWeight: "bold", fontSize: 15 },
});
