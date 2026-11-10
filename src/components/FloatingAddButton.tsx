import { useRef } from "react";
import { Animated, Pressable, type ViewStyle } from "react-native";
import { Icon, useTheme } from "./ui";
import { useReducedMotion } from "./useReducedMotion";
import { buttonFeedback } from "../services/amountKeyFeedback";

const SIZE = 60;

/**
 * The floating "记一笔" button.
 *
 * It keeps the solid theme color: tinted Liquid Glass blends with whatever
 * scrolls behind it, which turned the button a different color from the rest
 * of the theme and drew a second ring inside it. The glass look comes from a
 * light rim and a soft inner shade instead; a spring squeezes it under the
 * finger and lets it overshoot on release, with a haptic tap on touch.
 */
export function FloatingAddButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (toValue: number, bounciness: number) =>
    Animated.spring(scale, {
      toValue,
      bounciness,
      speed: 20,
      useNativeDriver: true,
    }).start();
  return (
    <Animated.View
      style={[
        {
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          transform: [{ scale }],
          boxShadow: t.dark
            ? "0 8px 22px rgba(0,0,0,.32)"
            : "0 8px 22px rgba(0,0,0,.18)",
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="记一笔"
        onPress={onPress}
        onPressIn={() => {
          buttonFeedback();
          if (!reduced) spring(0.86, 0);
        }}
        onPressOut={() => {
          if (!reduced) spring(1, 16);
        }}
        style={{
          flex: 1,
          borderRadius: SIZE / 2,
          backgroundColor: t.primary,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.30)",
          // A bright upper rim and a soft lower shade read as light on glass.
          boxShadow:
            "inset 0 1.5px 1.5px rgba(255,255,255,0.50), inset 0 -3px 6px rgba(0,0,0,0.14)",
        }}
      >
        <Icon name="plus" color={t.onPrimary} size={28} />
      </Pressable>
    </Animated.View>
  );
}
