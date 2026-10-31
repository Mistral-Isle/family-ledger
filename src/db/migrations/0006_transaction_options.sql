ALTER TABLE txn ADD exclude_budget integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE txn ADD exclude_totals integer DEFAULT 0 NOT NULL;
