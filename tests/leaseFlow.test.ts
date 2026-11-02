import { fixture } from "./sqlite";
import { leaseExit, leaseParts, leaseSchedule } from "../src/domain/lease";
import { leaseDepositIds, leaseLinkedDepositIds } from "../src/domain/leaseDeposits";
import { accountBalance, totals } from "../src/domain/selectors";
import { detailViewSnapshot, filterMonthTransactions } from "../src/domain/transactionFilters";
import { entryAccountGroups } from "../src/domain/entryAccounts";
import { validatePlanData } from "../src/domain/finance";
import { calculate, optionalAmount } from "../src/domain/money";

function setup() {
  const f = fixture();
  const s = f.repo.snapshot();
  return {
    f,
    bank: s.accounts[0]!,
    categoryId: s.categories.find((c) => c.kind === "expense")!.id,
  };
}
const leasePlan = (f: ReturnType<typeof fixture>) =>
  f.repo.snapshot().plans.find((p) => p.kind === "prepaid" && JSON.parse(p.data).lease)!;

test("a quarter paid at once is spread evenly over each lease month and shows in my details", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-15", end: "2027-01-14", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 300000,
      date: "2026-01-10",
    });
    const s = f.repo.snapshot();
    const expenses = s.txns.filter((t) => t.type === "expense" && !t.deleted);
    expect(expenses.map((t) => [t.occurredAt, t.amount])).toEqual([
      ["2026-01-15", 300000],
      ["2026-02-15", 300000],
      ["2026-03-15", 300000],
    ]);
    expect(expenses.every((t) => t.payerMemberId === bank.ownerMemberId)).toBe(true);
    expect(accountBalance(bank, s.txns)).toBe(-1200000);
    const mine = detailViewSnapshot(s, "mine");
    const january = filterMonthTransactions(mine, "2026-01", [], "");
    expect(january.map((t) => t.type).sort()).toEqual(["expense", "transfer", "transfer"]);
    expect(totals(january).expense).toBe(300000);
    expect(totals(filterMonthTransactions(mine, "2026-02", [], "")).expense).toBe(300000);
  } finally {
    f.sqlite.close();
  }
});

test("custom cycles use a unit and a count", () => {
  const months = leaseSchedule({ start: "2026-01-31", end: "2026-12-30", cycle: "custom", unit: "month", every: 2, rent: 200000, split: "month" });
  expect(months.map((p) => p.start)).toEqual(["2026-01-31", "2026-03-31", "2026-05-31", "2026-07-31", "2026-09-30", "2026-11-30"]);
  expect(leaseParts(months[0]!, { start: "2026-01-31", end: "2026-12-30", cycle: "custom", unit: "month", every: 2, rent: 200000, split: "month" }))
    .toEqual([{ date: "2026-01-31", amount: 100000 }, { date: "2026-02-28", amount: 100000 }]);
  const days = leaseSchedule({ start: "2026-01-01", end: "2026-01-25", cycle: "custom", unit: "day", every: 10, rent: 10000 });
  expect(days.map((p) => [p.start, p.end, p.amount])).toEqual([
    ["2026-01-01", "2026-01-10", 10000],
    ["2026-01-11", "2026-01-20", 10000],
    ["2026-01-21", "2026-01-25", 5000],
  ]);
  expect(leaseSchedule({ start: "2026-01-01", end: "2027-12-31", cycle: "custom", unit: "year", every: 1, rent: 1 }).length).toBe(2);
  for (const bad of [
    { unit: "month" as const, every: 0 },
    { unit: "month" as const, every: 61 },
    { unit: "hour" as never, every: 1 },
    { every: 2 },
  ])
    expect(() => leaseSchedule({ start: "2026-01-01", end: "2026-06-30", cycle: "custom", rent: 1000, ...bad })).toThrow();
  expect(() => leaseSchedule({ start: "2026-01-01", end: "2026-06-30", cycle: "month", every: 2, rent: 1000 })).toThrow();
});

test("rent can be paid late on the date the user chooses, never before the previous payment", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 0,
      date: "2026-01-03",
    });
    const plan = leasePlan(f);
    f.repo.payLease(plan.id, 1, "2026-04-08", bank.id);
    expect(() => f.repo.payLease(plan.id, 2, "2026-04-01", bank.id)).toThrow("不能早于上次付款日期");
    const s = f.repo.snapshot();
    const transfer = s.txns.find((t) => t.type === "transfer" && t.occurredAt === "2026-04-08")!;
    expect(transfer.amount).toBe(900000);
    expect(s.txns.filter((t) => t.type === "expense" && t.occurredAt >= "2026-04-01").map((t) => t.occurredAt))
      .toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);
    expect(() => validatePlanData("prepaid", JSON.parse(leasePlan(f).data))).not.toThrow();
  } finally {
    f.sqlite.close();
  }
});

