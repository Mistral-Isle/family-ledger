import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { useTheme } from "./ui";
export function GlassSurface({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: 32,
          padding: 5,
          backgroundColor: t.dark ? t.card : "rgba(255,255,255,.92)",
          boxShadow: "0 3px 18px rgba(0,0,0,.08)",
          borderWidth: 1,
          borderColor: t.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
