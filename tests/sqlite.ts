import { DatabaseSync } from "node:sqlite";
import { initialSql } from "../src/db/migration";
import { LedgerRepository, type SqlDriver } from "../src/db/repository";
import { randomUUID } from "node:crypto";

export function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(initialSql.replace(/--> statement-breakpoint/g, ""));
  const driver: SqlDriver = {
    runSync(sql, ...params) {
      return sqlite.prepare(sql).run(...params);
    },
    getAllSync<T>(sql: string, ...params: (string | number | null)[]) {
      return sqlite.prepare(sql).all(...params) as T[];
    },
    withTransactionSync(fn) {
      sqlite.exec("BEGIN");
      try {
        fn();
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const repo = new LedgerRepository(
    driver,
    randomUUID,
    () => "2026-10-29T12:00:00.000Z",
  );
  repo.initialize();
  return { repo, sqlite, driver };
}
