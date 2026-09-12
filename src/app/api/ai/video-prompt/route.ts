import { currentUserFromRequest, fail, json } from "@/lib/api";
import { chatOnce } from "@/lib/ai";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";
import { VIDEO_PROMPT_COUNT, buildVideoPromptMessages, parseStringList } from "@/lib/prompts";

export const dynamic = "force-dynamic";

/**
 * AI 视频「画面描述」候选：文生视频入口的提示词辅助。
 * 传入 idea（当前已填构想，可空）与 style，返回候选提示词列表。
 * 只计文本配额、不写历史记录——它是输入辅助，不是一次内容产出。
 */
export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: { idea?: string; style?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const idea = body.idea?.trim().slice(0, 300) ?? "";
  const style = body.style?.trim().slice(0, 100) ?? "";

  const used = await usageThisMonth(user.id, "text_chars");
  if (user.quotaTextChars >= 0 && used >= user.quotaTextChars) {
    return fail(403, "本月文本生成配额已用完，请联系管理员调整配额");
  }

  try {
    const raw = await chatOnce(buildVideoPromptMessages({ idea, style }), { maxTokens: 800 });
    const prompts = parseStringList(raw, VIDEO_PROMPT_COUNT);
    if (prompts.length === 0) return fail(502, "未能生成提示词，请重试");
    await recordUsage(user.id, "text_chars", raw.length);
    return json({ ok: true, prompts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    return fail(502, message);
  }
}
