import { amountKeyFeedback } from "../services/amountKeyFeedback";
import { Pressable, View, useWindowDimensions } from "react-native";
import { Icon, Txt, useTheme } from "./ui";
import { zh } from "../i18n/zh";
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
  const keyHeight = Math.max(50, Math.min(64, Math.round(height * 0.063)));
  const key = (value: string, label = value) => (
    <Pressable
      key={value}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={amountKeyFeedback}
      onPress={() => onKey(value)}
      delayLongPress={450}
      onLongPress={value === "⌫" ? () => onKey("clear") : undefined}
      accessibilityHint={value === "⌫" ? "长按归零" : undefined}
      style={({ pressed }) => ({
        flex: 1,
        height: keyHeight,
        borderRadius: 20,
        backgroundColor: pressed ? t.line : t.card,
        opacity: pressed ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      {value === "⌫" ? (
        <Icon name="delete.left" size={27} color={t.text} />
      ) : (
        <Txt
          size={28}
          color={["+", "−", "×", "÷"].includes(value) ? t.buttonText : t.text}
        >
          {value}
        </Txt>
      )}
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 3, gap: 8 }}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          [".", "0", "⌫"],
        ].map((r, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8 }}>
            {r.map((v) => key(v, v === "⌫" ? zh.backspace : v))}
          </View>
        ))}
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {key("+", zh.add)}
          {key("×", zh.multiply)}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {key("−", zh.subtract)}
          {key("÷", zh.divide)}
        </View>
        {onAgain && <Pressable
          accessibilityRole="button"
          accessibilityLabel={zh.continue}
          onPress={onAgain ?? onSave}
          style={({ pressed }) => ({
            height: keyHeight,
            borderRadius: 20,
            backgroundColor: t.card,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Txt size={14} bold color={t.buttonText}>
            {zh.continue}
          </Txt>
        </Pressable>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="完成"
          onPress={onSave}
          style={({ pressed }) => ({
            borderRadius: 20,
            height: onAgain ? keyHeight : keyHeight * 2 + 8,
            backgroundColor: t.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Txt size={18} bold color={t.onPrimary}>
            完成
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