test("early exit keeps used months, prorates the exit month and records a deposit shortfall", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 300000,
      date: "2026-01-01",
    });
    const before = f.repo.snapshot(),
      plan = leasePlan(f);
    const terms = JSON.parse(plan.data).lease;
    // February has 28 days; leaving on the 14th uses half of February's share.
    const exit = leaseExit(terms, 1, "2026-02-14");
    expect(exit.parts.map((p) => p.amount)).toEqual([300000, 150000, 0]);
    expect(exit.unused).toBe(450000);
    f.repo.endLease(
      plan.id,
      "2026-02-14",
      { depositIds: leaseDepositIds(before, plan.id), returned: 0, accountId: bank.id, categoryId },
      { returned: 400000, accountId: bank.id },
      { amount: 50000, accountId: bank.id, categoryId },
    );
    const s = f.repo.snapshot();
    const expenses = s.txns.filter((t) => !t.deleted && t.type === "expense");
    expect(expenses.filter((t) => t.occurredAt > "2026-02-14")).toEqual([]);
    // Paid 9,000 rent + 3,000 deposit; got 4,000 rent back; deposit fully withheld plus 500 extra.
    expect(accountBalance(bank, s.txns)).toBe(-1200000 + 400000 - 50000);
    expect(totals(s.txns).expense).toBe(300000 + 150000 + 50000 + 300000 + 50000);
    const d = JSON.parse(leasePlan(f).data);
    expect(d.shortfall).toMatchObject({ amount: 50000, date: "2026-02-14" });
    expect(d.closed).toBe(true);
    expect(() => validatePlanData("prepaid", d)).not.toThrow();
    const shortfall = s.txns.find((t) => t.note.endsWith("押金不足补缴"))!;
    expect(shortfall).toMatchObject({ accountId: bank.id, amount: 50000, payerMemberId: bank.ownerMemberId });
  } finally {
    f.sqlite.close();
  }
});

test("turning the split off records each period once at its start", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "车位",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-03-01", end: "2027-02-28", cycle: "custom", unit: "month", every: 6, rent: 120000, split: "none" },
      deposit: 0,
      date: "2026-03-01",
    });
    const s = f.repo.snapshot();
    expect(s.txns.filter((t) => t.type === "expense").map((t) => [t.occurredAt, t.amount])).toEqual([["2026-03-01", 120000]]);
    expect(leaseSchedule(JSON.parse(leasePlan(f).data).lease).length).toBe(2);
  } finally {
    f.sqlite.close();
  }
});

test("archiving moves plans out of the active list without touching records, and lease holdings are not accounts", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "month", rent: 300000, split: "month" },
      deposit: 300000,
      date: "2026-01-01",
    });
    const before = f.repo.snapshot(),
      plan = leasePlan(f);
    expect([...leaseLinkedDepositIds(before)]).toEqual(JSON.parse(plan.data).depositPlanIds);
    const groups = entryAccountGroups(before.accounts, before.meId);
    expect([...groups.mine, ...groups.more].some((a) => a.kind === "deposit" || a.kind === "prepaid")).toBe(false);
    f.repo.archivePlan(plan.id, true);
    const archived = f.repo.snapshot();
    expect(JSON.parse(leasePlan(f).data).archived).toBe(true);
    expect(archived.txns).toEqual(before.txns);
    f.repo.archivePlan(plan.id, false);
    expect(JSON.parse(leasePlan(f).data).archived).toBeUndefined();
    expect(() => validatePlanData("prepaid", { ...JSON.parse(plan.data), archived: "yes" })).toThrow("归档");
    const backup = f.repo.exportBackup();
    expect(() => f.repo.restoreBackup(backup)).not.toThrow();
  } finally {
    f.sqlite.close();
  }
});

test("older plan expenses without a payer still appear in the owner's details", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-03-31", cycle: "quarter", rent: 900000 },
      deposit: 0,
      date: "2026-01-01",
    });
    const s = f.repo.snapshot();
    s.txns = s.txns.map((t) => ({ ...t, payerMemberId: null }));
    const rows = filterMonthTransactions(detailViewSnapshot(s, "mine"), "2026-01", [], "");
    expect(rows.some((t) => t.type === "expense")).toBe(true);
    expect(rows.some((t) => t.type === "transfer")).toBe(true);
  } finally {
    f.sqlite.close();
  }
});

