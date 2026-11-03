import type { Snapshot } from "./types";
import { accountBalance } from "./selectors";
import { assertMoney } from "./money";

export type AssetView = "mine" | "family";

export function assetViewAccounts(data: Snapshot, view: AssetView, at: string) {
  return data.accounts
    .filter(a => a.scope === "family" && !a.deleted &&
      (view === "family" || (!!data.meId && a.ownerMemberId === data.meId)))
    .sort((a, b) => a.sort - b.sort)
    .map(account => ({ account, balance: accountBalance(account, data.txns, at) }));
}

export function assetAccountGroups(data: Snapshot, rows: ReturnType<typeof assetViewAccounts>) {
  const owners = [...new Set(rows.map(row => row.account.ownerMemberId))];
  owners.sort((a, b) => Number(b === data.meId) - Number(a === data.meId));
  return owners.map(id => ({
    id,
    name: id === data.meId ? "我的账户" :
      id ? `${data.members.find(m => m.id === id)?.name ?? "未识别成员"}的账户` : "共同账户",
    rows: rows.filter(row => row.account.ownerMemberId === id),
  }));
}

const spendable = ["bank", "wechat", "alipay", "cash"] as const;

/** Money at hand: bank, wallet and cash balances, less what credit cards owe. */
export function availableBalance(rows: ReturnType<typeof assetViewAccounts>) {
  const sum = (kind: string) =>
    rows
      .filter(r => r.account.kind === kind)
      .reduce((n, r) => assertMoney(n + r.balance), 0);
  const parts = [
    ...spendable.map(kind => ({ kind, amount: sum(kind) })),
    { kind: "credit" as const, amount: sum("credit") },
  ].filter(p => p.amount !== 0);
  return {
    total: parts.reduce((n, p) => assertMoney(n + p.amount), 0),
    parts,
  };
}
