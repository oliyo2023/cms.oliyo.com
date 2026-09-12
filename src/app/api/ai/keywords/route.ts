import { currentUserFromRequest, fail, json } from "@/lib/api";
import { chatOnce } from "@/lib/ai";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";
import { AUDIENCES, KEYWORD_COUNT, TONES, buildKeywordMessages, parseStringList, type Audience, type Tone } from "@/lib/prompts";

export const dynamic = "force-dynamic";

/**
 * 主题关键词候选：「AI 图文」的主题输入框用。
 * 传入 seed（当前已填主题，可空）与文风/读者，返回候选选题列表。
 * 只计文本配额、不写历史记录——它是输入辅助，不是一次内容产出。
 */
export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: { seed?: string; tone?: string; audience?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const seed = body.seed?.trim().slice(0, 200) ?? "";
  const tone: Tone = TONES.includes(body.tone as Tone) ? (body.tone as Tone) : "正式";
  const audience: Audience = AUDIENCES.includes(body.audience as Audience) ? (body.audience as Audience) : "公众号读者";

  const used = await usageThisMonth(user.id, "text_chars");
  if (user.quotaTextChars >= 0 && used >= user.quotaTextChars) {
    return fail(403, "本月文本生成配额已用完，请联系管理员调整配额");
  }

  try {
    const raw = await chatOnce(buildKeywordMessages({ seed, tone, audience }), { maxTokens: 600 });
    const keywords = parseStringList(raw, KEYWORD_COUNT * 2);
    if (keywords.length === 0) return fail(502, "未能生成关键词，请重试");
    await recordUsage(user.id, "text_chars", raw.length);
    return json({ ok: true, keywords });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return fail(502, message);
  }
}
