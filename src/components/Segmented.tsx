import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";
import { Txt, useTheme, Icon } from "./ui";
import { useReducedMotion } from "./useReducedMotion";
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  compact = false,
}: {
  compact?: boolean;
  value: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (value: T) => void;
}) {
  const t = useTheme(),
    reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
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
    <View style={{ backgroundColor: t.soft, borderRadius: 28, padding: compact ? 2 : 4 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
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
              borderRadius: 25,
              backgroundColor: t.dark ? t.selected : t.card,
              boxShadow: "0 2px 5px rgba(0,0,0,0.07)",
              transform: [{ translateX: x }],
            }}
          />
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
              minHeight: compact ? 28 : o.icon ? 58 : 44,
              paddingVertical: compact ? 4 : 8,
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
              color={value === o.value ? t.onSelected : t.muted}
            >
              {o.label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
