/**
 * Pure reference resolution helpers (client- and server-safe, no I/O).
 * Rows store media as `r2://<key>` or external `https://…`; these map them to URLs.
 */

export function r2KeyOf(ref: string): string | null {
  return ref.startsWith("r2://") ? ref.slice(5) : null;
}

export function mediaUrl(ref: string): string {
  const key = r2KeyOf(ref);
  return key ? `/media/${key}` : ref;
}

export function thumbOf(item: { media: string; thumb: string }): string {
  return mediaUrl(item.thumb || item.media);
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;

/**
 * 判断素材应该用 <video> 还是 <img> 渲染。
 * 库里的 `cover` / `media` 既可能是图片也可能是视频，按分类字段判断并不可靠，
 * 因此以扩展名为准，避免把 .mp4 塞进 <img> 变成破图。
 */
export function isVideoRef(ref: string): boolean {
  return VIDEO_EXT.test(ref);
}
