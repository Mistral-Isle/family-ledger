import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "./useReducedMotion";
import { resistedPosition, swipeTarget, swipeWidth } from "./swipePhysics";
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
  const reduced = useReducedMotion();
  const current = useRef(0),
    frame = useRef(0),
    consumed = useRef(false);
  const max = startActions ? swipeWidth : 0;
  const gesture = useRef({
    x: 0,
    y: 0,
    base: 0,
    active: false,
    horizontal: false,
    vertical: false,
    lastX: 0,
    time: 0,
    velocity: 0,
    pointer: -1,
  });
  const show = (value: number) => {
    current.current = value;
    setOffset(value);
  };
  const stop = () => cancelAnimationFrame(frame.current);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const settle = (target: number, velocity = 0) => {
    stop();
    if (reduced) {
      show(target);
      return;
    }
    let last = performance.now();
    // Analytic critical spring, interrupted from its current presentation value.
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.064);
      last = now;
      const delta = current.current - target,
        omega = 24;
      const c = velocity + omega * delta,
        decay = Math.exp(-omega * dt);
      const next = (delta + c * dt) * decay;
      velocity = (velocity - omega * c * dt) * decay;
      show(target + next);
      if (Math.abs(next) < 0.2 && Math.abs(velocity) < 2) show(target);
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <div
        aria-hidden={offset >= 0}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: swipeWidth,
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
          width: swipeWidth,
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
          touchAction: "pan-y",
          userSelect: "none",
          willChange: dragging ? "transform" : "auto",
          cursor: disabled ? "pointer" : dragging ? "grabbing" : "grab",
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary || disabled) return;
          stop();
          consumed.current = false;
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            base: current.current,
            active: true,
            horizontal: false,
            vertical: false,
            lastX: e.clientX,
            time: e.timeStamp,
            velocity: 0,
            pointer: e.pointerId,
          };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g.active || g.vertical || g.pointer !== e.pointerId) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (!g.horizontal) {
            if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
              g.vertical = true;
              settle(swipeTarget(current.current, 0, max));
              return;
            }
            if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            g.horizontal = true;
            consumed.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
          }
          const dt = e.timeStamp - g.time;
          if (dt > 0)
            g.velocity = Math.max(
              -1500,
              Math.min(1500, ((e.clientX - g.lastX) / dt) * 1000),
            );
          g.lastX = e.clientX;
          g.time = e.timeStamp;
          show(resistedPosition(g.base + dx, max));
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          if (g.pointer !== e.pointerId) return;
          g.active = false;
          setDragging(false);
          const velocity = e.timeStamp - g.time < 80 ? g.velocity : 0;
          settle(swipeTarget(current.current, velocity, max), velocity);
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => {
          const g = gesture.current;
          if (!g.horizontal && g.active) {
            g.active = false;
            settle(swipeTarget(current.current, 0, max));
          }
        }}
        onPointerCancel={() => {
          gesture.current.active = false;
          setDragging(false);
          settle(swipeTarget(gesture.current.base, 0, max));
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
