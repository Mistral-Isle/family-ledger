import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useReducedMotion } from "./useReducedMotion";

export type SummaryPagerProps = {
  page: number;
  onChange: (page: number) => void;
  children: ReactNode[];
};

/** Native paging keeps horizontal swipes independent of the vertical ledger. */
export function SummaryPager({ page, onChange, children }: SummaryPagerProps) {
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const previousWidth = useRef(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!width) return;
    scroll.current?.scrollTo({
      x: page * width,
      animated: !reduced && previousWidth.current === width,
    });
    previousWidth.current = width;
  }, [page, width, reduced]);
  return (
    <ScrollView
      ref={scroll}
      testID="summary-pager"
      horizontal
      pagingEnabled
      directionalLockEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onMomentumScrollEnd={(event) => {
        if (!width) return;
        const next = Math.max(
          0,
          Math.min(
            children.length - 1,
            Math.round(event.nativeEvent.contentOffset.x / width),
          ),
        );
        if (next !== page) onChange(next);
      }}
      contentContainerStyle={{ alignItems: "stretch" }}
    >
      {width > 0 &&
        children.map((child, index) => (
          <View
            key={index}
            style={{ width }}
            accessibilityElementsHidden={page !== index}
            importantForAccessibility={
              page !== index ? "no-hide-descendants" : "auto"
            }
            pointerEvents={page === index ? "auto" : "none"}
          >
            {child}
          </View>
        ))}
    </ScrollView>
  );
}
