import { useRef, useState } from "react";
import { useTheme } from "./ui";
import type { CategoryOrderListProps } from "./CategoryOrderList";
export function CategoryOrderList({ items, onChange }: CategoryOrderListProps) {
  const t = useTheme(),
    container = useRef<HTMLDivElement>(null),
    drag = useRef<{ id: string; original: string[] } | null>(null);
  const [active, setActive] = useState<string | null>(null),
    [announcement, setAnnouncement] = useState("");
  function move(id: string, targetId: string) {
    const ids = items.map((i) => i.id),
      from = ids.indexOf(id),
      to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    onChange(ids);
    setAnnouncement(
      (items.find((i) => i.id === id)?.name ?? "") + "，第 " + (to + 1) + " 项",
    );
  }
  return (
    <div
      ref={container}
      role="list"
      aria-label="拖动排序列表"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        borderRadius: 16,
        background: t.card,
        color: t.text,
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const box = container.current!.getBoundingClientRect();
        if (e.clientY < box.top + 40) container.current!.scrollTop -= 12;
        else if (e.clientY > box.bottom - 40)
          container.current!.scrollTop += 12;
        const hit = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>("[data-category-order]");
        if (hit && container.current?.contains(hit))
          move(drag.current.id, hit.dataset.categoryOrder!);
      }}
      onPointerUp={() => {
        drag.current = null;
        setActive(null);
      }}
      onPointerCancel={() => {
        if (drag.current) onChange(drag.current.original);
        drag.current = null;
        setActive(null);
      }}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          role="listitem"
          data-category-order={item.id}
          style={{
            display: "flex",
            alignItems: "center",
            minHeight: 56,
            padding: "4px 12px",
            borderBottom: "1px solid " + t.line,
            background: active === item.id ? t.soft : t.card,
          }}
        >
          <span style={{ flex: 1, fontSize: 16 }}>{item.name}</span>
          <button
            type="button"
            aria-label={"拖动排序" + item.name}
            aria-describedby="category-order-keyboard"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.currentTarget.focus();
              drag.current = { id: item.id, original: items.map((i) => i.id) };
              setActive(item.id);
              container.current!.setPointerCapture(e.pointerId);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                const target = items[index + (e.key === "ArrowUp" ? -1 : 1)];
                if (target) move(item.id, target.id);
              }
            }}
            style={{
              cursor: "grab",
              touchAction: "none",
              border: 0,
              borderRadius: 10,
              background: "transparent",
              color: t.muted,
              minHeight: 44,
              minWidth: 44,
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 7H19M5 12H19M5 17H19"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
      <span
        id="category-order-keyboard"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clipPath: "inset(50%)",
        }}
      >
        拖动调整顺序，也可使用上、下方向键。
      </span>
      <span
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clipPath: "inset(50%)",
        }}
      >
        {announcement}
      </span>
    </div>
  );
}
