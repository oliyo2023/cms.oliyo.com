import { currentUserFromRequest, fail, json } from "@/lib/api";
import { videoConfig, videoPollUrl } from "@/lib/ai";
import { createHistory } from "@/lib/repos/history";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";

export const dynamic = "force-dynamic";

/**
 * 视频生成（Agnes Video 2.5 Flash 兼容）：
 * 创建 POST {baseUrl}/videos → video_id；查询走 VIDEO_POLL_URL 模板
 * （Agnes: /agnesapi?video_id={id}&model_name={model}），完成地址在 metadata.url。
 * 未配置 VIDEO_ / AGNES_API_KEY 时返回 configured:false（管理端显示未启用）。
 */
const GENERIC_POLL_MS = 15000;

async function startGenericJob(prompt: string): Promise<{ id: string }> {
  const cfg = await videoConfig();
  if (!cfg) throw new Error("视频生成服务未配置");
  const res = await fetch(`${cfg.baseUrl}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      prompt,
      mode: "text",
      seconds: cfg.seconds,
      size: cfg.size,
      aspect_ratio: cfg.aspect,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`视频服务启动失败 ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string; task_id?: string; video_id?: string };
  const id = data.video_id ?? data.id ?? data.task_id;
  if (!id) throw new Error("视频服务未返回任务 ID");
  return { id };
}

export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const cfg = await videoConfig();
  if (!cfg) {
    return json(
      { configured: false, message: "视频生成服务未配置（VIDEO_API_KEY / AGNES_API_KEY）" },
      { status: 501 },
    );
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) return fail(400, "请描述要生成的视频画面");

  const used = await usageThisMonth(user.id, "videos");
  if (user.quotaVideos >= 0 && used >= user.quotaVideos) {
    return fail(403, "本月视频生成配额已用完");
  }
  try {
    const { id } = await startGenericJob(prompt);
    return json({ ok: true, taskId: id, pollMs: GENERIC_POLL_MS });
  } catch (e) {
    const message = e instanceof Error ? e.message : "视频生成失败";
    return fail(502, message);
  }
}

/** 轮询任务状态；done 后记录用量与历史。 */
export async function GET(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const url = new URL(req.url);
  const taskId = url.searchParams.get("id");
  if (!taskId) return fail(400, "缺少任务 id");
  const cfg = await videoConfig();
  if (!cfg) return json({ configured: false }, { status: 501 });

  try {
    const res = await fetch(videoPollUrl(cfg, taskId), {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`查询任务失败 ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      status?: string;
      state?: string;
      detail?: string;
      url?: string;
      metadata?: { url?: string };
      output?: string | { url?: string };
    };
    const status = (data.status ?? data.state ?? "unknown").toLowerCase();
    if (status === "failed") {
      return json({ ok: false, status: "failed", message: data.detail ?? "视频任务失败" }, { status: 200 });
    }
    if (status === "done" || status === "succeeded" || status === "completed") {
      const videoUrl =
        data.metadata?.url ?? data.url ?? (typeof data.output === "string" ? data.output : data.output?.url);
      if (videoUrl) {
        await recordUsage(user.id, "videos", 1);
        await createHistory({
          ownerId: user.id,
          kind: "video_gen",
          title: "视频生成",
          model: cfg.model,
          input: "",
          extra: { url: videoUrl },
        });
        return json({ ok: true, status: "done", url: videoUrl });
      }
    }
    return json({ ok: true, status, polling: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "查询失败";
    return json({ ok: false, status: "error", message }, { status: 502 });
  }
}

export const maxDuration = 60;
