import {
  categoryIconPaths,
  categoryIconAliases,
} from "../domain/categoryIcons";
import React, { useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";
import { SymbolView } from "expo-symbols";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUi } from "../state/ui";
import { zh } from "../i18n/zh";
import { isBudgetDemo } from "../demo/config";
export const blue = "#007AFF";
export const coral = "#D9363E";
export function useTheme() {
  const system = useColorScheme();
  const preference = useUi((s) => s.theme);
  const appearance = useUi((s) => s.appearance);
  const dark =
    appearance === "ink" ||
    (preference === "system" ? system : preference) === "dark";
  const warm = appearance === "warm";
  return {
    dark,
    bg: dark ? "#101114" : warm ? "#F5F1EA" : "#F2F2F7",
    card: dark ? "#1D2026" : warm ? "#FFFDFA" : "#FFFFFF",
    text: dark ? "#F5F5F7" : "#1C1C1E",
    muted: dark ? "#ABABB2" : "#67676F",
    line: dark ? "#38383A" : warm ? "#DDD3C5" : "#E5E5EA",
    soft: dark ? "#2B3039" : warm ? "#EDE5D9" : "#E9E9EF",
    blue: dark ? "#9CBFFF" : warm ? "#8B6844" : blue,
    green: dark ? "#6BDA89" : "#247342",
  };
}
const symbols = [
  "clock",
  "delete.left",
  "calendar",
  "questionmark.circle",
  "book.closed.fill",
  "list.bullet",
  "chart.bar.fill",
  "plus",
  "creditcard.fill",
  "person.crop.circle",
  "chevron.down",
  "circle",
  "checkmark.circle.fill",
  "chevron.left",
  "chevron.right",
  "xmark",
  "ellipsis",
  "checkmark",
  "arrow.left.arrow.right",
  "magnifyingglass",
  "arrow.up.right",
  "arrow.down.left",
  "pencil",
  "trash",
  "pin.fill",
  "lock.fill",
  "cloud",
  "moon.fill",
  "sun.max.fill",
  "gearshape.fill",
  "arrow.up",
  "arrow.down",
  "fork.knife",
  "cup.and.saucer.fill",
  "birthday.cake.fill",
  "cart.fill",
  "basket.fill",
  "pawprint.fill",
  "cross.case.fill",
  "tram.fill",
  "car.side.fill",
  "airplane",
  "fuelpump.fill",
  "parkingsign.circle.fill",
  "wrench.and.screwdriver.fill",
  "shield.fill",
  "building.columns.fill",
  "house.fill",
  "bolt.fill",
  "iphone",
  "sparkles",
  "gamecontroller.fill",
  "film.fill",
  "suitcase.fill",
  "envelope.fill",
  "person.2.fill",
  "gift.fill",
  "book.fill",
  "shippingbox.fill",
  "banknote.fill",
  "star.fill",
  "envelope.open.fill",
  "chart.line.uptrend.xyaxis",
  "plus.circle.fill",
] as const;
export type IconName = (typeof symbols)[number];
const paths: Record<string, string> = {
  "suitcase.fill": "M8 5V3H16V5M4 5H20V21H4ZM8 5V21M16 5V21",
  clock: "M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12ZM12 6V12L16 14",
  "sun.max.fill":
    "M16 12a4 4 0 11-8 0 4 4 0 018 0M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  calendar:
    "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M8 14h.1M12 14h.1M16 14h.1M8 18h.1M12 18h.1",
  "questionmark.circle":
    "M22 12a10 10 0 11-20 0 10 10 0 0120 0M9 8a3 3 0 016 0c0 2-3 2-3 5M12 17h.1",
  plus: "M12 5v14M5 12h14",
  xmark: "M6 6l12 12M6 18L18 6",
  ellipsis: "M4 12h.1M12 12h.1M20 12h.1",
  checkmark: "M5 12l4 4L19 6",
  "chevron.left": "M15 5l-7 7 7 7",
  "chevron.right": "M9 5l7 7-7 7",
  "book.closed.fill": "M5 3h14v18H5a2 2 0 010-4h14M5 3v14M9 7h6",
  "book.fill": "M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3zM12 6v15",
  "list.bullet": "M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1",
  "chart.bar.fill": "M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7",
  "chevron.down": "M6 9L12 15L18 9",
  circle: "M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12Z",
  "checkmark.circle.fill":
    "M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12ZM7 12L10 15L17 8",
  "delete.left":
    "M9 5H20Q22 5 22 7V17Q22 19 20 19H9Q8 19 7 18L2 13Q1 12 2 11L7 6Q8 5 9 5M12 9L18 15M18 9L12 15",
  "creditcard.fill": "M3 5h18v14H3zM3 9h18M6 15h4",
  "person.crop.circle":
    "M20 21v-3a6 6 0 00-6-6h-4a6 6 0 00-6 6v3M16 5a4 4 0 11-8 0 4 4 0 018 0",
  "arrow.left.arrow.right": "M4 7h16l-4-4M20 17H4l4 4M20 7l-4 4M4 17l4-4",
  magnifyingglass: "M21 21l-6-6M17 10a7 7 0 11-14 0 7 7 0 0114 0",
  "arrow.up.right": "M6 18L18 6M6 6h12v12",
  "arrow.down.left": "M18 6L6 18M6 6v12h12",
  pencil: "M4 16L16 4l4 4L8 20H4zM14 6l4 4",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  "arrow.up": "M12 20V4M5 11l7-7 7 7",
  "arrow.down": "M12 4v16M5 13l7 7 7-7",
  "fork.knife": "M4 3v6a3 3 0 006 0V3M7 3v18M19 3c-4 3-4 9 0 9V3v18",
  "cup.and.saucer.fill":
    "M3 6h13v8a5 5 0 01-5 5H8a5 5 0 01-5-5zM16 7h2a3 3 0 010 6h-2M2 22h17",
  "house.fill": "M3 10l9-7 9 7M5 9v12h14V9M9 21v-8h6v8",
  "cart.fill": "M2 3h3l3 13h11l3-10H6M10 21h.1M18 21h.1",
  "car.side.fill":
    "M3 10l3-5h11l3 5v8H3zM3 10h17M6 18v3M17 18v3M6 14h1M16 14h1",
  "tram.fill":
    "M6 3h12v15H6zM6 11h12M9 3v8M7 22l3-4M17 22l-3-4M9 15h.1M15 15h.1",
  "banknote.fill":
    "M2 5h20v14H2zM9 12a3 3 0 106 0 3 3 0 10-6 0M5 9h.1M19 15h.1",
  "gift.fill":
    "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8C4-3 1 9 12 8c11 1 8-11 0 0",
  "envelope.fill": "M2 5h20v14H2zM2 5l10 8L22 5",
  "star.fill": "M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z",
  sparkles: "M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3zM21 2v4M19 4h4",
  "lock.fill": "M5 10h14v11H5zM8 10V6a4 4 0 018 0v4M12 14v3",
  cloud: "M5 18a4 4 0 010-8 7 7 0 0113-2 5 5 0 010 10z",
  "pin.fill": "M8 3h8l-1 7 4 3v2H5v-2l4-3zM12 15v7",
  "gearshape.fill":
    "M9 2H15L15.5 4.5L17 5.4L19.4 4.6L22.4 9.8L20.5 11.5V13L22.4 14.7L19.4 19.9L17 19.1L15.5 20L15 22.5H9L8.5 20L7 19.1L4.6 19.9L1.6 14.7L3.5 13V11.5L1.6 9.8L4.6 4.6L7 5.4L8.5 4.5ZM16 12.25A4 4 0 1 1 8 12.25A4 4 0 1 1 16 12.25Z",
};
export function Icon({
  name,
  size = 22,
  color = blue,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const customPath =
    categoryIconPaths[name] ??
    categoryIconPaths["category:" + categoryIconAliases[name]];
  if (customPath)
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={customPath}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  const valid = symbols.find((s) => s === name) ?? "sparkles";
  if (Platform.OS === "ios")
    return (
      <SymbolView
        name={valid}
        tintColor={color}
        size={size}
        weight="semibold"
        style={{ width: size, height: size }}
      />
    );
  const d =
    paths[name] ??
    (name.includes("book")
      ? paths["book.fill"]
      : name.includes("bank")
        ? paths["banknote.fill"]
        : paths["sparkles"]);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={d}
        stroke={color}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
export const iconOptions: IconName[] = [
  "fork.knife",
  "cup.and.saucer.fill",
  "cart.fill",
  "tram.fill",
  "car.side.fill",
  "house.fill",
  "gift.fill",
  "book.fill",
  "banknote.fill",
  "star.fill",
  "sparkles",
  "pawprint.fill",
];
export function Txt({
  children,
  size = 15,
  bold = false,
  color,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  bold?: boolean;
  color?: string;
  style?: object;
}) {
  const t = useTheme();
  return (
    <Text
      style={[
        {
          fontSize: size,
          lineHeight: size * (size >= 28 ? 1.15 : 1.45),
          letterSpacing: size >= 28 ? -0.6 : 0,
          fontVariant: ["tabular-nums"],
          color: color ?? t.text,
          fontWeight: bold ? "600" : "400",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Page({
  children,
  scroll = true,
  footer,
  revealSearch,
  searchActive = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  revealSearch?: React.ReactNode;
  searchActive?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const searchPositioned = useRef(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const content = (
    <View
      style={{
        width: "100%",
        maxWidth: 760,
        alignSelf: "center",
        paddingHorizontal: 20,
        paddingTop: revealSearch ? 20 : insets.top + 20,
        paddingBottom: footer ? 24 : 180 + insets.bottom,
        gap: 20,
      }}
    >
      {isBudgetDemo && (
        <View
          style={{
            padding: 12,
            borderRadius: 14,
            backgroundColor: t.soft,
            gap: 4,
          }}
        >
          <Txt bold size={12} color={t.blue}>
            示例账本 · 可放心体验
          </Txt>
          <Txt size={12} color={t.muted}>
            包含固定支出与日常消费，数据独立保存。
          </Txt>
        </View>
      )}
      {children}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {scroll ? (
        <ScrollView
          ref={scroller}
          onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, height) => {
            if (
              revealSearch &&
              viewportHeight > 0 &&
              height >= viewportHeight + 63 &&
              !searchPositioned.current
            ) {
              searchPositioned.current = true;
              scroller.current?.scrollTo({
                y: searchActive ? 0 : 64,
                animated: false,
              });
            }
          }}
          contentOffset={
            revealSearch && !searchActive ? { x: 0, y: 64 } : undefined
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            minHeight: revealSearch ? viewportHeight + 64 : undefined,
          }}
          style={{ flex: 1 }}
        >
          {revealSearch && (
            <View
              style={{
                height: 64 + insets.top,
                paddingHorizontal: 20,
                paddingTop: insets.top + 4,
                maxWidth: 760,
                width: "100%",
                alignSelf: "center",
              }}
            >
              {revealSearch}
            </View>
          )}
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {footer && (
        <View
          style={{
            backgroundColor: t.card,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 760,
              alignSelf: "center",
              paddingHorizontal: 16,
              paddingTop: 12,
              gap: 10,
            }}
          >
            {footer}
          </View>
        </View>
      )}
    </View>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: 26,
          borderCurve: "continuous",
          padding: 20,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, style]}
    >
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: secondary ? t.soft : t.blue,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 24,
        borderCurve: "continuous",
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
        minHeight: 48,
        flexShrink: 1,
      })}
    >
      {icon && (
        <Icon name={icon} color={secondary ? t.blue : "#fff"} size={18} />
      )}
      <Txt bold color={secondary ? t.blue : "#fff"}>
        {label}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color,
}: {
  name: string;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 11,
        minWidth: 44,
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: pressed ? t.soft : "transparent",
      })}
    >
      <Icon name={name} color={color ?? t.muted} size={20} />
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      aria-selected={!!selected}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? t.blue : pressed ? t.soft : t.card,
        borderRadius: 14,
        borderCurve: "continuous",
        minHeight: 44,
        justifyContent: "center",
        paddingVertical: 10,
        paddingHorizontal: 14,
      })}
    >
      <Txt
        size={13}
        color={selected ? (t.dark ? "#000" : "#fff") : t.text}
        bold={selected}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Txt size={12} color={t.muted}>
        {label}
      </Txt>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        style={[
          styles.input,
          { backgroundColor: t.card, borderColor: t.line, color: t.text },
          props.style,
        ]}
      />
    </View>
  );
}
export function Heading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: 5 }}>
        <Txt size={34} bold>
          {title}
        </Txt>
        {subtitle && (
          <Txt size={12} color={t.muted}>
            {subtitle}
          </Txt>
        )}
      </View>
      {action}
    </Row>
  );
}
export function ErrorText({ message }: { message: string }) {
  return message ? (
    <Txt size={13} color={coral}>
      {message}
    </Txt>
  ) : null;
}
export function confirmAction(
  title: string,
  message: string,
  action: () => void,
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) action();
  } else
    Alert.alert(title, message, [
      { text: zh.cancel, style: "cancel" },
      { text: zh.confirm, style: "destructive", onPress: action },
    ]);
}
export const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    minHeight: 48,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
