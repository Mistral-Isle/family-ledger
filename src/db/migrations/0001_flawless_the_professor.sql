ALTER TABLE `txn` ADD `refund_income` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `txn` ADD `refund_income_category_id` text;