test("ending a lease with every amount left blank or zero is allowed", () => {
  const { f, bank, categoryId } = setup();
  try {
    expect(optionalAmount("")).toBe(0);
    expect(optionalAmount(" 0 ")).toBe(0);
    expect(() => calculate("")).toThrow();
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 300000,
      date: "2026-01-01",
    });
    const before = f.repo.snapshot(),
      plan = leasePlan(f);
    f.repo.endLease(
      plan.id,
      "2026-02-14",
      { depositIds: leaseDepositIds(before, plan.id), returned: optionalAmount(""), accountId: bank.id, categoryId },
      { returned: optionalAmount(""), accountId: bank.id },
      optionalAmount("") ? { amount: 1, accountId: bank.id, categoryId } : undefined,
    );
    expect(JSON.parse(leasePlan(f).data)).toMatchObject({ closed: true, rentSettlement: { returned: 0 } });
  } finally {
    f.sqlite.close();
  }
});

test("money that arrives after a lease ended settles the deposit and offsets rent loss", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 300000,
      date: "2026-01-01",
    });
    const before = f.repo.snapshot(),
      plan = leasePlan(f),
      depositIds = leaseDepositIds(before, plan.id);
    // Move out mid-February, nothing refunded yet and the deposit left open.
    f.repo.endLease(plan.id, "2026-02-14", undefined, { returned: 0, accountId: bank.id });
    expect(() => f.repo.leaseLaterRefund(plan.id, "2026-02-10", { accountId: bank.id, rent: 1 })).toThrow("不能早于结束日期");
    const spentBefore = totals(f.repo.snapshot().txns).expense;
    f.repo.leaseLaterRefund(plan.id, "2026-02-20", {
      accountId: bank.id,
      rent: 400000,
      deposit: { depositIds, returned: 250000, categoryId },
    });
    const s = f.repo.snapshot();
    expect(accountBalance(bank, s.txns)).toBe(-1200000 + 400000 + 250000);
    // 4,000 rent comes back as a refund of the 4,500 loss; 500 of the deposit is withheld.
    expect(totals(s.txns).expense).toBe(spentBefore - 400000 + 50000);
    const d = JSON.parse(leasePlan(f).data);
    expect(d.depositSettlement).toMatchObject({ returned: 250000, deducted: 50000, date: "2026-02-20" });
    expect(d.laterRefunds).toEqual([{ date: "2026-02-20", rent: 400000, deposit: 250000, accountId: bank.id }]);
    expect(() => validatePlanData("prepaid", d)).not.toThrow();
    expect(leaseDepositIds(s, plan.id)).toEqual([]);
    expect(() => f.repo.leaseLaterRefund(plan.id, "2026-02-21", { accountId: bank.id, rent: 9000000 })).toThrow("超过已付租金");
    expect(() => f.repo.leaseLaterRefund(plan.id, "2026-02-21", { accountId: bank.id, rent: 0 })).toThrow("请填写");
  } finally {
    f.sqlite.close();
  }
});

test("renewing extends the same lease, keeps paid periods and prices only the new ones", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 0,
      date: "2026-01-01",
    });
    const plan = leasePlan(f);
    expect(() => f.repo.extendLease(plan.id, "2026-12-31")).toThrow("晚于原到期日");
    f.repo.extendLease(plan.id, "2027-12-31", 960000);
    const s = f.repo.snapshot();
    expect(s.plans.filter((p) => p.kind === "prepaid" && !p.deleted)).toHaveLength(1);
    const schedule = leaseSchedule(JSON.parse(leasePlan(f).data).lease);
    expect(schedule.map((p) => p.amount)).toEqual([900000, 900000, 900000, 900000, 960000, 960000, 960000, 960000]);
  } finally {
    f.sqlite.close();
  }
});

test("editing rebuilds a lease from corrected terms and replays rent already paid", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 300000,
      date: "2026-01-01",
    });
    const plan = leasePlan(f);
    f.repo.payLease(plan.id, 1, "2026-03-28", bank.id);
    // The rent was really 10,500 per quarter and the deposit 3,500.
    f.repo.editLease(plan.id, {
      name: "公寓 302",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "quarter", rent: 1050000, split: "month" },
      deposit: 350000,
      date: "2026-01-01",
    });
    const s = f.repo.snapshot(),
      d = JSON.parse(leasePlan(f).data);
    expect(leasePlan(f).id).toBe(plan.id);
    expect(leasePlan(f).name).toBe("公寓 302");
    expect(d.paidPeriods).toBe(2);
    expect(d.lastPaymentDate).toBe("2026-03-28");
    expect(accountBalance(bank, s.txns)).toBe(-(1050000 * 2 + 350000));
    expect(totals(s.txns).expense).toBe(1050000 * 2);
    expect(leaseDepositIds(s, plan.id).length).toBe(1);
    expect(s.plans.filter((p) => p.kind === "deposit" && !p.deleted)).toHaveLength(1);
    expect(() => validatePlanData("prepaid", d)).not.toThrow();
  } finally {
    f.sqlite.close();
  }
});

