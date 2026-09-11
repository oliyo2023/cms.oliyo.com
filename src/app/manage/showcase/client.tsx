"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Film, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { btnGhost, btnPrimary, cx, inputCls } from "@/components/ui";
import Modal from "@/components/modal";

type Category = "gallery" | "video" | "episode";

type ShowcaseItem = {
  id: string;
  category: Category;
  title: string;
  description: string;
  media: string;
  thumb: string;
  seriesId: string | null;
  sort: number;
  published: boolean;
  createdAt: number;
};

type Series = {
  id: string;
  title: string;
  description: string;
  cover: string;
  sort: number;
  published: boolean;
  createdAt: number;
};

type MediaRow = { id: string; key: string; name: string; kind: string };

const refToUrl = (ref: string) => (ref.startsWith("r2://") ? `/media/${ref.slice(5)}` : ref);
const fmtDate = (t: number) => new Date(t).toLocaleString("zh-CN", { dateStyle: "short", timeStyle: "short" });

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function useTip(): [string | null, (msg: string) => void] {
  const [tip, setTip] = useState<string | null>(null);
  const notify = useCallback((msg: string) => {
    setTip(msg);
    window.setTimeout(() => setTip(null), 2600);
  }, []);
  return [tip, notify];
}

function MediaPicker({
  kind,
  onPick,
  onClose,
}: {
  kind: "image" | "video";
  onPick: (ref: string) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<MediaRow[] | null>(null);
  useEffect(() => {
    fetch(`/api/media?kind=${kind}`)
      .then((r) => r.json())
      .then((d: { media?: MediaRow[] }) => {
        const m = d.media;
        setRows(Array.isArray(m) ? m : []);
      })
      .catch(() => setRows([]));
  }, [kind]);

  return (
    <Modal title={`从素材库选择${kind === "image" ? "图片" : "视频"}`} onClose={onClose}>
      {rows === null && <p className="text-sm text-zinc-500">加载中…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-zinc-500">素材库为空，请先到「素材库」上传。</p>}
      <div className="grid grid-cols-3 gap-2">
        {rows?.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(`r2://${m.key}`)}
            className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-left transition hover:border-indigo-600"
            title={m.name}
          >
            {m.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/${m.key}`} alt={m.name} className="h-20 w-full object-cover" />
            ) : (
              <div className="flex h-20 items-center justify-center bg-black">
                <Film className="h-6 w-6 text-zinc-600" />
              </div>
            )}
            <div className="truncate px-1.5 py-1 text-[10px] text-zinc-500 group-hover:text-zinc-300">{m.name}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** 新建/编辑展示条目（画廊图 / 视频 / 剧集单集共用） */
function ItemForm({
  initial,
  category,
  seriesOptions,
  onDone,
  onClose,
}: {
  initial: ShowcaseItem | null;
  category: Category;
  seriesOptions?: Series[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [media, setMedia] = useState(initial?.media ?? "");
  const [thumb, setThumb] = useState(initial?.thumb ?? "");
  const [seriesId, setSeriesId] = useState(initial?.seriesId ?? "");
  const [picker, setPicker] = useState<"image" | "video" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const pickKind: "image" | "video" = category === "gallery" ? "image" : "video";
  const isImage = category === "gallery";

  async function save() {
    if (!title.trim()) {
      setError("请填写标题");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        category,
        title: title.trim(),
        description,
        media: media.trim(),
        thumb: isImage ? "" : thumb.trim(),
        seriesId: category === "episode" && seriesId ? seriesId : null,
      };
      const res = await fetch(initial ? `/api/showcase/${initial.id}` : "/api/showcase", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      router.refresh();
      onDone();
      onClose();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial ? "编辑条目" : category === "gallery" ? "新建画廊作品" : category === "video" ? "新建视频成片" : "新建单集"}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">标题</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">简介</label>
          <textarea className={cx(inputCls, "h-20 resize-none")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="一句话描述" />
        </div>
        {category === "episode" && seriesOptions && seriesOptions.length > 0 && (
          <div>
            <label className="mb-1 block text-xs text-zinc-400">所属剧集</label>
            <select className={cx(inputCls, "bg-zinc-900")} value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
              <option value="">未选择</option>
              {seriesOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-zinc-400">{isImage ? "图片" : "视频"}（粘贴 r2:// 引用或 https 链接）</label>
          <div className="flex gap-2">
            <input className={inputCls} value={media} onChange={(e) => setMedia(e.target.value)} placeholder={isImage ? "https://… 或 r2://media/…" : "视频地址"} />
            <button type="button" className={btnGhost} onClick={() => setPicker(pickKind)}>
              <Upload className="h-4 w-4" />
              素材库
            </button>
          </div>
          {media && (
            <div className="mt-2">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={refToUrl(media)} alt="preview" className="h-28 rounded-lg object-cover" />
              ) : (
                <video src={refToUrl(media)} className="h-28 w-full rounded-lg bg-black object-contain" controls />
              )}
            </div>
          )}
        </div>
        {!isImage && (
          <div>
            <label className="mb-1 block text-xs text-zinc-400">封面图（可选）</label>
            <input className={inputCls} value={thumb} onChange={(e) => setThumb(e.target.value)} placeholder="https://… 或 r2://media/…" />
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>取消</button>
          <button className={btnPrimary} disabled={busy} onClick={() => void save()}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
      {picker && <MediaPicker kind={picker} onPick={(ref) => setMedia(ref)} onClose={() => setPicker(null)} />}
    </Modal>
  );
}

function ItemCard({
  item,
  seriesOptions,
  onChanged,
  onDeleted,
  notify,
}: {
  item: ShowcaseItem;
  seriesOptions?: Series[];
  onChanged: () => void;
  onDeleted: (id: string) => void;
  notify: (msg: string) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const isVideo = item.category !== "gallery";

  async function togglePublish() {
    const res = await fetch(`/api/showcase/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !item.published }),
    });
    if (res.ok) {
      notify(item.published ? "已下线" : "已发布");
      onChanged();
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm(`删除「${item.title}」？`)) return;
    const res = await fetch(`/api/showcase/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("已删除");
      onDeleted(item.id);
      router.refresh();
    }
  }

  return (
    <div className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="relative aspect-video bg-zinc-950">
        {isVideo ? (
          <video src={refToUrl(item.media)} className="h-full w-full object-cover" muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={refToUrl(item.thumb || item.media)} alt={item.title} className="h-full w-full object-cover" />
        )}
        {!item.published && (
          <span className="absolute left-2 top-2 rounded bg-zinc-950/80 px-1.5 py-0.5 text-[10px] text-zinc-300">未发布</span>
        )}
      </div>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-100">{item.title}</div>
          <div className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{item.description || fmtDate(item.createdAt)}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            title={item.published ? "下线" : "发布"}
            onClick={() => void togglePublish()}
            className={cx("rounded-md p-1.5", item.published ? "text-emerald-500 hover:text-emerald-400" : "text-zinc-500 hover:text-zinc-200")}
          >
            {item.published ? "已发布" : "草稿"}
          </button>
          <button title="编辑" onClick={() => setEditing(true)} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button title="删除" onClick={() => void remove()} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {editing && (
        <ItemForm initial={item} category={item.category} seriesOptions={seriesOptions} onDone={onChanged} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

/** 画廊 / 视频成片网格 */
export function ShowcaseGrid({ category }: { category: "gallery" | "video" }) {
  const [items, setItems] = useState<ShowcaseItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [tip, notify] = useTip();

  const load = useCallback(() => {
    fetch(`/api/showcase?cat=${category}`)
      .then((r) => r.json())
      .then((d: { items?: ShowcaseItem[] }) => {
        const it = d.items;
        setItems(Array.isArray(it) ? it : []);
      })
      .catch(() => setItems([]));
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {category === "gallery" ? "公开站「画廊」展示的图片作品" : "公开站「视频成片」展示的视频"}
        </p>
        <div className="flex items-center gap-2">
          {category === "video" && (
            <button className={btnGhost} onClick={() => setGenOpen(true)}>
              <Sparkles className="h-4 w-4" />
              AI 生成视频
            </button>
          )}
          <button className={btnPrimary} onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            新建
          </button>
        </div>
      </div>
      {tip && <p className="text-sm text-emerald-400">{tip}</p>}
      {items === null && <p className="text-sm text-zinc-500">加载中…</p>}
      {items && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
          还没有内容，点击「新建」添加第一件作品。
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items?.map((it) => (
          <ItemCard
            key={it.id}
            item={it}
            onChanged={load}
            onDeleted={(id) => setItems((prev) => prev?.filter((x) => x.id !== id) ?? null)}
            notify={notify}
          />
        ))}
      </div>
      {creating && <ItemForm initial={null} category={category} onDone={load} onClose={() => setCreating(false)} />}
      {genOpen && <VideoGenModal onClose={() => setGenOpen(false)} onCreated={() => { load(); setGenOpen(false); }} notify={notify} />}
    </section>
  );
}

/** AI 视频生成（异步任务；依赖 VIDEO_* 配置，未配置时给出说明） */
function VideoGenModal({
  onClose,
  onCreated,
  notify,
}: {
  onClose: () => void;
  onCreated: () => void;
  notify: (msg: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "polling" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  async function start() {
    if (!prompt.trim()) {
      notify("请描述视频画面");
      return;
    }
    setBusy(true);
    setPhase("polling");
    setMessage("已提交任务，等待生成…");
    try {
      const res = await fetch("/api/ai/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = (await res.json()) as { configured?: boolean; message?: string; taskId?: string; pollMs?: number; error?: string };
      if (res.status === 501 || data.configured === false) {
        setPhase("error");
        setMessage(data.message ?? data.error ?? "视频生成服务未配置");
        return;
      }
      if (!res.ok || !data.taskId) {
        setPhase("error");
        setMessage(data.error ?? "提交失败");
        return;
      }
      const pollMs = data.pollMs ?? 15000;
      let done = false;
      for (let i = 0; i < 8 && !done; i++) {
        await sleep(Math.min(pollMs, 15000));
        const pollRes = await fetch(`/api/ai/video?id=${encodeURIComponent(data.taskId)}`);
        const poll = (await pollRes.json()) as { ok?: boolean; status?: string; url?: string; message?: string };
        if (poll.ok && poll.status === "done" && poll.url) {
          setVideoUrl(poll.url);
          setPhase("done");
          setMessage("生成完成");
          done = true;
        } else if (poll.status === "error" || pollRes.status >= 400) {
          setPhase("error");
          setMessage(poll.message ?? "任务查询失败");
          done = true;
        } else {
          setMessage(`生成中（异步任务，轮询第 ${i + 1} 次）…`);
        }
      }
      if (!done) {
        setPhase("error");
        setMessage("任务仍在排队，请稍后到历史记录查看；或使用素材库上传视频后发布。");
      }
    } catch {
      setPhase("error");
      setMessage("网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function publishAsVideo() {
    if (!videoUrl) return;
    const res = await fetch("/api/showcase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "video",
        title: prompt.trim().slice(0, 40),
        description: prompt.trim().slice(0, 120),
        media: videoUrl,
        published: true,
      }),
    });
    if (res.ok) {
      notify("已发布为视频成片");
      onCreated();
    } else {
      notify("发布失败");
    }
  }

  return (
    <Modal title="AI 生成视频" onClose={onClose}>
      <div className="space-y-3">
        <textarea
          className={cx(inputCls, "h-24 resize-none")}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述视频画面与风格，例如：城市夜景延时摄影，车流灯光流动，4K 质感"
        />
        {phase === "polling" && <p className="text-sm text-indigo-300">{message}</p>}
        {phase === "error" && <p className="text-sm text-amber-400">{message}</p>}
        {phase === "done" && videoUrl && (
          <div className="space-y-2">
            <video src={videoUrl} controls className="w-full rounded-lg bg-black" />
            <p className="text-xs text-emerald-400">生成完成，可直接发布到公开站「视频成片」。</p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>
            关闭
          </button>
          {phase === "done" && videoUrl ? (
            <button className={btnPrimary} onClick={() => void publishAsVideo()}>
              <Plus className="h-4 w-4" />
              发布为视频成片
            </button>
          ) : (
            <button className={btnPrimary} disabled={busy} onClick={() => void start()}>
              {busy ? "处理中…" : "生成视频"}
            </button>
          )}
        </div>
        <p className="text-[11px] leading-5 text-zinc-600">
          视频生成走异步任务（按 VIDEO_* 环境变量指向的服务适配）；未配置时此按钮会提示服务未启用。直接提供视频文件时请用「素材库」上传。
        </p>
      </div>
    </Modal>
  );
}

/** 剧集管理：剧集列表 + 各自单集 */
export function SeriesManager() {
  const [seriesList, setSeriesList] = useState<Series[] | null>(null);
  const [episodes, setEpisodes] = useState<Record<string, ShowcaseItem[]>>({});
  const [creating, setCreating] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [editingEpisode, setEditingEpisode] = useState<ShowcaseItem | null>(null);
  const [addTo, setAddTo] = useState<string | null>(null); // 正在添加单集的剧集 id
  const [addTitle, setAddTitle] = useState("");
  const [addMedia, setAddMedia] = useState("");
  const [tip, notify] = useTip();
  const router = useRouter();

  const loadSeries = useCallback(() => {
    fetch("/api/series")
      .then((r) => r.json())
      .then((d: { series?: Series[] }) => {
        const s = d.series;
        setSeriesList(Array.isArray(s) ? s : []);
      })
      .catch(() => setSeriesList([]));
  }, []);

  const loadEpisodes = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/showcase?cat=episode&series=${sid}`);
      const d = (await res.json()) as { items?: ShowcaseItem[] };
      const it = d.items;
      setEpisodes((prev) => ({ ...prev, [sid]: Array.isArray(it) ? it : [] }));
    } catch {
      setEpisodes((prev) => ({ ...prev, [sid]: [] }));
    }
  }, []);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  const reveal = (sid: string) => {
    if (!episodes[sid]) void loadEpisodes(sid);
    setEpisodes((prev) => ({ ...prev, [sid]: prev[sid] ?? [] }));
  };

  async function removeSeries(s: Series) {
    if (!confirm(`删除剧集「${s.title}」？其全部单集将一并删除。`)) return;
    const res = await fetch(`/api/series/${s.id}`, { method: "DELETE" });
    if (res.ok) {
      notify("已删除剧集");
      setSeriesList((prev) => prev?.filter((x) => x.id !== s.id) ?? null);
      router.refresh();
    }
  }

  async function saveEpisode(sid: string) {
    if (!addTitle.trim() || !addMedia.trim()) {
      notify("请填写单集标题与视频地址");
      return;
    }
    const res = await fetch("/api/showcase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "episode",
        title: addTitle.trim(),
        description: "",
        media: addMedia.trim(),
        thumb: "",
        seriesId: sid,
        published: true,
        sort: episodes[sid]?.length ?? 0,
      }),
    });
    if (res.ok) {
      setAddTitle("");
      setAddMedia("");
      setAddTo(null);
      notify("已添加单集");
      await loadEpisodes(sid);
      router.refresh();
    }
  }

  async function toggleSeriesPublish(s: Series) {
    const next = !s.published;
    const res = await fetch(`/api/series/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    if (res.ok) {
      notify(next ? "已发布剧集" : "剧集已下线");
      setSeriesList((prev) => prev?.map((x) => (x.id === s.id ? { ...x, published: next } : x)) ?? null);
      router.refresh();
    }
  }

  async function toggleEpPublish(sid: string, ep: ShowcaseItem) {
    const next = !ep.published;
    const res = await fetch(`/api/showcase/${ep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    if (res.ok) {
      setEpisodes((prev) => ({ ...prev, [sid]: (prev[sid] ?? []).map((x) => (x.id === ep.id ? { ...x, published: next } : x)) }));
      router.refresh();
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">剧集：含多集的系列内容，公开站以「剧集」栏目展示</p>
        <button className={btnPrimary} onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          新建剧集
        </button>
      </div>
      {tip && <p className="text-sm text-emerald-400">{tip}</p>}
      {seriesList === null && <p className="text-sm text-zinc-500">加载中…</p>}
      {seriesList && seriesList.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">还没有剧集。</div>
      )}
      {seriesList?.map((s) => {
        const eps = episodes[s.id];
        return (
          <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {s.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={refToUrl(s.cover)} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-100">{s.title}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{eps ? `${eps.length} 集` : ""}</span>
                    <span className={cx("rounded px-1.5 py-0.5 text-[10px]", s.published ? "bg-emerald-900/40 text-emerald-300" : "bg-zinc-800 text-zinc-400")}>
                      {s.published ? "已发布" : "草稿"}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{s.description || "无简介"}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button title="添加单集" className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" onClick={() => { reveal(s.id); setAddTo(addTo === s.id ? null : s.id); }}>
                  <Plus className="h-4 w-4" />
                </button>
                <button title={s.published ? "下线剧集" : "发布剧集"} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" onClick={() => void toggleSeriesPublish(s)}>
                  {s.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button title="编辑剧集" className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" onClick={() => setEditingSeries(s)}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button title="删除剧集" className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400" onClick={() => void removeSeries(s)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {eps === undefined ? (
                <button onClick={() => void loadEpisodes(s.id)} className="text-xs text-zinc-500 hover:text-zinc-300">
                  加载单集…
                </button>
              ) : eps.length === 0 ? (
                <p className="text-xs text-zinc-600">暂无单集</p>
              ) : (
                eps.map((ep) => (
                  <div key={ep.id} className="flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2">
                    <Film className="h-6 w-6 shrink-0 text-zinc-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-zinc-200">{ep.title}</div>
                      <div className="text-[10px] text-zinc-500">第 {ep.sort + 1} 集</div>
                    </div>
                    <button title={ep.published ? "下线单集" : "发布单集"} className="rounded p-1 text-zinc-500 hover:text-zinc-200" onClick={() => void toggleEpPublish(s.id, ep)}>
                      {ep.published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                    <button className="rounded p-1 text-zinc-500 hover:text-zinc-200" title="编辑单集" onClick={() => setEditingEpisode(ep)}>
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      className="rounded p-1 text-zinc-500 hover:text-red-400"
                      title="删除单集"
                      onClick={() => {
                        if (!confirm(`删除单集「${ep.title}」？`)) return;
                        void fetch(`/api/showcase/${ep.id}`, { method: "DELETE" }).then(() => {
                          setEpisodes((prev) => ({ ...prev, [s.id]: (prev[s.id] ?? []).filter((x) => x.id !== ep.id) }));
                          router.refresh();
                        });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}

              {addTo === s.id && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950/70 p-3">
                  <input className={cx(inputCls, "w-52 flex-none")} value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="单集标题" />
                  <input className={cx(inputCls, "min-w-52 flex-1")} value={addMedia} onChange={(e) => setAddMedia(e.target.value)} placeholder="视频地址（https 或 r2://）" />
                  <button className={btnPrimary} onClick={() => void saveEpisode(s.id)}>
                    <Plus className="h-4 w-4" />
                    添加
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {creating && (
        <SeriesForm onDone={() => { loadSeries(); setCreating(false); }} onClose={() => setCreating(false)} />
      )}
      {editingSeries && (
        <SeriesForm
          editing={editingSeries}
          onDone={() => { loadSeries(); setEditingSeries(null); }}
          onClose={() => setEditingSeries(null)}
        />
      )}
      {editingEpisode && (
        <ItemForm
          initial={editingEpisode}
          category="episode"
          seriesOptions={seriesList ?? []}
          onDone={() => { if (editingEpisode.seriesId) void loadEpisodes(editingEpisode.seriesId); }}
          onClose={() => setEditingEpisode(null)}
        />
      )}
    </section>
  );
}

function SeriesForm({
  editing,
  onDone,
  onClose,
}: {
  editing?: Series | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [cover, setCover] = useState(editing?.cover ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function saveSeries() {
    if (!title.trim()) {
      setError("请填写剧集标题");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(editing ? `/api/series/${editing.id}` : "/api/series", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description, cover: cover.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={editing ? "编辑剧集" : "新建剧集"} onClose={onClose}>
      <div className="space-y-3">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="剧集标题" />
        <textarea className={cx(inputCls, "h-16 resize-none")} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="剧集简介" />
        <input className={inputCls} value={cover} onChange={(e) => setCover(e.target.value)} placeholder="封面（https://… 或 r2://media/…）" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>取消</button>
          <button className={btnPrimary} disabled={busy} onClick={() => void saveSeries()}>
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
