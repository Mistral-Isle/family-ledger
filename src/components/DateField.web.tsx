import { View } from "react-native";
import { Txt, useTheme } from "./ui";
import type { DateFieldProps } from "./DateField";
export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  optional,
  compact,
}: DateFieldProps) {
  const t = useTheme();
  return (
    <View style={{ gap: 6, flexShrink: 1 }}>
      {!compact && (
        <Txt size={12} color={t.muted}>
          {label}
        </Txt>
      )}
      <input
        aria-label={label}
        type={mode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {}
        }}
        style={{
          boxSizing: "border-box",
          colorScheme: t.dark ? "dark" : "light",
          minHeight: 44,
          width: compact ? (mode === "time" ? 100 : 132) : "100%",
          maxWidth: "100%",
          border: "none",
          borderRadius: 16,
          padding: compact ? 4 : 14,
          font: "inherit",
          fontSize: compact ? 12 : 15,
          color: t.text,
          background: t.card,
        }}
      />
      {optional && (
        <button
          onClick={() => onChange("")}
          style={{
            border: 0,
            background: "transparent",
            color: t.blue,
            padding: 8,
            minHeight: 32,
          }}
        >
          {mode === "time" ? "不记录时间" : "清除日期"}
        </button>
      )}
    </View>
  );
}
