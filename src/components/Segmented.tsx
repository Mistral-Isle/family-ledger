import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";
import { Txt, useTheme, Icon } from "./ui";
import { useReducedMotion } from "./useReducedMotion";
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  compact = false,
  height,
}: {
  compact?: boolean;
  height?: number;
  value: T;
  options: { value: T; label: string; icon?: string; accessibilityLabel?: string }[];
  onChange: (value: T) => void;
}) {
  const t = useTheme(),
    reduced = useReducedMotion();
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
      ...(on ? { speed: 28, bounciness: 6 } : { speed: 14, bounciness: 10 }),
    }).start();
  };
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
        damping: 24,
        stiffness: 260,
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
        damping: 24,
        stiffness: 260,
      }).start();
    },
    onPanResponderTerminate: () => x.setValue(index * step),
  });
  return (
    <View
      style={{
        backgroundColor: t.soft,
        borderRadius: 999,
        padding: compact ? 2 : 4,
      }}
    >
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onTouchStart={() => hold(true)}
        onTouchEnd={() => hold(false)}
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
              borderRadius: 999,
              borderCurve: "continuous",
              borderWidth: 0.5,
              borderColor: t.dark
                ? "rgba(255,255,255,0.16)"
                : "rgba(255,255,255,0.85)",
              backgroundColor: t.dark
                ? t.selected
                : held
                  ? "rgba(255,255,255,0.88)"
                  : t.card,
              boxShadow: held
                ? "0 4px 14px rgba(0,0,0,0.14)"
                : "0 2px 5px rgba(0,0,0,0.07)",
              transform: [
                { translateX: x },
                { scaleX: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
                { scaleY: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
              ],
            }}
          />
        )}
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{ selected: value === o.value }}
            aria-selected={value === o.value}
            onPress={() => onChange(o.value)}
            onPressIn={() => hold(true)}
            onPressOut={() => hold(false)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: height ? height - (compact ? 4 : 8) : compact ? 28 : o.icon ? 58 : 44,
              paddingVertical: compact || height ? 4 : 8,
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
                size={21}
                color={
                  value === o.value ? (t.dark ? t.onSelected : t.blue) : t.muted
                }
              />
            )}
            <Txt
              size={compact ? 13 : o.icon ? 10 : 15}
              bold={o.value === value}
              color={
                value === o.value ? (t.dark ? t.onSelected : t.blue) : t.muted
              }
            >
              {o.label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
