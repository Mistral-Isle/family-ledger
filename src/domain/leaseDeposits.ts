import type { Snapshot } from "./types";

// Include deposits carried over through earlier contracts. Old records without
// links are suggested only when the original deposit can be identified uniquely.
export function leaseDepositIds(s: Snapshot, leaseId: string): string[] {
  const ids = new Set<string>(),
    visited = new Set<string>();
  let current: string | undefined = leaseId;
  while (current && !visited.has(current)) {
    visited.add(current);
    const plan = s.plans.find(
      (p) => p.id === current && !p.deleted && p.kind === "prepaid",
    );
    if (!plan) break;
    const d = JSON.parse(plan.data);
    if (!d.lease) break;
    if (Array.isArray(d.depositPlanIds)) {
      for (const id of d.depositPlanIds) ids.add(id);
    } else if (d.deposit > 0) {
      const matches = s.plans.filter((p) => {
        if (
          p.deleted ||
          p.kind !== "deposit" ||
          p.name !== plan.name + " · 押金"
        )
          return false;
        const deposit = JSON.parse(p.data);
        return (
          deposit.amount === d.deposit &&
          deposit.date === d.date &&
          deposit.paymentAccountId === d.paymentAccountId
        );
      });
      if (matches.length === 1) ids.add(matches[0]!.id);
    }
    current = d.renewedFrom;
  }
  return [...ids].filter((id) =>
    s.plans.some(
      (p) =>
        p.id === id &&
        !p.deleted &&
        p.kind === "deposit" &&
        !JSON.parse(p.data).closed,
    ),
  );
}

/** Deposits that belong to a lease are shown inside the lease, not as separate plans. */
export function leaseLinkedDepositIds(s: Snapshot): Set<string> {
  const ids = new Set<string>();
  const plans = s.plans.filter((p) => !p.deleted);
  for (const plan of plans) {
    if (plan.kind !== "prepaid") continue;
    const d = JSON.parse(plan.data);
    if (!d.lease) continue;
    for (const id of d.depositPlanIds ?? []) ids.add(id);
    if (Array.isArray(d.depositPlanIds)) continue;
    for (const p of plans)
      if (p.kind === "deposit" && p.name === plan.name + " · 押金") {
        const deposit = JSON.parse(p.data);
        if (
          deposit.date === d.date &&
          deposit.paymentAccountId === d.paymentAccountId
        )
          ids.add(p.id);
      }
  }
  return ids;
}
