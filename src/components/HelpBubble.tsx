import { useRef, useState, useEffect, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormScrollView, Icon, Txt, useTheme } from "./ui";
import { useReducedMotion } from "./useReducedMotion";

/** Anchored, dismissible explanations and contextual menus share one surface. */
export function Popover({
  label,
  icon = "ellipsis",
  active = false,
  triggerText,
  compact = false,
  disclosure = false,
  triggerContent,
  menuWidth = 320,
  align = "end",
  contentStyle,
  animated = true,
  scroll = true,
  children,
}: {
  label: string;
  icon?: string;
  active?: boolean;
  triggerText?: string;
  compact?: boolean;
  disclosure?: boolean;
  /**
   * A custom trigger. Pass a function to draw the pressed state yourself (a
   * help label highlights only its "?"); plain content dims while pressed,
   * because a fill behind a text label would hug the letters.
   */
  triggerContent?: ReactNode | ((pressed: boolean) => ReactNode);
  menuWidth?: number;
  align?: "start" | "end";
  contentStyle?: StyleProp<ViewStyle>;
  animated?: boolean;
  /** Short menus lay out at their own height instead of inside a scroller. */
  scroll?: boolean;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const trigger = useRef<View>(null);
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    height: number;
  } | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const close = () => {
    closing.current = true;
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0, duration: animated ? (reduced ? 100 : 160) : 0,
      easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setAnchor(null); });
  };
  const reveal = () => {
    closing.current = false;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1, duration: animated ? (reduced ? 100 : 240) : 0,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  };
  useEffect(() => () => progress.stopAnimation(), [progress]);
  const [keyboard, setKeyboard] = useState(0);
  const open = !!anchor;
  useEffect(() => {
    if (!open) return;
    const ios = Platform.OS === "ios";
    const shown = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height));
    const hidden = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(0));
    return () => { shown.remove(); hidden.remove(); setKeyboard(0); };
  }, [open]);
  useEffect(() => {
    if (!anchor || Platform.OS !== "web") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [anchor]);
  const bubbleWidth = Math.min(menuWidth, width - 32);
  const below = anchor ? anchor.y < height * 0.55 : true;
  return (
    <>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: !!anchor }}
        aria-expanded={!!anchor}
        onPress={() =>
          trigger.current?.measureInWindow((x, y, _w, h) =>
            setAnchor({ x, y, height: h }),
          )
        }
        style={({ pressed }) => ({
          minWidth: 44,
          minHeight: compact ? 30 : 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          paddingHorizontal: triggerText ? 10 : 0,
          backgroundColor:
            triggerContent === undefined && (pressed || active || compact)
              ? t.soft
              : "transparent",
          opacity:
            pressed && triggerContent !== undefined && typeof triggerContent !== "function"
              ? 0.6
              : 1,
        })}
      >
        {({ pressed }) =>
          typeof triggerContent === "function" ? triggerContent(pressed) : triggerContent ??
          (triggerText ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <Txt
                size={compact ? 13 : 15}
                bold
                style={{ textAlign: "center" }}
              >
                {triggerText}
              </Txt>
              {disclosure && (
                <Icon name="chevron.down" size={11} color={t.muted} />
              )}
            </View>
          ) : (
            <Icon
              name={icon}
              size={icon === "questionmark.circle" ? 18 : 22}
              color={active ? t.blue : t.muted}
            />
          ))
        }
      </Pressable>
      <Modal
        visible={!!anchor}
        transparent
        animationType="none"
        onShow={reveal}
        onRequestClose={close}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭气泡"
            onPress={close}
            style={{ position: "absolute", inset: 0 }}
          />
          {anchor && (
            <Animated.View
              onLayout={() => { if (!closing.current) reveal(); }}
              accessibilityViewIsModal
              style={{
                opacity: progress,
                transform: reduced || !animated ? [] : [
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [below ? -8 : 8, 0] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
                ],
                transformOrigin: align === "start" ? (below ? "top left" : "bottom left") : (below ? "top right" : "bottom right"),
                position: "absolute",
                left: Math.max(
                  16,
                  Math.min(
                    align === "start" ? anchor.x : anchor.x - bubbleWidth + 44,
                    width - bubbleWidth - 16,
                  ),
                ),
                // An input inside the bubble would otherwise sit behind the keyboard.
                ...(keyboard
                  ? { bottom: keyboard + 8 }
                  : below
                  ? {
                      top: Math.max(
                        insets.top + 8,
                        anchor.y + anchor.height + 6,
                      ),
                    }
                  : {
                      bottom: Math.max(
                        insets.bottom + 8,
                        height - anchor.y + 6,
                      ),
                    }),
                width: bubbleWidth,
                maxHeight: !scroll ? undefined : keyboard ? Math.max(120, height - keyboard - insets.top - 16) : Math.max(
                  120,
                  (below
                    ? height - anchor.y - anchor.height - insets.bottom
                    : anchor.y - insets.top) - 24,
                ),
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: t.card,
                borderColor: t.line,
                borderWidth: 1,
                boxShadow: "0 10px 40px rgba(0,0,0,0.16)",
                overflow: "hidden",
              }}
            >
              {scroll ? (
                <FormScrollView
                  contentContainerStyle={[{ padding: 18, gap: 12 }, contentStyle]}
                >
                  {typeof children === "function" ? children(close) : children}
                </FormScrollView>
              ) : (
                <View style={[{ padding: 18, gap: 12 }, contentStyle]}>
                  {typeof children === "function" ? children(close) : children}
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </Modal>
    </>
  );
}

export function HelpBubble({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <Popover label={`${label}说明`} icon="questionmark.circle">
      <Txt size={14}>{children}</Txt>
    </Popover>
  );
}

/**
 * A text label followed by a "?" that opens an explanation. The whole label is
 * the tap target, but only the "?" lights up, inside its own round backing,
 * so the highlight never presses against the words.
 */
export function HelpLabel({
  pressed,
  children,
  color,
  size = 12,
  iconSize = 14,
}: {
  pressed: boolean;
  children: ReactNode;
  color?: string;
  size?: number;
  iconSize?: number;
}) {
  const t = useTheme();
  const disc = iconSize + 12;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 1, flexShrink: 1 }}>
      <Txt size={size} color={color ?? t.muted} style={{ flexShrink: 1 }}>
        {children}
      </Txt>
      <View
        style={{
          width: disc,
          height: disc,
          borderRadius: disc / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? t.soft : "transparent",
        }}
      >
        <Icon name="questionmark.circle" size={iconSize} color={pressed ? t.text : t.muted} />
      </View>
    </View>
  );
}
