CREATE TABLE `alert_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_id` text NOT NULL,
	`fee_type` text NOT NULL,
	`balance` real NOT NULL,
	`threshold` real NOT NULL,
	`sent_at` text DEFAULT '2026-03-12T19:20:57.660Z',
	FOREIGN KEY (`telegram_id`) REFERENCES `users`(`telegram_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `alert_history_telegram_id_idx` ON `alert_history` (`telegram_id`);--> statement-breakpoint
CREATE INDEX `alert_history_sent_at_idx` ON `alert_history` (`sent_at`);--> statement-breakpoint
CREATE TABLE `recharge_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`telegram_id` text NOT NULL,
	`browser_session_id` text,
	`step` text NOT NULL,
	`selected_fee_type` text,
	`selected_amount_index` integer,
	`available_amounts` text,
	`available_payment_methods` text,
	`payment_url` text,
	`balance_before` real,
	`created_at` text DEFAULT '2026-03-12T19:20:57.660Z',
	`expires_at` text,
	FOREIGN KEY (`telegram_id`) REFERENCES `users`(`telegram_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recharge_sessions_telegram_id_idx` ON `recharge_sessions` (`telegram_id`);--> statement-breakpoint
CREATE INDEX `recharge_sessions_expires_at_idx` ON `recharge_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`telegram_id` text PRIMARY KEY NOT NULL,
	`fee_url` text,
	`check_interval` integer DEFAULT 300,
	`thresholds` text DEFAULT '{"electricity":5,"cold_water":1,"hot_water":0.5}',
	`cached_balances` text,
	`cached_at` text,
	`created_at` text DEFAULT '2026-03-12T19:20:57.659Z',
	`updated_at` text DEFAULT '2026-03-12T19:20:57.660Z'
);
