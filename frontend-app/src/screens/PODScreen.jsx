import React, { useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Image, Alert, ActivityIndicator, PanResponder, Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path } from "react-native-svg";
import { driverApi } from "../api/driver";

const { width } = Dimensions.get("window");
const SIG_HEIGHT = 180;

// ── Signature Pad (dùng PanResponder + SVG, không cần WebView) ──────────────
function SignaturePad({ paths, onPathsChange }) {
  const currentD = useRef("");

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: ({ nativeEvent: { locationX: x, locationY: y } }) => {
      currentD.current = `M${x.toFixed(1)},${y.toFixed(1)}`;
      onPathsChange([...paths, currentD.current]);
    },
    onPanResponderMove: ({ nativeEvent: { locationX: x, locationY: y } }) => {
      currentD.current += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      onPathsChange([...paths.slice(0, -1), currentD.current]);
    },
  });

  return (
    <View style={sig.wrap} {...responder.panHandlers}>
      <Svg style={StyleSheet.absoluteFill}>
        {paths.map((d, i) => (
          <Path key={i} d={d} stroke="#1a1a1a" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        ))}
      </Svg>
      {paths.length === 0 && (
        <Text style={sig.placeholder}>Ký tên vào đây…</Text>
      )}
    </View>
  );
}

const sig = StyleSheet.create({
  wrap:        { height: SIG_HEIGHT, backgroundColor: "#fafafa", borderWidth: 1.5, borderColor: "#d9d9d9", borderRadius: 10, overflow: "hidden", marginBottom: 8 },
  placeholder: { position: "absolute", top: "45%", left: 0, right: 0, textAlign: "center", color: "#ccc", fontSize: 14, pointerEvents: "none" },
});

// ── POD Screen ────────────────────────────────────────────────────────────────
export default function PODScreen({ route, navigation }) {
  const { routeId, stop, stopIndex } = route.params;
  const [photos,  setPhotos]  = useState([]);   // uri[]
  const [paths,   setPaths]   = useState([]);   // SVG path strings
  const [note,    setNote]    = useState("");
  const [loading, setLoading] = useState(false);

  // ── Chụp / chọn ảnh ─────────────────────────────────────────────────────
  const pickImage = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền", "Hãy cấp quyền camera trong Cài đặt.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.7,
      base64:     true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => [...prev, result.assets[0]]);
    }
  };

  const removePhoto = (idx) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  // ── Submit ePOD ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (paths.length === 0) {
      Alert.alert("Thiếu chữ ký", "Vui lòng ký tên xác nhận trước khi gửi.");
      return;
    }

    setLoading(true);
    try {
      const entities = [];

      if (paths.length > 0) {
        entities.push({
          type: "SIGNATURE",
          data: [{ value: `svg:${paths.join("|")}` }],
        });
      }

      photos.forEach((photo) => {
        if (photo.base64) {
          entities.push({
            type: "PHOTO",
            data: [{ value: `data:image/jpeg;base64,${photo.base64}` }],
          });
        }
      });

      await driverApi.updateStop(routeId, stopIndex, {
        action:       "complete",
        status:       "COMPLETED",
        note,
        podImages: entities.filter((e) => e.type === "PHOTO").flatMap((e) => e.data.map((d) => d.value)),
        signatureImage: entities.find((e) => e.type === "SIGNATURE")?.data?.[0]?.value ?? "",
      });

      Alert.alert("Thành công", "Đã xác nhận giao hàng và lưu ePOD!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Stop info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>
          📍 {stop.CustomerName ?? stop.Address ?? `Điểm dừng ${stopIndex}`}
        </Text>
      </View>

      {/* Chụp ảnh */}
      <Text style={styles.label}>📸 Ảnh bằng chứng giao hàng</Text>
      <View style={styles.photoRow}>
        {photos.map((p, i) => (
          <View key={i} style={styles.photoWrap}>
            <Image source={{ uri: p.uri }} style={styles.photo} />
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

      {/* Chữ ký */}
      <Text style={styles.label}>✍️ Chữ ký khách hàng</Text>
      <SignaturePad paths={paths} onPathsChange={setPaths} />
      <TouchableOpacity onPress={() => setPaths([])} style={styles.clearBtn}>
        <Text style={styles.clearText}>Xóa chữ ký</Text>
      </TouchableOpacity>

      {/* Ghi chú */}
      <Text style={styles.label}>📝 Ghi chú (tùy chọn)</Text>
      <View style={styles.noteInput}>
        <Text style={{ color: "#aaa", fontSize: 14 }}
          onPress={() => {}}
        >{note || "Nhập ghi chú nếu có…"}</Text>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitText}>✅ Xác nhận hoàn thành giao hàng</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#f0f2f5" },
  infoBox:      { backgroundColor: "#fff", margin: 12, borderRadius: 12, padding: 14, elevation: 2 },
  infoTitle:    { fontSize: 15, fontWeight: "bold", color: "#222" },
  label:        { fontSize: 14, fontWeight: "600", color: "#444", marginLeft: 16, marginBottom: 8, marginTop: 16 },
  photoRow:     { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8 },
  photoWrap:    { position: "relative" },
  photo:        { width: 88, height: 88, borderRadius: 8 },
  removeBtn:    { position: "absolute", top: -6, right: -6, backgroundColor: "#ff4d4f", borderRadius: 10, width: 20, height: 20, justifyContent: "center", alignItems: "center" },
  removeText:   { color: "#fff", fontSize: 11, fontWeight: "bold" },
  addPhotoBtn:  { width: 88, height: 88, borderRadius: 8, borderWidth: 1.5, borderColor: "#d9d9d9", borderStyle: "dashed", justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  addPhotoIcon: { fontSize: 24, color: "#aaa" },
  addPhotoText: { fontSize: 11, color: "#aaa", marginTop: 2 },
  clearBtn:     { alignSelf: "flex-end", marginRight: 16, marginBottom: 4 },
  clearText:    { color: "#ff4d4f", fontSize: 13 },
  noteInput:    { backgroundColor: "#fff", marginHorizontal: 12, borderRadius: 10, padding: 14, minHeight: 72, elevation: 1 },
  submitBtn:    { backgroundColor: "#52c41a", margin: 16, borderRadius: 12, padding: 16, alignItems: "center", elevation: 3 },
  submitText:   { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
