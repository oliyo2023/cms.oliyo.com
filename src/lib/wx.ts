/**
 * 公众号排版 preset templates (pure strings, server-safe).
 * WeChat keeps inline styles but strips <style>/classes, so everything is inline.
 */

export const WX_ACCENTS = [
  { id: "indigo", color: "#6366f1", name: "品牌紫" },
  { id: "blue", color: "#3b82f6", name: "晴空蓝" },
  { id: "green", color: "#10b981", name: "青竹绿" },
  { id: "red", color: "#ef4444", name: "朱砂红" },
  { id: "orange", color: "#f97316", name: "暖橙" },
  { id: "gold", color: "#d97706", name: "琥珀金" },
] as const;

export type WxAccentId = (typeof WX_ACCENTS)[number]["id"];

export function accentOf(id: string): string {
  return WX_ACCENTS.find((a) => a.id === id)?.color ?? "#6366f1";
}

/** 卡片容器（公众号正文外层常用） */
export function wxSection(inner: string, opts?: { padding?: string; radius?: string; bg?: string }): string {
  const pad = opts?.padding ?? "8px 4px";
  return `<section style="padding:${pad};background:${opts?.bg ?? "transparent"};border-radius:${opts?.radius ?? "8px"};">${inner}</section>`;
}

export type TitleStyleId = "bar" | "center" | "round" | "num";

export function wxTitle(text: string, accent: string, style: TitleStyleId = "bar"): string {
  const esc = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  switch (style) {
    case "center":
      return `<section style="text-align:center;"><span style="font-size:20px;font-weight:bold;color:#18181b;letter-spacing:1px;border-bottom:3px solid ${accent};padding-bottom:6px;">${esc}</span></section>`;
    case "round":
      return `<section style="text-align:center;"><span style="display:inline-block;font-size:17px;font-weight:bold;color:#ffffff;background:${accent};border-radius:20px;padding:6px 18px;">${esc}</span></section>`;
    case "num":
      return `<section style="display:flex;align-items:center;gap:10px;"><span style="color:#ffffff;background:${accent};border-radius:6px;font-size:15px;font-weight:bold;padding:2px 9px;flex:none;">题</span><span style="font-size:18px;font-weight:bold;color:#18181b;">${esc}</span></section>`;
    case "bar":
    default:
      return `<section style="display:flex;align-items:center;gap:10px;"><span style="width:4px;height:20px;background:${accent};border-radius:2px;flex:none;display:inline-block;"></span><span style="font-size:18px;font-weight:bold;color:#18181b;letter-spacing:0.5px;">${esc}</span></section>`;
  }
}

export function wxParagraph(text: string): string {
  const esc = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p style="margin:10px 0;font-size:15px;color:#3f3f46;line-height:1.8;letter-spacing:0.2px;">${esc}</p>`;
}

export function wxQuote(text: string, accent: string): string {
  const esc = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<section style="border-left:4px solid ${accent};background:${accent}1a;border-radius:0 8px 8px 0;padding:10px 14px;margin:12px 0;"><p style="margin:0;font-size:15px;color:#52525b;line-height:1.7;">${esc}</p></section>`;
}

export function wxCard(inner: string, accent: string): string {
  return `<section style="border:1px solid ${accent}33;background:#ffffff;border-radius:10px;padding:14px 16px;margin:12px 0;">${inner}</section>`;
}

export function wxDivider(accent: string, variant: "line" | "gradient" | "dot" = "gradient"): string {
  if (variant === "dot") {
    return `<section style="text-align:center;margin:14px 0;"><span style="color:${accent};font-size:12px;">✦ ✦ ✦</span></section>`;
  }
  if (variant === "line") {
    return `<section style="height:2px;background:${accent};opacity:0.35;border-radius:1px;margin:14px 0;"></section>`;
  }
  return `<section style="height:1px;background:linear-gradient(90deg,transparent,${accent},transparent);margin:16px 0;"></section>`;
}

export function wxCode(code: string): string {
  const esc = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<section style="background:#f4f4f5;border-radius:8px;padding:12px 14px;margin:12px 0;overflow-x:auto;"><pre style="margin:0;font-family:ui-monospace,monospace;font-size:13px;color:#27272a;white-space:pre-wrap;word-break:break-all;">${esc}</pre></section>`;
}

export function wxImgPlaceholder(desc: string): string {
  const esc = desc.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<figure style="margin:14px 0;background:#fafafa;border:1px dashed #d4d4d8;border-radius:8px;padding:26px 12px;text-align:center;"><div style="font-size:26px;line-height:1;">🖼</div><figcaption style="margin-top:8px;font-size:13px;color:#a1a1aa;">配图位：${esc}</figcaption></figure>`;
}

/** 封面/图片行内图（带圆角与说明） */
export function wxImage(src: string, caption?: string): string {
  const escCap = (caption ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<figure style="margin:14px 0;"><img src="${src}" style="width:100%;border-radius:8px;display:block;" alt="${escCap}"/><figcaption style="text-align:center;font-size:13px;color:#a1a1aa;margin-top:6px;">${escCap}</figcaption></figure>`;
}
