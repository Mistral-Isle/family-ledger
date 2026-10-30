import NativeSegmentedControl from "@react-native-segmented-control/segmented-control";
import { useTheme } from "./ui";
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  return (
    <NativeSegmentedControl
      values={options.map((o) => o.label)}
      selectedIndex={options.findIndex((o) => o.value === value)}
      onChange={(event) =>
        onChange(options[event.nativeEvent.selectedSegmentIndex]!.value)
      }
      appearance={t.dark ? "dark" : "light"}
      backgroundColor={t.soft}
      tintColor={t.card}
      fontStyle={{ color: t.muted, fontSize: 15 }}
      activeFontStyle={{ color: t.text, fontWeight: "600", fontSize: 15 }}
      style={{ height: 48, borderRadius: 24, overflow: "hidden" }}
    />
  );
}
