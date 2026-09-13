-- 0003_episode_shots.sql — 剧集单集的多镜头序列与角色设定
-- 短剧链路：一集由多个几秒镜头组成，逐镜头生成后按序连播；
-- 角色设定图用于逐镜头的 reference 引用，保证同一角色跨镜头外观一致。
ALTER TABLE `showcase_items` ADD COLUMN `shots` text NOT NULL DEFAULT '[]';
ALTER TABLE `series` ADD COLUMN `cast` text NOT NULL DEFAULT '[]';
