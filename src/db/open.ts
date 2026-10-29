import { openDatabaseAsync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { randomUUID } from "expo-crypto";
import { LedgerRepository } from "./repository";
import { migrations } from "./migration";
import * as schema from "./schema";

let repository: LedgerRepository | undefined;
export async function openLedger(): Promise<LedgerRepository> {
  if (repository) return repository;
  const sqlite = await openDatabaseAsync("family-ledger.db");
  await sqlite.execAsync(
    "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;",
  );
  const db = drizzle(sqlite, { schema });
  await migrate(db, migrations);
  const next = new LedgerRepository(sqlite, randomUUID);
  next.initialize();
  repository = next;
  return next;
}
