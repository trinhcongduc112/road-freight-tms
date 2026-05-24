import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supportApi } from "../api/driver";

const PRIMARY = "#1677ff";

const WELCOME = {
  sender: "bot",
  body: "Xin chào! Mình là trợ lý AI Road Freight TMS. Bạn có thể hỏi về quy trình chạy chuyến, ePOD, báo sự cố, COD… Nếu mình không trả lời được, mình sẽ chuyển sang tư vấn viên thật.",
  createdAt: new Date().toISOString(),
};

const QUICK_PROMPTS = [
  "Quy trình chạy chuyến trên app?",
  "Cách xác nhận giao hàng (ePOD)?",
  "Cách báo sự cố?",
  "Quên mật khẩu thì sao?",
];

function normalizeSession(session) {
  if (!session) return null;
  return { ...session, messages: session.messages ?? [] };
}

function senderLabel(sender) {
  if (sender === "human") return "Tư vấn viên";
  return null;
}

function Bubble({ msg }) {
  const isMe = msg.sender === "user";
  const label = senderLabel(msg.sender);
  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowAgent]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleAgent]}>
        {label && <Text style={styles.bubbleLabel}>{label}</Text>}
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.body}</Text>
      </View>
    </View>
  );
}

export default function AIChatScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef(null);
  const sessionRef = useRef(null);

  const messages = session?.messages?.length ? session.messages : [WELCOME];
  const isHuman = session?.handledBy === "human";

  useEffect(() => { sessionRef.current = session; }, [session]);

  const reloadSession = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await supportApi.chatSession();
      const next = normalizeSession(res?.data?.data);
      const prevCount = sessionRef.current?.messages?.length ?? 0;
      setSession(next);
      return (next?.messages?.length ?? 0) > prevCount;
    } catch {
      return false;
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    let cancelled = false;
    reloadSession({ silent: true }).finally(() => {
      if (!cancelled) setLoadingSession(false);
    });
    return () => { cancelled = true; };
  }, [reloadSession]);

  // Refetch khi screen được focus lại (vd quay từ màn khác)
  useFocusEffect(
    useCallback(() => {
      reloadSession({ silent: true });
    }, [reloadSession])
  );

  // Khi handledBy=human → auto-poll mỗi 8s để bắt reply của tư vấn viên
  useEffect(() => {
    if (!isHuman) return undefined;
    const id = setInterval(() => {
      reloadSession({ silent: true });
    }, 8000);
    return () => clearInterval(id);
  }, [isHuman, reloadSession]);

  const scrollToEnd = useCallback(() => {
    if (!listRef.current) return;
    setTimeout(() => {
      try { listRef.current.scrollToEnd({ animated: true }); } catch {}
    }, 80);
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, loading, isHuman, scrollToEnd]);

  async function send(text = input, options = {}) {
    const body = String(text).trim();
    if (!body || loading) return;
    setInput("");
    setLoading(true);
    try {
      const forceSupport = options.forceSupport === true
        || body.toLowerCase().includes("gặp tư vấn")
        || body.toLowerCase().includes("gap tu van")
        || body.toLowerCase().includes("gặp nhân viên")
        || body.toLowerCase().includes("gap nhan vien");
      const res = await supportApi.chatMessage(body, {
        sessionId: session?._id,
        forceSupport,
      });
      const payload = res?.data?.data;
      const nextSession = payload?.session;
      if (nextSession) {
        setSession(normalizeSession(nextSession));
      } else if (payload?.message) {
        // Fallback nếu API không trả session — append message vào local state
        const fake = {
          ...(session ?? {}),
          messages: [
            ...(session?.messages ?? []),
            { sender: "user", body, createdAt: new Date().toISOString() },
            { sender: "bot", body: payload.message, createdAt: new Date().toISOString() },
          ],
        };
        setSession(normalizeSession(fake));
      }
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message ?? "Không gửi được tin nhắn");
    } finally {
      setLoading(false);
    }
  }

  async function resumeBot() {
    if (!session?._id || loading) return;
    setLoading(true);
    try {
      const res = await supportApi.resumeBot(session._id);
      const nextSession = res?.data?.data?.session;
      if (nextSession) setSession(normalizeSession(nextSession));
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message ?? "Không quay lại AI được");
    } finally {
      setLoading(false);
    }
  }

  if (loadingSession) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item, idx) => `${item.sender}-${idx}-${item.createdAt ?? ""}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <Bubble msg={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reloadSession()}
            colors={[PRIMARY]}
            tintColor={PRIMARY}
          />
        }
        ListHeaderComponent={messages.length <= 1 ? (
          <View style={styles.prompts}>
            <Text style={styles.promptsTitle}>Câu hỏi gợi ý</Text>
            {QUICK_PROMPTS.map((p) => (
              <TouchableOpacity
                key={p}
                style={styles.promptBtn}
                onPress={() => send(p)}
                activeOpacity={0.7}
              >
                <Text style={styles.promptText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        ListFooterComponent={loading ? (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color={PRIMARY} />
            <Text style={styles.typingText}>Bot đang gõ…</Text>
          </View>
        ) : null}
        onContentSizeChange={scrollToEnd}
      />

      {isHuman && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Đang chờ tư vấn viên phản hồi.</Text>
          <TouchableOpacity
            onPress={resumeBot}
            disabled={loading}
            style={[styles.bannerBtn, loading && styles.bannerBtnDisabled]}
            activeOpacity={0.7}
          >
            <Text style={styles.bannerBtnText}>Quay lại AI</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {!isHuman && messages.length > 1 && (
          <TouchableOpacity
            style={styles.humanBtn}
            onPress={() => send("Tôi muốn gặp tư vấn viên", { forceSupport: true })}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.humanBtnText}>Gặp tư vấn viên</Text>
          </TouchableOpacity>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Nhập câu hỏi của bạn…"
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || loading}
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            activeOpacity={0.8}
          >
            <Text style={styles.sendBtnText}>Gửi</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f0f2f5" },
  loadingRoot: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f0f2f5" },

  listContent: { padding: 12, paddingBottom: 16, flexGrow: 1 },

  prompts: { marginBottom: 12 },
  promptsTitle: { fontSize: 13, color: "#64748b", marginBottom: 8, marginLeft: 4 },
  promptBtn: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#d6e4ff",
  },
  promptText: { color: PRIMARY, fontSize: 14, fontWeight: "500" },

  row: { flexDirection: "row", marginBottom: 8 },
  rowMe: { justifyContent: "flex-end" },
  rowAgent: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "82%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  bubbleMe: {
    backgroundColor: PRIMARY,
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  bubbleText: { color: "#1a1a1a", fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: "#fff" },
  bubbleLabel: { fontSize: 11, fontWeight: "700", color: "#4f46e5", marginBottom: 2 },

  typing: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  typingText: { color: "#666", fontSize: 13, marginLeft: 8 },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#fffbeb",
    borderTopWidth: 1,
    borderTopColor: "#fde68a",
  },
  bannerText: { color: "#78350f", fontSize: 13, flex: 1 },
  bannerBtn: {
    backgroundColor: "#fff",
    borderColor: "#fbbf24",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bannerBtnDisabled: { opacity: 0.5 },
  bannerBtnText: { color: "#78350f", fontWeight: "600", fontSize: 13 },

  inputBar: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  humanBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#eef2ff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  humanBtnText: { color: "#4f46e5", fontSize: 13, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "flex-end" },
  input: {
    flex: 1,
    backgroundColor: "#f4f5f7",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: "#1a1a1a",
    maxHeight: 110,
    minHeight: 40,
  },
  sendBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginLeft: 8,
    minHeight: 44,
    minWidth: 64,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#bfdbfe" },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
