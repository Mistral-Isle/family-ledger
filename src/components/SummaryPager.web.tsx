import { useEffect, useRef } from "react";
import type { SummaryPagerProps } from "./SummaryPager";
import { useReducedMotion } from "./useReducedMotion";

export function SummaryPager({ page, onChange, children }: SummaryPagerProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const current = useRef({ page, onChange, count: children.length });
  current.current = { page, onChange, count: children.length };
  const reduced = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef({ x: 0, y: 0, left: 0, active: false, moved: false });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = () =>
      element.scrollTo({
        left: current.current.page * element.clientWidth,
        behavior: "instant",
      });
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => {
      observer.disconnect();
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    const element = viewport.current;
    if (
      element &&
      Math.abs(element.scrollLeft - page * element.clientWidth) > 1
    )
      element.scrollTo({
        left: page * element.clientWidth,
        behavior: reduced ? "instant" : "smooth",
      });
  }, [page, reduced]);
  const settle = (element: HTMLDivElement) => {
    const next = Math.max(
      0,
      Math.min(
        current.current.count - 1,
        Math.round(element.scrollLeft / element.clientWidth),
      ),
    );
    element.style.scrollSnapType = "x mandatory";
    element.scrollTo({
      left: next * element.clientWidth,
      behavior: reduced ? "instant" : "smooth",
    });
    if (next !== current.current.page) current.current.onChange(next);
  };
  return (
    <div
      ref={viewport}
      data-testid="summary-pager"
      style={{
        display: "flex",
        overflowX: "auto",
        scrollbarWidth: "none",
        scrollSnapType: "x mandatory",
        overscrollBehaviorX: "contain",
        touchAction: "pan-y",
        userSelect: "none",
        alignItems: "stretch",
      }}
      onScroll={() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (viewport.current && !drag.current.active)
            settle(viewport.current);
        }, 140);
      }}
      onPointerDown={(event) => {
        drag.current.moved = false;
        if (event.button !== 0) return;
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          left: event.currentTarget.scrollLeft,
          active: true,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const gesture = drag.current;
        if (!gesture.active || event.buttons === 0) return;
        const dx = event.clientX - gesture.x;
        if (!gesture.moved) {
          if (
            Math.abs(dx) < 8 ||
            Math.abs(dx) < Math.abs(event.clientY - gesture.y) * 1.5
          )
            return;
          gesture.moved = true;
          event.currentTarget.style.scrollSnapType = "none";
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        event.preventDefault();
        event.currentTarget.scrollLeft = gesture.left - dx;
      }}
      onPointerUp={(event) => {
        const moved = drag.current.moved;
        drag.current.active = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        if (moved) settle(event.currentTarget);
      }}
      onPointerCancel={(event) => {
        drag.current.active = false;
        settle(event.currentTarget);
      }}
      onClickCapture={(event) => {
        if (drag.current.moved) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      {children.map((child, index) => (
        <div
          key={index}
          inert={page !== index}
          aria-hidden={page !== index}
          style={{
            flex: "0 0 100%",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            scrollSnapAlign: "start",
            scrollSnapStop: "always",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
