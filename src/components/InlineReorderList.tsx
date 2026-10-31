import { AccountIcon } from "./AccountIcon";
import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from "expo-modules-core";
import { useState } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { Button, Icon, Row, Txt, useTheme } from "./ui";
import { SwipeActions } from "./SwipeActions";
import { DragOrderFallback } from "./DragOrderFallback";
import type { InlineListProps, InlineItem } from "./InlineReorderList.types";
type NativeProps = ViewProps & {
  items: InlineItem[];
  interactive: boolean;
  itemHeight: number;
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
  rowHeight = 82,
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
        height: Math.min(maxHeight, items.length * rowHeight),
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: t.card,
      }}
    >
      {NativeList &&
      !items.some((item) => item.symbol?.startsWith("category:")) ? (
        <NativeList
          key={revision}
          items={items}
          interactive
          itemHeight={rowHeight}
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
        <DragOrderFallback
          items={items}
          onChange={reorder}
          rowHeight={rowHeight}
          renderItem={(row) => {
            const item = items.find((i) => i.id === row.id)!;
            const actions = (item.trailing ?? "").split(",").filter(Boolean);
            const labels: Record<string, string> = {
              hide: "隐藏",
              show: "显示",
              delete: "删除",
              edit: "编辑",
              balance: "调整余额",
              remove: "移除",
            };
            return (
              <SwipeActions
                actionWidth={actions.length * 76}
                disabled={!actions.length}
                actions={
                  <Row style={{ gap: 4 }}>
                    {actions.map((action) => (
                      <Button
                        key={action}
                        secondary
                        label={labels[action] ?? action}
                        onPress={() => onAction?.(item.id, action)}
                      />
                    ))}
                  </Row>
                }
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  onPress={() => onPress?.(item.id)}
                  style={{
                    minHeight: rowHeight,
                    justifyContent: "center",
                    backgroundColor: t.card,
                    paddingHorizontal: 8,
                  }}
                >
                  <Row>
                    {item.accountKind ? (
                      <AccountIcon
                        kind={item.accountKind}
                        size={40}
                        selected={item.selected === "true"}
                      />
                    ) : (
                      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: item.selected === "true" ? (item.color ?? t.blue) : "transparent" }}>
                        <Icon name={item.symbol ?? "star.fill"} color={item.selected === "true" ? "#fff" : (item.color ?? t.blue)} size={24} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Txt bold>{item.name}</Txt>
                      {!!item.subtitle && (
                        <Txt size={12} color={t.muted}>
                          {item.subtitle}
                        </Txt>
                      )}
                    </View>
                  </Row>
                </Pressable>
              </SwipeActions>
            );
          }}
        />
      )}
    </View>
  );
}
