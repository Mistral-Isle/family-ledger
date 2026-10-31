import { leaseSchedule, leaseParts, leaseExit } from "../src/domain/lease";
import { fixture } from "./sqlite";
import { accountBalance, totals } from "../src/domain/selectors";
import { leaseDepositIds } from "../src/domain/leaseDeposits";
import { financialRowGroups } from "../src/domain/financialRows";

test.each([590000, 550000, 600000, 0])(
  "early exit refunds %i, removes future rent and settles deposit atomically",
  (returned) => {
    const f = fixture(),
      other = fixture();
    try {
      const s = f.repo.snapshot(),
        bank = s.accounts[0]!,
        categoryId = s.categories.find((c) => c.kind === "expense")!.id;
      f.repo.createLease({
        name: "公寓",
        paymentAccountId: bank.id,
        categoryId,
        lease: {
          start: "2025-01-01",
          end: "2025-12-31",
          cycle: "quarter",
          rent: 900000,
        },
        deposit: 300000,
        date: "2025-01-01",
      });
      const before = f.repo.snapshot(),
        plan = before.plans.find((p) => p.kind === "prepaid")!;
      const originalJanuary = before.txns.find(
        (t) => t.type === "expense" && t.occurredAt === "2025-01-01",
      )!;
      expect(
        leaseExit(JSON.parse(plan.data).lease, 1, "2025-01-31").unused,
      ).toBe(590000);
      f.repo.endLease(
        plan.id,
        "2025-01-31",
        {
          depositIds: leaseDepositIds(before, plan.id),
          returned: 250000,
          accountId: bank.id,
          categoryId,
        },
        { returned, accountId: bank.id },
      );
      const after = f.repo.snapshot();
      expect(after.txns.find((t) => t.id === originalJanuary.id)!.amount).toBe(
        originalJanuary.amount,
      );
      expect(
        after.txns.filter(
          (t) =>
            !t.deleted && t.type === "expense" && t.occurredAt > "2025-01-31",
        ),
      ).toEqual([]);
      expect(accountBalance(bank, after.txns)).toBe(-950000 + returned);
      expect(totals(after.txns)).toMatchObject({
        income: 0,
        expense: 950000 - returned,
      });
      expect(
        accountBalance(
          after.accounts.find((a) => a.kind === "prepaid")!,
          after.txns,
        ),
      ).toBe(0);
      other.repo.restoreBackup(f.repo.exportBackup());
      expect(other.repo.snapshot()).toEqual(after);
    } finally {
      f.sqlite.close();
      other.sqlite.close();
    }
  },
);

test("early exit keeps earlier month cents and rejects invalid refunds without changing anything", () => {
  const terms = {
    start: "2024-01-29",
    end: "2024-12-31",
    cycle: "quarter" as const,
    rent: 100001,
  };
  const full = leaseParts(leaseSchedule(terms)[0]!);
  const exit = leaseExit(terms, 1, "2024-02-15");
  expect(exit.parts[0]!.amount).toBe(full[0]!.amount);
  expect(exit.parts.slice(2).every((p) => p.amount === 0)).toBe(true);
  expect(exit.parts.reduce((sum, p) => sum + p.amount, exit.unused)).toBe(
    100001,
  );
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      bank = s.accounts[0]!,
      categoryId = s.categories.find((c) => c.kind === "expense")!.id;
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: terms,
      deposit: 30000,
      date: terms.start,
    });
    const before = f.repo.snapshot(),
      p = before.plans.find((p) => p.kind === "prepaid")!;
    expect(() => f.repo.endLease(p.id, "2024-02-15")).toThrow();
    expect(() =>
      f.repo.endLease(p.id, "2024-02-15", undefined, {
        returned: 100002,
        accountId: bank.id,
      }),
    ).toThrow();
    expect(() =>
      f.repo.endLease(
        p.id,
        "2024-02-15",
        {
          depositIds: leaseDepositIds(before, p.id),
          returned: 30001,
          accountId: bank.id,
          categoryId,
        },
        { returned: exit.unused, accountId: bank.id },
      ),
    ).toThrow();
    expect(f.repo.snapshot()).toEqual(before);
  } finally {
    f.sqlite.close();
  }
});

