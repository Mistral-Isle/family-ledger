import { useState } from "react";
import { View } from "react-native";
import { InlineReorderList } from "./InlineReorderList";
import { ErrorText } from "./ui";
import { useLedger } from "./LedgerProvider";
import { reorderVisibleFavorites } from "../services/localShortcuts";
import { formatMoney } from "../domain/money";
import type { Favorite } from "../domain/types";

export function FavoriteList({
  items,
  onPress,
  manage = false,
}: {
  items: Favorite[];
  onPress: (favorite: Favorite) => void;
  manage?: boolean;
}) {
  const { data, repo, run } = useLedger();
  const [error, setError] = useState("");
  return (
    <View style={{ width: "100%", gap: 8 }}>
      <InlineReorderList
        maxHeight={manage ? 560 : 320}
        items={items.map((f) => ({
          id: f.id,
          name: f.label,
          subtitle:
            data.categories.find((c) => c.id === f.categoryId)?.name ??
            "分类已移除",
          amount: f.amount ? formatMoney(f.amount) : "",
          symbol: "star.fill",
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
