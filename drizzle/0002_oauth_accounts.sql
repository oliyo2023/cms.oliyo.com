-- 0002_oauth_accounts.sql — 第三方登录账号绑定（GitHub / Google）
CREATE TABLE IF NOT EXISTS `oauth_accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `provider` text NOT NULL,
  `subject` text NOT NULL,
  `email` text NOT NULL,
  `avatar_url` text,
  `created_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `oauth_provider_subject_idx` ON `oauth_accounts` (`provider`, `subject`);
CREATE INDEX IF NOT EXISTS `oauth_user_idx` ON `oauth_accounts` (`user_id`);
