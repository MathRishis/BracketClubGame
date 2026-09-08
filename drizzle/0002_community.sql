CREATE TABLE `community_accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`admin` integer DEFAULT 0 NOT NULL,
	`bio` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`bracket_id` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL,
	`seen` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operations` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`bracket_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);

--> statement-breakpoint
CREATE INDEX notifications_account_created ON notifications(account_id,created_at);
--> statement-breakpoint
CREATE INDEX templates_account ON templates(account_id);
--> statement-breakpoint
CREATE INDEX reports_resolved ON reports(resolved,created_at);

--> statement-breakpoint
CREATE TABLE participation (id text PRIMARY KEY NOT NULL, bracket_id text NOT NULL, viewer text NOT NULL, updated_at integer NOT NULL);
--> statement-breakpoint
CREATE INDEX participation_bracket_updated ON participation(bracket_id,updated_at);
