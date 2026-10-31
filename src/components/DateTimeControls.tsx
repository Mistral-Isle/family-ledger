import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "./ui";
export function CalendarControl({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const t = useTheme();
  return (
    <DateTimePicker
      accessibilityLabel="选择日期"
      value={value}
      mode="date"
      display="inline"
      locale="zh-CN"
      themeVariant={t.dark ? "dark" : "light"}
      onChange={(_, date) => {
        if (date) onChange(date);
      }}
      style={{ alignSelf: "stretch" }}
    />
  );
}
export function TimeControl({
  value,
  onChange,
  compact = false,
}: {
  compact?: boolean;
  value: Date;
  onChange: (date: Date) => void;
}) {
  const t = useTheme();
  return (
    <DateTimePicker
      accessibilityLabel="选择时间"
      value={value}
      mode="time"
      display={compact ? "compact" : "spinner"}
      accentColor={t.blue}
      locale="zh-CN"
      themeVariant={t.dark ? "dark" : "light"}
      onChange={(_, date) => {
        if (date) onChange(date);
      }}
      style={
        compact
          ? { height: 44, width: 120 }
          : { height: 190, alignSelf: "stretch" }
      }
    />
  );
}
