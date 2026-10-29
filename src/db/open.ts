import { openDatabaseAsync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { randomUUID } from "expo-crypto";
import { LedgerRepository } from "./repository";
import { migrations } from "./migration";
import { acquireDatabaseLease } from "./databaseLease";
import * as schema from "./schema";

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
  const sqlite = await openDatabaseAsync("family-ledger.db");
  try {
    await sqlite.execAsync(
      "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
    );
    await migrate(drizzle(sqlite, { schema }), migrations);
    const next = new LedgerRepository(sqlite, randomUUID);
    next.initialize();
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
