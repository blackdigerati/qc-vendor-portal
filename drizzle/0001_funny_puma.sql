CREATE TABLE `ss_sync_cursor` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_label_fetch_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `batches` ADD `source` text DEFAULT 'ss_label_sync' NOT NULL;--> statement-breakpoint
ALTER TABLE `batches` ADD `label_fetch_at` integer;--> statement-breakpoint
ALTER TABLE `order_items` ADD `status_flag` text;--> statement-breakpoint
ALTER TABLE `order_items` ADD `pending_until` integer;--> statement-breakpoint
ALTER TABLE `order_items` ADD `notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `ss_verify_status` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `ss_shipment_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `ss_verify_checked_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `ss_verify_error` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `merged_into_order_number` text;--> statement-breakpoint
ALTER TABLE `skus` ADD `product_id` text;