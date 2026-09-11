"use client";

import { useEffect, useRef, useState } from "react";
import { File as FileIcon, FileAudio, Image as ImageIcon, Link2, Trash2, Upload } from "lucide-react";
import { btnPrimary, cx } from "@/components/ui";

type MediaKind = "image" | "video" | "audio" | "file";
type Filter = "all" | MediaKind;

type MediaRow = {
  id: string;
  key: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: number;
};

const CHIPS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "file", label: "文件" },
];

function errText(raw: unknown): string | null {
  if (raw === null || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const error: unknown = rec.error;
  return typeof error === "string" ? error : null;
}

function parseRows(json: string): MediaRow[] {
  try {
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw as MediaRow[];
  } catch {
    return [];
  }
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MediaClient({ initialJson, kind }: { initialJson: string; kind?: MediaKind }) {
  const [items, setItems] = useState<MediaRow[]>(() => parseRows(initialJson));
  const [filter, setFilter] = useState<Filter>(() => {
    if (kind === "image" || kind === "video") return kind;
    if (kind === "file" || kind === "audio") return "file";
    return "all";
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function flash(text: string, error = false) {
    setToast({ text, error });
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), 2600);
  }

  function pickFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0 || busy) return;
    void uploadFiles(files);
  }

  async function uploadFiles(files: File[]) {
    setBusy(true);
    setDone(0);
    setTotal(files.length);
    let uploaded = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/media", { method: "POST", body: fd });
        const raw: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          flash(`「${file.name}」上传失败：${errText(raw) ?? "服务器错误"}`, true);
          continue;
        }
        if (raw === null || typeof raw !== "object") {
          flash(`「${file.name}」上传响应异常`, true);
          continue;
        }
        const rec = raw as Record<string, unknown>;
        const media: unknown = rec.media;
        if (media === null || typeof media !== "object") {
          flash(`「${file.name}」上传响应异常`, true);
          continue;
        }
        const row = media as MediaRow;
        if (typeof row.id !== "string" || typeof row.key !== "string") {
          flash(`「${file.name}」上传响应异常`, true);
          continue;
        }
        setItems((prev) => [row, ...prev]);
        uploaded += 1;
      } catch {
        flash(`「${file.name}」网络错误，请重试`, true);
      } finally {
        setDone(i + 1);
      }
    }
    setBusy(false);
    if (uploaded > 0) flash(uploaded === files.length ? `已上传 ${uploaded} 个文件` : `已上传 ${uploaded}/${files.length} 个文件`);
  }

  async function removeRow(row: MediaRow) {
    if (!window.confirm(`确定删除「${row.name}」吗？此操作不可恢复。`)) return;
    try {
      const res = await fetch(`/api/media/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const raw: unknown = await res.json().catch(() => null);
        flash(errText(raw) ?? "删除失败，请重试", true);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== row.id));
      flash("已删除");
    } catch {
      flash("网络错误，请重试", true);
    }
  }

  async function copyRef(key: string) {
    try {
      await navigator.clipboard.writeText(`r2://${key}`);
      flash("已复制引用");
    } catch {
      flash("复制失败，请手动复制", true);
    }
  }

  const visible = items.filter((row) => {
    if (filter === "all") return true;
    if (filter === "file") return row.kind === "file" || row.kind === "audio";
    return row.kind === filter;
  });
  const chipCount = (value: Filter) => {
    if (value === "all") return items.length;
    if (value === "file") return items.filter((r) => r.kind === "file" || r.kind === "audio").length;
    return items.filter((r) => r.kind === value).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((chip) => {
            const active = filter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setFilter(chip.value)}
                className={cx(
                  "rounded-full border px-3 py-1 text-sm transition",
                  active
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
                )}
              >
                {chip.label}
                <span className={cx("ml-1.5 text-xs", active ? "text-indigo-400" : "text-zinc-600")}>
                  {chipCount(chip.value)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {busy && (
            <span className="text-xs text-zinc-400">
              上传中 {done}/{total}
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              pickFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={`${btnPrimary} px-3 py-1.5 text-sm`}
          >
            <Upload className="h-4 w-4" />
            上传文件
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-zinc-700" />
          <p className="mt-4 text-sm text-zinc-400">
            {items.length === 0
              ? "还没有素材，点击右上角「上传文件」上传图片或视频。"
              : filter === "video"
                ? "暂无视频素材。"
                : filter === "file"
                  ? "暂无文件素材。"
                  : "暂无图片素材。"}
          </p>
          <p className="mt-1 text-xs text-zinc-600">单文件不超过 60MB，支持图片与视频格式。</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((row) => {
            return (
              <div
                key={row.id}
                className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition hover:border-zinc-700"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                  {row.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/media/${row.key}`} alt={row.name} className="h-full w-full object-contain" loading="lazy" />
                  ) : row.kind === "video" ? (
                    <video
                      src={`/media/${row.key}`}
                      muted
                      loop
                      playsInline
                      controls
                      preload="metadata"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {row.mime.startsWith("audio/") ? (
                        <FileAudio className="h-10 w-10 text-zinc-600" />
                      ) : (
                        <FileIcon className="h-10 w-10 text-zinc-600" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2 px-3 pb-3 pt-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-200" title={row.name}>
                      {row.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {formatBytes(row.size)} · {formatTime(row.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      title="复制引用"
                      onClick={() => void copyRef(row.key)}
                      className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-indigo-300"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      onClick={() => void removeRow(row)}
                      className="rounded-md p-1.5 text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div
          className={cx(
            "fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border px-4 py-2.5 text-sm shadow-lg",
            toast.error
              ? "border-red-800 bg-red-950/95 text-red-300"
              : "border-zinc-700 bg-zinc-800/95 text-zinc-100",
          )}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
