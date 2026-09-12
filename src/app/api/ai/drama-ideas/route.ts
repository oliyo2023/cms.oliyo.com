import { currentUserFromRequest, fail, json } from "@/lib/api";
import { chatOnce } from "@/lib/ai";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";
import { DRAMA_GENRES, DRAMA_IDEA_COUNT, buildDramaIdeaMessages, parseKeywords, type DramaGenre } from "@/lib/prompts";

export const dynamic = "force-dynamic";

/**
 * 短剧「题材 / 剧情设定」候选：「短剧生成」的设定输入框用。
 * 传入 seed（当前已填设定，可空）与类型，返回候选设定列表。
 * 只计文本配额、不写历史记录——它是输入辅助，不是一次内容产出。
 */
export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: { seed?: string; genre?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const seed = body.seed?.trim().slice(0, 300) ?? "";
  const genre: DramaGenre = DRAMA_GENRES.includes(body.genre as DramaGenre) ? (body.genre as DramaGenre) : "反转爽剧";

  const used = await usageThisMonth(user.id, "text_chars");
  if (user.quotaTextChars >= 0 && used >= user.quotaTextChars) {
    return fail(403, "本月文本生成配额已用完，请联系管理员调整配额");
  }

  try {
    const raw = await chatOnce(buildDramaIdeaMessages({ genre, seed }), { maxTokens: 600 });
    const ideas = parseKeywords(raw).slice(0, DRAMA_IDEA_COUNT);
    if (ideas.length === 0) return fail(502, "未能生成设定，请重试");
    await recordUsage(user.id, "text_chars", raw.length);
    return json({ ok: true, ideas });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return fail(502, message);
  }
}
