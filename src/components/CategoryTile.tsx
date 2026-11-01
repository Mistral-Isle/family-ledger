import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Category } from "../domain/types";
import { Icon, useTheme } from "./ui";

export function CategoryTile({ category, shown = category, selected, hasChildren, onPress }: {
  category: Category;
  shown?: Category;
  selected: boolean;
  hasChildren: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(70);
  const label = shown.id !== category.id ? `${category.name}·${shown.name}` : category.name;
  const units = [...label].reduce((sum, char) => sum + (/[^\u0000-\u00ff]/.test(char) ? 1 : 0.55), 0);
  const fontSize = Math.max(8, Math.min(11, (width - 4) / Math.max(1, units)));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={category.name}
      accessibilityState={{ selected }}
      accessibilityHint={shown.id !== category.id ? `已选${category.name}·${shown.name}` : hasChildren ? "选择二级分类" : undefined}
      onPress={onPress}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={({ pressed }) => ({ width: "20%", alignItems: "center", paddingVertical: 6, gap: 5, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: selected ? shown.kind === "income" ? t.incomeIcon : t.expenseIcon : t.idleIconBackground, alignItems: "center", justifyContent: "center" }}>
        <Icon name={shown.icon} size={25} color={selected ? "#fff" : t.idleIcon} />
        {hasChildren && (
          <View style={{ position: "absolute", right: -2, bottom: -2, width: 15, height: 13, borderRadius: 6, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}>
            <Icon name="ellipsis" size={12} color={t.idleIcon} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} ellipsizeMode="tail"
        style={{ width: "100%", fontSize, lineHeight: 15, color: selected ? t.text : t.muted, textAlign: "center", paddingHorizontal: 2 }}>
        {label}
      </Text>
    </Pressable>
  );
}
