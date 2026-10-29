CREATE TABLE `plan` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`hlc` text NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`scope` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`data` text NOT NULL
);
