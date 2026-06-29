CREATE TABLE `billing_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`handling_threshold_cents` integer DEFAULT 4000 NOT NULL,
	`handling_per_item_cents` integer DEFAULT 50 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'logged' NOT NULL,
	`logged_at` integer DEFAULT (unixepoch()) NOT NULL,
	`logged_by` text NOT NULL,
	`received_at` integer,
	`received_by` text,
	`credit_cents` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`logged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_on` integer NOT NULL,
	`ref_note` text DEFAULT '' NOT NULL,
	`recorded_by` text NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`status` text DEFAULT 'sent' NOT NULL,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_payments`("id", "amount_cents", "paid_on", "ref_note", "recorded_by", "recorded_at", "approved_by", "approved_at", "status") SELECT "id", "amount_cents", "paid_on", "ref_note", "recorded_by", "recorded_at", "approved_by", "approved_at", "status" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `order_items` ADD `merged_from_order_number` text;--> statement-breakpoint
ALTER TABLE `skus` ADD `sku_status_flag` text;--> statement-breakpoint
ALTER TABLE `skus` ADD `sku_status_pending_until` integer;--> statement-breakpoint
ALTER TABLE `skus` ADD `sku_status_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `skus` ADD `sku_status_set_at` integer;