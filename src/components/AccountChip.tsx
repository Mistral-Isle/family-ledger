import { Pressable } from "react-native";
import type { AccountKind } from "../domain/types";
import { AccountIcon } from "./AccountIcon";
import { Txt, useTheme } from "./ui";

export function AccountChip({
  kind,
  label,
  selected = false,
  onPress,
}: {
  kind: AccountKind;
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      aria-pressed={selected}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        minHeight: 44,
        maxWidth: "100%",
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 16,
        borderCurve: "continuous",
        backgroundColor: selected ? t.primary : pressed ? t.soft : t.card,
      })}
    >
      <AccountIcon kind={kind} size={26} selected={selected} />
      <Txt
        size={13}
        color={selected ? "#FFFFFF" : t.text}
        bold={selected}
        style={{ flexShrink: 1 }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
