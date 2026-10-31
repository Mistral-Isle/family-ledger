
ALTER TABLE txn ADD payer_member_id text;
--> statement-breakpoint
ALTER TABLE txn ADD trip_id text;
--> statement-breakpoint
CREATE TABLE trip (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, hlc TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, scope TEXT NOT NULL, name TEXT NOT NULL, start_date TEXT, end_date TEXT, ended INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE duplicate (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, hlc TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, scope TEXT NOT NULL, first_id TEXT NOT NULL, second_id TEXT NOT NULL, fingerprint TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX txn_trip_idx ON txn(trip_id);
