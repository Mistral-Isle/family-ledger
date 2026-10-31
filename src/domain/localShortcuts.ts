import type { Account, Snapshot, Favorite } from "./types";
import { financialRow } from "./financialRows";
import { shortcuts } from "../i18n/shortcuts";

export function reorderItems<T extends { id: string }>(
  items: T[],
  ids: string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  if (
    ids.length !== items.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !byId.has(id))
  )
    throw new Error(shortcuts.changed);
  return ids.map((id) => byId.get(id)!);
}

export function pinnedAccounts(data: Snapshot) {
  return data.preferences.pinned.flatMap((id) => {
    const account = data.accounts.find(
      (a) => a.id === id && !a.deleted && a.scope === "family",
    );
    return account ? [account] : [];
  });
}

export function accountOrder(pinned: string[]) {
  const ranks = new Map(pinned.map((id, index) => [id, index]));
  return (a: Account, b: Account) =>
    (ranks.get(a.id) ?? pinned.length) - (ranks.get(b.id) ?? pinned.length) ||
    a.sort - b.sort;
}

export function favoriteFromTransaction(
  data: Snapshot,
  id: string,
): Omit<Favorite, "id"> | null {
  const txn = data.txns.find((t) => t.id === id && !t.deleted && !t.discarded);
  if (
    !txn ||
    txn.scope !== "family" ||
    !["expense", "income"].includes(txn.type) ||
    financialRow(data, txn)
  )
    return null;
  const category = data.categories.find(
    (c) =>
      c.id === txn.categoryId && !c.deleted && !c.hidden && c.kind === txn.type,
  );
  const account = data.accounts.find(
    (a) =>
      a.id === txn.accountId &&
      a.scope === "family" &&
      !a.deleted &&
      !a.archived,
  );
  if (
    !category ||
    !account ||
    data.categories.some(
      (c) => c.id === category.parentId && (c.hidden || c.deleted),
    )
  )
    return null;
  return {
    categoryId: category.id,
    accountId: account.id,
    label: category.name,
    amount: txn.amount,
    note: txn.note,
  };
}
