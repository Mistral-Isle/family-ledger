import NativeSegmentedControl from "@react-native-segmented-control/segmented-control";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { useTheme } from "./ui";

// On iOS 26 the system control draws a clear track and a Liquid Glass thumb,
// but only while its colors are left alone: a background or tint color
// replaces both with flat fills.
const nativeGlass = isLiquidGlassAvailable();

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  compact = false,
  height,
}: {
  compact?: boolean;
  height?: number;
  value: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  const size = height ?? (compact ? 32 : 48);
  return (
    <NativeSegmentedControl
      values={options.map((o) => o.label)}
      selectedIndex={options.findIndex((o) => o.value === value)}
      onChange={(event) =>
        onChange(options[event.nativeEvent.selectedSegmentIndex]!.value)
      }
      appearance={t.dark ? "dark" : "light"}
      {...(nativeGlass
        ? {
            fontStyle: { fontSize: 15 },
            // A text color leaves the glass alone; only fills replace it.
            activeFontStyle: {
              color: t.blue,
              fontWeight: "600" as const,
              fontSize: 15,
            },
            style: { height: size },
          }
        : {
            backgroundColor: t.soft,
            tintColor: t.dark ? t.selected : t.card,
            fontStyle: { color: t.muted, fontSize: 15 },
            activeFontStyle: {
              color: t.dark ? t.onSelected : t.blue,
              fontWeight: "600" as const,
              fontSize: 15,
            },
            style: { height: size, borderRadius: size / 2, overflow: "hidden" as const },
          })}
    />
  );
}
