import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, Modal,
} from "react-native";
import { authApi } from "../api/driver";
import { useAuthStore } from "../store/authStore";
import { getBaseUrl, setBaseUrl, clearBaseUrl } from "../api/baseUrlStore";

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const savedLogin = useAuthStore((s) => s.savedLogin);

  useEffect(() => {
    if (!savedLogin) return;
    setEmail(savedLogin.email ?? "");
    setPassword(savedLogin.password ?? "");
    setRemember(true);
  }, [savedLogin]);

  const openSettings = () => {
    setUrlInput(getBaseUrl() ?? "");
    setSettingsOpen(true);
  };

  const saveUrl = async () => {
    setSavingUrl(true);
    try {
      const saved = await setBaseUrl(urlInput);
      Alert.alert("Đã lưu", `URL backend: ${saved}`);
      setSettingsOpen(false);
    } catch (err) {
      Alert.alert("URL không hợp lệ", err.message);
    } finally {
      setSavingUrl(false);
    }
  };

  const resetUrl = async () => {
    await clearBaseUrl();
    setUrlInput("");
    Alert.alert("Đã đặt lại", "URL backend đã xóa, app sẽ dùng giá trị mặc định.");
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email và mật khẩu.");
      return;
    }
    setLoading(true);
    try {
      const res  = await authApi.login({ Email: email.trim(), Password: password });
      const data = res.data.data ?? res.data;
      await setSession({ token: data.token, user: data.user, remember, email: email.trim(), password });
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? "Lỗi không xác định";
      Alert.alert("Đăng nhập thất bại", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoIcon}>🚛</Text>
          <Text style={styles.logoTitle}>Road Freight</Text>
          <Text style={styles.logoSub}>TMS — Ứng dụng tài xế</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        {/* Password + toggle ẩn/hiện */}
        <View style={styles.pwdRow}>
          <TextInput
            style={styles.pwdInput}
            placeholder="Mật khẩu"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPwd}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd((v) => !v)}>
            <Text style={styles.eyeIcon}>{showPwd ? "🙈" : "👁"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.rememberRow} onPress={() => setRemember((v) => !v)} activeOpacity={0.8}>
          <View style={[styles.checkbox, remember && styles.checkboxOn]}>
            {remember && <Text style={styles.checkText}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? "Đang xử lý…" : "ĐĂNG NHẬP"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.settingsBtn} onPress={openSettings} activeOpacity={0.7}>
        <Text style={styles.settingsText}>⚙️  Cấu hình kết nối</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>© 2026 Road Freight TMS</Text>

      {/* Modal cấu hình URL backend */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cấu hình backend</Text>
            <Text style={styles.modalDesc}>
              Nhập URL máy chủ Road Freight TMS. Liên hệ quản trị viên nếu chưa có.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="https://api.cong-ty-cua-ban.com/api"
              placeholderTextColor="#aaa"
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <Text style={styles.modalHint}>
              Ví dụ:{"\n"}
              • http://192.168.1.50:5000/api  (dev LAN){"\n"}
              • https://tms-api.example.com/api  (production)
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnGhost} onPress={resetUrl}>
                <Text style={styles.modalBtnGhostText}>Đặt lại</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setSettingsOpen(false)}>
                <Text style={styles.modalBtnGhostText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, savingUrl && styles.btnDisabled]}
                onPress={saveUrl}
                disabled={savingUrl}
              >
                <Text style={styles.modalBtnPrimaryText}>{savingUrl ? "Đang lưu…" : "Lưu"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#1677ff", justifyContent: "center", padding: 24 },
  card:        { backgroundColor: "#fff", borderRadius: 16, padding: 28, elevation: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  logoWrap:    { alignItems: "center", marginBottom: 32 },
  logoIcon:    { fontSize: 52, marginBottom: 8 },
  logoTitle:   { fontSize: 26, fontWeight: "bold", color: "#1677ff" },
  logoSub:     { fontSize: 13, color: "#888", marginTop: 2 },
  input:       { backgroundColor: "#f5f7fa", borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: "#e8ecf0", color: "#222" },
  pwdRow:      { flexDirection: "row", alignItems: "center", backgroundColor: "#f5f7fa", borderRadius: 10, borderWidth: 1, borderColor: "#e8ecf0", marginBottom: 14 },
  pwdInput:    { flex: 1, padding: 14, fontSize: 15, color: "#222" },
  eyeBtn:      { paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  eyeIcon:     { fontSize: 20 },
  rememberRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#b9c2d0", alignItems: "center", justifyContent: "center", marginRight: 8, backgroundColor: "#fff" },
  checkboxOn:  { backgroundColor: "#1677ff", borderColor: "#1677ff" },
  checkText:   { color: "#fff", fontSize: 15, fontWeight: "bold" },
  rememberText:{ color: "#334155", fontSize: 14, fontWeight: "600" },
  btn:         { backgroundColor: "#1677ff", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 6 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: "#fff", fontSize: 16, fontWeight: "bold", letterSpacing: 1 },
  footer:      { textAlign: "center", color: "rgba(255,255,255,0.6)", marginTop: 24, fontSize: 12 },

  settingsBtn:    { alignSelf: "center", marginTop: 18, paddingVertical: 8, paddingHorizontal: 14 },
  settingsText:   { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "500" },

  modalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 },
  modalCard:      { backgroundColor: "#fff", borderRadius: 14, padding: 22 },
  modalTitle:     { fontSize: 18, fontWeight: "bold", color: "#222", marginBottom: 8 },
  modalDesc:      { fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 18 },
  modalInput:     { backgroundColor: "#f5f7fa", borderRadius: 10, padding: 12, fontSize: 14, borderWidth: 1, borderColor: "#e8ecf0", color: "#222", marginBottom: 10 },
  modalHint:      { fontSize: 11, color: "#888", lineHeight: 16, marginBottom: 18 },
  modalActions:   { flexDirection: "row", alignItems: "center" },
  modalBtnGhost:  { paddingVertical: 10, paddingHorizontal: 14 },
  modalBtnGhostText: { color: "#1677ff", fontSize: 14, fontWeight: "600" },
  modalBtnPrimary: { backgroundColor: "#1677ff", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, marginLeft: 8 },
  modalBtnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
});
