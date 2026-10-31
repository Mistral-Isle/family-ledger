import { Pressable, View } from "react-native";
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
        opacity: pressed ? 0.6 : 1,
        transform: [{ scale: pressed ? 0.94 : 1 }],
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      {value === "⌫" ? (
        <Icon name="delete.left" size={25} color={t.text} />
      ) : (
        <Txt
          size={23}
          color={["+", "−", "×", "÷"].includes(value) ? t.buttonText : t.text}
        >
          {value}
        </Txt>
      )}
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
        {onAgain && <Pressable
          accessibilityRole="button"
          accessibilityLabel={zh.continue}
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
          <Txt size={14} bold color={t.buttonText}>
            {zh.continue}
          </Txt>
        </Pressable>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="完成"
          onPress={onSave}
          style={({ pressed }) => ({
            minHeight: 44,
            borderRadius: 14,
            flex: onAgain ? undefined : 1,
            backgroundColor: t.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Txt size={16} bold color={t.onPrimary}>
            完成
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}
