import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from "expo-modules-core";
import { GlassView } from "expo-glass-effect";
import { View, type ViewProps } from "react-native";
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
      <View style={{ height: 62, width: "100%" }}>
        <GlassView
          pointerEvents="none"
          glassEffectStyle="regular"
          colorScheme={t.dark ? "dark" : "light"}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: 31,
            borderCurve: "continuous",
          }}
        />
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
      </View>
    );
  }

  return (
    <SlidingTabsFallback value={value} options={options} onChange={onChange} />
  );
}
