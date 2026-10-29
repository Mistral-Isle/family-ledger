// Versioned SQL consumed by the Drizzle migrator and the real SQLite test adapter.
export const initialSql = `
CREATE TABLE member (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, hlc TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL, color TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE account (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, hlc TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, scope TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, initial_balance INTEGER NOT NULL, owner_member_id TEXT NOT NULL, last4 TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE category (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, hlc TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, parent_id TEXT, kind TEXT NOT NULL, name TEXT NOT NULL, sf_symbol TEXT NOT NULL, color TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, merged_into TEXT, delete_action TEXT);
--> statement-breakpoint
CREATE TABLE txn (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, hlc TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, scope TEXT NOT NULL, type TEXT NOT NULL, amount INTEGER NOT NULL CHECK (typeof(amount) = 'integer'), account_id TEXT NOT NULL, to_account_id TEXT, category_id TEXT, occurred_at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', recorder_member_id TEXT NOT NULL, for_whom TEXT NOT NULL, discarded INTEGER NOT NULL DEFAULT 0, refund_of_id TEXT);
--> statement-breakpoint
CREATE INDEX txn_date_idx ON txn(occurred_at);
--> statement-breakpoint
CREATE INDEX txn_account_idx ON txn(account_id);
--> statement-breakpoint
CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, op_json TEXT NOT NULL, uploaded INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE local_pref (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
`;
export const refundIncomeSql = `
ALTER TABLE txn ADD refund_income integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE txn ADD refund_income_category_id text;
`;
export const migrations = {
  journal: {
    version: "7",
    dialect: "sqlite",
    entries: [
      {
        idx: 0,
        version: "6",
        when: 1793280000000,
        tag: "0000_ledger",
        breakpoints: true,
      },
      {
        idx: 1,
        version: "6",
        when: 1793287424031,
        tag: "0001_flawless_the_professor",
        breakpoints: true,
      },
    ],
  },
  migrations: { m0000: initialSql, m0001: refundIncomeSql },
};
