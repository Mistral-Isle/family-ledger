import { rentAccountIds } from "../src/domain/rentAccounts";
import { fixture } from "./sqlite";

test.each(["lease", "legacy"])(
  "%s rental accounts are hidden without hiding payment or unrelated accounts",
  (kind) => {
    const f = fixture();
    try {
      const initial = f.repo.snapshot();
      const paymentAccountId = initial.accounts[0]!.id;
      const categoryId = initial.categories.find((c) => c.name === "房租")!.id;
      const common = { name: "房租", paymentAccountId, categoryId };
      if (kind === "lease") {
        f.repo.createLease({
          ...common,
          lease: {
            start: "2026-10-01",
            end: "2027-09-30",
            cycle: "quarter",
            rent: 900000,
          },
          deposit: 300000,
          date: "2026-10-01",
        });
      } else {
        f.repo.createRent({
          ...common,
          monthlyRent: 300000,
          depositMonths: 1,
          prepayMonths: 3,
          start: "2026-10-01",
        });
      }
      f.repo.createDeposit({
        name: "其他押金",
        amount: 10000,
        paymentAccountId,
        date: "2026-10-01",
      });
      const s = f.repo.snapshot();
      const before = JSON.stringify(s);
      const hidden = rentAccountIds(s);
      expect([...hidden].sort()).toEqual(
        s.accounts
          .filter((a) => a.name === "房租" || a.name === "房租 · 押金")
          .map((a) => a.id)
          .sort(),
      );
      expect(hidden.size).toBe(2);
      expect(hidden.has(paymentAccountId)).toBe(false);
      expect(
        hidden.has(s.accounts.find((a) => a.name === "其他押金")!.id),
      ).toBe(false);
      expect(JSON.stringify(s)).toBe(before);
      // Archived rental accounts stay hidden when the archived list is opened.
      s.accounts.forEach((a) => {
        if (hidden.has(a.id)) a.archived = true;
      });
      expect(rentAccountIds(s)).toEqual(hidden);
    } finally {
      f.sqlite.close();
    }
  },
);
