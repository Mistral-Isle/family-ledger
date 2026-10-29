import { useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, View } from "react-native";
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
  const config = useRef({ disabled, start: !!startActions });
  config.current = { disabled, start: !!startActions };
  const [side, setSide] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const base = useRef(0);
  const current = useRef(0);
  const settle = (value: number) => {
    base.current = value;
    current.current = value;
    setSide(Math.sign(value));
    Animated.spring(offset, {
      toValue: value,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  };
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !config.current.disabled &&
        Math.abs(g.dx) > 8 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        offset.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        current.current = Math.max(
          -80,
          Math.min(config.current.start ? 80 : 0, base.current + g.dx),
        );
        setSide(Math.sign(current.current));
        offset.setValue(current.current);
      },
      onPanResponderRelease: () =>
        settle(current.current < -40 ? -80 : current.current > 40 ? 80 : 0),
      onPanResponderTerminate: () => settle(base.current),
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
