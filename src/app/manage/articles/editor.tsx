"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bold,
  Check,
  ClipboardCopy,
  Code2,
  ExternalLink,
  Heading1,
  Image as ImageIcon,
  Italic,
  ListOrdered,
  List,
  Loader2,
  Minus,
  Quote,
  Save,
  Sparkles,
  Square,
  Strikethrough,
  Type,
  Underline,
  Undo2,
} from "lucide-react";
import { btnGhost, btnPrimary, cx, inputCls } from "@/components/ui";
import Modal from "@/components/modal";
import MediaPicker from "@/components/media-picker";
import { htmlToText } from "@/lib/md";
import type { FormatBlock } from "@/lib/prompts";
import {
  accentOf,
  wxCard,
  wxCode,
  wxDivider,
  wxImgPlaceholder,
  wxParagraph,
  wxQuote,
  wxSection,
  wxTitle,
  WX_ACCENTS,
  type TitleStyleId,
} from "@/lib/wx";

type Article = {
  id: string;
  title: string;
  summary: string;
  cover: string;
  contentHtml: string;
  status: "draft" | "published";
  publishedAt: number | null;
};

function parseArticle(json: string): Article | null {
  try {
    const raw: unknown = JSON.parse(json);
    if (raw === null || typeof raw !== "object") return null;
    const rec = raw as Record<string, unknown>;
    if (typeof rec.id !== "string") return null;
    return {
      id: rec.id,
      title: typeof rec.title === "string" ? rec.title : "",
      summary: typeof rec.summary === "string" ? rec.summary : "",
      cover: typeof rec.cover === "string" ? rec.cover : "",
      contentHtml: typeof rec.contentHtml === "string" ? rec.contentHtml : "",
      status: rec.status === "published" ? "published" : "draft",
      publishedAt: typeof rec.publishedAt === "number" ? rec.publishedAt : null,
    };
  } catch {
    return null;
  }
}

/** execCommand-based block insert with a manual fallback for contentEditable. */
function insertHtml(html: string) {
  const ok = document.execCommand("insertHTML", false, html);
  if (!ok) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const div = document.createElement("div");
    div.innerHTML = html;
    const frag = document.createDocumentFragment();
    while (div.firstChild) frag.appendChild(div.firstChild);
    range.deleteContents();
    range.insertNode(frag);
  }
}

function selectedText(): string {
  const sel = window.getSelection();
  return sel ? sel.toString().trim() : "";
}

const ALLOWED_ATTRS: Record<string, string[]> = {
  section: ["style"],
  p: ["style"],
  span: ["style"],
  h1: ["style"],
  h2: ["style"],
  h3: ["style"],
  h4: ["style"],
  strong: [],
  em: [],
  u: [],
  s: [],
  blockquote: ["style"],
  pre: ["style"],
  code: [],
  ul: ["style"],
  ol: ["style", "start"],
  li: ["style"],
  figure: ["style"],
  figcaption: ["style"],
  img: ["src", "alt", "style"],
  a: ["href", "style"],
  br: [],
  hr: ["style"],
};

const FORBIDDEN = new Set(["script", "style", "iframe", "object", "embed", "link", "meta", "form", "input", "button"]);

/** 复制到公众号：清理 DOM → 返回带内联样式的 HTML。 */
function serializeWechat(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];
  const nodes: Element[] = [];
  let n = walker.nextNode();
  while (n) {
    nodes.push(n as Element);
    n = walker.nextNode();
  }
  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();
    if (FORBIDDEN.has(tag) || !(tag in ALLOWED_ATTRS)) {
      toRemove.push(el);
      continue;
    }
    const allowed = ALLOWED_ATTRS[tag];
    for (const attr of Array.from(el.attributes)) {
      if (!allowed.includes(attr.name)) el.removeAttribute(attr.name);
    }
  }
  for (const el of toRemove) el.remove();
  return clone.innerHTML;
}

async function copyWechat(html: string, text: string): Promise<boolean> {
  const wrapped = wxSection(html, { padding: "0", bg: "#ffffff" });
  try {
    if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([wrapped], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
  } catch {
    // fall through to legacy copy
  }
  const helper = document.createElement("div");
  helper.contentEditable = "true";
  helper.style.position = "fixed";
  helper.style.left = "-9999px";
  helper.innerHTML = wrapped;
  document.body.appendChild(helper);
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(helper);
  sel?.removeAllRanges();
  sel?.addRange(range);
  const ok = document.execCommand("copy");
  sel?.removeAllRanges();
  document.body.removeChild(helper);
  return ok;
}

function ToolBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cx(
        "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs transition",
        active ? "bg-indigo-600/25 text-indigo-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
      )}
    >
      {children}
    </button>
  );
}

