import { fixture } from "./sqlite";
import { accountBalance } from "../src/domain/selectors";

test("category order persists and syncs within sibling groups without changing payments or parentage", () => {
  const a = fixture(),
    b = fixture();
  try {
    b.repo.prepareJoin("对方");
    b.repo.mergeOperations(a.repo.pendingOperations());
    a.repo.mergeOperations(b.repo.pendingOperations());
    const s = a.repo.snapshot(),
      roots = s.categories
        .filter((c) => !c.parentId && c.kind === "expense")
        .sort((a, b) => a.sort - b.sort),
      children = s.categories
        .filter((c) => c.parentId === roots[0]!.id)
        .sort((a, b) => a.sort - b.sort);
    const id = a.repo.saveTxn({
      type: "expense",
      amount: 500,
      accountId: s.accounts[0]!.id,
      categoryId: children[0]!.id,
      occurredAt: "2026-10-31",
      note: "",
      forWhom: "both",
    });
    const before = a.repo.snapshot();
    a.repo.reorderCategories(roots.map((c) => c.id).reverse());
    a.repo.reorderCategories(children.map((c) => c.id).reverse());
    b.repo.mergeOperations(a.repo.pendingOperations());
    for (const f of [a, b]) {
      expect(
        f.repo
          .snapshot()
          .categories.filter((c) => c.kind === "expense" && !c.parentId)
          .sort((a, b) => a.sort - b.sort)
          .map((c) => c.id),
      ).toEqual(roots.map((c) => c.id).reverse());
      expect(
        f.repo
          .snapshot()
          .categories.filter((c) => c.parentId === roots[0]!.id)
          .sort((a, b) => a.sort - b.sort)
          .map((c) => c.id),
      ).toEqual(children.map((c) => c.id).reverse());
      expect(f.repo.snapshot().txns.find((t) => t.id === id)).toEqual(
        before.txns.find((t) => t.id === id),
      );
      expect(accountBalance(s.accounts[0]!, f.repo.snapshot().txns)).toBe(-500);
    }
    a.repo.initialize();
    expect(
      a.repo.snapshot().categories.find((c) => c.id === roots.at(-1)!.id)!.sort,
    ).toBe(0);
  } finally {
    a.sqlite.close();
    b.sqlite.close();
  }
});
test.each(["missing", "duplicate", "mixed", "deleted"])(
  "rejects %s category ordering atomically",
  (mode) => {
    const f = fixture();
    try {
      const s = f.repo.snapshot(),
        roots = s.categories.filter((c) => !c.parentId && c.kind === "expense"),
        ids = roots.map((c) => c.id);
      if (mode === "missing") ids.pop();
      if (mode === "duplicate") ids[1] = ids[0]!;
      if (mode === "mixed") ids[0] = s.categories.find((c) => c.parentId)!.id;
      if (mode === "deleted")
        f.repo.deleteCategory(roots[0]!.id, { action: "discard" });
      const before = JSON.parse(f.repo.exportBackup()).tables;
      expect(() => f.repo.reorderCategories(ids)).toThrow("分类已变化");
      expect(JSON.parse(f.repo.exportBackup()).tables).toEqual(before);
    } finally {
      f.sqlite.close();
    }
  },
);
