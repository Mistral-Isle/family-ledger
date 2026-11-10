import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";
import { Txt, useTheme, Icon } from "./ui";
import { useReducedMotion } from "./useReducedMotion";
import { GlassView } from "expo-glass-effect";
import { GlassSurface, useLiquidGlass } from "./GlassSurface";

/**
 * The tab bar. Its thumb follows the iOS 26 segmented control used on the
 * statistics page: a plain pill at rest that swells into a Liquid Glass
 * bubble while a finger is on the bar, then springs back when it lifts.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (value: T) => void;
}) {
  const t = useTheme(),
    reduced = useReducedMotion(),
    glass = useLiquidGlass();
  const [width, setWidth] = useState(0);
  const [held, setHeld] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const hold = (on: boolean) => {
    if (on === held) return;
    setHeld(on);
    if (reduced) return lift.setValue(on ? 1 : 0);
    Animated.spring(lift, {
      toValue: on ? 1 : 0,
      useNativeDriver: true,
      ...(on ? { speed: 28, bounciness: 6 } : { speed: 14, bounciness: 12 }),
    }).start();
  };
  // At rest the pill matches the system segmented control: white in light,
  // a soft grey in dark. Without glass the bar itself is white, so the pill
  // keeps the theme's tinted fill.
  const thumb = glass
    ? t.dark
      ? "rgba(255,255,255,0.17)"
      : "#FFFFFF"
    : t.selected;
  // Selected labels take the theme color; only the dark fallback pill is
  // itself filled with that color, so its label stays white.
  const active = t.dark && !glass ? t.onSelected : t.blue;
  const step = width / options.length,
    index = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
  useEffect(() => {
    if (reduced) x.setValue(index * step);
    else
      Animated.spring(x, {
        toValue: index * step,
        useNativeDriver: true,
        damping: 27,
        stiffness: 170,
        mass: 1,
      }).start();
  }, [index, step, reduced, x]);
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: () => x.stopAnimation(),
    onPanResponderMove: (_, g) =>
      x.setValue(Math.max(0, Math.min(width - step, index * step + g.dx))),
    onPanResponderRelease: (_, g) => {
      const target = Math.max(
        0,
        Math.min(options.length - 1, Math.round(index + g.dx / (step || 1))),
      );
      onChange(options[target]!.value);
      Animated.spring(x, {
        toValue: target * step,
        useNativeDriver: true,
        damping: 27,
        stiffness: 170,
      }).start();
    },
    onPanResponderTerminate: () => x.setValue(index * step),
  });
  return (
    <GlassSurface>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onTouchStart={() => hold(true)}
        onTouchEnd={(e) => {
          if (!e.nativeEvent.touches.length) hold(false);
        }}
        onTouchCancel={() => hold(false)}
        {...pan.panHandlers}
        style={{ flexDirection: "row" }}
      >
        {!!width && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: step,
              transform: [
                { translateX: x },
                { scaleX: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
                { scaleY: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
              ],
            }}
          >
            <Animated.View
              style={{
                flex: 1,
                borderRadius: 25,
                borderCurve: "continuous",
                backgroundColor: thumb,
                // The fill thins out while held so the bubble reads as glass.
                opacity: glass
                  ? lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] })
                  : 1,
                boxShadow: t.dark
                  ? undefined
                  : held
                    ? "0 4px 14px rgba(0,0,0,0.16)"
                    : "0 1px 5px rgba(0,0,0,0.10)",
              }}
            />
            {glass && held && (
              <GlassView
                glassEffectStyle="clear"
                isInteractive
                colorScheme={t.dark ? "dark" : "light"}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  borderRadius: 25,
                  borderCurve: "continuous",
                }}
              />
            )}
          </Animated.View>
        )}
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: value === o.value }}
            aria-selected={value === o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: o.icon ? 62 : 44,
              paddingVertical: 8,
              paddingHorizontal: 4,
              gap: 3,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            {o.icon && (
              <Icon
                name={o.icon}
                size={24}
                color={value === o.value ? active : t.muted}
              />
            )}
            <Txt
              size={o.icon ? 12 : 13}
              bold={o.value === value}
              color={value === o.value ? active : t.muted}
            >
              {o.label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </GlassSurface>
  );
}
