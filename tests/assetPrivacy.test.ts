import { randomUUID } from "node:crypto";
import { LedgerRepository } from "../src/db/repository";
import { fixture } from "./sqlite";

test("asset visibility persists across reopening without changing balances or syncing", () => {
  const f = fixture();
  try {
    const before = f.repo.snapshot();
    const outbox = f.sqlite.prepare("SELECT * FROM outbox ORDER BY seq").all();
    expect(f.repo.getAssetAmountsHidden()).toBe(false);
    f.repo.setAssetAmountsHidden(true);
    const reopened = new LedgerRepository(f.driver, randomUUID);
    expect(reopened.getAssetAmountsHidden()).toBe(true);
    expect(reopened.snapshot()).toEqual(before);
    expect(f.sqlite.prepare("SELECT * FROM outbox ORDER BY seq").all()).toEqual(
      outbox,
    );
    reopened.setAssetAmountsHidden(false);
    expect(
      new LedgerRepository(f.driver, randomUUID).getAssetAmountsHidden(),
    ).toBe(false);
  } finally {
    f.sqlite.close();
  }
});
