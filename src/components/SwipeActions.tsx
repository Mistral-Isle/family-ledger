import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, View } from "react-native";
import { useReducedMotion } from "./useReducedMotion";
import { resistedPosition, swipeTarget } from "./swipePhysics";
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
  const reduced = useReducedMotion();
  const config = useRef({ disabled, start: !!startActions, reduced });
  config.current = { disabled, start: !!startActions, reduced };
  const [side, setSide] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const base = useRef(0);
  const current = useRef(0);
  useEffect(() => {
    const listener = offset.addListener(({ value }) => {
      current.current = value;
      setSide(Math.sign(value));
    });
    return () => {
      offset.stopAnimation();
      offset.removeListener(listener);
    };
  }, [offset]);
  const settle = (value: number, velocity = 0) => {
    base.current = value;
    if (config.current.reduced) {
      offset.setValue(value);
      return;
    }
    Animated.spring(offset, {
      toValue: value,
      useNativeDriver: true,
      stiffness: 576,
      damping: 48,
      mass: 1,
      velocity,
    }).start();
  };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !config.current.disabled &&
        Math.abs(g.dx) > 8 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        base.current = current.current;
        offset.stopAnimation((value) => {
          base.current = value;
          current.current = value;
        });
      },
      onPanResponderMove: (_, g) => {
        current.current = resistedPosition(
          base.current + g.dx,
          config.current.start ? 80 : 0,
        );
        setSide(Math.sign(current.current));
        offset.setValue(current.current);
      },
      onPanResponderRelease: (_, g) => {
        const velocity = Math.max(-1500, Math.min(1500, g.vx * 1000));
        settle(
          swipeTarget(current.current, velocity, config.current.start ? 80 : 0),
          velocity,
        );
      },
      onPanResponderTerminate: () =>
        settle(swipeTarget(base.current, 0, config.current.start ? 80 : 0)),
    }),
  ).current;
  return (
    <View style={{ overflow: "hidden" }}>
      <View
        accessibilityElementsHidden={side >= 0}
        importantForAccessibility={side >= 0 ? "no-hide-descendants" : "auto"}
        pointerEvents={side < 0 ? "auto" : "none"}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 80,
          justifyContent: "center",
        }}
      >
        {actions}
      </View>
      <View
        accessibilityElementsHidden={side <= 0}
        importantForAccessibility={side <= 0 ? "no-hide-descendants" : "auto"}
        pointerEvents={side > 0 ? "auto" : "none"}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 80,
          justifyContent: "center",
        }}
      >
        {startActions}
      </View>
      <Animated.View
        {...responder.panHandlers}
        style={{ transform: [{ translateX: offset }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
