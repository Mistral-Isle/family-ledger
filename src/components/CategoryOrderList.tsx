import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from "expo-modules-core";
import { Platform, ScrollView, View, type ViewProps } from "react-native";
import { IconButton, Row, Txt, useTheme } from "./ui";
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
  function move(index: number, delta: number) {
    const next = items.map((i) => i.id);
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    next.splice(target, 0, next.splice(index, 1)[0]!);
    onChange(next);
  }
  return (
    <ScrollView>
      {items.map((item, index) => (
        <Row
          key={item.id}
          style={{ minHeight: 56, borderBottomWidth: 1, borderColor: t.line }}
        >
          <View style={{ flex: 1 }}>
            <Txt>{item.name}</Txt>
          </View>
          <IconButton
            name="arrow.up"
            label={"上移" + item.name}
            onPress={() => move(index, -1)}
          />
          <IconButton
            name="arrow.down"
            label={"下移" + item.name}
            onPress={() => move(index, 1)}
          />
        </Row>
      ))}
    </ScrollView>
  );
}
