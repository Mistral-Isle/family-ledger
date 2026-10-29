ALTER TABLE `budget` ADD `allocations` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `txn` ADD `occurred_time` text;