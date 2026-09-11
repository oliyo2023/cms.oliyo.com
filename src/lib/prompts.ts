import type { ChatMessage } from "@/lib/ai";

export type Tone = "正式" | "轻松" | "温暖" | "犀利" | "文艺";
export type Audience = "公众号读者" | "朋友圈" | "小红书用户" | "短视频口播" | "通用";

export const TONES: Tone[] = ["正式", "轻松", "温暖", "犀利", "文艺"];
export const AUDIENCES: Audience[] = ["公众号读者", "朋友圈", "小红书用户", "短视频口播", "通用"];

export function buildArticleMessages(opts: {
  topic: string;
  angle?: string;
  tone: Tone;
  audience: Audience;
  length: "short" | "medium" | "long";
  extra?: string;
}): ChatMessage[] {
  const lengthMap = { short: "约 400-600 字", medium: "约 800-1200 字", long: "约 1500-2500 字" };
  const system =
    "你是资深中文新媒体编辑。产出结构完整、可直接发布的图文文案：用 Markdown 输出（标题用 #，小节用 ##，列表与引用正常使用）。" +
    "不要输出任何解释或前后缀文字，只输出文章正文。";
  const user = [
    `主题：${opts.topic}`,
    opts.angle ? `切入角度：${opts.angle}` : "",
    `文风：${opts.tone}`,
    `目标读者：${opts.audience}`,
    `篇幅：${lengthMap[opts.length]}`,
    opts.extra ? `补充要求：${opts.extra}` : "",
    "要求：1) 开头一句话抓人；2) 信息密度高、去掉空话套话；3) 若可配图，用「[图: 一句画面描述]」标记建议插图位置。",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export type RewriteMode = "deep" | "mild" | "casual" | "longform";

export const REWRITE_MODES: Array<{ id: RewriteMode; label: string; hint: string }> = [
  { id: "deep", label: "深度改写", hint: "重写结构与表达，保留核心信息，原创度高" },
  { id: "mild", label: "轻度润色", hint: "修正语病、优化表达，尽量贴近原文" },
  { id: "casual", label: "口语化", hint: "改成更口语、亲切的表达，适合口播/朋友圈" },
  { id: "longform", label: "扩写加长", hint: "补充细节与论据，篇幅拉长 40% 左右" },
];

export function buildRewriteMessages(opts: {
  source: string;
  mode: RewriteMode;
  titleHint?: string;
}): ChatMessage[] {
  const rules: Record<RewriteMode, string> = {
    deep: "深度改写：调整段落结构与叙述顺序，替换同义表达，删除重复，保留全部事实与数据；确保与原文明显不同但意思一致。",
    mild: "轻度润色：只修正语病、标点与不顺的表达，不改变结构，尽量少动原文。",
    casual: "口语化改写：使用更生活化、口语的用词与短句，拉近与读者距离，可适度添加语气词。",
    longform: "扩写改写：在保留原意与结构的基础上补充细节、案例或论据，篇幅增加约 40%。",
  };
  const system =
    "你是中文内容改写专家。输出只有改写结果正文，无任何解释、标题或前后缀。严禁编造原稿没有的事实与数据。";
  const user = [
    opts.titleHint ? `原标题（可参考，不要求输出标题）：${opts.titleHint}` : "",
    rules[opts.mode],
    "原文如下：",
    "--------",
    opts.source,
    "--------",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function buildImagePrompt(articleText: string, style?: string): string {
  return [
    "为一篇中文文章配一张信息图/插画风格封面，画面需契合以下文章内容与氛围：",
    `风格：${style || "现代扁平插画，柔和渐变"}。`,
    "要求：不要出现任何文字；构图简洁有力，适合公众号封面（2.35:1 或 1:1）。",
    "文章内容摘要：",
    articleText.slice(0, 800),
  ].join("\n");
}

// ---------- 智能排版（正文 → 结构化排版块） ----------

export type FormatBlockType = "title" | "p" | "quote" | "divider";
export type FormatBlock = { type: FormatBlockType; text: string };

export function buildFormatMessages(text: string): ChatMessage[] {
  const system =
    "你是公众号排版师。把用户给出的文章重组为结构化排版块，输出严格的 JSON 数组，不要输出任何解释或代码围栏。" +
    '每块形如 {"type":"title|p|quote|divider","text":"..."}：' +
    "title=小节标题（每个逻辑小节一个）；p=正文段落（保留原文语义，仅可拆分合并段落、顺句，不得删减或扩写内容）；" +
    "quote=金句或要点摘录（全文 1-3 处）；divider=分隔线（小节之间，全文 2-4 处）。" +
    "第一块应是 p（导语）而不是 title。text 一律为纯文本，不含 Markdown 符号。";
  return [
    { role: "system", content: system },
    { role: "user", content: text.slice(0, 12000) },
  ];
}

const FORMAT_TYPES: ReadonlyArray<FormatBlockType> = ["title", "p", "quote", "divider"];

/** 解析模型输出的排版块 JSON（容忍围栏与前后缀文字），逐块校验与截断。 */
export function parseFormatBlocks(raw: string): FormatBlock[] {
  let text = raw.trim();
  const tryParse = (s: string): unknown => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      return null;
    }
  };
  let parsed: unknown = tryParse(text);
  if (parsed === null && text.includes("```")) {
    const m = text.match(/```[a-zA-Z]*\n?([\s\S]*?)```/);
    if (m) parsed = tryParse(m[1].trim());
  }
  if (parsed === null) {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end > start) parsed = tryParse(text.slice(start, end + 1));
  }
  if (!Array.isArray(parsed)) throw new Error("排版结果解析失败，请重试");
  const blocks: FormatBlock[] = [];
  for (const item of parsed.slice(0, 120)) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const type = rec.type;
    if (typeof type !== "string" || !FORMAT_TYPES.includes(type as FormatBlockType)) continue;
    const text2 = typeof rec.text === "string" ? rec.text.trim().slice(0, 2000) : "";
    if (type !== "divider" && !text2) continue;
    blocks.push({ type: type as FormatBlockType, text: text2 });
  }
  if (blocks.length === 0) throw new Error("排版结果解析失败，请重试");
  return blocks;
}

