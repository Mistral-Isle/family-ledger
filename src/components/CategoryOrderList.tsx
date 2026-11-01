import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from "expo-modules-core";
import { Platform, type ViewProps } from "react-native";
import { useTheme } from "./ui";
import { DragOrderFallback } from "./DragOrderFallback";
export type OrderItem = { id: string; name: string };
export type CategoryOrderListProps = {
  items: OrderItem[];
  onChange: (ids: string[]) => void;
};
type NativeProps = ViewProps & {
  items: OrderItem[];
  dark: boolean;
  surfaceColor: string;
  onOrderChange: (event: { nativeEvent: { ids: string[] } }) => void;
};
const NativeList =
  Platform.OS === "ios" && requireOptionalNativeModule("LedgerCategoryOrder")
    ? requireNativeViewManager<NativeProps>("LedgerCategoryOrder")
    : null;
export function CategoryOrderList({ items, onChange }: CategoryOrderListProps) {
  const t = useTheme();
  if (NativeList)
    return (
      <NativeList
        items={items}
        dark={t.dark}
        surfaceColor={t.card}
        onOrderChange={(e) => onChange(e.nativeEvent.ids)}
        style={{ flex: 1 }}
      />
    );
  return <DragOrderFallback items={items} onChange={onChange} />;
}
