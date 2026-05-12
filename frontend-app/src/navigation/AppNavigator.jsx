import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/driver";

import LoginScreen       from "../screens/LoginScreen";
import RouteListScreen   from "../screens/RouteListScreen";
import RouteDetailScreen from "../screens/RouteDetailScreen";
import StopDetailScreen  from "../screens/StopDetailScreen";
import PODScreen         from "../screens/PODScreen";
import MapScreen         from "../screens/MapScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { token, user, hydrated, hydrate, setUser } = useAuthStore();

  // Khôi phục token từ SecureStore khi khởi động
  useEffect(() => { hydrate(); }, []);

  // Sau khi có token, fetch thông tin user
  useEffect(() => {
    if (token && !user) {
      authApi.me()
        .then((res) => setUser(res.data.data?.user ?? res.data.data))
        .catch(() => {});
    }
  }, [token]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1677ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: "#1677ff" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "bold" },
        }}
      >
        {!token ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="RouteList"
              component={RouteListScreen}
              options={{ title: "Chuyến đi của tôi" }}
            />
            <Stack.Screen
              name="RouteDetail"
              component={RouteDetailScreen}
              options={{ title: "Chi tiết chuyến" }}
            />
            <Stack.Screen
              name="StopDetail"
              component={StopDetailScreen}
              options={{ title: "Điểm dừng" }}
            />
            <Stack.Screen
              name="POD"
              component={PODScreen}
              options={{ title: "Xác nhận giao hàng (ePOD)" }}
            />
            <Stack.Screen
              name="Map"
              component={MapScreen}
              options={{ title: "Bản đồ lộ trình" }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
