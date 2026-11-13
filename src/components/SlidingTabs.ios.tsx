import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from "expo-modules-core";
import type { ViewProps } from "react-native";
import { useTheme } from "./ui";
import { useLiquidGlass } from "./GlassSurface";
import {
  SlidingTabsFallback,
  type SlidingTabOption,
} from "./SlidingTabsFallback";

type NativeTabBarProps = ViewProps & {
  items: { value: string; label: string; symbol: string }[];
  selectedIndex: number;
  dark: boolean;
  activeColor: string;
  mutedColor: string;
  onSelect: (e: { nativeEvent: { index: number } }) => void;
};

const NativeLedgerTabBar = requireOptionalNativeModule("LedgerTabBar")
  ? requireNativeViewManager<NativeTabBarProps>("LedgerTabBar")
  : null;

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SlidingTabOption<T>[];
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  const glass = useLiquidGlass();

  if (glass && NativeLedgerTabBar) {
    const selectedIndex = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
    return (
      <NativeLedgerTabBar
        items={options.map((o) => ({
          value: o.value,
          label: o.label,
          symbol: o.icon ?? "circle.fill",
        }))}
        selectedIndex={selectedIndex}
        dark={t.dark}
        activeColor={t.blue}
        mutedColor={t.muted}
        onSelect={(event) => {
          const chosen = options[event.nativeEvent.index];
          if (chosen && chosen.value !== value) onChange(chosen.value);
        }}
        style={{ height: 62, width: "100%" }}
      />
    );
  }

  return (
    <SlidingTabsFallback value={value} options={options} onChange={onChange} />
  );
}
