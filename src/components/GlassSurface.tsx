import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  View,
  type ViewStyle,
} from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useTheme } from "./ui";
export function GlassSurface({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduce,
    );
    return () => sub.remove();
  }, []);
  const base: ViewStyle = {
    borderRadius: 32,
    borderCurve: "continuous",
    padding: 5,
  };
  if (Platform.OS === "ios" && isLiquidGlassAvailable() && !reduce)
    return (
      <GlassView glassEffectStyle="regular" style={[base, style]}>
        {children}
      </GlassView>
    );
  return (
    <View
      style={[
        base,
        {
          backgroundColor: t.card,
          boxShadow: "0 3px 18px rgba(0,0,0,0.08)",
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
