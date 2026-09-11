import { currentUserFromRequest, fail, json } from "@/lib/api";
import { createMediaRow, listMedia } from "@/lib/repos/media";
import { recordUsage } from "@/lib/repos/quota";
import { storePut } from "@/lib/store";

export const dynamic = "force-dynamic";

const MAX_SIZE = 60 * 1024 * 1024; // 60MB request cap

function kindOf(mime: string): "image" | "video" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

function extOf(name: string, mime: string): string {
  const fromName = name.split(".").pop();
  if (fromName && /^[a-z0-9]{2,5}$/i.test(fromName)) return fromName.toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}

export async function GET(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const list = await listMedia(user.id, {
    ...(kind === "image" || kind === "video" || kind === "audio" || kind === "file"
      ? { kind }
      : {}),
  });
  return json({ media: list });
}

export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(400, "缺少文件字段 file");
  if (file.size > MAX_SIZE) return fail(413, "文件超过 60MB 限制");
  if (file.size === 0) return fail(400, "空文件");

  const mime = file.type || "application/octet-stream";
  const ext = extOf(file.name, mime);
  const key = `media/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  await storePut(key, bytes, mime);
  await recordUsage(user.id, "media_bytes", file.size);

  const row = await createMediaRow({
    ownerId: user.id,
    key,
    name: file.name,
    kind: kindOf(mime),
    mime,
    size: file.size,
  });
  return json({ media: row }, { status: 201 });
}
