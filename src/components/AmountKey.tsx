import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, View, type ViewStyle } from "react-native";
import { amountKeyFeedback } from "../services/amountKeyFeedback";

const MIN_PRESSED_MS = 110;

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
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressedAt = useRef(0);
  const clearLong = () => {
    if (longTimer.current) clearTimeout(longTimer.current);
    longTimer.current = null;
  };
  const clearLift = () => {
    if (liftTimer.current) clearTimeout(liftTimer.current);
    liftTimer.current = null;
  };
  useEffect(() => () => { clearLong(); clearLift(); }, []);
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
    // A quick tap lifts within a few milliseconds; keep the pressed look on
    // screen long enough to be seen, as Pressable does.
    const left = MIN_PRESSED_MS - (Date.now() - pressedAt.current);
    clearLift();
    if (left > 0) liftTimer.current = setTimeout(() => setPressed(false), left);
    else setPressed(false);
  };
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onAccessibilityTap={onPress}
      onTouchStart={(e) => {
        // Every touch in a touch-start has just begun. Two fingers landing in
        // the same frame arrive together, so keep only those on this key.
        const changed = e.nativeEvent.changedTouches;
        const mine = changed.filter(
          (touch) => String(touch.target) === String(e.nativeEvent.target),
        );
        const fresh = mine.length || changed.length !== 1 ? mine : changed;
        if (!fresh.length) return;
        // Ids are reused once a finger lifts; drop any this key still holds
        // that are off the screen, so a missed lift cannot keep it pressed.
        const active = new Set(
          e.nativeEvent.touches.map((touch) => Number(touch.identifier)),
        );
        touches.current.forEach((id) => {
          if (!active.has(id)) touches.current.delete(id);
        });
        fresh.forEach((touch) => touches.current.add(Number(touch.identifier)));
        amountKeyFeedback();
        clearLift();
        pressedAt.current = Date.now();
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
