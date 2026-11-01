import { useState } from "react";
import { View } from "react-native";
import { InlineReorderList } from "./InlineReorderList";
import { ErrorText, useTheme } from "./ui";
import { useLedger } from "./LedgerProvider";
import { reorderVisibleFavorites } from "../services/localShortcuts";
import { formatMoney } from "../domain/money";
import type { Favorite } from "../domain/types";

export function FavoriteList({
  items,
  onPress,
  manage = false,
  selectedId,
}: {
  items: Favorite[];
  onPress: (favorite: Favorite) => void;
  manage?: boolean;
  selectedId?: string;
}) {
  const { data, repo, run } = useLedger();
  const t = useTheme();
  const [error, setError] = useState("");
  return (
    <View style={{ width: "100%", gap: 8 }}>
      <InlineReorderList
        maxHeight={manage ? 560 : 320}
        rowHeight={64}
        items={items.map((f) => ({
          id: f.id,
          name: f.label,
          subtitle:
            data.categories.find((c) => c.id === f.categoryId)?.name ??
            "分类已移除",
          amount: f.amount ? formatMoney(f.amount) : "",
          symbol:
            data.categories.find((c) => c.id === f.categoryId)?.icon ??
            "tag.fill",
          color: data.categories.find((c) => c.id === f.categoryId)?.kind === "income" ? t.incomeIcon : t.expenseIcon,
          selected: String(selectedId === f.id),
          trailing: manage ? "remove" : "",
        }))}
        onReorder={(ids) => {
          run(() => reorderVisibleFavorites(repo, ids));
          setError("");
        }}
        onPress={(id) => {
          const favorite = items.find((f) => f.id === id);
          if (favorite) onPress(favorite);
        }}
        onAction={(id) => {
          try {
            run(() =>
              repo.updatePreferences({
                favorites: repo
                  .snapshot()
                  .preferences.favorites.filter((f) => f.id !== id),
              }),
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
        onError={setError}
      />
      <ErrorText message={error} />
    </View>
  );
}