// ---------- 短剧自动生成 ----------

export type DramaGenre = "反转爽剧" | "悬疑" | "甜宠" | "职场" | "家庭" | "科幻" | "年代";
export const DRAMA_GENRES: DramaGenre[] = ["反转爽剧", "悬疑", "甜宠", "职场", "家庭", "科幻", "年代"];

export type DramaPlan = {
  title: string;
  logline: string;
  episodes: Array<{
    number: number;
    title: string;
    summary: string;
    shots: Array<{ shot: number; prompt: string }>;
  }>;
};

export function buildDramaMessages(opts: {
  idea: string;
  genre: DramaGenre;
  episodes: number;
  shotsPerEpisode: number;
  style?: string;
}): ChatMessage[] {
  const system =
    "你是中文短剧编剧 + AI 分镜师。只输出 JSON，无任何解释、前后缀或 markdown 代码块标记。" +
    "JSON 结构：{ title, logline, episodes: [{ number, title, summary, shots: [{ shot, prompt }] }] }。" +
    "要求：1) 每集 1 段 80-150 字剧情梗概；" +
    "2) 每镜头 prompt 是可直接喂给视频模型的中文画面描述（5-20 字，含主体/动作/场景/镜头语言，如「近景，主角摔门而出，雨夜走廊」）；" +
    "3) 镜头数与集数严格按用户指定；4) 剧情有起承转合，最后一集给反转或钩子。";
  const user = [
    `题材/设定：${opts.idea}`,
    `类型：${opts.genre}`,
    `集数：${opts.episodes}`,
    `每集镜头数：${opts.shotsPerEpisode}`,
    `视觉风格：${opts.style?.trim() ? opts.style.trim() : "竖屏短剧质感，写实光影"}`,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function parseDramaPlan(raw: string): DramaPlan {
  let text = raw.trim();
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    return normalizeDramaPlan(obj);
  } catch {
    // fall through: strip fences / extract outer braces
  }
  if (text.includes("```")) {
    const m = text.match(/```[a-zA-Z]*\n?([\s\S]*?)```/);
    if (m) text = m[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("剧本 JSON 解析失败，请重新生成");
  }
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("剧本 JSON 解析失败，请重新生成");
  }
  return normalizeDramaPlan(obj);
}

function normalizeDramaPlan(obj: Record<string, unknown>): DramaPlan {
  const rawEps = obj.episodes;
  if (!Array.isArray(rawEps)) throw new Error("剧本 JSON 解析失败，请重新生成");
  const eps = rawEps.map((e, i) => {
    const ep = (e ?? {}) as Record<string, unknown>;
    const number = typeof ep.number === "number" ? ep.number : i + 1;
    const title = typeof ep.title === "string" && ep.title.trim() ? ep.title.trim() : `第 ${number} 集`;
    const summary = typeof ep.summary === "string" ? ep.summary.trim() : "";
    const rawShots = Array.isArray(ep.shots) ? ep.shots : [];
    const shots = rawShots.map((s, j) => {
      const sh = (s ?? {}) as Record<string, unknown>;
      const shot = typeof sh.shot === "number" ? sh.shot : j + 1;
      const prompt = String(sh.prompt ?? "").trim().slice(0, 120);
      return { shot, prompt };
    });
    return { number, title, summary, shots };
  });
  return {
    title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : "未命名短剧",
    logline: typeof obj.logline === "string" ? obj.logline.trim() : "",
    episodes: eps,
  };
}

// ---------- 主题关键词候选（AI 图文） ----------

export const KEYWORD_COUNT = 8;

export function buildKeywordMessages(opts: { seed?: string; tone: Tone; audience: Audience }): ChatMessage[] {
  const system =
    "你是资深中文新媒体选题策划。只输出 JSON 字符串数组，无任何解释、编号或 markdown 代码块标记。" +
    `给出 ${KEYWORD_COUNT} 个可直接作为图文的「主题 / 关键词」候选：每个 6-18 字，彼此角度不重复，` +
    "具体到能直接开写（不要「关于 AI 的思考」这类空泛表述）。";
  const user = [
    opts.seed?.trim() ? `在以下方向上拓展：${opts.seed.trim()}` : "方向不限：给当下值得写、读者真正关心的选题。",
    `文风：${opts.tone}`,
    `目标读者：${opts.audience}`,
    '输出示例：["创作者如何用 AI 省下每天两小时", "被算法投喂三年后我重新学会了阅读"]',
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** 宽松解析：优先取 JSON 数组，失败则按行拆分（清掉编号/引号/项目符号）。 */
export function parseKeywords(raw: string): string[] {
  const text = raw.trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const arr: unknown = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(arr)) {
        const out = arr.map((v) => String(v ?? "").trim()).filter(Boolean);
        if (out.length) return out.slice(0, KEYWORD_COUNT * 2);
      }
    } catch {
      // 落到按行拆分
    }
  }
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.、)）])\s*/, "").replace(/^["'“”「『]|["'“”」』]$/g, "").trim())
    .filter(Boolean)
    .slice(0, KEYWORD_COUNT * 2);
}