test("legacy rent payment, deposit and monthly allocation collapse without changing totals", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    f.repo.createRent({
      name: "房租",
      monthlyRent: 350000,
      depositMonths: 1,
      prepayMonths: 3,
      start: "2025-01-01",
      paymentAccountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
    });
    const after = f.repo.snapshot(),
      rows = after.txns.filter((t) => t.occurredAt === "2025-01-01");
    const groups = financialRowGroups(after, rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.txns).toHaveLength(3);
    expect(totals(groups.flatMap((g) => g.txns))).toEqual(totals(rows));
    expect(totals(rows).expense).toBe(350000);
  } finally {
    f.sqlite.close();
  }
});

test.each([300000, 250000, 0])(
  "ending a lease settles deposit refund %i and only charges the deduction",
  (returned) => {
    const f = fixture(),
      other = fixture();
    try {
      const s = f.repo.snapshot(),
        bank = s.accounts[0]!,
        categoryId = s.categories.find((c) => c.kind === "expense")!.id;
      f.repo.createLease({
        name: "公寓",
        paymentAccountId: bank.id,
        categoryId,
        lease: {
          start: "2025-01-01",
          end: "2025-12-31",
          cycle: "quarter",
          rent: 900000,
        },
        deposit: 300000,
        date: "2025-01-01",
      });
      const p = f.repo.snapshot().plans.find((p) => p.kind === "prepaid")!;
      const depositIds = leaseDepositIds(f.repo.snapshot(), p.id);
      expect(depositIds).toHaveLength(1);
      const settlement = {
        depositIds,
        returned,
        accountId: bank.id,
        categoryId,
      };
      f.repo.endLease(p.id, "2025-03-31", settlement);
      const after = f.repo.snapshot();
      expect(accountBalance(bank, after.txns, "2025-12-31")).toBe(
        -1200000 + returned,
      );
      expect(totals(after.txns).expense).toBe(1200000 - returned);
      expect(totals(after.txns).income).toBe(0);
      const deposit = after.accounts.find((a) => a.kind === "deposit")!;
      expect(accountBalance(deposit, after.txns, "2025-12-31")).toBe(0);
      expect(deposit.archived).toBe(true);
      expect(leaseDepositIds(after, p.id)).toEqual([]);
      expect(() => f.repo.endLease(p.id, "2025-03-31", settlement)).toThrow();
      expect(f.repo.snapshot()).toEqual(after);
      other.repo.restoreBackup(f.repo.exportBackup());
      expect(other.repo.snapshot()).toEqual(after);
    } finally {
      f.sqlite.close();
      other.sqlite.close();
    }
  },
);

test("deposit settlement validates amount and rolls back refund if ending fails", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      bank = s.accounts[0]!,
      categoryId = s.categories.find((c) => c.kind === "expense")!.id;
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: {
        start: "2025-01-01",
        end: "2025-12-31",
        cycle: "quarter",
        rent: 900000,
      },
      deposit: 300000,
      date: "2025-01-01",
    });
    const before = f.repo.snapshot(),
      p = before.plans.find((p) => p.kind === "prepaid")!;
    const settlement = {
      depositIds: leaseDepositIds(before, p.id),
      returned: 300001,
      accountId: bank.id,
      categoryId,
    };
    expect(() => f.repo.endLease(p.id, "2025-03-31", settlement)).toThrow();
    expect(f.repo.snapshot()).toEqual(before);
    f.sqlite.exec(
      "CREATE TRIGGER fail_end BEFORE UPDATE ON plan WHEN NEW.kind='prepaid' BEGIN SELECT RAISE(ABORT,'forced'); END",
    );
    expect(() =>
      f.repo.endLease(p.id, "2025-03-31", { ...settlement, returned: 250000 }),
    ).toThrow("forced");
    expect(f.repo.snapshot()).toEqual(before);
  } finally {
    f.sqlite.close();
  }
});

