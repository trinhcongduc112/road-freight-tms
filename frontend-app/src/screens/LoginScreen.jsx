import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { authApi } from "../api/driver";
import { useAuthStore } from "../store/authStore";

export default function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const setSession = useAuthStore((s) => s.setSession);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email và mật khẩu.");
      return;
    }
    setLoading(true);
    try {
      const res  = await authApi.login({ Email: email.trim(), Password: password });
      const data = res.data.data ?? res.data;
      await setSession({ token: data.token, user: data.user });
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

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? "Đang xử lý…" : "ĐĂNG NHẬP"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>© 2026 Road Freight TMS</Text>
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
  eyeBtn:      { paddingHorizontal: 14, paddingVertical: 10 },
  eyeIcon:     { fontSize: 20 },
  btn:         { backgroundColor: "#1677ff", borderRadius: 10, padding: 16, alignItems: "center", marginTop: 6 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: "#fff", fontSize: 16, fontWeight: "bold", letterSpacing: 1 },
  footer:      { textAlign: "center", color: "rgba(255,255,255,0.6)", marginTop: 24, fontSize: 12 },
});
