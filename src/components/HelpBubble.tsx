import { useRef, useState, useEffect, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Txt, useTheme } from "./ui";
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
  children,
}: {
  label: string;
  icon?: string;
  active?: boolean;
  triggerText?: string;
  compact?: boolean;
  disclosure?: boolean;
  triggerContent?: ReactNode;
  menuWidth?: number;
  align?: "start" | "end";
  contentStyle?: StyleProp<ViewStyle>;
  animated?: boolean;
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
            pressed || active || compact ? t.soft : "transparent",
        })}
      >
        {triggerContent ??
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
          ))}
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
                ...(below
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
                maxHeight: Math.max(
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
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[{ padding: 18, gap: 12 }, contentStyle]}
              >
                {typeof children === "function" ? children(close) : children}
              </ScrollView>
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
