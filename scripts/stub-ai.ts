/**
 * Dev-only OpenAI-compatible stub used for E2E verification when no real LLM keys exist.
 * Serves /v1/chat/completions (stream + once), /v1/images/generations (b64 PNG),
 * /v1/videos create+poll. Never deployed.
 */
import http from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 8788);

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function sampleArticle(topic: string): string {
  return [
    `# ${topic || "未命名主题"}`,
    "",
    "这是一段用于验证流式输出与保存链路的示例正文。",
    "",
    "## 为什么值得关注",
    "",
    "第一，信息在快速变化；第二，工具正在成熟；第三，机会窗口有限。",
    "",
    "> 判断趋势，关键不在噪音，而在结构性的变化。",
    "",
    `围绕「${topic || "该主题"}」我们整理了三个要点：`,
    "",
    "- 实践优先：先跑通最小闭环；",
    "- 数据说话：用指标代替感觉；",
    "- 持续迭代：小步快跑、及时复盘。",
    "",
    "[图: 一张与主题相关的信息图插画]",
    "",
    "## 结语",
    "",
    "与其等待完美方案，不如尽早开始验证。",
  ].join("\n");
}

function rewriteSample(src: string): string {
  const head = (src.match(/^.{0,80}/s)?.[0] ?? "").trim();
  return `深度改写版：${head}…… 在保留原意的前提下调整了句式与段落结构，使表达更精炼。${" ".repeat(1)}` + "（stub 输出，正式环境由 LLM 完成。）";
}

/** 最近创建的 stub 视频任务；查询时回带，便于断言 mode / 素材确实传到了服务端。 */
let lastJob: unknown = null;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (!url.pathname.startsWith("/v1/")) {
    res.writeHead(404).end("not found");
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const bodyRaw = Buffer.concat(chunks).toString("utf8");
  let body: Record<string, unknown> = {};
  try {
    body = bodyRaw ? JSON.parse(bodyRaw) : {};
  } catch {
    /* ignore */
  }
  const messages = (body.messages ?? []) as Array<{ role: string; content: string }>;
  const userMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const isRewrite = userMsg.includes("原文如下") || userMsg.includes("改写");
  const topic = (userMsg.match(/(?:^|\n)主题[:：]\s*([^\n]+)/)?.[1] ?? userMsg.split("\n")[0]).slice(0, 40);
  const isDrama = userMsg.includes("集数：");
  const isDramaIdeas = systemMsg.includes("短剧选题策划");
  const isKeywords = systemMsg.includes("新媒体选题策划");
  const isVideoPrompt = systemMsg.includes("AI 视频提示词工程师");
  const videoPromptsSample = JSON.stringify([
    "雨后的未来城市街道，霓虹倒映在积水里，银色跑车缓慢驶过，低角度跟拍后缓缓拉远，写实光影，冷暖对比",
    "黄昏的旧书店，女孩抽出泛黄相册轻轻翻开，镜头从书脊之间缓慢推向侧脸，暖色调，胶片颗粒",
  ]);
  const dramaIdeasSample = JSON.stringify([
    "外卖员意外拿到豪门遗嘱，每集一个反转",
    "实习医生发现全院病历造假，越查越深",
    "被退婚当天，她接手了负债累累的老厂",
    "保安夜班撞见老板的秘密交易",
    "被裁当天中了大奖，却不敢告诉家人",
    "替身演员意外成了替身新娘",
  ]);
  const keywordsSample = JSON.stringify([
    "创作者如何用 AI 省下每天两小时",
    "被算法投喂三年后我重新学会了阅读",
    "一人公司：三个人的活怎么一个人干完",
    "把 AI 当实习生带的一个月",
    "内容创作者的护城河还剩什么",
    "我用一周记录了自己的注意力去向",
    "为什么好工具反而让人更焦虑",
    "从零开始做垂直小号的 90 天",
  ]);
  const drama = JSON.stringify({
    title: "豪门遗嘱",
    logline: "外卖员意外拿到豪门遗嘱，每集一个反转。",
    characters: [
      { name: "陈默", appearance: "28 岁男性外卖员，寸头，皮肤偏黑，穿深蓝色冲锋衣，眼神倔强" },
      { name: "林婉", appearance: "35 岁女性，齐肩黑发，高颧骨，穿米色风衣，神情冷淡" },
    ],
    episodes: [
      {
        number: 1,
        title: "开篇",
        summary: "外卖员送单到豪宅，意外捡到遗嘱残页。",
        shots: [
          { shot: 1, prompt: "近景，陈默站在豪宅门口", cast: ["陈默"], dialogue: "这单送得也太远了。" },
          { shot: 2, prompt: "中景，客厅里林婉写下遗嘱", cast: ["林婉"], dialogue: "" },
          { shot: 3, prompt: "特写，遗嘱残页露出签名", cast: [], dialogue: "" },
        ],
      },
      {
        number: 2,
        title: "反转",
        summary: "遗嘱署名竟是外卖员，众人震惊。",
        shots: [
          { shot: 1, prompt: "中景，陈默在家族会议上被围住", cast: ["陈默", "林婉"], dialogue: "你们都别拦着我。" },
          { shot: 2, prompt: "特写，遗嘱落款放大", cast: [], dialogue: "" },
          { shot: 3, prompt: "中景，陈默推门而入", cast: ["陈默"], dialogue: "遗嘱上写的是我的名字。" },
        ],
      },
    ],
  });
  const full = isDrama
    ? drama
    : isDramaIdeas
      ? dramaIdeasSample
      : isVideoPrompt
        ? videoPromptsSample
        : isKeywords
          ? keywordsSample
          : isRewrite
            ? rewriteSample(userMsg)
            : sampleArticle(topic || userMsg);

  if (url.pathname === "/v1/images/generations") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ b64_json: PNG_1PX }] }));
    return;
  }

  if (body.stream === true && url.pathname === "/v1/chat/completions") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const chunksOut = full.match(/.{1,12}/gs) ?? [];
    let i = 0;
    const timer = setInterval(() => {
      if (i >= chunksOut.length) {
        res.write(`data: [DONE]\n\n`);
        clearInterval(timer);
        res.end();
        return;
      }
      const piece = chunksOut[i++];
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
    }, 15);
    req.on("close", () => clearInterval(timer));
    return;
  }

  if (url.pathname === "/v1/chat/completions") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: full } }] }));
    return;
  }

  if (url.pathname === "/v1/videos" && req.method === "POST") {
    // 对齐 Agnes：按 mode 校验素材，让 E2E 能真正覆盖 keyframe / reference 两条输入路径。
    const mode = String(body.mode ?? "text");
    const firstFrame = body.first_frame;
    const lastFrame = body.last_frame;
    const images = body.images;
    if (mode === "keyframe" && !firstFrame && !lastFrame) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "first_frame and last_frame are both missing" }));
      return;
    }
    if (mode === "reference" && (!Array.isArray(images) || images.length === 0)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "images is required" }));
      return;
    }
    lastJob = { prompt: String(body.prompt ?? ""), mode, firstFrame, lastFrame, images };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: "stub-video-1", video_id: "stub-video-1", status: "queued" }));
    return;
  }
  if (url.pathname.startsWith("/v1/videos/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "completed",
        metadata: { url: "https://example.com/stub.mp4" },
        stubJob: lastJob,
      }),
    );
    return;
  }

  res.writeHead(404).end("unknown stub route");
});

server.listen(PORT, () => console.log(`ai stub listening on :${PORT}`));
