import { useRef } from "react";
import { Animated, Pressable, View, type ViewStyle } from "react-native";
import { GlassView } from "expo-glass-effect";
import { Icon, useTheme } from "./ui";
import { useLiquidGlass } from "./GlassSurface";
import { useReducedMotion } from "./useReducedMotion";

const SIZE = 60;

/**
 * The floating "记一笔" button.
 *
 * On iOS 26 it is tinted interactive Liquid Glass: the system draws the
 * light along the rim and makes the button swell and spring back under the
 * finger, as Apple's own floating buttons do. Elsewhere a spring squeezes it
 * on press and lets it overshoot on release, and an inner highlight stands in
 * for the glass rim.
 */
export function FloatingAddButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const glass = useLiquidGlass();
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number, bounciness: number) =>
    Animated.spring(scale, {
      toValue,
      bounciness,
      speed: 18,
      useNativeDriver: true,
    }).start();
  const shadow = t.dark
    ? "0 8px 24px rgba(0,0,0,.30)"
    : "0 8px 24px rgba(0,0,0,.16)";
  return (
    <Animated.View
      style={[
        {
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          boxShadow: shadow,
          transform: [{ scale }],
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="记一笔"
        onPress={onPress}
        onPressIn={() => !glass && !reduced && spring(0.88, 0)}
        onPressOut={() => !glass && !reduced && spring(1, 14)}
        style={{ flex: 1 }}
      >
        {glass ? (
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            tintColor={t.primary}
            colorScheme={t.dark ? "dark" : "light"}
            style={{
              flex: 1,
              borderRadius: SIZE / 2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="plus" color={t.onPrimary} size={28} />
          </GlassView>
        ) : (
          <View
            style={{
              flex: 1,
              borderRadius: SIZE / 2,
              backgroundColor: t.primary,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.28)",
              // A bright top edge and a soft lower one read as light on a rim.
              boxShadow:
                "inset 0 1.5px 1px rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.12)",
            }}
          >
            <Icon name="plus" color={t.onPrimary} size={28} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
