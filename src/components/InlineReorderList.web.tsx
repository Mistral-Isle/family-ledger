import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Icon, Row, Txt, useTheme } from "./ui";
import { SwipeActions } from "./SwipeActions";
import { AccountIcon } from "./AccountIcon";
import type { InlineListProps, InlineItem } from "./InlineReorderList.types";
const labels: Record<string, string> = {
  edit: "编辑",
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
}: InlineListProps) {
  const t = useTheme(),
    root = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(items),
    [active, setActive] = useState<string | null>(null);
  const latest = useRef(draft);
  latest.current = draft;
  const dragging = useRef<string | null>(null);
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
      onPointerMove={(e) => {
        if (!dragging.current) return;
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
      onPointerUp={() => {
        if (!dragging.current) return;
        dragging.current = null;
        setActive(null);
        commit(latest.current);
      }}
      onPointerCancel={() => {
        dragging.current = null;
        setActive(null);
        setDraft(items);
      }}
    >
      {draft.map((item, index) => {
        const trailing = (item.trailing || "").split(",").filter(Boolean),
          leading = (item.leading || "").split(",").filter(Boolean);
        return (
          <div key={item.id} role="listitem" data-inline-id={item.id}>
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
                  backgroundColor: active === item.id ? t.soft : t.card,
                  borderBottomWidth: index < draft.length - 1 ? 0.5 : 0,
                  borderColor: t.line,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  onPress={() => onPress?.(item.id)}
                  style={{
                    flex: 1,
                    minHeight: 82,
                    padding: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {item.accountKind ? (
                    <AccountIcon kind={item.accountKind} size={40} />
                  ) : (
                    <Icon
                      name={item.symbol ?? "star.fill"}
                      color={t.blue}
                      size={24}
                    />
                  )}
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt bold>{item.name}</Txt>
                    {!!item.subtitle && (
                      <Txt size={12} color={t.muted}>
                        {item.subtitle}
                      </Txt>
                    )}
                  </View>
                  {!!item.amount && <Txt bold>{item.amount}</Txt>}
                </Pressable>
                <button
                  aria-label={"拖动" + item.name}
                  style={{
                    minWidth: 40,
                    minHeight: 44,
                    touchAction: "none",
                    border: 0,
                    background: "transparent",
                    color: t.muted,
                    cursor: "grab",
                    fontSize: 22,
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    e.preventDefault();
                    dragging.current = item.id;
                    setActive(item.id);
                    root.current!.setPointerCapture(e.pointerId);
                  }}
                  onKeyDown={(e) => {
                    if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
                    e.preventDefault();
                    const next = [...draft],
                      to = index + (e.key === "ArrowUp" ? -1 : 1);
                    if (to < 0 || to >= next.length) return;
                    next.splice(to, 0, next.splice(index, 1)[0]!);
                    setDraft(next);
                    commit(next);
                  }}
                >
                  ≡
                </button>
              </View>
            </SwipeActions>
          </div>
        );
      })}
    </div>
  );
}
