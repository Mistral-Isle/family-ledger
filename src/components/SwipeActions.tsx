import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

// Only one row exposes actions at a time, like the native account list.
let openRow: { id: symbol; close: () => void } | null = null;

export function SwipeActions({
  children,
  actions,
  startActions,
  disabled = false,
  actionWidth = 80,
  startWidth = 80,
}: {
  children: ReactNode;
  actions: ReactNode;
  startActions?: ReactNode;
  disabled?: boolean;
  actionWidth?: number;
  startWidth?: number;
}) {
  const swipe = useRef<SwipeableMethods>(null);
  const id = useRef(Symbol("swipe-row")).current;
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        // Unmount the recognizer on blur so a cancelled drag cannot survive a tab change.
        setFocused(false);
        if (openRow?.id === id) openRow = null;
      };
    }, [id]),
  );
  const claimRow = () => {
    if (openRow?.id !== id) openRow?.close();
    openRow = { id, close: () => swipe.current?.close() };
  };
  if (!focused || disabled) return <View>{children}</View>;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={1}
      dragOffsetFromLeftEdge={6}
      dragOffsetFromRightEdge={6}
      leftThreshold={startWidth * 0.32}
      rightThreshold={actionWidth * 0.32}
      overshootLeft={false}
      overshootRight={false}
      enableTrackpadTwoFingerGesture
      onSwipeableOpenStartDrag={claimRow}
      onSwipeableWillOpen={claimRow}
      onSwipeableClose={() => {
        if (openRow?.id === id) openRow = null;
      }}
      renderLeftActions={
        startActions
          ? () => (
              <View style={{ width: startWidth, justifyContent: "center" }}>
                {startActions}
              </View>
            )
          : undefined
      }
      renderRightActions={() => (
        <View style={{ width: actionWidth, justifyContent: "center" }}>
          {actions}
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
