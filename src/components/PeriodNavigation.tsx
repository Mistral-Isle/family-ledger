import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Icon, useTheme } from "./ui";

export function PeriodNavigation({
  children,
  onPrevious,
  onNext,
  previousLabel = "上一期",
  nextLabel = "下一期",
}: {
  children: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel?: string;
  nextLabel?: string;
}) {
  const t = useTheme();
  const arrow = (back: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={back ? previousLabel : nextLabel}
      onPress={back ? onPrevious : onNext}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: t.blue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          name={back ? "chevron.left" : "chevron.right"}
          color={t.dark ? t.bg : "#FFFFFF"}
          size={17}
        />
      </View>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {arrow(true)}
      <View style={{ flex: 1, alignItems: "center", minWidth: 0 }}>
        {children}
      </View>
      {arrow(false)}
    </View>
  );
}
