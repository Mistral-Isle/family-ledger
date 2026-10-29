import { SyncRunner } from "../components/SyncRunner";
import { useEffect } from "react";
import { AppState } from "react-native";
import { useVault } from "../state/vault";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LedgerProvider } from "../components/LedgerProvider";
import { useTheme } from "../components/ui";
export default function RootLayout() {
  const t = useTheme();
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") useVault.getState().setUnlocked(false);
    });
    return () => listener.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <LedgerProvider>
        <SyncRunner />
        <StatusBar style={t.dark ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
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
  );
}
