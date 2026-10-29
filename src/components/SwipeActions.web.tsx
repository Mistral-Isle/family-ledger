import { useRef, useState, type ReactNode } from "react";

export function SwipeActions({
  children,
  actions,
  startActions,
  disabled = false,
}: {
  children: ReactNode;
  actions: ReactNode;
  startActions?: ReactNode;
  disabled?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef({
    x: 0,
    y: 0,
    base: 0,
    active: false,
    horizontal: false,
    vertical: false,
  });
  const consumed = useRef(false);
  const width = 80;
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <div
        aria-hidden={offset >= 0}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          visibility: offset >= 0 ? "hidden" : "visible",
        }}
      >
        {actions}
      </div>
      <div
        aria-hidden={offset <= 0}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width,
          display: "flex",
          alignItems: "center",
          visibility: offset <= 0 ? "hidden" : "visible",
        }}
      >
        {startActions}
      </div>
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 180ms ease-out",
          touchAction: "pan-y",
          userSelect: "none",
          cursor: disabled ? "pointer" : dragging ? "grabbing" : "grab",
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || disabled) return;
          consumed.current = false;
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            base: offset,
            active: true,
            horizontal: false,
            vertical: false,
          };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (e.buttons === 0) g.active = false;
          if (!g.active || g.vertical) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (!g.horizontal) {
            if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
              g.vertical = true;
              return;
            }
            if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            g.horizontal = true;
            consumed.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
          }
          setOffset(
            Math.max(-width, Math.min(startActions ? width : 0, g.base + dx)),
          );
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          g.active = false;
          setDragging(false);
          if (g.horizontal) {
            setOffset(
              offset < -width / 2 ? -width : offset > width / 2 ? width : 0,
            );
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => {
          gesture.current.active = false;
          setDragging(false);
          setOffset(gesture.current.base);
        }}
        onClickCapture={(e) => {
          if (consumed.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>
    </div>
  );
}
