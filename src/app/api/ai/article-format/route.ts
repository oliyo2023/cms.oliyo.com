import { currentUserFromRequest, fail, json } from "@/lib/api";
import { chatOnce } from "@/lib/ai";
import { getVar } from "@/lib/config";
import { createHistory } from "@/lib/repos/history";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";
import { buildFormatMessages, parseFormatBlocks } from "@/lib/prompts";

export const dynamic = "force-dynamic";

const MIN_TEXT = 50;
const MAX_TEXT = 12000;

/** 智能排版：正文 → 结构化排版块（样式由前端 wx* 模板渲染，模型只负责结构）。 */
export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const text = body.text?.trim() ?? "";
  if (text.length < MIN_TEXT) return fail(400, `正文太短（至少 ${MIN_TEXT} 字）再排版`);
  if (text.length > MAX_TEXT) return fail(400, `正文过长（最多 ${MAX_TEXT} 字），请分段排版`);

  const used = await usageThisMonth(user.id, "text_chars");
  if (user.quotaTextChars >= 0 && used >= user.quotaTextChars) {
    return fail(403, "本月文本生成配额已用完，请联系管理员调整配额");
  }
  const model = getVar("LLM_MODEL") ?? "";

  try {
    const raw = await chatOnce(buildFormatMessages(text), { maxTokens: 4000 });
    const blocks = parseFormatBlocks(raw);
    const outputLen = blocks.reduce((n, b) => n + b.text.length, 0);
    await recordUsage(user.id, "text_chars", outputLen);
    const historyId = await createHistory({
      ownerId: user.id,
      kind: "article_format",
      title: text.slice(0, 60),
      model,
      input: text.slice(0, 2000),
      extra: { blocks: blocks.length, chars: outputLen },
    });
    return json({ ok: true, historyId, blocks });
  } catch (e) {
    const message = e instanceof Error ? e.message : "排版失败";
    return fail(502, message);
  }
}
