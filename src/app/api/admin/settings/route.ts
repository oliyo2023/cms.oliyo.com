import { inArray } from "drizzle-orm";
import { fail, json, requireAdmin } from "@/lib/api";
import { getVar } from "@/lib/config";
import { db } from "@/lib/drizzle";
import { settings as settingsTable } from "@/lib/schema";
import { setSetting, deleteSetting } from "@/lib/repos/settings";
import { llmConfig } from "@/lib/ai";

export const dynamic = "force-dynamic";

type FieldSpec = {
  name: string;
  label: string;
  secret: boolean;
  hint?: string;
  /** 有 options 时前端渲染为下拉选择，避免布尔值让人手打 true/false 出错。 */
  options?: Array<{ value: string; label: string }>;
};

/** 后台可配置项清单（含展示分组信息）。 */
export const SETTINGS_FIELDS: FieldSpec[] = [
  // —— 站点与 SEO：DB 值优先于部署 env/secret；改动即时生效，无需重新部署 ——
  { name: "SITE_NAME", label: "站点名称", secret: false, hint: "用于标题后缀（… — 站点名称）、页头文字与 og:site_name" },
  { name: "SITE_TITLE", label: "首页标题", secret: false, hint: "首页 <title> 完整文案；留空则回退站点名称" },
  { name: "SITE_DESCRIPTION", label: "站点描述", secret: false, hint: "首页 meta description 与社交分享描述，建议 60-120 字" },
  { name: "SITE_KEYWORDS", label: "关键词", secret: false, hint: "英文逗号分隔；留空则不输出 keywords" },
  { name: "SITE_OG_IMAGE", label: "社交分享图", secret: false, hint: "绝对 URL（https://…），建议 1200×630；留空则用纯文本卡片" },
  { name: "SITE_URL", label: "站点地址", secret: false, hint: "canonical 基址，同时用于 sitemap、分享图绝对化、OAuth 回调，以及视频生成引用素材库图片（须为外部可访问的绝对地址）" },
  {
    name: "SITE_INDEXABLE",
    label: "搜索引擎收录",
    secret: false,
    hint: "关闭后 robots.txt 整站禁止抓取，页面也带 noindex",
    options: [
      { value: "true", label: "允许收录" },
      { value: "false", label: "禁止收录" },
    ],
  },
  { name: "AGNES_API_KEY", label: "Agnes API Key", secret: true },
  { name: "LLM_API_KEY", label: "文本独立 Key", secret: true, hint: "仅在需要覆盖共享 Key 时填写" },
  { name: "LLM_BASE_URL", label: "Base URL", secret: false },
  { name: "LLM_MODEL", label: "模型", secret: false },
  { name: "IMAGE_API_KEY", label: "图像独立 Key", secret: true, hint: "仅在需要覆盖共享 Key 时填写" },
  { name: "IMAGE_BASE_URL", label: "Base URL", secret: false },
  { name: "IMAGE_MODEL", label: "模型", secret: false },
  { name: "IMAGE_SIZE", label: "尺寸档位", secret: false, hint: "1K / 2K / 3K / 4K，留空使用默认" },
  { name: "IMAGE_RATIO", label: "宽高比", secret: false, hint: "如 16:9、1:1" },
  { name: "VIDEO_API_KEY", label: "视频独立 Key", secret: true, hint: "仅在需要覆盖共享 Key 时填写" },
  { name: "VIDEO_BASE_URL", label: "Base URL", secret: false },
  { name: "VIDEO_MODEL", label: "模型", secret: false },
  { name: "VIDEO_SIZE", label: "分辨率", secret: false, hint: "Flash 模型固定 720P" },
  { name: "VIDEO_ASPECT", label: "画幅", secret: false, hint: "如 16:9、9:16" },
  { name: "VIDEO_SECONDS", label: "时长（秒）", secret: false, hint: "4 - 12" },
  { name: "VIDEO_POLL_URL", label: "任务查询 URL 模板", secret: false, hint: "支持 {id}、{model} 占位符" },
  // —— 第三方登录：DB 值优先于部署 env/secret（与 AI 配置同优先级）——
  { name: "OAUTH_STATE_SECRET", label: "State 签名密钥", secret: true, hint: "≥32 位随机串；未配置时 state 校验退化为弱模式" },
  { name: "GITHUB_CLIENT_ID", label: "GitHub Client ID", secret: false, hint: "留空 = 隐藏 GitHub 登录入口" },
  { name: "GITHUB_CLIENT_SECRET", label: "GitHub Client Secret", secret: true, hint: "OAuth App 密钥" },
  { name: "GOOGLE_CLIENT_ID", label: "Google Client ID", secret: false, hint: "留空 = 隐藏 Google 登录入口" },
  { name: "GOOGLE_CLIENT_SECRET", label: "Google Client Secret", secret: true, hint: "OAuth 客户端密钥" },
];

const FIELD_NAMES = SETTINGS_FIELDS.map((f) => f.name);
const isSecretField = (name: string) => SETTINGS_FIELDS.some((f) => f.name === name && f.secret);

export async function GET(req: Request) {
  await requireAdmin(req);
  const rows = await db()
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, FIELD_NAMES));
  const dbMap = new Map(rows.map((r) => [r.key, r.value]));
  const fields = SETTINGS_FIELDS.map((spec) => {
    const dbVal = dbMap.get(spec.name);
    const envVal = getVar(spec.name);
    if (spec.secret) {
      const effective = dbVal ?? envVal;
      return {
        ...spec,
        hasValue: Boolean(effective),
        tail: effective ? effective.slice(-4) : null,
        fromDb: dbVal !== undefined,
        hasEnv: envVal !== undefined && envVal !== "",
        value: undefined,
      };
    }
    const effective = dbVal ?? envVal;
    return {
      ...spec,
      hasValue: Boolean(effective),
      tail: null,
      fromDb: dbVal !== undefined,
      hasEnv: envVal !== undefined && envVal !== "",
      value: effective ?? "",
    };
  });
  return json({ fields });
}

export async function POST(req: Request) {
  await requireAdmin(req);
  let body: { values?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const values = body.values ?? {};
  const unknown = Object.keys(values).filter((k) => !FIELD_NAMES.includes(k));
  if (unknown.length > 0) return fail(400, `未知配置项: ${unknown.join(", ")}`);
  for (const [name, value] of Object.entries(values)) {
    if (isSecretField(name) && value !== "" && !/^[\x21-\x7E]+$/.test(value)) {
      return fail(400, `${name} 含非法字符（空格或非 ASCII），请粘贴完整 key`);
    }
  }
  for (const [name, value] of Object.entries(values)) {
    if (value === "") await deleteSetting(name);
    else await setSetting(name, value);
  }
  return json({ ok: true, updated: Object.keys(values).length });
}

/** 文本模型连通性测试（真实消耗极少量 token；图像/视频为异步或计费任务，不提供按钮）。 */
export async function PUT(req: Request) {
  await requireAdmin(req);
  try {
    const cfg = await llmConfig();
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 4,
      }),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return json({ ok: false, status: res.status, message: `${cfg.model} @ ${cfg.baseUrl} → ${res.status} ${text.slice(0, 160)}` }, { status: 200 });
    }
    return json({ ok: true, message: `${cfg.model} @ ${cfg.baseUrl} 连通正常` });
  } catch (e) {
    const message = e instanceof Error ? e.message : "测试失败";
    return json({ ok: false, message }, { status: 200 });
  }
}
