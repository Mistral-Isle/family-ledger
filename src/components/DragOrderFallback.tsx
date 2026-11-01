import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Txt, useTheme } from "./ui";
import type { CategoryOrderListProps, OrderItem } from "./CategoryOrderList";

// Custom SVG categories use this list even in installed iOS builds.
export function DragOrderFallback({ items, onChange, renderItem, rowHeight = 56 }: CategoryOrderListProps & {
  renderItem?: (item: OrderItem, dragging: boolean) => ReactNode;
  rowHeight?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const viewport = useRef({ top: 0, height: 0 });
  const autoScroll = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const finger = useRef(0);
  const active = useRef<{ start: number; dy: number; update: (dy: number) => void } | null>(null);
  const current = useRef({ items, onChange, rowHeight });
  current.current = { items, onChange, rowHeight };
  const stop = () => {
    clearInterval(autoScroll.current);
    active.current = null;
    setDragging(false);
  };
  useEffect(() => () => clearInterval(autoScroll.current), []);
  function move(id: string, delta: number) {
    const ids = current.current.items.map((item) => item.id);
    const from = ids.indexOf(id);
    if (from < 0) return;
    const to = Math.max(0, Math.min(ids.length - 1, from + delta));
    if (from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    current.current.onChange(ids);
  }
  return (
    <ScrollView
      ref={scroll}
      nestedScrollEnabled
      scrollEnabled={!dragging}
      scrollEventThrottle={16}
      onLayout={(e) => { viewport.current.height = e.nativeEvent.layout.height; }}
      onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; }}
    >
      {items.map((item, index) => (
        <DragRow
          key={item.id}
          item={item}
          separator={index < items.length - 1}
          rowHeight={rowHeight}
          enabled={items.length > 1}
          renderItem={renderItem}
          onMove={(delta) => move(item.id, delta)}
          onStart={(absoluteY, update) => {
            finger.current = absoluteY;
            active.current = { start: offset.current, dy: 0, update };
            setDragging(true);
            scroll.current?.getNativeScrollRef()?.measureInWindow((_x, y, _w, height) => { viewport.current = { top: y, height }; });
            clearInterval(autoScroll.current);
            autoScroll.current = setInterval(() => {
              const drag = active.current;
              if (!drag) return;
              const { top, height } = viewport.current;
              const direction = finger.current < top + 36 ? -1 : finger.current > top + height - 36 ? 1 : 0;
              if (!direction) return;
              offset.current = Math.max(0, Math.min(current.current.items.length * current.current.rowHeight - height, offset.current + direction * 6));
              scroll.current?.scrollTo({ y: offset.current, animated: false });
              drag.update(drag.dy + offset.current - drag.start);
            }, 16);
          }}
          onDrag={(dy, absoluteY) => {
            finger.current = absoluteY;
            if (!active.current) return dy;
            active.current.dy = dy;
            return dy + offset.current - active.current.start;
          }}
          onStop={stop}
        />
      ))}
    </ScrollView>
  );
}

function DragRow({ item, separator, renderItem, rowHeight, enabled, onMove, onStart, onDrag, onStop }: {
  item: OrderItem;
  separator: boolean;
  renderItem?: (item: OrderItem, dragging: boolean) => ReactNode;
  rowHeight: number;
  enabled: boolean;
  onMove: (offset: number) => void;
  onStart: (absoluteY: number, update: (dy: number) => void) => void;
  onDrag: (dy: number, absoluteY: number) => number;
  onStop: () => void;
}) {
  const t = useTheme();
  const y = useRef(new Animated.Value(0)).current;
  const displacement = useRef(0);
  const [active, setActive] = useState(false);
  const update = (dy: number) => { displacement.current = dy; y.setValue(dy); };
  const pan = Gesture.Pan()
    .enabled(enabled)
    .activateAfterLongPress(400)
    .runOnJS(true)
    .onStart((e) => {
      setActive(true);
      onStart(e.absoluteY, update);
    })
    .onUpdate((e) => update(onDrag(e.translationY, e.absoluteY)))
    .onEnd(() => onMove(Math.round(displacement.current / rowHeight)))
    .onFinalize(() => {
      update(0);
      setActive(false);
      onStop();
    });
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={{
          transform: [{ translateY: y }, { scale: active ? 1.02 : 1 }],
          zIndex: active ? 10 : 0,
          height: rowHeight,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          opacity: active ? 0.92 : 1,
          backgroundColor: active ? t.soft : t.card,

        }}
      >
        <View pointerEvents={active ? "none" : "auto"} style={{ flex: 1 }}>
          {renderItem?.(item, active) ?? <Txt>{item.name}</Txt>}
        </View>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={"拖动排序" + item.name}
          accessibilityHint="长按整行或手柄，再上下拖动"
          accessibilityActions={[
            { name: "increment", label: "向后调整" },
            { name: "decrement", label: "向前调整" },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "increment") onMove(1);
            if (e.nativeEvent.actionName === "decrement") onMove(-1);
          }}
          style={{ minWidth: 36, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <View accessible={false} style={{ gap: 4 }}>
            {[0, 1, 2].map(line => <View key={line} style={{ width: 18, height: 2, borderRadius: 1, backgroundColor: active ? t.blue : t.muted }} />)}
          </View>
        </View>
        {separator && <View pointerEvents="none" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 0.5, backgroundColor: t.line }} />}
      </Animated.View>
    </GestureDetector>
  );
}
