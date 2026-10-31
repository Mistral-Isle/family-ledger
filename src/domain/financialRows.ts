import type { Snapshot, Txn } from "./types";

export function financialRow(s: Snapshot, txn: Txn) {
  const plan = s.plans.find(
    (p) =>
      !p.deleted &&
      ["prepaid", "deposit"].includes(p.kind) &&
      JSON.parse(p.data).txnIds?.includes(txn.id),
  );
  if (!plan) return null;
  const d = JSON.parse(plan.data);
  const paying = txn.type === "transfer" && txn.toAccountId === d.accountId;
  const returning = txn.type === "transfer" && txn.accountId === d.accountId;
  const rent =
    !!d.lease ||
    s.categories.some((c) => c.id === d.categoryId && c.name === "房租");
  const label =
    plan.kind === "deposit"
      ? paying
        ? "缴纳押金"
        : returning
          ? "押金退回"
          : "押金扣除"
      : paying
        ? rent
          ? "预付租金"
          : "预付费用"
        : returning || txn.type === "refund"
          ? rent
            ? "租金退回"
            : "预付费用退回"
          : txn.note.includes("未退租金")
            ? "退租损失"
            : rent
              ? "房租分摊"
              : "费用分摊";
  const hint = paying
    ? "实际付款，转入押金或预付余额"
    : returning
      ? "退回账户，不计收入"
      : txn.type === "expense" && plan.kind === "prepaid"
        ? "计入支出，不再扣付款账户"
        : "";
  let group = plan;
  if (plan.kind === "deposit") {
    const candidates = s.plans.filter((p) => {
      if (p.deleted || p.kind !== "prepaid") return false;
      const prepaid = JSON.parse(p.data);
      return (
        prepaid.depositPlanIds?.includes(plan.id) ||
        (plan.name === p.name + " · 押金" &&
          d.date === prepaid.date &&
          d.paymentAccountId === prepaid.paymentAccountId)
      );
    });
    if (candidates.length === 1) group = candidates[0]!;
  }
  return {
    plan,
    groupId: group.id,
    name: group.name,
    label,
    hint,
    paid: paying ? txn.amount : 0,
    returned: returning || txn.type === "refund" ? txn.amount : 0,
  };
}

export function financialRowGroups(s: Snapshot, txns: Txn[]) {
  const groups: { id: string; name: string; txns: Txn[] }[] = [];
  for (const txn of txns) {
    const info = financialRow(s, txn);
    const key = info ? "plan:" + info.groupId : "txn:" + txn.id;
    const existing = groups.find((g) => g.id === key);
    if (existing) existing.txns.push(txn);
    else groups.push({ id: key, name: info?.name ?? "", txns: [txn] });
  }
  return groups;
}
