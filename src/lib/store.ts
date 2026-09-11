import fs from "node:fs";
import path from "node:path";
import { getR2 } from "@/lib/db";

/**
 * Media object storage behind one interface:
 *  - Cloudflare: R2 bucket (binding MEDIA).
 *  - Node dev: files under dev-data/r2/.
 * Reference helpers (`r2://…` ↔ url) live in @/lib/refs and are re-exported here.
 */
export { mediaUrl, r2KeyOf } from "@/lib/refs";

export type StoredObject = { body: ReadableStream | Uint8Array; mime: string };

const devRoot = () => {
  const dir = path.resolve(process.env.DEV_DATA_DIR ?? "dev-data", "r2");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export async function storePut(key: string, body: ArrayBuffer | Uint8Array, mime: string): Promise<void> {
  const r2 = getR2();
  const data = body instanceof Uint8Array ? body.slice().buffer : body;
  if (r2) {
    await r2.put(key, data, { httpMetadata: { contentType: mime } });
    return;
  }
  const file = path.join(devRoot(), key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, new Uint8Array(data));
}

export async function storeGet(key: string): Promise<StoredObject | null> {
  const r2 = getR2();
  if (r2) {
    const obj = await r2.get(key);
    if (!obj) return null;
    return { body: obj.body as unknown as ReadableStream, mime: obj.httpMetadata?.contentType ?? "application/octet-stream" };
  }
  const file = path.join(devRoot(), key);
  if (!fs.existsSync(file)) return null;
  return { body: new Uint8Array(fs.readFileSync(file)), mime: mimeOf(key) };
}

export async function storeDelete(key: string): Promise<void> {
  const r2 = getR2();
  if (r2) {
    await r2.delete(key);
    return;
  }
  const file = path.join(devRoot(), key);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function mimeOf(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}