test("deleting a lease removes its deposit and every bill it wrote", () => {
  const { f, bank, categoryId } = setup();
  try {
    const before = f.repo.snapshot();
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 300000,
      date: "2026-01-01",
    });
    f.repo.deleteLease(leasePlan(f).id);
    const s = f.repo.snapshot();
    expect(s.plans.filter((p) => !p.deleted)).toEqual([]);
    expect(s.txns.filter((t) => !t.deleted)).toEqual(before.txns.filter((t) => !t.deleted));
    expect(accountBalance(bank, s.txns)).toBe(accountBalance(bank, before.txns));
  } finally {
    f.sqlite.close();
  }
});

test("a lease can end on a future date or before its latest payment", () => {
  const { f, bank, categoryId } = setup();
  try {
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2027-12-31", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 0,
      date: "2026-01-01",
    });
    const plan = leasePlan(f);
    f.repo.payLease(plan.id, 1, "2026-03-20", bank.id);
    expect(() => f.repo.endLease(plan.id, "2025-12-31", undefined, { returned: 0, accountId: bank.id })).toThrow("不能早于起租日");
    f.repo.endLease(plan.id, "2026-03-10", undefined, { returned: 0, accountId: bank.id });
    expect(() => validatePlanData("prepaid", JSON.parse(leasePlan(f).data))).not.toThrow();
    const other = setup();
    try {
      other.f.repo.createLease({
        name: "公寓",
        paymentAccountId: other.bank.id,
        categoryId: other.categoryId,
        lease: { start: "2026-01-01", end: "2027-12-31", cycle: "quarter", rent: 900000, split: "month" },
        deposit: 0,
        date: "2026-01-01",
      });
      other.f.repo.endLease(leasePlan(other.f).id, "2027-01-15", undefined, { returned: 0, accountId: other.bank.id });
      expect(JSON.parse(leasePlan(other.f).data).endedAt).toBe("2027-01-15");
    } finally {
      other.f.sqlite.close();
    }
  } finally {
    f.sqlite.close();
  }
});

test("standalone deposits can be corrected while held and deleted with all their bills", () => {
  const { f, bank, categoryId } = setup();
  try {
    const before = f.repo.snapshot();
    f.repo.createDeposit({ name: "水电押金", amount: 50000, paymentAccountId: bank.id, date: "2026-01-01" });
    const plan = () => f.repo.snapshot().plans.find((p) => p.kind === "deposit" && !p.deleted)!;
    const id = plan().id;
    f.repo.editDeposit(id, { name: "水电押金", amount: 80000, paymentAccountId: bank.id, date: "2026-01-02", expectedReturn: "2026-12-31" });
    expect(plan().id).toBe(id);
    expect(JSON.parse(plan().data)).toMatchObject({ amount: 80000, date: "2026-01-02", expectedReturn: "2026-12-31" });
    expect(accountBalance(bank, f.repo.snapshot().txns)).toBe(accountBalance(bank, before.txns) - 80000);
    f.repo.closeDeposit(id, 60000, bank.id, categoryId, "2026-12-31");
    expect(() => f.repo.editDeposit(id, { name: "水电押金", amount: 1, paymentAccountId: bank.id, date: "2026-01-02" })).toThrow("不能修改");
    f.repo.deleteDeposit(id);
    const s = f.repo.snapshot();
    expect(s.plans.filter((p) => !p.deleted)).toEqual([]);
    expect(s.txns.filter((t) => !t.deleted)).toEqual(before.txns.filter((t) => !t.deleted));
    // A lease's own deposit is managed through the lease.
    f.repo.createLease({
      name: "公寓",
      paymentAccountId: bank.id,
      categoryId,
      lease: { start: "2026-01-01", end: "2026-12-31", cycle: "quarter", rent: 900000, split: "month" },
      deposit: 300000,
      date: "2026-01-01",
    });
    expect(() => f.repo.deleteDeposit(plan().id)).toThrow("租赁的押金");
  } finally {
    f.sqlite.close();
  }
});
