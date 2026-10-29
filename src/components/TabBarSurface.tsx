import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "./ui";
export function TabBarSurface({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: t.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </View>
  );
}
