/**
 * DeviationExplainModal — hộp thoại bắt tài xế giải trình khi lệch giờ > 20 phút.
 *
 * Hiển thị khi backend trả `eta.requiresExplanation = true` sau khi hoàn thành điểm.
 * Tài xế chọn lý do (TRAFFIC/BREAKDOWN/...) và xác nhận số phút dự kiến trễ
 * cho các điểm tiếp theo (mặc định = độ lệch đã đo).
 */
import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView } from "react-native";

/* Reasons cho TRỄ */
const LATE_REASONS = [
  { value: "TRAFFIC",         label: "🚦 Tắc đường",       fault: "FORCE_MAJEURE" },
  { value: "BREAKDOWN",       label: "🔧 Hỏng xe",         fault: "COMPANY" },
  { value: "CUSTOMER_DELAY",  label: "👤 Khách chậm nhận", fault: "CUSTOMER" },
  { value: "WEATHER",         label: "🌧 Thời tiết xấu",   fault: "FORCE_MAJEURE" },
  { value: "POLICE",          label: "🚓 Bị CSGT kiểm tra", fault: "DRIVER" },
  { value: "OTHER",           label: "❓ Khác",            fault: "" },
];

/* Reasons cho SỚM bất thường (>60p) — case hiếm, thường là vấn đề kiểm soát */
const EARLY_REASONS = [
  { value: "EARLY",           label: "⏩ Đường rất thoáng / kế hoạch quá rộng", fault: "" },
  { value: "CUSTOMER_DELAY",  label: "👤 Bỏ qua điểm này (khách hẹn lại)",     fault: "CUSTOMER" },
  { value: "OTHER",           label: "❓ Khác (ghi chú rõ)",                    fault: "" },
];

export default function DeviationExplainModal({ visible, deviationMin = 0, onSubmit, onCancel }) {
  const isEarly = deviationMin < 0;
  const absDev = Math.abs(deviationMin);
  const REASONS = isEarly ? EARLY_REASONS : LATE_REASONS;
  const [reason, setReason] = useState(REASONS[0].value);
  const [delayMin, setDelayMin] = useState(String(Math.round(deviationMin)));
  const [note, setNote] = useState("");

  const submit = () => {
    const dev = Number(delayMin);
    if (!Number.isFinite(dev)) return;
    const found = REASONS.find((r) => r.value === reason);
    onSubmit({
      expectedDelayMinutes: dev,
      reason,
      note: note.trim().slice(0, 500),
      faultParty: found?.fault ?? ""
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {isEarly ? "⏩ Đến sớm bất thường" : "⏰ Đến trễ"} {absDev} phút
          </Text>
          <Text style={styles.subtitle}>
            {isEarly
              ? "Sớm hơn 60 phút — vui lòng xác nhận để hệ thống cập nhật ETA hoặc cảnh báo điều phối nếu cần."
              : "Trễ hơn 20 phút — chọn lý do để hệ thống cập nhật ETA các điểm sau."}
          </Text>

          <ScrollView style={{ maxHeight: 250 }}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.reasonBtn, reason === r.value && styles.reasonBtnActive]}
                onPress={() => setReason(r.value)}
              >
                <Text style={[styles.reasonText, reason === r.value && styles.reasonTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Dự kiến lệch giờ (phút, âm = sớm hơn)</Text>
          <TextInput
            value={delayMin}
            onChangeText={setDelayMin}
            keyboardType="numbers-and-punctuation"
            style={styles.input}
          />

          <Text style={styles.label}>Ghi chú (không bắt buộc)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Mô tả ngắn..."
            multiline
            style={[styles.input, { height: 60 }]}
          />

          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
              <Text style={styles.btnCancelText}>Bỏ qua</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={submit}>
              <Text style={styles.btnPrimaryText}>Gửi & Cập nhật ETA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:        { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  card:            { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  title:           { fontSize: 18, fontWeight: "bold", color: "#1a1a1a", marginBottom: 6 },
  subtitle:        { fontSize: 13, color: "#666", marginBottom: 12 },
  reasonBtn:       { borderWidth: 1, borderColor: "#d9d9d9", borderRadius: 8, padding: 12, marginBottom: 8 },
  reasonBtnActive: { borderColor: "#1677ff", backgroundColor: "#e6f4ff" },
  reasonText:      { fontSize: 14, color: "#333" },
  reasonTextActive:{ color: "#1677ff", fontWeight: "bold" },
  label:           { fontSize: 13, color: "#555", marginTop: 12, marginBottom: 4 },
  input:           { borderWidth: 1, borderColor: "#d9d9d9", borderRadius: 8, padding: 10, fontSize: 14, color: "#000" },
  row:             { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  btn:             { flex: 1, padding: 14, borderRadius: 8, alignItems: "center" },
  btnCancel:       { backgroundColor: "#f5f5f5", marginRight: 8 },
  btnCancelText:   { color: "#666", fontWeight: "bold" },
  btnPrimary:      { backgroundColor: "#1677ff", marginLeft: 8 },
  btnPrimaryText:  { color: "#fff", fontWeight: "bold" },
});
