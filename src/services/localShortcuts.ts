import type { LedgerRepository } from "../db/repository";
import {
  favoriteFromTransaction,
  pinnedAccounts,
  reorderItems,
} from "../domain/localShortcuts";
import { shortcuts } from "../i18n/shortcuts";

export function reorderShortcuts(
  repo: LedgerRepository,
  kind: "favorites" | "pinned",
  ids: string[],
) {
  // Re-read at save time: a sync or another editor must not resurrect removed items.
  const data = repo.snapshot();
  if (kind === "favorites") {
    repo.updatePreferences({
      favorites: reorderItems(data.preferences.favorites, ids),
    });
  } else {
    const ordered = reorderItems(pinnedAccounts(data), ids).map((a) => a.id);
    repo.updatePreferences({ pinned: ordered });
  }
}

export function saveTransactionFavorite(
  repo: LedgerRepository,
  id: string,
  label: string,
) {
  const favorite = favoriteFromTransaction(repo.snapshot(), id);
  if (!favorite) throw new Error(shortcuts.unavailable);
  repo.saveFavorite({ ...favorite, label });
}

export function reorderVisibleFavorites(repo: LedgerRepository, ids: string[]) {
  const data = repo.snapshot(),
    items = data.preferences.favorites;
  const chosen = new Set(ids);
  const visible = items.filter((f) => chosen.has(f.id));
  const ordered = reorderItems(visible, ids);
  let index = 0;
  repo.updatePreferences({
    favorites: items.map((f) => (chosen.has(f.id) ? ordered[index++]! : f)),
  });
}
