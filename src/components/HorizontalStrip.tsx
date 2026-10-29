import type { ReactNode } from "react";
import { ScrollView } from "react-native";
export function HorizontalStrip({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
    >
      {children}
    </ScrollView>
  );
}
