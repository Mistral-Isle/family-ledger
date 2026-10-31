import type { Snapshot } from "./types";

// Hide rental bookkeeping accounts from everyday lists, while retaining their
// balances, transactions and management through the rental plan.
export function rentAccountIds(s: Snapshot): Set<string> {
  const plans = s.plans
    .filter((p) => !p.deleted)
    .map((plan) => ({ plan, data: JSON.parse(plan.data) }));
  const rentals = plans.filter(
    ({ plan, data }) =>
      plan.kind === "prepaid" &&
      (data.lease ||
        s.categories.some(
          (c) => c.id === data.categoryId && c.name === "房租",
        )),
  );
  const ids = new Set<string>(rentals.map(({ data }) => data.accountId));
  for (const { plan, data } of plans) {
    if (plan.kind !== "deposit") continue;
    if (
      rentals.some(
        ({ plan: rental, data: rent }) =>
          rent.depositPlanIds?.includes(plan.id) ||
          (plan.name === rental.name + " · 押金" &&
            data.date === rent.date &&
            data.paymentAccountId === rent.paymentAccountId),
      )
    )
      ids.add(data.accountId);
  }
  return ids;
}
