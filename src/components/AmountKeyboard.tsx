import { Pressable, View, useWindowDimensions } from "react-native";
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
  const { height } = useWindowDimensions();
  const keyHeight = Math.max(50, Math.min(64, Math.round(height * 0.063)));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={labels[key] ?? key}
              onPress={() => onKey(key)}
              delayLongPress={450}
              onLongPress={key === "⌫" ? () => onKey("clear") : undefined}
              style={({ pressed }) => ({
                flex: 1,
                height: keyHeight,
                paddingVertical: 5,
                borderRadius: 20,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? t.line : t.card,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Txt
                size={28}
                color={
                  ["+", "−", "×", "÷"].includes(key) ? t.buttonText : t.text
                }
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
