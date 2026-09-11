import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ---------- users ----------
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passHash: text("pass_hash").notNull(), // pbkdf2$iterations$saltHex$hashHex
    role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
    // quota limits; -1 = unlimited
    quotaTextChars: integer("quota_text_chars").notNull().default(0),
    quotaImages: integer("quota_images").notNull().default(0),
    quotaVideos: integer("quota_videos").notNull().default(0),
    quotaRewriteChars: integer("quota_rewrite_chars").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

// ---------- sessions ----------
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_exp_idx").on(t.expiresAt)],
);

// ---------- usage_events (quota ledger, current calendar month resets usage) ----------
export const usageEvents = sqliteTable(
  "usage_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    metric: text("metric", {
      enum: ["text_chars", "rewrite_chars", "images", "videos", "media_bytes"],
    }).notNull(),
    amount: integer("amount").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("usage_user_metric_idx").on(t.userId, t.metric, t.createdAt)],
);

// ---------- media (素材库) ----------
export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    key: text("key").notNull(), // R2 object key: media/<uuid>.<ext>
    name: text("name").notNull(),
    kind: text("kind", { enum: ["image", "video", "audio", "file"] }).notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("media_key_idx").on(t.key), index("media_owner_idx").on(t.ownerId)],
);

// ---------- articles (图文/文章，含公众号排版内容) ----------
export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    contentHtml: text("content_html").notNull().default(""),
    plainText: text("plain_text").notNull().default(""),
    cover: text("cover").notNull().default(""), // r2://<key> | https://...
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    publishedAt: integer("published_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("articles_pub_idx").on(t.status, t.publishedAt)],
);

// ---------- series (剧集) ----------
export const series = sqliteTable(
  "series",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    cover: text("cover").notNull().default(""),
    sort: integer("sort").notNull().default(0),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("series_pub_idx").on(t.published, t.sort)],
);

// ---------- showcase_items (画廊/视频/剧集单集) ----------
export const showcaseItems = sqliteTable(
  "showcase_items",
  {
    id: text("id").primaryKey(),
    category: text("category", { enum: ["gallery", "video", "episode"] }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    media: text("media").notNull().default(""), // r2://<key> | https://...
    thumb: text("thumb").notNull().default(""),
    seriesId: text("series_id"),
    sort: integer("sort").notNull().default(0),
    published: integer("published", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("showcase_cat_pub_idx").on(t.category, t.published, t.sort),
    index("showcase_series_idx").on(t.seriesId),
  ],
);

// ---------- history (AI 操作记录库) ----------
export const history = sqliteTable(
  "history",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    kind: text("kind", {
      enum: ["article_gen", "rewrite", "image_gen", "video_gen", "drama_gen", "manual"],
    }).notNull(),
    title: text("title").notNull().default(""),
    model: text("model").notNull().default(""),
    input: text("input").notNull().default(""),
    output: text("output").notNull().default(""),
    extra: text("extra").notNull().default("{}"), // JSON: images[], videoUrl, articleId, etc
    status: text("status", { enum: ["done", "failed"] }).notNull().default("done"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("history_owner_idx").on(t.ownerId, t.createdAt)],
);

// ---------- oauth_accounts (第三方登录绑定：一个用户可绑多个 provider) ----------
export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider", { enum: ["github", "google"] }).notNull(),
    subject: text("subject").notNull(),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("oauth_provider_subject_idx").on(t.provider, t.subject),
    index("oauth_user_idx").on(t.userId),
  ],
);

 // ---------- settings (key-value site config) ----------
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type User = typeof users.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Series = typeof series.$inferSelect;
export type ShowcaseItem = typeof showcaseItems.$inferSelect;
export type MediaRow = typeof media.$inferSelect;
export type HistoryRow = typeof history.$inferSelect;
export type OAuthAccount = typeof oauthAccounts.$inferSelect;

export const schema = {
  users,
  sessions,
  usageEvents,
  media,
  articles,
  series,
  showcaseItems,
  history,
  oauthAccounts,
  settings,
};
