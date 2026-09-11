import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSettingsIn } from "@/lib/repos/settings";

const DEFAULTS: Record<string, string> = {
  REGISTRATION_OPEN: "true",
  SITE_NAME: "创作台",
  SITE_TITLE: "创作台 — AI 生成图文 · 智能洗稿 · 公众号排版",
  SITE_DESCRIPTION: "AI 图文创作、洗稿与公众号排版管理平台",
  SITE_INDEXABLE: "true",
  NEW_USER_TEXT_QUOTA: "100000",
  NEW_USER_IMAGE_QUOTA: "30",
  NEW_USER_VIDEO_QUOTA: "10",
  NEW_USER_REWRITE_QUOTA: "200000",
};

/** Reads a worker var/secret, falling back to process.env then built-in default. */
export function getVar(name: string): string | undefined {
  try {
    const env = getCloudflareContext().env as Record<string, unknown>;
    const v = env[name];
    if (typeof v === "string") return v;
  } catch {
    // not in worker
  }
  if (process.env[name] !== undefined) return process.env[name];
  return DEFAULTS[name];
}

export const isVarTruthy = (v: string | undefined) => v === "true" || v === "1";

/** 单项解析：D1 settings > 部署 env/secret > 内置默认。 */
export async function resolveVar(name: string): Promise<string | undefined> {
  const fromDb = await getSettingsIn([name]);
  const dbVal = fromDb[name];
  return dbVal !== undefined && dbVal !== "" ? dbVal : getVar(name);
}

/**
 * 后台可配置项解析：D1 settings（管理端设置页）> 环境变量 > 内置默认。
 * DB 无值时回落 getVar（环境变量/默认），使部署 secret 与运行时配置共存。
 */
export async function resolveVars(names: string[]): Promise<Record<string, string | undefined>> {
  const fromDb = await getSettingsIn(names);
  const out: Record<string, string | undefined> = {};
  for (const name of names) {
    const dbVal = fromDb[name];
    out[name] = dbVal !== undefined && dbVal !== "" ? dbVal : getVar(name);
  }
  return out;
}
