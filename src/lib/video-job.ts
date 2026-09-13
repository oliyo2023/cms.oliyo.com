/**
 * AI 视频任务的「提交 + 轮询」客户端协议。
 *
 * 服务端 `POST /api/ai/video` 只负责建任务并返回 taskId（异步任务不在请求内完成），
 * 完成地址要按 pollMs 轮询 `GET /api/ai/video?id=` 才能拿到。管理端三处都要走这套
 * 流程（作品展示的生成弹窗、短剧的逐镜头生成、AI 视频栏目），集中在这里避免三份漂移。
 */

/**
 * 轮询上限；超过即视为仍在排队，交由用户稍后在「历史记录」查看。
 * 实测 5 秒成片约需 3.5-4 分钟（排队 + 推理），故给到 15 次 × 15s ≈ 3.75 分钟。
 * 逐镜头批量生成时不能等这么久，调用方会传更短的 attempts（见 drama 页）。
 */
const MAX_POLL_ATTEMPTS = 15;
/** 单次轮询间隔上限，服务端给的 pollMs 再大也不超过它。 */
const MAX_POLL_MS = 15000;

/** 生成模式：text 纯文本；keyframe 首/尾帧控制；reference 图片参考（见 Agnes 视频文档）。 */
export type VideoMode = "text" | "keyframe" | "reference";

/** 提交给 /api/ai/video 的任务参数；首尾帧与参考图可传素材库引用（r2://）或外链。 */
export type VideoJobSpec = {
  prompt: string;
  mode?: VideoMode;
  firstFrame?: string;
  lastFrame?: string;
  images?: string[];
};

export type VideoJobResult =
  | { ok: true; url: string }
  | { ok: false; message: string; unconfigured?: boolean };

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

export async function runVideoJob(
  spec: VideoJobSpec,
  onProgress?: (message: string) => void,
  opts?: { maxAttempts?: number },
): Promise<VideoJobResult> {
  onProgress?.("已提交任务，等待生成…");

  let res: Response;
  try {
    res = await fetch("/api/ai/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
    });
  } catch {
    return { ok: false, message: "网络错误" };
  }
  const data = (await res.json().catch(() => null)) as
    | { configured?: boolean; message?: string; taskId?: string; pollMs?: number; error?: string }
    | null;
  if (res.status === 501 || data?.configured === false) {
    return { ok: false, unconfigured: true, message: data?.message ?? data?.error ?? "视频生成服务未配置" };
  }
  if (!res.ok || !data?.taskId) return { ok: false, message: data?.error ?? "提交失败" };

  const interval = Math.min(data.pollMs ?? MAX_POLL_MS, MAX_POLL_MS);
  const attempts = Math.min(opts?.maxAttempts ?? MAX_POLL_ATTEMPTS, MAX_POLL_ATTEMPTS);
  for (let i = 0; i < attempts; i++) {
    await sleep(interval);
    let pollRes: Response;
    try {
      pollRes = await fetch(`/api/ai/video?id=${encodeURIComponent(data.taskId)}`);
    } catch {
      return { ok: false, message: "网络错误" };
    }
    const poll = (await pollRes.json().catch(() => null)) as
      | { ok?: boolean; status?: string; url?: string; message?: string }
      | null;
    if (poll?.ok && poll.status === "done" && poll.url) return { ok: true, url: poll.url };
    if (poll?.status === "error" || poll?.status === "failed" || pollRes.status >= 400) {
      return { ok: false, message: poll?.message ?? "任务查询失败" };
    }
    onProgress?.(`生成中（异步任务，轮询第 ${i + 1} 次）…`);
  }
  return { ok: false, message: "任务仍在排队，请稍后到「历史记录」查看；或改用素材库上传视频后发布。" };
}
