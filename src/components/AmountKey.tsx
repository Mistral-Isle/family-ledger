import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, View, type ViewStyle } from "react-native";
import { amountKeyFeedback } from "../services/amountKeyFeedback";

/**
 * One key of the amount keypad.
 *
 * Pressable answers through React Native's single-responder system: while one
 * finger is still on a key, a second finger landing on another key is ignored,
 * so quick typing (two thumbs, or the next tap arriving before the last one
 * lifts) silently dropped digits. Raw touch events reach every key on its own,
 * so a key now registers the moment it is touched, like a calculator.
 * VoiceOver activates through onAccessibilityTap; the web preview keeps
 * Pressable because browsers send mouse rather than touch events.
 */
export function AmountKey({
  label,
  hint,
  onPress,
  onLongPress,
  style,
  pressedStyle,
  children,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  onLongPress?: () => void;
  style: ViewStyle;
  pressedStyle: ViewStyle;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  const touches = useRef(new Set<number>());
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearLong = () => {
    if (longTimer.current) clearTimeout(longTimer.current);
    longTimer.current = null;
  };
  useEffect(() => clearLong, []);
  if (Platform.OS === "web")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        onPress={onPress}
        delayLongPress={450}
        onLongPress={onLongPress}
        style={({ pressed: down }) => [style, down && pressedStyle]}
      >
        {children}
      </Pressable>
    );
  const release = (ids: number[]) => {
    ids.forEach((id) => touches.current.delete(id));
    if (touches.current.size) return;
    clearLong();
    setPressed(false);
  };
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onAccessibilityTap={onPress}
      onTouchStart={(e) => {
        // A touch that began on this key is reported once, however many
        // other fingers are down elsewhere on the keypad.
        // Two fingers landing in the same frame arrive together, so keep
        // only the touches that started on this key.
        const changed = e.nativeEvent.changedTouches;
        const mine = changed.filter(
          (touch) => String(touch.target) === String(e.nativeEvent.target),
        );
        const fresh = (mine.length || changed.length !== 1 ? mine : changed)
          .filter((touch) => !touches.current.has(Number(touch.identifier)));
        if (!fresh.length) return;
        fresh.forEach((touch) => touches.current.add(Number(touch.identifier)));
        amountKeyFeedback();
        setPressed(true);
        onPress();
        if (onLongPress) {
          clearLong();
          longTimer.current = setTimeout(() => {
            longTimer.current = null;
            onLongPress();
          }, 450);
        }
      }}
      onTouchEnd={(e) =>
        release(e.nativeEvent.changedTouches.map((t) => Number(t.identifier)))
      }
      onTouchCancel={(e) =>
        release(e.nativeEvent.changedTouches.map((t) => Number(t.identifier)))
      }
      style={[style, pressed && pressedStyle]}
    >
      {children}
    </View>
  );
}
