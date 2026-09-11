import { currentUserFromRequest, fail } from "@/lib/api";
import { streamChat } from "@/lib/ai";
import { getVar } from "@/lib/config";
import { createHistory } from "@/lib/repos/history";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";
import { buildRewriteMessages, type RewriteMode } from "@/lib/prompts";
import { encodeSse, errorSse, sseHeaders } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: { source?: string; mode?: RewriteMode; titleHint?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const source = body.source?.trim() ?? "";
  if (!source) return fail(400, "请粘贴要改写的原文");
  if (source.length > 20000) return fail(400, "原文过长（最多 2 万字）");
  const mode = body.mode ?? "deep";

  const used = await usageThisMonth(user.id, "rewrite_chars");
  if (user.quotaRewriteChars >= 0 && used >= user.quotaRewriteChars) {
    return fail(403, "本月洗稿配额已用完，请联系管理员调整配额");
  }
  const model = getVar("LLM_MODEL") ?? "";

  const encoder = new TextEncoder();
  const messages = buildRewriteMessages({ source, mode, titleHint: body.titleHint });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const full = await streamChat(messages, (delta) => {
          controller.enqueue(encoder.encode(encodeSse("delta", { text: delta })));
        });
        await recordUsage(user.id, "rewrite_chars", full.length);
        const historyId = await createHistory({
          ownerId: user.id,
          kind: "rewrite",
          title: (body.titleHint ?? source.slice(0, 30)) || "洗稿",
          model,
          input: source.slice(0, 500),
          output: full,
          extra: { mode, length: full.length },
        });
        controller.enqueue(encoder.encode(encodeSse("done", { historyId, chars: full.length })));
      } catch (e) {
        const message = e instanceof Error ? e.message : "改写失败";
        controller.enqueue(encoder.encode(errorSse(message)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
