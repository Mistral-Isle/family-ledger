import { Pressable, View } from "react-native";
import { Txt, useTheme } from "./ui";
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
  const key = (value: string, label = value) => (
    <Pressable
      key={value}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onKey(value)}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        borderRadius: 14,
        backgroundColor: pressed ? t.line : t.soft,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <Txt
        size={23}
        color={["+", "−", "×", "÷"].includes(value) ? t.blue : t.text}
      >
        {value}
      </Txt>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <View style={{ flex: 1, gap: 6 }}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          [".", "0", "⌫"],
        ].map((r, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 6 }}>
            {r.map((v) => key(v, v === "⌫" ? zh.backspace : v))}
          </View>
        ))}
      </View>
      <View style={{ width: 94, gap: 6 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {key("+", zh.add)}
          {key("×", zh.multiply)}
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {key("−", zh.subtract)}
          {key("÷", zh.divide)}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={onAgain ? zh.continue : zh.save}
          onPress={onAgain ?? onSave}
          style={({ pressed }) => ({
            minHeight: 44,
            borderRadius: 14,
            backgroundColor: t.soft,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Txt size={14} bold color={t.blue}>
            {onAgain ? zh.continue : zh.save}
          </Txt>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="完成记账"
          onPress={onSave}
          style={({ pressed }) => ({
            minHeight: 44,
            borderRadius: 14,
            backgroundColor: t.blue,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Txt size={16} bold color="#fff">
            完成
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
