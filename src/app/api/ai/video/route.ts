import { currentUserFromRequest, fail, json } from "@/lib/api";
import { videoConfig, videoPollUrl, type VideoConfig } from "@/lib/ai";
import { resolveVar } from "@/lib/config";
import { siteUrl } from "@/lib/site";
import { r2KeyOf } from "@/lib/refs";
import { createHistory } from "@/lib/repos/history";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";

export const dynamic = "force-dynamic";

/**
 * 视频生成（Agnes Video 2.5 Flash 兼容）：
 * 创建 POST {baseUrl}/videos → video_id；查询走 VIDEO_POLL_URL 模板
 * （Agnes: /agnesapi?video_id={id}&model_name={model}），完成地址在 metadata.url。
 *
 * 三种生成模式（见官方文档）：
 *  - text：纯文生视频；
 *  - keyframe：首帧/尾帧控制，first_frame 与 last_frame 至少一个；
 *  - reference：图片参考，images 至少一张（Flash 上限 5 张）。
 * 媒体既可用素材库引用（r2://<key>），也可用外链 https://…；对外必须是绝对可达 URL。
 *
 * 未配置 VIDEO_ / AGNES_API_KEY 时返回 configured:false（管理端显示未启用）。
 */
const GENERIC_POLL_MS = 15000;
const MAX_PROMPT_CHARS = 2000;
const MODES = ["text", "keyframe", "reference"] as const;
/** Flash 校验：参考图最多 5 张（agnes-video-2.5-flash 文档「与 Agnes Video 2.5 的差异」）。 */
const MAX_REFERENCE_IMAGES = 5;

type VideoMode = (typeof MODES)[number];

/** 素材引用 → 视频服务可公开下载的绝对 URL。 */
function absoluteMedia(ref: string, base: string): string {
  const key = r2KeyOf(ref);
  return key ? `${base}/media/${key}` : ref;
}

async function startJob(
  cfg: VideoConfig,
  job: { prompt: string; mode: VideoMode; firstFrame?: string; lastFrame?: string; images?: string[] },
): Promise<{ id: string }> {
  const payload: Record<string, unknown> = {
    model: cfg.model,
    prompt: job.prompt,
    mode: job.mode,
    seconds: cfg.seconds,
    size: cfg.size,
    aspect_ratio: cfg.aspect,
  };
  if (job.mode === "keyframe") {
    if (job.firstFrame) payload.first_frame = job.firstFrame;
    if (job.lastFrame) payload.last_frame = job.lastFrame;
  } else if (job.mode === "reference") {
    payload.images = job.images ?? [];
  }

  const res = await fetch(`${cfg.baseUrl}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(payload),
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

  let body: { prompt?: string; mode?: string; firstFrame?: string; lastFrame?: string; images?: string[] };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) return fail(400, "请描述要生成的视频画面");
  if (prompt.length > MAX_PROMPT_CHARS) return fail(400, `画面描述过长（上限 ${MAX_PROMPT_CHARS} 字）`);

  const mode: VideoMode = MODES.includes(body.mode as VideoMode) ? (body.mode as VideoMode) : "text";
  const siteBase = await resolveVar("SITE_URL");
  const base = siteUrl(req, siteBase);
  const firstRef = body.firstFrame?.trim() ?? "";
  const lastRef = body.lastFrame?.trim() ?? "";
  const imageRefs = (Array.isArray(body.images) ? body.images : [])
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_REFERENCE_IMAGES);

  if (mode === "keyframe" && !firstRef && !lastRef) return fail(400, "首尾帧模式至少要提供首帧或尾帧");
  if (mode === "reference" && imageRefs.length === 0) return fail(400, "参考模式至少要提供一张参考图");
  // 素材库引用要由 Agnes 侧公开抓取；没有固定站点地址时只会拼出本地地址，异步任务会静默失败。
  if (!siteBase && [firstRef, lastRef, ...imageRefs].some((ref) => r2KeyOf(ref) !== null)) {
    return fail(400, "使用素材库图片需要先配置「站点地址」SITE_URL（视频服务要能公开抓取该地址）");
  }

  const firstFrame = firstRef ? absoluteMedia(firstRef, base) : "";
  const lastFrame = lastRef ? absoluteMedia(lastRef, base) : "";
  const images = imageRefs.map((ref) => absoluteMedia(ref, base));

  const used = await usageThisMonth(user.id, "videos");
  if (user.quotaVideos >= 0 && used >= user.quotaVideos) {
    return fail(403, "本月视频生成配额已用完");
  }
  try {
    const { id } = await startJob(cfg, { prompt, mode, firstFrame, lastFrame, images });
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
      error?: { message?: string };
      url?: string;
      metadata?: { url?: string };
      output?: string | { url?: string };
    };
    const status = (data.status ?? data.state ?? "unknown").toLowerCase();
    if (status === "failed") {
      return json(
        { ok: false, status: "failed", message: data.error?.message ?? data.detail ?? "视频任务失败" },
        { status: 200 },
      );
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
