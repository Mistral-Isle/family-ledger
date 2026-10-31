import type { Snapshot, Txn } from "./types";
export const privacyAccountId = (memberId: string) => "privacy:" + memberId;
export const privacyMemberId = (id: string | null | undefined) =>
  id?.startsWith("privacy:") ? id.slice(8) : null;
export function transferAccountName(s: Snapshot, id: string | null) {
  const member = privacyMemberId(id);
  if (member) return member === s.meId ? "我的隐私账户" : "对方的隐私账户";
  return (
    s.accounts.find((a) => a.id === id && a.scope === "family")?.name ?? "账户"
  );
}
export function transferDirection(s: Snapshot, t: Txn) {
  const owner = (id: string | null) =>
    privacyMemberId(id) ?? s.accounts.find((a) => a.id === id)?.ownerMemberId;
  return owner(t.accountId) === owner(t.toAccountId)
    ? "转账"
    : owner(t.toAccountId) === s.meId
      ? "转入"
      : owner(t.accountId) === s.meId
        ? "转出"
        : "转账";
}
