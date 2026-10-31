import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from "expo-modules-core";
import { useState } from "react";
import { View, type ViewProps } from "react-native";
import { useTheme } from "./ui";
import { DragOrderFallback } from "./DragOrderFallback";
import type { InlineListProps, InlineItem } from "./InlineReorderList.types";
type NativeProps = ViewProps & {
  items: InlineItem[];
  interactive: boolean;
  dark: boolean;
  surfaceColor: string;
  onOrderChange: (e: { nativeEvent: { ids: string[] } }) => void;
  onItemPress: (e: { nativeEvent: { id: string } }) => void;
  onItemAction: (e: { nativeEvent: { id: string; action: string } }) => void;
};
const NativeList = requireOptionalNativeModule("LedgerCategoryOrder")
  ? requireNativeViewManager<NativeProps>("LedgerCategoryOrder")
  : null;
export function InlineReorderList({
  items,
  onReorder,
  onPress,
  onAction,
  onError,
  maxHeight = 480,
}: InlineListProps) {
  const t = useTheme(),
    [revision, setRevision] = useState(0);
  function reorder(ids: string[]) {
    try {
      onReorder(ids);
    } catch (e) {
      setRevision((n) => n + 1);
      onError((e as Error).message);
    }
  }
  return (
    <View
      style={{
        height: Math.min(maxHeight, items.length * 82),
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: t.card,
      }}
    >
      {NativeList ? (
        <NativeList
          key={revision}
          items={items}
          interactive
          dark={t.dark}
          surfaceColor={t.card}
          style={{ flex: 1 }}
          onOrderChange={(e) => reorder(e.nativeEvent.ids)}
          onItemPress={(e) => onPress?.(e.nativeEvent.id)}
          onItemAction={(e) =>
            onAction?.(e.nativeEvent.id, e.nativeEvent.action)
          }
        />
      ) : (
        <DragOrderFallback items={items} onChange={reorder} />
      )}
    </View>
  );
}
