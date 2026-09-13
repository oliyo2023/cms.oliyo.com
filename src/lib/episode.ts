/**
 * 剧集单集的多镜头结构与角色设定（共享类型）。
 *
 * 一集由多个几秒镜头组成：`showcase_items.media` 存第一镜头成片（用于列表/封面），
 * `shots` 存完整序列，公开站详情页按序连播并挂字幕。
 * 角色设定图存在 `series.cast[].portrait`，逐镜头以 reference 模式引用，
 * 保证同一角色跨镜头外观一致。
 */
export type EpisodeShot = {
  shot: number;
  prompt: string;
  /** 该镜头出场角色名，对应 CastMember.name。 */
  cast: string[];
  /** 该镜头台词，作为字幕；无台词为空串。 */
  dialogue: string;
  /** 该镜头成片地址（r2:// 或 https）；未生成为空串。 */
  video: string;
};

export type CastMember = {
  name: string;
  appearance: string;
  /** 角色设定图引用（r2:// 或 https）；未生成为空串。 */
  portrait: string;
};

/** 从 JSON 列解析，容忍脏数据；任何异常一律回落为空数组，不让单条坏数据挡住整页。 */
export function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** 单集的第一个已生成镜头，用作展示用封面/列表素材。 */
export function firstShotVideo(shots: EpisodeShot[]): string {
  return shots.find((s) => s.video)?.video ?? "";
}

/** 角色设定图 → 图像模型可用的生成提示词。 */
export function buildPortraitPrompt(member: CastMember, style?: string): string {
  return [
    member.appearance,
    "角色设定图，正面半身像，中性表情，简洁背景，单人无文字",
    style?.trim() || "写实光影，竖屏短剧质感",
  ].join("，");
}

export type ShotRequest = { prompt: string; mode: "text" | "reference"; images: string[] };

/**
 * 镜头 → 视频任务参数。
 * 出场角色有设定图时走 reference 模式并逐个编号引用（文档要求提示词里写明素材用途），
 * 没有设定图（或该镜头无人物）则退回纯文生视频。
 */
export function buildShotRequest(shot: EpisodeShot, portraitByName: Record<string, string>): ShotRequest {
  const portraits = shot.cast.map((name) => portraitByName[name]).filter((ref): ref is string => Boolean(ref));
  if (portraits.length === 0) return { prompt: shot.prompt, mode: "text", images: [] };
  const refs = portraits.map((_, i) => `<Picture ${i + 1}>`).join("、");
  return {
    prompt: `以 ${refs} 中的角色形象为参考，保持人物外观一致，${shot.prompt}`,
    mode: "reference",
    images: portraits,
  };
}
