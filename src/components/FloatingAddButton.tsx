import { useRef } from "react";
import { Animated, Pressable, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
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
 * light rim, a top sheen and a soft lower shade, drawn as a vector layer so
 * they are there from the first frame (an inset box shadow only showed up
 * once a press redrew the button). A spring squeezes it under the finger and
 * lets it overshoot on release, with a haptic tap as the finger lifts.
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
        onPress={() => {
          buttonFeedback();
          onPress();
        }}
        onPressIn={() => {
          if (!reduced) spring(0.86, 0);
        }}
        onPressOut={() => {
          if (!reduced) spring(1, 16);
        }}
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: t.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GlassRim />
        <Icon name="plus" color={t.onPrimary} size={28} />
      </Pressable>
    </Animated.View>
  );
}

/** A bright upper rim, a sheen fading down and a soft lower shade: light on glass. */
function GlassRim() {
  const r = SIZE / 2;
  return (
    <Svg
      pointerEvents="none"
      width={SIZE}
      height={SIZE}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        <LinearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.24} />
          <Stop offset="0.5" stopColor="#fff" stopOpacity={0} />
          <Stop offset="0.72" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.16} />
        </LinearGradient>
        <LinearGradient id="rim" x1="0.3" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.85} />
          <Stop offset="0.45" stopColor="#fff" stopOpacity={0.12} />
          <Stop offset="0.8" stopColor="#fff" stopOpacity={0.08} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0.4} />
        </LinearGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill="url(#sheen)" />
      <Circle cx={r} cy={r} r={r - 0.9} fill="none" stroke="url(#rim)" strokeWidth={1.4} />
    </Svg>
  );
}
