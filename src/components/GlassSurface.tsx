import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  View,
  type ViewStyle,
} from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useTheme } from "./ui";

const glassAvailable = Platform.OS === "ios" && isLiquidGlassAvailable();

/** Liquid Glass is drawn only on iOS 26+ and while Reduce Transparency is off. */
export function useLiquidGlass() {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    if (!glassAvailable) return;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduce,
    );
    return () => sub.remove();
  }, []);
  return glassAvailable && !reduce;
}

export function GlassSurface({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const glass = useLiquidGlass();
  const base: ViewStyle = {
    borderRadius: 32,
    borderCurve: "continuous",
    padding: 5,
  };
  // The app has its own light/dark switch, so the glass follows the app
  // theme rather than the system one.
  if (glass)
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={t.dark ? "dark" : "light"}
        style={[base, style]}
      >
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

/** The moving tab indicator: a clear glass lens over the glass bar, like iOS 26 tab bars. */
export function GlassThumb() {
  const t = useTheme();
  return (
    <GlassView
      glassEffectStyle="clear"
      isInteractive
      colorScheme={t.dark ? "dark" : "light"}
      tintColor={t.dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.05)"}
      style={{ flex: 1, borderRadius: 25, borderCurve: "continuous" }}
    />
  );
}
