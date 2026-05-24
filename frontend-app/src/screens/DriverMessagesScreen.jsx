import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { driverApi } from "../api/driver";

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN", { hour12: false });
}

export default function DriverMessagesScreen({ route }) {
  const initialTripId = route.params?.tripId ?? null;
  const [messages, setMessages] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(initialTripId);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const headerHeight = useHeaderHeight();

  // Khai báo ref để điều khiển FlatList
  const flatListRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = selectedTripId
        ? await driverApi.getTripMessages(selectedTripId)
        : await driverApi.getMessages();
      setMessages(res.data.data ?? []);
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTripId]);

  useFocusEffect(useCallback(() => { fetchMessages(); }, [fetchMessages]));

  useEffect(() => {
    const timer = setInterval(fetchMessages, 4000);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  const trips = useMemo(() => {
    const map = new Map();
    messages.forEach((item) => {
      const id = item.TripID;
      if (!map.has(id)) map.set(id, { id, lastAt: item.createdAt });
      else map.get(id).lastAt = item.createdAt;
    });
    return [...map.values()].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  }, [messages]);

  const visibleMessages = selectedTripId
    ? messages
    : messages.filter((item) => item.TripID === trips[0]?.id);
  const activeTripId = selectedTripId ?? trips[0]?.id;

  const send = async () => {
    if (!activeTripId || !text.trim()) return;
    setSending(true);
    try {
      await driverApi.sendTripMessage(activeTripId, { text: text.trim() });
      setText("");
      await fetchMessages();
    } catch (err) {
      Alert.alert("Lỗi", err.response?.data?.message ?? err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#1677ff" style={{ marginTop: 60 }} />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      {!selectedTripId && trips.length > 1 && (
        <View style={styles.tripTabs}>
          {trips.map((trip, index) => (
            <TouchableOpacity
              key={trip.id}
              style={[styles.tripTab, activeTripId === trip.id && styles.tripTabActive]}
              onPress={() => setSelectedTripId(trip.id)}
            >
              <Text style={[styles.tripTabText, activeTripId === trip.id && styles.tripTabTextActive]}>
                Chuyến {index + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        ref={flatListRef}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        style={styles.list}
        data={visibleMessages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={visibleMessages.length ? styles.listContent : styles.emptyWrap}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có tin nhắn từ dispatcher.</Text>}
        renderItem={({ item }) => {
          const mine = item.SenderType === "DRIVER";
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine && styles.bubbleMine]}>
                <Text style={[styles.messageText, mine && styles.messageTextMine]}>{item.Text}</Text>
                <Text style={[styles.messageMeta, mine && styles.messageMetaMine]}>
                  {item.SenderName || item.SenderType} · {formatTime(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Nhập tin nhắn trả lời..."
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending || !activeTripId) && styles.sendBtnDisabled]} disabled={!text.trim() || sending || !activeTripId} onPress={send}>
          <Text style={styles.sendText}>{sending ? "..." : "Gửi"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f0f2f5" },
  tripTabs: { flexDirection: "row", gap: 8, padding: 10, backgroundColor: "#fff" },
  tripTab: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#dbe3ef" },
  tripTabActive: { backgroundColor: "#1677ff", borderColor: "#1677ff" },
  tripTabText: { color: "#334155", fontWeight: "700", fontSize: 12 },
  tripTabTextActive: { color: "#fff" },
  list: { flex: 1 },
  listContent: { padding: 12 },
  emptyWrap: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  empty: { color: "#94a3b8", textAlign: "center" },
  bubbleRow: { alignItems: "flex-start", marginBottom: 8 },
  bubbleRowMine: { alignItems: "flex-end" },
  bubble: { maxWidth: "82%", backgroundColor: "#fff", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  bubbleMine: { backgroundColor: "#1677ff", borderColor: "#1677ff" },
  messageText: { color: "#0f172a", fontSize: 14 },
  messageTextMine: { color: "#fff" },
  messageMeta: { color: "#64748b", fontSize: 10, marginTop: 4 },
  messageMetaMine: { color: "rgba(255,255,255,.78)" },
  inputBar: { flexDirection: "row", gap: 8, padding: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  input: { flex: 1, minHeight: 42, maxHeight: 96, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: "#0f172a" },
  sendBtn: { alignSelf: "flex-end", backgroundColor: "#1677ff", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, minWidth: 64, justifyContent: "center", alignItems: "center" },
  sendBtnDisabled: { opacity: 0.45 },
  sendText: { color: "#fff", fontWeight: "800" },
});