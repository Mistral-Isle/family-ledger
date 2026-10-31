import { calculate, moneyKey } from "../src/domain/money";
import { VaultAuthentication } from "../src/domain/vaultAuthentication";
import { fixture } from "./sqlite";

const type = (keys: string) => [...keys].reduce(moneyKey, "");
test("keypad rejects a third decimal digit but accepts multi-digit whole amounts and each operand", () => {
  expect(type("2.88888")).toBe("2.88");
  expect(type("123456.78")).toBe("123456.78");
  expect(type(".123+4.567")).toBe("0.12+4.56");
  expect(calculate(type(".123+4.567"))).toBe(468);
  expect(type("1..2")).toBe("1.2");
  expect(type("1+×2")).toBe("1×2");
  expect(type("2.88⌫9")).toBe("2.89");
  expect(type("0001")).toBe("1");
  expect(type("−12.345")).toBe("−12.34");
});

test("successful Face ID waits for active; background or cancelled attempts cannot unlock", () => {
  const unlock = jest.fn(),
    auth = new VaultAuthentication(unlock);
  const attempt = auth.begin("active");
  auth.change("inactive");
  expect(auth.complete(attempt, true)).toBe(true);
  expect(unlock).toHaveBeenLastCalledWith(false);
  auth.change("active");
  expect(unlock).toHaveBeenLastCalledWith(true);
  auth.change("background");
  expect(unlock).toHaveBeenLastCalledWith(false);
  const second = auth.begin("active");
  auth.change("background");
  expect(auth.complete(second, true)).toBe(false);
  auth.change("active");
  expect(unlock).toHaveBeenLastCalledWith(false);
  const third = auth.begin("active");
  expect(auth.complete(third, false)).toBe(false);
  expect(unlock).toHaveBeenLastCalledWith(false);
  const fourth = auth.begin("active");
  auth.change("inactive");
  expect(auth.complete(fourth, true)).toBe(true);
  auth.invalidate();
  auth.change("active");
  expect(unlock).toHaveBeenLastCalledWith(false);
});

test("budget carries both levels into future months without overwriting history or explicit months", () => {
  const f = fixture();
  try {
    const c = f.repo
      .snapshot()
      .categories.find((c) => c.kind === "expense" && c.parentId)!;
    const allocations = { [c.parentId!]: 8000, [c.id]: 5000 };
    f.repo.setMonthBudget("2026-10", 10000, allocations);
    expect(f.repo.monthBudget("2026-09")).toBeNull();
    expect(f.repo.monthBudget("2026-11")).toBe(10000);
    expect(f.repo.monthAllocations("2026-11")).toEqual(allocations);
    f.repo.setMonthBudget("2026-11", 12000);
    expect(f.repo.monthBudget("2026-10")).toBe(10000);
    expect(f.repo.monthBudget("2027-01")).toBe(12000);
    f.repo.setMonthBudget("2026-10", 15000);
    expect(f.repo.monthBudget("2026-11")).toBe(12000);
    f.repo.setMonthBudget("2026-12", 0, {});
    expect(f.repo.monthBudget("2027-01")).toBe(0);
    expect(f.repo.monthAllocations("2027-01")).toEqual({});
    f.repo.setMonthBudget("2027-02", null, {});
    expect(f.repo.monthBudget("2027-03")).toBeNull();
    expect(f.repo.monthAllocations("2027-03")).toEqual({});
  } finally {
    f.sqlite.close();
  }
});
