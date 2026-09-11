import { currentUserFromRequest, fail, json } from "@/lib/api";
import { generateImage } from "@/lib/ai";
import { getVar } from "@/lib/config";
import { createHistory } from "@/lib/repos/history";
import { createMediaRow } from "@/lib/repos/media";
import { recordUsage, usageThisMonth } from "@/lib/repos/quota";
import { storePut } from "@/lib/store";

export const dynamic = "force-dynamic";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** 生成结果落 R2（生成 URL 会过期，入库后走 /media 代理长期可用）。 */
async function persistImage(img: { url?: string; b64?: string }, ownerId: string): Promise<string | null> {
  let bytes: Uint8Array | null = null;
  let mime = "image/png";
  if (img.url && /^https?:\/\//.test(img.url)) {
    try {
      const res = await fetch(img.url);
      if (!res.ok) return img.url;
      mime = res.headers.get("content-type")?.split(";")[0] ?? mime;
      if (!mime.startsWith("image/")) mime = "image/png";
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch {
      return img.url;
    }
  } else if (img.b64) {
    const bin = atob(img.b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  }
  if (!bytes) return null;
  const ext = EXT_BY_MIME[mime] ?? "png";
  const key = `media/${crypto.randomUUID()}.${ext}`;
  await storePut(key, bytes, mime);
  await createMediaRow({
    ownerId,
    key,
    name: `AI 配图 ${new Date().toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" })}`,
    kind: "image",
    mime,
    size: bytes.byteLength,
  });
  return `/media/${key}`;
}

export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: { prompt?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const prompt = body.prompt?.trim() ?? "";
  if (!prompt) return fail(400, "请填写画面描述");
  if (prompt.length > 2000) return fail(400, "画面描述过长");

  const used = await usageThisMonth(user.id, "images");
  if (user.quotaImages >= 0 && used >= user.quotaImages) {
    return fail(403, "本月图片生成配额已用完");
  }
  try {
    const img = await generateImage(prompt);
    const model = getVar("IMAGE_MODEL") ?? "";
    await recordUsage(user.id, "images", 1);
    const storedUrl = await persistImage(img, user.id);
    const historyId = await createHistory({
      ownerId: user.id,
      kind: "image_gen",
      title: (body.note ?? prompt).slice(0, 60),
      model,
      input: prompt,
      extra: { url: storedUrl ?? img.url ?? null },
    });
    return json({ ok: true, historyId, image: { url: storedUrl ?? img.url } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "图片生成失败";
    return fail(502, message);
  }
}
