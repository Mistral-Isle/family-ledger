import { useRef, type ReactNode } from "react";
export function HorizontalStrip({ children }: { children: ReactNode }) {
  const gesture = useRef({ x: 0, y: 0, left: 0, active: false, moved: false });
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 2,
        cursor: "grab",
        userSelect: "none",
      }}
      onPointerDown={(e) => {
        gesture.current.moved = false;
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        gesture.current = {
          x: e.clientX,
          y: e.clientY,
          left: e.currentTarget.scrollLeft,
          active: true,
          moved: false,
        };
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (e.buttons === 0) g.active = false;
        if (!g.active) return;
        const dx = e.clientX - g.x;
        if (!g.moved) {
          if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - g.y))
            return;
          g.moved = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        e.currentTarget.scrollLeft = g.left - dx;
      }}
      onPointerUp={(e) => {
        gesture.current.active = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        gesture.current.active = false;
      }}
      onClickCapture={(e) => {
        if (gesture.current.moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}
