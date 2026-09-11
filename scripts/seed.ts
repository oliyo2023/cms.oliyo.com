/**
 * Seeds the database:
 *   - admin account (env ADMIN_EMAIL / ADMIN_PASSWORD, defaults below)
 *   - demo showcase content (视频成片 / 剧集) using the legacy public COS media
 * Idempotent: skips when users already exist. Run: pnpm seed
 */
import { hashPassword, newId } from "../src/lib/auth";
import { db } from "../src/lib/drizzle";
import { articles, series, showcaseItems, users } from "../src/lib/schema";
import { count } from "drizzle-orm";

async function main() {
  const [{ n }] = await db().select({ n: count() }).from(users);
  if (n > 0) {
    console.log("users exist — seed skipped");
    return;
  }
  const now = Date.now();
  const email = (process.env.ADMIN_EMAIL ?? "admin@oliyo.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin123456";
  await db().insert(users).values({
    id: newId(),
    email,
    name: "管理员",
    passHash: await hashPassword(password),
    role: "admin",
    quotaTextChars: -1,
    quotaImages: -1,
    quotaVideos: -1,
    quotaRewriteChars: -1,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`admin created: ${email}`);

  const legacy = (id: string) => `https://cos-platform-outputs.agnes-ai.cn/videos/agnes-video-v2.0/${id}.mp4`;
  const videos: Array<{ id: string; title: string; desc: string }> = [
    { id: "video_12d4184045104f25bd32163577d2488d", title: "城市夜景 · 流光", desc: "城市夜景延时摄影，车流灯光流动，4K 质感" },
    { id: "video_d8c0adcb97274b42a931fa39cec753d7", title: "精卫填海 · 水墨", desc: "中国水墨动画风格，笔触晕染，山海经神话氛围" },
    { id: "video_af3b8aa9442f40bfb21908b3822df04c", title: "基山 · 猼訑与九尾狐", desc: "上古洪荒气韵，基山幽谷，猼訑四耳九尾，青丘九尾狐沐月" },
    { id: "video_5d703c1ef972488fae4f6c15fa5f04b0", title: "丹树 · 玉膏", desc: "丹树朱果、岩间玉膏喷涌如泉，暖光升腾，仙雾缭绕" },
  ];
  for (const [i, v] of videos.entries()) {
    await db().insert(showcaseItems).values({
      id: newId(),
      category: "video",
      title: v.title,
      description: v.desc,
      media: legacy(v.id),
      sort: i,
      published: true,
      createdAt: now - i * 3600_000,
    });
  }
  console.log(`seeded ${videos.length} showcase videos`);

  const sid = newId();
  await db().insert(series).values({
    id: sid,
    ownerId: "",
    title: "山海经 · 精卫填海",
    description: "中国水墨动画风格系列，笔触晕染，诗意留白",
    cover: legacy("video_d8c0adcb97274b42a931fa39cec753d7"),
    sort: 0,
    published: true,
    createdAt: now,
  });
  const episodes = [
    { title: "第一集 · 溺海", desc: "古代少女在东海波涛中挣扎，渐渐没入海中，随即精卫鸟冲天而起" },
    { title: "第二集 · 衔石", desc: "精卫鸟口衔树枝石块，飞过浩瀚海面，将石子投向浪涛" },
  ];
  for (const [i, ep] of episodes.entries()) {
    await db().insert(showcaseItems).values({
      id: newId(),
      category: "episode",
      title: ep.title,
      description: ep.desc,
      media: legacy(i === 0 ? "video_0b060ee72d02428685b0a91bd5e5f00a" : "video_da85d448cd4b41749919934f49d10bca"),
      seriesId: sid,
      sort: i,
      published: true,
      createdAt: now,
    });
  }
  console.log("seeded 1 series / 2 episodes");

  await db().insert(articles).values({
    id: newId(),
    ownerId: "",
    title: "你好，创作台",
    summary: "一次生成图文、智能洗稿与公众号排版的示例文章",
    contentHtml:
      '<section><h1 style="text-align:center;font-size:22px;color:#6366f1;">你好，创作台</h1><p style="text-align:center;color:#a1a1aa;font-size:14px;margin:4px 0 20px;">一次 AI 图文创作示例</p><p>创作台帮你把想法变成图文：输入主题，AI 生成文案与配图；粘贴素材，智能洗稿产出新表达；一键排版，复制到公众号即可发布。</p><blockquote>本页由种子数据填充，登录后即可在管理端创建自己的内容。</blockquote></section>',
    plainText: "你好，创作台。一次 AI 图文创作示例。创作台帮你把想法变成图文。",
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  console.log("seeded 1 demo article");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
