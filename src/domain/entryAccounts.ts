import type { Account, FinancialPlan } from "./types";
import { isHoldingAccount } from "./rentAccounts";

/** Accounts a plan keeps for itself, such as a loan's balance; entries never pick them. */
export function planAccountIds(plans: FinancialPlan[]) {
  return new Set(plans.filter(p => !p.deleted).map(p => JSON.parse(p.data).accountId as string));
}

export function entryAccountGroups(accounts: Account[], meId: string, planAccounts = new Set<string>()) {
  const available = accounts.filter(a => !a.deleted && !a.archived && !isHoldingAccount(a) && !planAccounts.has(a.id));
  return {
    mine: available.filter(a => !!meId && a.ownerMemberId === meId).sort((a, b) => a.sort - b.sort),
    more: available.filter(a => a.scope === "family" && (!meId || a.ownerMemberId !== meId)).sort((a, b) => a.sort - b.sort),
  };
}