test("renewed lease carries original and additional deposits into one settlement", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot(),
      bank = s.accounts[0]!,
      categoryId = s.categories.find((c) => c.kind === "expense")!.id;
    const input = {
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: {
        start: "2024-01-01",
        end: "2024-12-31",
        cycle: "year" as const,
        rent: 1200000,
      },
      deposit: 300000,
      date: "2024-01-01",
    };
    f.repo.createLease(input);
    const original = f.repo.snapshot().plans.find((p) => p.kind === "prepaid")!;
    f.repo.createLease({
      ...input,
      lease: { ...input.lease, start: "2025-01-01", end: "2025-12-31" },
      date: "2025-01-01",
      deposit: 50000,
      renewedFrom: original.id,
    });
    const renewed = f.repo
      .snapshot()
      .plans.find((p) => JSON.parse(p.data).renewedFrom === original.id)!;
    const depositIds = leaseDepositIds(f.repo.snapshot(), renewed.id);
    expect(depositIds).toHaveLength(2);
    f.repo.endLease(renewed.id, "2025-12-31", {
      depositIds,
      returned: 320000,
      accountId: bank.id,
      categoryId,
    });
    expect(totals(f.repo.snapshot().txns).expense).toBe(2430000);
    expect(leaseDepositIds(f.repo.snapshot(), original.id)).toEqual([]);
    expect(
      f.repo
        .snapshot()
        .plans.filter((p) => p.kind === "deposit")
        .every((p) => JSON.parse(p.data).closed),
    ).toBe(true);
  } finally {
    f.sqlite.close();
  }
});

test("rent changes affect only unpaid periods and ending preserves history and blocks payments", () => {
  const f = fixture(),
    other = fixture();
  try {
    const s = f.repo.snapshot(),
      bank = s.accounts[0]!;
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
      lease: {
        start: "2025-01-01",
        end: "2025-12-31",
        cycle: "quarter",
        rent: 900000,
      },
      deposit: 300000,
      date: "2025-01-01",
    });
    const plan = f.repo.snapshot().plans.find((p) => p.kind === "prepaid")!;
    const originalTxns = f.repo.snapshot().txns;
    expect(() => f.repo.adjustLeaseRent(plan.id, 0, 990000)).toThrow();
    expect(() => f.repo.adjustLeaseRent(plan.id, 1, 0)).toThrow();
    f.repo.adjustLeaseRent(plan.id, 1, 990000);
    expect(f.repo.snapshot().txns).toEqual(originalTxns);
    let d = JSON.parse(
      f.repo.snapshot().plans.find((p) => p.id === plan.id)!.data,
    );
    expect(leaseSchedule(d.lease).map((p) => p.amount)).toEqual([
      900000, 990000, 990000, 990000,
    ]);
    f.repo.payLease(plan.id, 1, "2025-04-01", bank.id);
    f.repo.adjustLeaseRent(plan.id, 2, 960000);
    d = JSON.parse(f.repo.snapshot().plans.find((p) => p.id === plan.id)!.data);
    expect(leaseSchedule(d.lease).map((p) => p.amount)).toEqual([
      900000, 990000, 960000, 960000,
    ]);
    const paid = f.repo.snapshot();
    expect(accountBalance(bank, paid.txns, "2025-12-31")).toBe(-2190000);
    expect(() => f.repo.endLease(plan.id, "2025-03-31")).toThrow();
    f.repo.endLease(plan.id, "2025-06-30");
    expect(f.repo.snapshot().txns).toEqual(paid.txns);
    expect(f.repo.snapshot().accounts).toEqual(paid.accounts);
    expect(
      JSON.parse(f.repo.snapshot().plans.find((p) => p.id === plan.id)!.data),
    ).toMatchObject({ closed: true, endedAt: "2025-06-30" });
    expect(() => f.repo.payLease(plan.id, 2, "2025-07-01", bank.id)).toThrow();
    expect(() => f.repo.adjustLeaseRent(plan.id, 2, 900000)).toThrow();
    expect(() => f.repo.endLease(plan.id, "2025-06-30")).toThrow();
    other.repo.restoreBackup(f.repo.exportBackup());
    expect(other.repo.snapshot()).toEqual(f.repo.snapshot());
  } finally {
    f.sqlite.close();
    other.sqlite.close();
  }
});

