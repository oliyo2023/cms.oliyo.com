import { currentUserFromRequest, fail } from "@/lib/api";
import { streamChat } from "@/lib/ai";
import { getVar } from "@/lib/config";
import { createHistory } from "@/lib/repos/history";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";
import { buildArticleMessages, type Audience, type Tone } from "@/lib/prompts";
import { encodeSse, errorSse, sseHeaders } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: {
    topic?: string;
    angle?: string;
    tone?: Tone;
    audience?: Audience;
    length?: "short" | "medium" | "long";
    extra?: string;
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const topic = body.topic?.trim() ?? "";
  if (!topic) return fail(400, "请填写主题");
  const length = body.length ?? "medium";

  const used = await usageThisMonth(user.id, "text_chars");
  if (user.quotaTextChars >= 0 && used >= user.quotaTextChars) {
    return fail(403, "本月文本生成配额已用完，请联系管理员调整配额");
  }
  const model = getVar("LLM_MODEL") ?? "";

  const encoder = new TextEncoder();
  const messages = buildArticleMessages({
    topic,
    angle: body.angle,
    tone: body.tone ?? "正式",
    audience: body.audience ?? "公众号读者",
    length,
    extra: body.extra,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const full = await streamChat(messages, (delta) => {
          controller.enqueue(encoder.encode(encodeSse("delta", { text: delta })));
        });
        await recordUsage(user.id, "text_chars", full.length);
        const historyId = await createHistory({
          ownerId: user.id,
          kind: "article_gen",
          title: topic.slice(0, 60),
          model,
          input: topic,
          output: full,
          extra: { length: full.length },
        });
        controller.enqueue(encoder.encode(encodeSse("done", { historyId, chars: full.length })));
      } catch (e) {
        const message = e instanceof Error ? e.message : "生成失败";
        controller.enqueue(encoder.encode(errorSse(message)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
