import { fixture } from "./sqlite";
import { defaultCategoryIconUpdates } from "../src/domain/defaultCategoryIconUpdates";
import { categoryIconLayers } from "../src/domain/categoryIcons";
import { accountBalance } from "../src/domain/selectors";

test("fresh defaults use all approved icons with distinct income and sibling shapes", () => {
  const f = fixture();
  try {
    const s = f.repo.snapshot();
    expect(defaultCategoryIconUpdates).toHaveLength(59);
    for (const update of defaultCategoryIconUpdates) {
      const category = s.categories.find(
        (c) =>
          c.kind === update.kind &&
          c.name === update.name &&
          (s.categories.find((p) => p.id === c.parentId)?.name ?? null) ===
            update.parent,
      )!;
      expect(category.icon).toBe(update.icon);
      expect(categoryIconLayers[category.icon]?.length).toBeGreaterThan(0);
      expect(categoryIconLayers[category.icon]?.every((layer) => !layer.transform)).toBe(true);
    }
    const income = s.categories.filter((c) => c.kind === "income");
    expect(
      new Set(income.map((c) => JSON.stringify(categoryIconLayers[c.icon])))
        .size,
    ).toBe(7);
    for (const parent of s.categories.filter(
      (c) => !c.parentId && c.kind === "expense",
    )) {
      const children = s.categories.filter((c) => c.parentId === parent.id);
      expect(
        new Set(children.map((c) => JSON.stringify(categoryIconLayers[c.icon])))
          .size,
      ).toBe(children.length);
    }
    expect(s.categories.find((c) => c.name === "汽车")?.icon).toBe(
      "category:car-rounded",
    );
  } finally {
    f.sqlite.close();
  }
});

test("legacy defaults upgrade once, preserving custom icons, names, positions, hidden state and ledger data", () => {
  const f = fixture(),
    peer = fixture();
  try {
    let s = f.repo.snapshot();
    for (const update of defaultCategoryIconUpdates) {
      const c = s.categories.find(
        (c) =>
          c.kind === update.kind &&
          c.name === update.name &&
          (s.categories.find((p) => p.id === c.parentId)?.name ?? null) ===
            update.parent,
      )!;
      f.repo.saveCategory({ ...c, icon: update.previousIcon });
    }
    s = f.repo.snapshot();
    const beauty = s.categories.find((c) => c.name === "美妆")!;
    const drink = s.categories.find((c) => c.name === "饮品")!;
    const groceries = s.categories.find((c) => c.name === "买菜食材")!;
    const wash = s.categories.find((c) => c.name === "洗车")!;
    f.repo.saveCategory({ ...beauty, icon: "category:gift" });
    f.repo.saveCategory({ ...drink, name: "咖啡专用" });
    f.repo.saveCategory({
      ...groceries,
      parentId: s.categories.find((c) => c.name === "购物")!.id,
    });
    f.repo.saveCategory({ ...wash, hidden: true, sort: 99 });
    f.repo.saveTxn({
      type: "expense",
      amount: 2500,
      accountId: s.accounts[0]!.id,
      categoryId: beauty.id,
      occurredAt: "2026-10-31",
      note: "图标升级保留账单",
      forWhom: "both",
    });
    f.sqlite.exec(
      "DELETE FROM local_pref WHERE key = 'defaultCategoryIconsV1'",
    );
    const before = f.repo.snapshot();
    const balance = accountBalance(before.accounts[0]!, before.txns);
    peer.repo.restoreBackup(f.repo.exportBackup());
    f.repo.initialize();
    const after = f.repo.snapshot();
    for (const id of [beauty.id, drink.id, groceries.id])
      expect(after.categories.find((c) => c.id === id)).toEqual(
        before.categories.find((c) => c.id === id),
      );
    const updatedWash = after.categories.find((c) => c.id === wash.id)!;
    expect(updatedWash).toMatchObject({
      hidden: true,
      sort: 99,
      icon: "category:car-6",
    });
    expect(after.categories.find((c) => c.name === "汽车")?.icon).toBe(
      "category:car-rounded",
    );
    for (const old of before.categories) {
      const updated = after.categories.find((c) => c.id === old.id)!;
      const strip = ({ icon, hlc, updatedAt, ...rest }: typeof old) => rest;
      expect(strip(updated)).toEqual(strip(old));
    }
    expect(after.txns).toEqual(before.txns);
    expect(after.accounts).toEqual(before.accounts);
    expect(after.preferences).toEqual(before.preferences);
    expect(accountBalance(after.accounts[0]!, after.txns)).toBe(balance);
    peer.repo.mergeOperations(f.repo.pendingOperations());
    expect(peer.repo.snapshot().categories).toEqual(after.categories);
    f.repo.initialize();
    expect(f.repo.snapshot()).toEqual(after);
    f.repo.saveCategory({ ...updatedWash, icon: wash.icon });
    f.repo.initialize();
    expect(
      f.repo.snapshot().categories.find((c) => c.id === wash.id)?.icon,
    ).toBe(wash.icon);
  } finally {
    f.sqlite.close();
    peer.sqlite.close();
  }
});