export default function Editor({ articleJson }: { articleJson: string }) {
  const router = useRouter();
  const article = useMemo(() => parseArticle(articleJson), [articleJson]);
  const [id, setId] = useState<string | null>(article?.id ?? null);
  const [title, setTitle] = useState(article?.title ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [cover, setCover] = useState(article?.cover ?? "");
  const [status, setStatus] = useState<"draft" | "published">(article?.status ?? "draft");
  const [accentId, setAccentId] = useState<string>(WX_ACCENTS[0].id);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [formatOpen, setFormatOpen] = useState(false);
  const [formatBusy, setFormatBusy] = useState(false);
  const [formatStyle, setFormatStyle] = useState<TitleStyleId>("bar");
  const [imgModal, setImgModal] = useState<null | { target: "body" | "cover" }>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const savedCaptionRef = useRef("");
  const accent = accentOf(accentId);
  const flash = (msg: string, ok = true) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2200);
    void ok;
  };

  useEffect(() => {
    const el = editorRef.current;
    if (el && article?.contentHtml && el.innerHTML === "") {
      el.innerHTML = article.contentHtml;
      setCharCount(el.innerText.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange() {
    const el = editorRef.current;
    if (el) setCharCount(el.innerText.replace(/\s/g, "").length);
  }

  function run(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, value);
    onChange();
  }

  /** 用 span 包裹选区以设置字号。 */
  function setFontSize(px: number) {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const el = editorRef.current;
    if (!sel || !el || sel.rangeCount === 0) return;
    const text = sel.toString();
    if (!text) {
      insertHtml(`<span style="font-size:${px}px;">正文</span>`);
      onChange();
      return;
    }
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    try {
      range.surroundContents(span);
    } catch {
      // selection spans element boundaries — wrap each text node instead
      const frag = range.extractContents();
      const wrapper = document.createElement("span");
      wrapper.style.fontSize = `${px}px`;
      wrapper.appendChild(frag);
      range.insertNode(wrapper);
    }
    onChange();
  }

  function colorText(color: string) {
    run("foreColor", color);
  }

  function insertTitle(style: TitleStyleId) {
    const text = selectedText() || "小标题";
    insertHtml(wxTitle(text, accent, style));
    onChange();
  }

  function insertParagraph() {
    const text = selectedText() || "正文段落";
    insertHtml(wxParagraph(text));
    onChange();
  }

  function insertQuote() {
    insertHtml(wxQuote(selectedText() || "金句引用", accent));
    onChange();
  }

  function insertCard() {
    insertHtml(wxCard(wxParagraph(selectedText() || "卡片内容"), accent));
    onChange();
  }

  function insertDivider(variant: "gradient" | "line" | "dot") {
    insertHtml(wxDivider(accent, variant));
    onChange();
  }

  function insertCode() {
    insertHtml(wxCode("// 代码片段"));
    onChange();
  }

  function openImageModal(target: "body" | "cover") {
    const el = editorRef.current;
    const sel = window.getSelection();
    const inEditor = Boolean(el && sel?.anchorNode && el.contains(sel.anchorNode));
    savedRangeRef.current = target === "body" && inEditor && sel ? sel.getRangeAt(0).cloneRange() : null;
    savedCaptionRef.current = target === "body" ? selectedText() : "";
    setImgModal({ target });
  }

  /** 弹窗夺焦会丢选区：插入前恢复保存的光标，无选区则落到正文末尾。 */
  function insertAtSavedRange(html: string) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    const range = savedRangeRef.current ?? (() => {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      return r;
    })();
    sel?.removeAllRanges();
    sel?.addRange(range);
    insertHtml(html);
    savedRangeRef.current = null;
    savedCaptionRef.current = "";
    onChange();
  }

  /** 智能排版：正文 → AI 结构化 → wx* 模板渲染替换。 */
  async function applyFormat() {
    const el = editorRef.current;
    if (!el) return;
    const text = el.innerText.trim();
    if (text.length < 50) {
      flash("正文太短（至少 50 字）再排版", false);
      setFormatOpen(false);
      return;
    }
    setFormatBusy(true);
    try {
      const res = await fetch("/api/ai/article-format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as { blocks?: FormatBlock[]; error?: string };
      if (!res.ok || !data.blocks) {
        flash(data.error ?? "排版失败", false);
        return;
      }
      el.innerHTML = data.blocks
        .map((b) =>
          b.type === "title"
            ? wxTitle(b.text, accent, formatStyle)
            : b.type === "quote"
              ? wxQuote(b.text, accent)
              : b.type === "divider"
                ? wxDivider(accent, "gradient")
                : wxParagraph(b.text),
        )
        .join("");
      onChange();
      setFormatOpen(false);
      flash("智能排版完成");
    } catch {
      flash("网络错误，排版失败", false);
    } finally {
      setFormatBusy(false);
    }
  }

  function insertImgPlaceholder() {
    insertHtml(wxImgPlaceholder(selectedText() || "示意图"));
    onChange();
  }

  async function save(publish: boolean) {
    const el = editorRef.current;
    const contentHtml = el ? el.innerHTML : "";
    const body = {
      title: title.trim() || "未命名文章",
      summary: summary.trim(),
      cover: cover.trim(),
      contentHtml,
      status: publish ? "published" : status,
    };
    setBusy(true);
    try {
      const res = await fetch(id ? `/api/articles/${id}` : "/api/articles", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { article?: Article; error?: string };
      if (!res.ok) {
        flash(data.error ?? "保存失败", false);
        return;
      }
      if (data.article) {
        setId(data.article.id);
        if (data.article.status === "published") setStatus("published");
      }
      setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
      router.refresh();
      flash(publish ? "已发布到公开站" : "已保存草稿");
    } catch {
      flash("网络错误，保存失败", false);
    } finally {
      setBusy(false);
    }
  }

  async function copyToWechat() {
    const el = editorRef.current;
    if (!el) return;
    const html = serializeWechat(el);
    const text = el.innerText;
    const ok = await copyWechat(html, text);
    if (ok) flash("已复制，去公众号编辑器粘贴即可（保留排版）");
    else flash("复制失败，请手动选择正文复制", false);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-zinc-100">公众号排版</h1>
          {savedAt && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              已保存 {savedAt}
            </span>
          )}
          {notice && <span className={cx("text-xs", notice.includes("失败") ? "text-red-400" : "text-emerald-400")}>{notice}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/manage/articles" className={cx(btnGhost, "text-xs")}>
            <Undo2 className="h-3.5 w-3.5" />
            返回列表
          </Link>
          <button className={cx(btnGhost, "text-xs")} disabled={formatBusy} onClick={() => setFormatOpen(true)}>
            {formatBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            智能排版
          </button>
          <button className={cx(btnGhost, "text-xs")} disabled={busy} onClick={() => void save(false)}>
            <Save className="h-3.5 w-3.5" />
            保存草稿
          </button>
          <button className={cx(btnPrimary, "text-xs")} disabled={busy} onClick={() => void save(status === "draft")}>
            {status === "draft" ? "保存并发布" : "更新发布"}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
            onClick={() => void copyToWechat()}
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            复制到公众号
          </button>
          {id && status === "published" && (
            <Link href={`/article/${id}`} target="_blank" className={cx(btnGhost, "text-xs")}>
              <ExternalLink className="h-3.5 w-3.5" />
              公开页
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* 编辑主区 */}
        <div className="space-y-3">
          <input
            className={cx(inputCls, "border-transparent bg-transparent px-0 py-1 text-2xl font-semibold text-zinc-100 placeholder-zinc-600")}
            placeholder="文章标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className={cx(inputCls, "border-transparent bg-transparent px-0 text-sm text-zinc-500 placeholder-zinc-600")}
            placeholder="摘要（公开站展示用，可留空）"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <input
              className={cx(inputCls, "border-transparent bg-transparent px-0 text-sm text-zinc-500 placeholder-zinc-600")}
              placeholder="封面图 URL（可选，https://… 或 /media/…）"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
            />
            <button
              type="button"
              className={cx(btnGhost, "shrink-0 px-2.5 py-1.5 text-xs")}
              onClick={() => openImageModal("cover")}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              选图
            </button>
          </div>

          {/* 工具栏：文本样式 */}
          <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
            <ToolBtn title="加粗" onClick={() => run("bold")}><Bold className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn title="斜体" onClick={() => run("italic")}><Italic className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn title="下划线" onClick={() => run("underline")}><Underline className="h-3.5 w-3.5" /></ToolBtn>
            <ToolBtn title="删除线" onClick={() => run("strikeThrough")}><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>
            <span className="mx-1 h-4 w-px bg-zinc-800" />
            {WX_ACCENTS.map((c) => (
              <button
                key={c.id}
                title={c.name}
                onClick={() => colorText(c.color)}
                className={cx("h-5 w-5 rounded-full border transition", accentId === c.id ? "border-zinc-50 ring-1 ring-zinc-50/40" : "border-transparent")}
                style={{ background: c.color }}
              />
            ))}
            <span className="mx-1 h-4 w-px bg-zinc-800" />
            {[13, 15, 17, 19].map((px) => (
              <ToolBtn key={px} title={`字号 ${px}px`} onClick={() => setFontSize(px)}>
                <Type className="h-3.5 w-3.5" />
                {px}
              </ToolBtn>
            ))}
          </div>

          {/* 画布（白底手机宽度） */}
          <div className="flex justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40 py-6">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={onChange}
              className="wx-editor min-h-[480px] w-full max-w-[520px] rounded-xl bg-white px-6 py-8 text-[15px] leading-7 text-neutral-800 shadow-xl outline-none focus:ring-2 focus:ring-indigo-500/60"
            />
          </div>
          <p className="text-right text-xs text-zinc-600">正文约 {charCount} 字</p>
        </div>

        {/* 排版块侧栏 */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Heading1 className="h-3.5 w-3.5" />
              插入标题
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: "bar", label: "左竖线" },
                  { id: "center", label: "居中下划线" },
                  { id: "round", label: "圆底" },
                  { id: "num", label: "序号块" },
                ] as Array<{ id: TitleStyleId; label: string }>
              ).map((s) => (
                <button key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-300 hover:border-indigo-600" onClick={() => insertTitle(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Type className="h-3.5 w-3.5" />
              内容块
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <BlockBtn onClick={insertParagraph} icon={<Type className="h-3.5 w-3.5" />} label="正文" />
              <BlockBtn onClick={insertQuote} icon={<Quote className="h-3.5 w-3.5" />} label="引用" />
              <BlockBtn onClick={insertCard} icon={<Square className="h-3.5 w-3.5" />} label="卡片" />
              <BlockBtn onClick={() => insertDivider("gradient")} icon={<Minus className="h-3.5 w-3.5" />} label="渐变分隔线" />
              <BlockBtn onClick={() => insertDivider("line")} icon={<Minus className="h-3.5 w-3.5" />} label="实线" />
              <BlockBtn onClick={() => insertDivider("dot")} icon={<Minus className="h-3.5 w-3.5" />} label="星点" />
              <BlockBtn onClick={insertCode} icon={<Code2 className="h-3.5 w-3.5" />} label="代码块" />
              <BlockBtn onClick={() => openImageModal("body")} icon={<ImageIcon className="h-3.5 w-3.5" />} label="插入图片" />
              <BlockBtn onClick={insertImgPlaceholder} icon={<ImageIcon className="h-3.5 w-3.5" />} label="图片占位" />
              <BlockBtn onClick={() => run("insertUnorderedList")} icon={<List className="h-3.5 w-3.5" />} label="列表" />
              <BlockBtn onClick={() => run("insertOrderedList")} icon={<ListOrdered className="h-3.5 w-3.5" />} label="编号列表" />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-2 text-xs font-medium text-zinc-400">主题色（用于上方插入的排版块）</div>
            <div className="flex items-center gap-2">
              {WX_ACCENTS.map((c) => (
                <button
                  key={c.id}
                  title={c.name}
                  onClick={() => setAccentId(c.id)}
                  className={cx("h-7 w-7 rounded-lg transition", accentId === c.id ? "ring-2 ring-zinc-50/60" : "opacity-70 hover:opacity-100")}
                  style={{ background: c.color }}
                />
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">
              提示：选中正文中的文字再点「标题/引用」等，会用选中文字生成排版块；不选中则插入示例块，点击示例文字即可编辑。
            </p>
          </div>
        </aside>
      </div>

      {formatOpen && (
        <Modal title="智能排版" onClose={() => (formatBusy ? undefined : setFormatOpen(false))}>
          <div className="space-y-4">
            <p className="text-sm leading-6 text-zinc-400">
              AI 将重排整篇正文：划分小节、生成小标题、摘录金句、插入分隔线；语义保留，只调结构。
              排版会用当前主题色，并<b className="text-zinc-200">替换现有正文</b>。
            </p>
            <div>
              <p className="mb-1.5 text-sm text-zinc-300">标题样式</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "bar", label: "左竖线" },
                    { id: "center", label: "居中下划线" },
                    { id: "round", label: "圆底" },
                    { id: "num", label: "序号块" },
                  ] as Array<{ id: TitleStyleId; label: string }>
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={formatStyle === s.id}
                    onClick={() => setFormatStyle(s.id)}
                    className={cx(
                      "rounded-lg border px-2 py-2 text-xs transition",
                      formatStyle === s.id
                        ? "border-indigo-500 bg-indigo-600/10 text-indigo-300"
                        : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-zinc-500">当前正文约 {charCount} 字（至少 50 字）。消耗文本生成配额。</p>
            <div className="flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setFormatOpen(false)}>
                取消
              </button>
              <button className={btnPrimary} disabled={formatBusy} onClick={() => void applyFormat()}>
                {formatBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                {formatBusy ? "排版中…" : "开始排版"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {imgModal && (
        <ImageInsertModal
          onInsert={(src) => {
            if (imgModal.target === "cover") {
              setCover(src);
              flash("封面已更新");
            } else {
              insertAtSavedRange(wxImageUrl(src, savedCaptionRef.current));
            }
            setImgModal(null);
          }}
          onClose={() => setImgModal(null)}
        />
      )}
     </div>
   );
}

function BlockBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-300 transition hover:border-indigo-600 hover:text-zinc-100"
    >
      {icon}
      {label}
    </button>
  );
}

function wxImageUrl(src: string, caption?: string): string {
  const escCap = (caption ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<figure style="margin:14px 0;"><img src="${src}" style="width:100%;border-radius:8px;display:block;" alt="${escCap}"/><figcaption style="text-align:center;font-size:13px;color:#a1a1aa;margin-top:6px;">${escCap}</figcaption></figure>`;
}

/** 插图弹窗：AI 生成 / 素材库 / 外链，三条路都汇成 URL 插入。AI 生成与素材库复用 MediaPicker。 */
function ImageInsertModal({
  onInsert,
  onClose,
}: {
  onInsert: (src: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"ai" | "library" | "url">("ai");
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [url, setUrl] = useState("");

  function insertExternal() {
    const src = url.trim();
    if (!/^https?:\/\//.test(src) && !src.startsWith("/media/")) {
      setError("请输入有效图片地址（https:// 或 /media/…）");
      return;
    }
    onInsert(src);
  }

  const tabBtn = (id: "ai" | "library" | "url", label: string) => (
    <button
      key={id}
      type="button"
      aria-pressed={tab === id}
      onClick={() => {
        setTab(id);
        setError("");
      }}
      className={cx(
        "flex-1 rounded-lg px-3 py-1.5 text-xs transition",
        tab === id ? "bg-indigo-600/15 font-medium text-indigo-300" : "text-zinc-400 hover:text-zinc-200",
      )}
    >
      {label}
    </button>
  );

  return (
    <Modal title="插入图片" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-1 rounded-lg bg-zinc-950/70 p-1">{[tabBtn("ai", "AI 生成"), tabBtn("library", "素材库"), tabBtn("url", "外链")]}</div>

        {(tab === "ai" || tab === "library") && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              {tab === "ai" ? "描述画面生成配图，结果自动存入素材库。" : "选择素材库中已上传 / 已生成的图片。"}
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end">
              <button className={btnPrimary} onClick={() => setPicking(true)}>
                {tab === "ai" ? <Sparkles className="h-4 w-4" aria-hidden="true" /> : <ImageIcon className="h-4 w-4" aria-hidden="true" />}
                {tab === "ai" ? "生成 / 选择图片" : "浏览素材库"}
              </button>
            </div>
          </div>
        )}

        {tab === "url" && (
          <div className="space-y-3">
            <div>
              <label htmlFor="img-url" className="mb-1.5 block text-sm text-zinc-300">
                图片地址
              </label>
              <input
                id="img-url"
                className={inputCls}
                placeholder="https://… 或 /media/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end">
              <button className={btnPrimary} onClick={insertExternal}>
                插入
              </button>
            </div>
          </div>
        )}
      </div>

      {picking && (
        <MediaPicker
          kind="image"
          aiGenerate
          initialTab={tab === "ai" ? "ai" : "library"}
          onPick={(ref) => onInsert(ref.startsWith("r2://") ? `/media/${ref.slice(5)}` : ref)}
          onClose={() => setPicking(false)}
        />
      )}
    </Modal>
  );
}
