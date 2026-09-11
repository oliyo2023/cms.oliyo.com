-- 0001_init.sql — 创作台 cms.oliyo.com 全量初始结构
CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `name` text NOT NULL,
  `pass_hash` text NOT NULL,
  `role` text NOT NULL DEFAULT 'user',
  `quota_text_chars` integer NOT NULL DEFAULT 0,
  `quota_images` integer NOT NULL DEFAULT 0,
  `quota_videos` integer NOT NULL DEFAULT 0,
  `quota_rewrite_chars` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_idx` ON `users` (`email`);
CREATE TABLE IF NOT EXISTS `sessions` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `sessions_user_idx` ON `sessions` (`user_id`);
CREATE INDEX IF NOT EXISTS `sessions_exp_idx` ON `sessions` (`expires_at`);
CREATE TABLE IF NOT EXISTS `usage_events` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `metric` text NOT NULL,
  `amount` integer NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `usage_user_metric_idx` ON `usage_events` (`user_id`, `metric`, `created_at`);
CREATE TABLE IF NOT EXISTS `media` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `key` text NOT NULL,
  `name` text NOT NULL,
  `kind` text NOT NULL,
  `mime` text NOT NULL,
  `size` integer NOT NULL,
  `width` integer,
  `height` integer,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `media_key_idx` ON `media` (`key`);
CREATE INDEX IF NOT EXISTS `media_owner_idx` ON `media` (`owner_id`);
CREATE TABLE IF NOT EXISTS `articles` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `title` text NOT NULL,
  `summary` text NOT NULL DEFAULT '',
  `content_html` text NOT NULL DEFAULT '',
  `plain_text` text NOT NULL DEFAULT '',
  `cover` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'draft',
  `published_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `articles_pub_idx` ON `articles` (`status`, `published_at`);
CREATE TABLE IF NOT EXISTS `series` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `cover` text NOT NULL DEFAULT '',
  `sort` integer NOT NULL DEFAULT 0,
  `published` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `series_pub_idx` ON `series` (`published`, `sort`);
CREATE TABLE IF NOT EXISTS `showcase_items` (
  `id` text PRIMARY KEY NOT NULL,
  `category` text NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `media` text NOT NULL DEFAULT '',
  `thumb` text NOT NULL DEFAULT '',
  `series_id` text,
  `sort` integer NOT NULL DEFAULT 0,
  `published` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `showcase_cat_pub_idx` ON `showcase_items` (`category`, `published`, `sort`);
CREATE INDEX IF NOT EXISTS `showcase_series_idx` ON `showcase_items` (`series_id`);
CREATE TABLE IF NOT EXISTS `history` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL,
  `kind` text NOT NULL,
  `title` text NOT NULL DEFAULT '',
  `model` text NOT NULL DEFAULT '',
  `input` text NOT NULL DEFAULT '',
  `output` text NOT NULL DEFAULT '',
  `extra` text NOT NULL DEFAULT '{}',
  `status` text NOT NULL DEFAULT 'done',
  `created_at` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `history_owner_idx` ON `history` (`owner_id`, `created_at`);
CREATE TABLE IF NOT EXISTS `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL
);
