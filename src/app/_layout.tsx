import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useReducedMotion } from "../components/useReducedMotion";
import { SyncRunner } from "../components/SyncRunner";
import { isBudgetDemo, isLocalPreview } from "../demo/config";
import { useEffect } from "react";
import { AppState } from "react-native";
import { vaultAuthentication } from "../state/vault";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LedgerProvider } from "../components/LedgerProvider";
import { useTheme } from "../components/ui";
export default function RootLayout() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      vaultAuthentication.change(state);
    });
    return () => listener.remove();
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LedgerProvider>
          {!isBudgetDemo && !isLocalPreview && <SyncRunner />}
          <StatusBar style={t.dark ? "light" : "dark"} />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: reducedMotion ? "fade" : "default",
              contentStyle: { backgroundColor: t.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="entry" options={{ presentation: "modal" }} />
            <Stack.Screen name="refund" options={{ presentation: "modal" }} />
            <Stack.Screen name="account" options={{ presentation: "modal" }} />
            <Stack.Screen name="categories" />
          </Stack>
        </LedgerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
