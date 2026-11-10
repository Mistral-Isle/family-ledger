import { AmountKey } from "./AmountKey";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Icon, Txt, useTheme } from "./ui";
import { zh } from "../i18n/zh";

const GAP = 7;
const RADIUS = 16;

/**
 * Four equal columns. The operators share two keys ("+ ×" and "− ÷", press
 * again to swap), so every key keeps a full column's width instead of
 * squeezing four half-width operator keys into the last column.
 */
export function EntryKeyboard({
  onKey,
  onSave,
  onAgain,
}: {
  onKey: (key: string) => void;
  onSave: () => void;
  onAgain?: () => void;
}) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  const keyHeight = Math.max(52, Math.min(66, Math.round(height * 0.066)));
  const face = {
    height: keyHeight,
    borderRadius: RADIUS,
    borderCurve: "continuous" as const,
    backgroundColor: t.card,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    boxShadow: t.dark ? undefined : "0 1px 2px rgba(0,0,0,0.06)",
  };
  const key = (value: string, label: string) => (
    <AmountKey
      key={value}
      label={label}
      onPress={() => onKey(value)}
      onLongPress={value === "⌫" ? () => onKey("clear") : undefined}
      hint={
        value === "⌫"
          ? "长按归零"
          : value.length === 2
            ? "再按一次切换"
            : undefined
      }
      style={{ ...face, flex: 1 }}
      pressedStyle={{
        backgroundColor: t.line,
        transform: [{ scale: 0.95 }],
      }}
    >
      {value === "⌫" ? (
        <Icon name="delete.left" size={28} color={t.text} />
      ) : value.length === 2 ? (
        <Text style={{ fontSize: 26, color: t.buttonText }}>
          {value[0]} {value[1]}
        </Text>
      ) : (
        <Text
          style={{
            fontSize: 31,
            fontWeight: "400",
            color: t.text,
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
      )}
    </AmountKey>
  );
  return (
    <View style={{ flexDirection: "row", gap: GAP }}>
      {/* The basis absorbs the two inner gaps, so the right column ends up
          exactly one key wide. */}
      <View style={{ flexGrow: 3, flexShrink: 0, flexBasis: GAP * 2, gap: GAP }}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          [".", "0", "⌫"],
        ].map((r, i) => (
          <View key={i} style={{ flexDirection: "row", gap: GAP }}>
            {r.map((v) => key(v, v === "⌫" ? zh.backspace : v))}
          </View>
        ))}
      </View>
      <View style={{ flexGrow: 1, flexShrink: 0, flexBasis: 0, gap: GAP }}>
        <View style={{ flexDirection: "row" }}>
          {key("+×", `${zh.add}或${zh.multiply}`)}
        </View>
        <View style={{ flexDirection: "row" }}>
          {key("−÷", `${zh.subtract}或${zh.divide}`)}
        </View>
        {onAgain && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={zh.continue}
            onPress={onAgain}
            style={({ pressed }) => ({
              ...face,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Txt size={16} bold color={t.buttonText}>
              {zh.continue}
            </Txt>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="完成"
          onPress={onSave}
          style={({ pressed }) => ({
            ...face,
            height: onAgain ? keyHeight : keyHeight * 2 + GAP,
            backgroundColor: t.primary,
            boxShadow: undefined,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Txt size={19} bold color={t.onPrimary}>
            完成
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
