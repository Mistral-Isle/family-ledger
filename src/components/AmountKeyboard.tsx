import { Pressable, View } from "react-native";
import { Txt, useTheme } from "./ui";
import { zh } from "../i18n/zh";

const rows = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  [".", "0", "⌫", "+"],
];
const labels: Record<string, string> = {
  "⌫": zh.backspace,
  "÷": zh.divide,
  "×": zh.multiply,
  "−": zh.subtract,
  "+": zh.add,
};
export function AmountKeyboard({ onKey }: { onKey: (key: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 6 }}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={labels[key] ?? key}
              onPress={() => onKey(key)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 44,
                paddingVertical: 5,
                borderRadius: 12,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? t.line : t.soft,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Txt
                size={24}
                color={["+", "−", "×", "÷"].includes(key) ? t.blue : t.text}
              >
                {key}
              </Txt>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
