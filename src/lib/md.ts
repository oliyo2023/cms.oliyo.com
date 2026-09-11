/**
 * Minimal Markdown → HTML used when saving AI-generated text into article content.
 * Deliberately small: headings, paragraphs, lists, blockquote, code, links,
 * bold/italic and `[图: desc]` image-placeholder markers. Everything else is plain text.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function renderBlock(block: string, listType?: "ul" | "ol"): string {
  const t = block.trim();
  if (!t) return "";
  const img = t.match(/^\[图[:：]\s*(.+)\]$/);
  if (img) {
    return `<figure><p class="ai-img-placeholder">配图位：${escapeHtml(img[1])}</p></figure>`;
  }
  if (/^#{1,6}\s/.test(t)) {
    const m = t.match(/^(#{1,6})\s+(.*)$/)!;
    const level = m[1].length;
    return `<h${level}>${inline(m[2])}</h${level}>`;
  }
  if (/^(---|\*\*\*|___)\s*$/.test(t)) return "<hr/>";
  if (/^>\s?/.test(t)) {
    const inner = t
      .split(/\n/)
      .map((l) => l.replace(/^>\s?/, "").trim())
      .join(" ");
    return `<blockquote>${inline(inner)}</blockquote>`;
  }
  if (listType) {
    const items = block
      .split(/\n/)
      .filter((l) => l.trim())
      .map((l) => `<li>${inline(l.replace(/^[-*+]\s+|^\d+[.)]\s*/, ""))}</li>`)
      .join("");
    return `<${listType}>${items}</${listType}>`;
  }
  if (t.startsWith("```")) {
    const code = t.replace(/^```\w*\n?/, "").replace(/```$/, "").trim();
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
  return `<p>${inline(t)}</p>`;
}

export function mdToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listBuf: string[] = [];
  let codeBuf: string[] = [];
  let inCode = false;

  const flushList = () => {
    if (listBuf.length) {
      out.push(renderBlock(listBuf.join("\n"), listType ?? "ul"));
      listBuf = [];
      listType = null;
    }
  };

  for (const line of lines) {
    if (inCode) {
      if (line.trim().startsWith("```")) {
        inCode = false;
        out.push(renderBlock(["```", ...codeBuf].join("\n")));
        codeBuf = [];
      } else {
        codeBuf.push(line);
      }
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flushList();
      codeBuf = [];
      inCode = true;
      continue;
    }
    const isList = /^(\s*[-*+]\s|\s*\d+[.)]\s)/.test(line);
    if (isList) {
      const t = /^\s*[-*+]\s/.test(line) ? "ul" : "ol";
      if (listType === null) listType = t;
      else if (listType !== t) {
        flushList();
        listType = t;
      }
      listBuf.push(line.trim());
      continue;
    }
    if (listType) flushList();
    if (!trimmed) {
      out.push(""); // paragraph separator handled below
      continue;
    }
    out.push(trimmed);
  }
  if (inCode && codeBuf.length) {
    out.push(renderBlock(["```", ...codeBuf].join("\n")));
  }
  flushList();

  const body = out
    .join("\n\n")
    .split(/\n{2,}/)
    .map((b) => renderBlock(b))
    .filter(Boolean)
    .join("\n");
  return `<section>${body}</section>`;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
