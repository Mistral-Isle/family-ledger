CREATE TABLE `budget` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`hlc` text NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`scope` text NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL
);
