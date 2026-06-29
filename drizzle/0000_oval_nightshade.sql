CREATE TABLE `alert_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`event_type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invoice_id` text,
	`source` text DEFAULT 'ss_label_sync' NOT NULL,
	`label_fetch_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `billing_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`handling_threshold_cents` integer DEFAULT 4000 NOT NULL,
	`handling_per_item_cents` integer DEFAULT 50 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoice_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`sku` text NOT NULL,
	`qty` integer NOT NULL,
	`unit_cost_cents` integer NOT NULL,
	`shipping_addon_cents` integer DEFAULT 0 NOT NULL,
	`line_total_cents` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ledger_opening_balance` (
	`id` integer PRIMARY KEY NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`as_of` integer DEFAULT (unixepoch()) NOT NULL,
	`set_by` text,
	`set_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`set_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`sku` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`cost_of_goods_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`batch_id` text,
	`ss_shipment_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`status_flag` text,
	`pending_until` integer,
	`notes` text DEFAULT '' NOT NULL,
	`merged_from_order_number` text,
	FOREIGN KEY (`order_number`) REFERENCES `orders`(`order_number`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`order_number` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`address1` text DEFAULT '' NOT NULL,
	`address2` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`state` text DEFAULT '' NOT NULL,
	`zip` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`urgent` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`pulled_at` integer DEFAULT (unixepoch()) NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`ss_verify_status` text DEFAULT 'unverified' NOT NULL,
	`ss_shipment_id` text,
	`ss_verify_checked_at` integer,
	`ss_verify_error` text,
	`merged_into_order_number` text
);
--> statement-breakpoint
CREATE TABLE `payment_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
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
CREATE TABLE `skus` (
	`sku` text PRIMARY KEY NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`product_id` text,
	`base_cost_cents` integer DEFAULT 0 NOT NULL,
	`shipping_addon_cents` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`sku_status_flag` text,
	`sku_status_pending_until` integer,
	`sku_status_notes` text DEFAULT '' NOT NULL,
	`sku_status_set_at` integer
);
--> statement-breakpoint
CREATE TABLE `ss_sync_cursor` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_label_fetch_at` integer,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);