import { useRef, useState } from "react";
import { Animated, PanResponder, ScrollView, View } from "react-native";
import { Icon, Txt, useTheme } from "./ui";
import type { CategoryOrderListProps, OrderItem } from "./CategoryOrderList";

// Only used when the UIKit module is unavailable; installed iOS builds use UITableView.
export function DragOrderFallback({ items, onChange }: CategoryOrderListProps) {
  const [dragging, setDragging] = useState(false);
  function move(from: number, to: number) {
    const ids = items.map((item) => item.id);
    to = Math.max(0, Math.min(ids.length - 1, to));
    if (from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    onChange(ids);
  }
  return (
    <ScrollView scrollEnabled={!dragging}>
      {items.map((item, index) => (
        <DragRow
          key={item.id}
          item={item}
          onDragging={setDragging}
          onMove={(offset) => move(index, index + offset)}
        />
      ))}
    </ScrollView>
  );
}

function DragRow({
  item,
  onMove,
  onDragging,
}: {
  item: OrderItem;
  onMove: (offset: number) => void;
  onDragging: (value: boolean) => void;
}) {
  const t = useTheme(),
    y = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);
  const current = useRef({ onMove, onDragging });
  current.current = { onMove, onDragging };
  const height = useRef(56);
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setActive(true);
        current.current.onDragging(true);
      },
      onPanResponderMove: (_, g) => y.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        current.current.onMove(Math.round(g.dy / height.current));
        y.setValue(0);
        setActive(false);
        current.current.onDragging(false);
      },
      onPanResponderTerminate: () => {
        y.setValue(0);
        setActive(false);
        current.current.onDragging(false);
      },
    }),
  ).current;
  return (
    <Animated.View
      onLayout={(e) => {
        height.current = e.nativeEvent.layout.height;
      }}
      style={{
        transform: [{ translateY: y }],
        zIndex: active ? 1 : 0,
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        backgroundColor: active ? t.soft : t.card,
        borderBottomWidth: 1,
        borderBottomColor: t.line,
      }}
    >
      <Txt style={{ flex: 1 }}>{item.name}</Txt>
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={"拖动排序" + item.name}
        accessibilityActions={[
          { name: "increment", label: "向后调整" },
          { name: "decrement", label: "向前调整" },
        ]}
        onAccessibilityAction={(e) =>
          onMove(e.nativeEvent.actionName === "increment" ? 1 : -1)
        }
        style={{
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="line.3.horizontal" color={t.muted} />
      </View>
    </Animated.View>
  );
}
