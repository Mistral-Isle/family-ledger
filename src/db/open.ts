import { openDatabaseAsync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { randomUUID } from "expo-crypto";
import { LedgerRepository } from "./repository";
import { migrations } from "./migration";
import { acquireDatabaseLease } from "./databaseLease";
import * as schema from "./schema";
import { isBudgetDemo, isLocalPreview } from "../demo/config";
import { zh } from "../i18n/zh";
import { thisMonth } from "../domain/date";

let repository: LedgerRepository | undefined;
let opening: Promise<LedgerRepository> | undefined;
export function openLedger(): Promise<LedgerRepository> {
  if (repository) return Promise.resolve(repository);
  if (opening) return opening;
  // React mounts/retries can overlap. Never initialize the worker or run
  // migrations twice while its async VFS initialization is still incomplete.
  opening = initialize().finally(() => {
    opening = undefined;
  });
  return opening;
}
async function initialize(): Promise<LedgerRepository> {
  await acquireDatabaseLease();
  const sqlite = await openDatabaseAsync(
    isBudgetDemo ? "budget-preview-demo.db" : "family-ledger.db",
  );
  try {
    // User-authorized disposable preview reset. The exact default catalog is
    // the revision: future category edits cannot leave an older test catalog.
    const previewRevision = JSON.stringify([
      "preview-reset-v1",
      zh.defaultCategories,
      zh.defaultExpenseOrder,
    ]);
    const previewKey = isBudgetDemo
      ? "ledger-demo-catalog"
      : "ledger-preview-catalog";
    if (
      isLocalPreview &&
      localStorage.getItem(previewKey) !== previewRevision
    ) {
      await sqlite.execAsync("PRAGMA foreign_keys = OFF;");
      const tables = await sqlite.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      );
      await sqlite.withTransactionAsync(async () => {
        for (const { name } of tables)
          await sqlite.execAsync(`DROP TABLE "${name.replace(/"/g, '""')}";`);
      });
    }
    await sqlite.execAsync(
      "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
    );
    await migrate(drizzle(sqlite, { schema }), migrations);
    const next = new LedgerRepository(sqlite, randomUUID);
    next.initialize();
    if (isBudgetDemo) {
      const { seedBudgetDemo } = await import("../demo/seedBudgetDemo");
      seedBudgetDemo(next, thisMonth());
    }
    if (isLocalPreview && !isBudgetDemo) {
      const { seedIconPreview } = await import("../demo/seedIconPreview");
      seedIconPreview(next);
    }
    if (isLocalPreview) localStorage.setItem(previewKey, previewRevision);
    repository = next;
    return next;
  } catch (error) {
    // Close a partially initialized DB; never delete or replace its contents.
    try {
      await sqlite.closeAsync();
    } catch {
      /* Preserve the original opening error. */
    }
    throw error;
  }
}
