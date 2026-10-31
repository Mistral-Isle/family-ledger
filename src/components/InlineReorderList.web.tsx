import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Icon, Row, Txt, useTheme } from "./ui";
import { SwipeActions } from "./SwipeActions";
import { AccountIcon } from "./AccountIcon";
import type { InlineListProps, InlineItem } from "./InlineReorderList.types";
const labels: Record<string, string> = {
  edit: "编辑",
  hide: "隐藏",
  show: "显示",
  delete: "删除",
  balance: "调整余额",
  remove: "移除",
};
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
    root = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(items),
    [active, setActive] = useState<string | null>(null);
  const latest = useRef(draft);
  latest.current = draft;
  const dragging = useRef<string | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef({ x: 0, y: 0, lastY: 0 });
  const consumed = useRef(false);
  const clearHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(() => clearHold, []);
  useEffect(() => {
    if (!dragging.current) setDraft(items);
  }, [items]);
  function commit(next: InlineItem[]) {
    try {
      onReorder(next.map((item) => item.id));
    } catch (e) {
      setDraft(items);
      onError((e as Error).message);
    }
  }
  const actions = (item: InlineItem, names: string[]) => (
    <Row style={{ gap: 4 }}>
      {names.map((name) => (
        <Button
          key={name}
          secondary
          label={labels[name]!}
          onPress={() => onAction?.(item.id, name)}
        />
      ))}
    </Row>
  );
  return (
    <div
      ref={root}
      role="list"
      aria-label="可拖动列表"
      style={{
        maxHeight,
        overflowY: "auto",
        borderRadius: 22,
        background: t.card,
      }}
      onPointerMoveCapture={(e) => {
        if (!dragging.current) {
          if (
            Math.hypot(
              e.clientX - origin.current.x,
              e.clientY - origin.current.y,
            ) > 8
          )
            clearHold();
          if (
            e.pointerType === "touch" &&
            Math.abs(e.clientY - origin.current.y) >
              Math.abs(e.clientX - origin.current.x)
          ) {
            consumed.current = true;
            let scroll: HTMLElement | null = root.current;
            while (scroll && scroll.scrollHeight <= scroll.clientHeight + 1)
              scroll = scroll.parentElement;
            if (scroll) scroll.scrollTop += origin.current.lastY - e.clientY;
          }
          origin.current.lastY = e.clientY;
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        const bounds = root.current!.getBoundingClientRect();
        if (e.clientY < bounds.top + 32) root.current!.scrollTop -= 12;
        if (e.clientY > bounds.bottom - 32) root.current!.scrollTop += 12;
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-inline-id]");
        if (!target || !root.current!.contains(target)) return;
        const next = [...latest.current],
          from = next.findIndex((i) => i.id === dragging.current),
          to = next.findIndex((i) => i.id === target.dataset.inlineId);
        if (from >= 0 && to >= 0 && from !== to) {
          next.splice(to, 0, next.splice(from, 1)[0]!);
          latest.current = next;
          setDraft(next);
        }
      }}
      onPointerUpCapture={(e) => {
        clearHold();
        if (!dragging.current) return;
        e.stopPropagation();
        dragging.current = null;
        setActive(null);
        commit(latest.current);
      }}
      onPointerLeave={() => {
        if (!dragging.current) clearHold();
      }}
      onPointerCancel={() => {
        clearHold();
        dragging.current = null;
        setActive(null);
        setDraft(items);
      }}
    >
      {draft.map((item, index) => {
        const trailing = (item.trailing || "").split(",").filter(Boolean),
          leading = (item.leading || "").split(",").filter(Boolean);
        return (
          <div
            key={item.id}
            role="listitem"
            data-inline-id={item.id}
            onPointerDownCapture={(e) => {
              if (
                e.button !== 0 ||
                !(e.target as Element).closest("[data-grabbable]")
              )
                return;
              clearHold();
              consumed.current = false;
              origin.current = { x: e.clientX, y: e.clientY, lastY: e.clientY };
              const pointer = e.pointerId;
              hold.current = setTimeout(() => {
                dragging.current = item.id;
                consumed.current = true;
                setActive(item.id);
                root.current?.setPointerCapture(pointer);
              }, 450);
            }}
            onClickCapture={(e) => {
              if (consumed.current) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (!e.altKey || !["ArrowUp", "ArrowDown"].includes(e.key))
                return;
              e.preventDefault();
              const next = [...draft],
                to = index + (e.key === "ArrowUp" ? -1 : 1);
              if (to < 0 || to >= next.length) return;
              next.splice(to, 0, next.splice(index, 1)[0]!);
              setDraft(next);
              commit(next);
            }}
          >
            <SwipeActions
              disabled={!!active || (!trailing.length && !leading.length)}
              actionWidth={Math.max(80, trailing.length * 80)}
              startWidth={Math.max(96, leading.length * 96)}
              actions={trailing.length ? actions(item, trailing) : null}
              startActions={leading.length ? actions(item, leading) : undefined}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor:
                    active === item.id || item.selected === "true"
                      ? t.soft
                      : t.card,
                  borderBottomWidth: index < draft.length - 1 ? 0.5 : 0,
                  borderColor: t.line,
                }}
              >
                <div
                  data-grabbable
                  style={{
                    width: "100%",
                    flex: 1,
                    touchAction: "none",
                    cursor: active === item.id ? "grabbing" : "grab",
                    userSelect: "none",
                  }}
                >
                  <Pressable
                    accessibilityState={{ selected: item.selected === "true" }}
                    aria-pressed={
                      item.selected === undefined
                        ? undefined
                        : item.selected === "true"
                    }
                    accessibilityHint="长按拖动排序"
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    onPress={() => onPress?.(item.id)}
                    style={{
                      width: "100%",
                      flex: 1,
                      minHeight: rowHeight,
                      padding: rowHeight < 80 ? 10 : 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {item.accountKind ? (
                      <AccountIcon kind={item.accountKind} size={40} />
                    ) : (
                      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: item.selected === "true" ? (item.color ?? t.blue) : "transparent" }}>
                        <Icon name={item.symbol ?? "star.fill"} color={item.selected === "true" ? "#fff" : (item.color ?? t.blue)} size={24} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt
                        bold
                        color={item.selected === "true" ? t.blue : t.text}
                      >
                        {item.name}
                      </Txt>
                      {!!item.subtitle && (
                        <Txt size={12} color={t.muted}>
                          {item.subtitle}
                        </Txt>
                      )}
                    </View>
                    {!!item.amount && <Txt bold>{item.amount}</Txt>}
                    {item.selected === "true" && (
                      <Icon
                        name="checkmark.circle.fill"
                        color={t.blue}
                        size={19}
                      />
                    )}
                  </Pressable>
                </div>
              </View>
            </SwipeActions>
          </div>
        );
      })}
    </div>
  );
}