test("annual lease paid quarterly, month-end anchors, weekly final period and cent conservation", () => {
  const quarters = leaseSchedule({
    start: "2026-01-01",
    end: "2026-12-31",
    cycle: "quarter",
    rent: 900000,
  });
  expect(quarters.map((p) => p.start)).toEqual([
    "2026-01-01",
    "2026-04-01",
    "2026-07-01",
    "2026-10-01",
  ]);
  expect(quarters.map((p) => p.amount)).toEqual([
    900000, 900000, 900000, 900000,
  ]);
  const months = leaseSchedule({
    start: "2024-01-31",
    end: "2024-04-29",
    cycle: "month",
    rent: 10000,
  });
  expect(months.map((p) => p.start)).toEqual([
    "2024-01-31",
    "2024-02-29",
    "2024-03-31",
  ]);
  const weeks = leaseSchedule({
    start: "2026-01-29",
    end: "2026-02-07",
    cycle: "week",
    rent: 70000,
  });
  expect(weeks.map((p) => p.amount)).toEqual([70000, 30000]);
  expect(leaseParts(weeks[0]!)).toEqual([
    { date: "2026-01-29", amount: 30000 },
    { date: "2026-02-01", amount: 40000 },
  ]);
  for (const period of [...quarters, ...months, ...weeks])
    expect(leaseParts(period).reduce((sum, p) => sum + p.amount, 0)).toBe(
      period.amount,
    );
  expect(
    leaseSchedule({
      start: "2024-01-01",
      end: "2025-12-31",
      cycle: "year",
      rent: 120000,
    }).length,
  ).toBe(2);
});

test("lease payments, renewal, duplicate protection and backup round trip", () => {
  const f = fixture(),
    other = fixture();
  try {
    const s = f.repo.snapshot(),
      bank = s.accounts[0]!;
    const input = {
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId: s.categories.find((c) => c.kind === "expense")!.id,
      lease: {
        start: "2026-01-01",
        end: "2026-12-31",
        cycle: "quarter" as const,
        rent: 900000,
      },
      deposit: 300000,
      date: "2026-01-01",
    };
    f.repo.createLease(input);
    const plan = f.repo.snapshot().plans.find((p) => p.kind === "prepaid")!;
    expect(accountBalance(bank, f.repo.snapshot().txns, "2026-12-31")).toBe(
      -1200000,
    );
    f.repo.payLease(plan.id, 1, "2026-04-01", bank.id);
    const paid = f.repo.snapshot();
    expect(accountBalance(bank, paid.txns, "2026-12-31")).toBe(-2100000);
    expect(totals(paid.txns).expense).toBe(1800000);
    expect(() => f.repo.payLease(plan.id, 1, "2026-04-01", bank.id)).toThrow();
    expect(f.repo.snapshot()).toEqual(paid);
    const renewal = {
      ...input,
      deposit: 0,
      date: "2027-01-01",
      renewedFrom: plan.id,
      lease: { ...input.lease, start: "2027-01-01", end: "2027-12-31" },
    };
    f.repo.createLease(renewal);
    expect(
      f.repo.snapshot().plans.filter((p) => p.kind === "deposit"),
    ).toHaveLength(1);
    expect(() => f.repo.createLease(renewal)).toThrow("已续租");
    other.repo.restoreBackup(f.repo.exportBackup());
    expect(other.repo.snapshot()).toEqual(f.repo.snapshot());
  } finally {
    f.sqlite.close();
    other.sqlite.close();
  }
});

test("lease creation is atomic when writing a plan fails", () => {
  const f = fixture();
  try {
    const before = f.repo.snapshot();
    f.sqlite.exec(
      "CREATE TRIGGER fail_lease BEFORE INSERT ON plan WHEN NEW.kind='prepaid' BEGIN SELECT RAISE(ABORT,'forced'); END",
    );
    expect(() =>
      f.repo.createLease({
        name: "租赁",
        paymentAccountId: before.accounts[0]!.id,
        categoryId: before.categories.find((c) => c.kind === "expense")!.id,
        lease: {
          start: "2026-01-01",
          end: "2026-12-31",
          cycle: "quarter",
          rent: 900000,
        },
        deposit: 300000,
        date: "2026-01-01",
      }),
    ).toThrow("forced");
    expect(f.repo.snapshot()).toEqual(before);
  } finally {
    f.sqlite.close();
  }
});
