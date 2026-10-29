import type { Category, Snapshot, Txn, Favorite } from "./types";

export type CategoryDeletion =
  | { action: "migrate"; targetId: string }
  | { action: "create"; name: string }
  | { action: "discard" };

export function categoryDeletionImpact(s: Snapshot, id: string) {
  const source = s.categories.find((c) => c.id === id && !c.deleted);
  if (!source) throw new Error("分类不存在或已删除");
  const categories = s.categories.filter(
    (c) => !c.deleted && (c.id === id || c.parentId === id),
  );
  const ids = new Set(categories.map((c) => c.id));
  const txns = s.txns.filter(
    (t) =>
      !t.deleted &&
      (ids.has(t.categoryId ?? "") || ids.has(t.refundIncomeCategoryId ?? "")),
  );
  return {
    source,
    categories,
    txns,
    favorites: s.preferences.favorites.filter((f) => ids.has(f.categoryId)),
  };
}

export type CategoryDeletionHistory = {
  id: string;
  name: string;
  createdAt: string;
  action: CategoryDeletion["action"];
  categories: Category[];
  txns: Txn[];
  // Expected post-operation versions prevent restoring over later edits.
  versions: Record<string, string>;
  favoritesBefore?: Favorite[];
  favoritesAfter?: Favorite[];
};
