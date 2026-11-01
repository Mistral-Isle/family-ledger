import type { Account } from "./types";

export function entryAccountGroups(accounts: Account[], meId: string) {
  const available = accounts.filter(a => !a.deleted && !a.archived);
  return {
    mine: available.filter(a => !!meId && a.ownerMemberId === meId).sort((a, b) => a.sort - b.sort),
    more: available.filter(a => !meId || a.ownerMemberId !== meId).sort((a, b) => a.sort - b.sort),
  };
}
