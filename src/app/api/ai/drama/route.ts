import { currentUserFromRequest, fail } from "@/lib/api";
import { streamChat } from "@/lib/ai";
import { getVar } from "@/lib/config";
import { createHistory } from "@/lib/repos/history";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";
import { DRAMA_GENRES, buildDramaMessages, type DramaGenre } from "@/lib/prompts";
import { encodeSse, errorSse, sseHeaders } from "@/lib/sse";

export const dynamic = "force-dynamic";

/**
 * 短剧剧本生成（SSE）：LLM 输出 JSON 剧本（剧名/大纲/分集/逐镜头视频提示词）。
 * 配额按文本字符计入 text_chars；完成后写 history（kind: drama_gen）。
 */
export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: { idea?: string; genre?: string; episodes?: number; shotsPerEpisode?: number; style?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const idea = body.idea?.trim() ?? "";
  if (!idea) return fail(400, "请填写题材或剧情设定");
  const episodes = Math.min(12, Math.max(3, Number.isFinite(body.episodes) ? (body.episodes as number) : 6));
  const shotsPerEpisode = Math.min(8, Math.max(3, Number.isFinite(body.shotsPerEpisode) ? (body.shotsPerEpisode as number) : 4));
  const genre: DramaGenre = DRAMA_GENRES.includes(body.genre as DramaGenre) ? (body.genre as DramaGenre) : "反转爽剧";

  const used = await usageThisMonth(user.id, "text_chars");
  if (user.quotaTextChars >= 0 && used >= user.quotaTextChars) {
    return fail(403, "本月文本生成配额已用完");
  }
  const model = getVar("LLM_MODEL") ?? "";
  const messages = buildDramaMessages({ idea, genre, episodes, shotsPerEpisode, style: body.style });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const full = await streamChat(messages, (delta) => {
          controller.enqueue(encoder.encode(encodeSse("delta", { text: delta })));
        });
        await recordUsage(user.id, "text_chars", full.length);
        const historyId = await createHistory({
          ownerId: user.id,
          kind: "drama_gen",
          title: idea.slice(0, 60),
          model,
          input: idea,
          output: full,
          extra: { genre, episodes, shotsPerEpisode },
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

export const maxDuration = 120;
