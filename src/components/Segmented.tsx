import { Pressable, View } from "react-native";
import { Txt, useTheme } from "./ui";
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.soft,
        borderRadius: 12,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          onPress={() => onChange(option.value)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 40,
            paddingHorizontal: 8,
            paddingVertical: 8,
            justifyContent: "center",
            alignItems: "center",
            borderRadius: 9,
            backgroundColor: value === option.value ? t.card : "transparent",
            opacity: pressed ? 0.6 : 1,
            boxShadow:
              value === option.value ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          })}
        >
          <Txt size={14} bold={value === option.value}>
            {option.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
