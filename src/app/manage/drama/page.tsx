"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Loader2, Play, Save, Sparkles, Video, WandSparkles } from "lucide-react";
import { btnGhost, btnPrimary, cx, inputCls } from "@/components/ui";
import { postSse } from "@/lib/sse-client";
import { DRAMA_GENRES, parseDramaPlan, type DramaPlan } from "@/lib/prompts";
import { runVideoJob } from "@/lib/video-job";

function DramaShotRow({ epIdx, shot, onUrl }: { epIdx: number; shot: { shot: number; prompt: string }; onUrl: (key: string, url: string) => void }) {
  const key = `${epIdx}-${shot.shot}`;
  const [st, setSt] = useState<{ status: "idle" | "polling" | "done" | "error"; url: string; message: string }>({
    status: "idle",
    url: "",
    message: "",
  });

  async function start() {
    setSt({ status: "polling", url: "", message: "已提交视频任务，等待生成…" });
    const result = await runVideoJob(shot.prompt, (message) => setSt({ status: "polling", url: "", message }));
    if (!result.ok) {
      setSt({ status: "error", url: "", message: result.message });
      return;
    }
    setSt({ status: "done", url: result.url, message: "" });
    onUrl(key, result.url);
  }

  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">镜头 {shot.shot}</span>
        <p className="min-w-0 flex-1 text-xs leading-5 text-zinc-300">{shot.prompt || "（空镜头）"}</p>
        <button className={cx(btnGhost, "shrink-0 px-2 py-1 text-xs")} disabled={st.status === "polling"} onClick={() => void start()}>
          {st.status === "polling" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
          {st.status === "polling" ? "生成中…" : st.status === "done" ? "重新生成" : "生成视频"}
        </button>
      </div>
      {st.status === "polling" && <p className="mt-2 text-xs text-indigo-300">{st.message}</p>}
      {st.status === "error" && <p className="mt-2 text-xs text-amber-400">{st.message}</p>}
      {st.status === "done" && st.url && <video src={st.url} controls className="mt-2 w-full rounded-lg bg-black" />}
    </div>
  );
}

export default function DramaPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState<string>(DRAMA_GENRES[0]);
  const [episodes, setEpisodes] = useState("6");
  const [shotsPerEpisode, setShotsPerEpisode] = useState("4");
  const [style, setStyle] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [ideaErr, setIdeaErr] = useState("");

  const [plan, setPlan] = useState<DramaPlan | null>(null);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [shotUrls, setShotUrls] = useState<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  const epCount = Math.min(12, Math.max(3, Number(episodes) || 6));
  const shotCount = Math.min(8, Math.max(3, Number(shotsPerEpisode) || 4));

  async function generate() {
    if (!idea.trim()) {
      setError("请填写题材或剧情设定");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPlan(null);
    setShotUrls({});
    setError("");
    setSaveErr("");
    setState("running");
    let acc = "";
    try {
      await postSse(
        "/api/ai/drama",
        { idea: idea.trim(), genre, episodes: epCount, shotsPerEpisode: shotCount, style: style.trim() || undefined },
        {
          onDelta: (t) => {
            acc += t;
          },
          onEvent: (event, data) => {
            if (event === "error" && data && typeof data === "object") {
              const rec = data as Record<string, unknown>;
              const m = rec.message;
              throw new Error(typeof m === "string" ? m : "生成失败");
            }
          },
        },
        ac.signal,
      );
      try {
        setPlan(parseDramaPlan(acc));
        setState("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "剧本解析失败");
        setState("error");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "网络错误");
      setState("error");
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function genIdeas() {
    setIdeaBusy(true);
    setIdeaErr("");
    try {
      const res = await fetch("/api/ai/drama-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: idea.trim() || undefined, genre }),
      });
      const data = (await res.json()) as { ideas?: string[]; error?: string };
      if (!res.ok || !data.ideas?.length) {
        setIdeaErr(data.error ?? "生成失败，请重试");
        return;
      }
      setIdeas(data.ideas);
    } catch {
      setIdeaErr("网络错误，请重试");
    } finally {
      setIdeaBusy(false);
    }
  }

  async function saveAsDraft() {
    if (!plan) return;
    setSaving(true);
    setSaveErr("");
    try {
      const sRes = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: plan.title, description: plan.logline, cover: "", sort: 0, published: false }),
      });
      const sData = (await sRes.json()) as { series?: { id: string }; error?: string };
      if (!sRes.ok || !sData.series) throw new Error(sData.error ?? "创建剧集失败");
      const seriesId = sData.series.id;
      for (const epIdx of plan.episodes.keys()) {
        const ep = plan.episodes[epIdx];
        const media = ep.shots.map((s) => shotUrls[`${epIdx}-${s.shot}`]).find((u) => u) ?? "";
        const eRes = await fetch("/api/showcase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: "episode",
            title: ep.title,
            description: ep.summary,
            media,
            seriesId,
            sort: ep.number - 1,
            published: false,
          }),
        });
        if (!eRes.ok) {
          const eData = (await eRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(eData?.error ?? "创建单集失败");
        }
      }
      setNotice("已存为未发布草稿");
      router.push("/manage/showcase?tab=series");
      router.refresh();
    } catch (e) {
      setSaveErr(`${e instanceof Error ? e.message : "保存失败"}（部分单集可能已创建，重试前可先手动删除重复草稿）`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">短剧生成</h1>
        <p className="mt-1 text-sm text-zinc-500">题材 → 分集剧本与逐镜头提示词 → 逐条生成视频 → 存为未发布剧集草稿。</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs text-zinc-400">题材 / 剧情设定 *</label>
              <button
                type="button"
                className={cx(btnGhost, "px-2 py-0.5 text-[11px]")}
                disabled={ideaBusy}
                onClick={() => void genIdeas()}
                title="按当前类型与已填设定方向，生成一批候选题材/剧情设定"
              >
                {ideaBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <WandSparkles className="h-3 w-3" />}
                {ideaBusy ? "生成中…" : "AI 生成设定"}
              </button>
            </div>
            <textarea
              className={cx(inputCls, "h-20 resize-none")}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="例如：外卖员意外拿到豪门遗嘱，每集一个反转"
            />
            {ideaErr && <p className="mt-1 text-[11px] text-red-400">{ideaErr}</p>}
            {ideas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ideas.map((k, i) => (
                  <button
                    key={`${i}-${k}`}
                    type="button"
                    onClick={() => setIdea(k)}
                    title="点击填入设定"
                    className={cx(
                      "rounded-lg border px-2 py-1 text-left text-[11px] leading-4 transition",
                      idea.trim() === k
                        ? "border-indigo-500 bg-indigo-600/15 text-indigo-300"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-indigo-600/60 hover:text-zinc-200",
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">类型</label>
            <select className={cx(inputCls, "bg-zinc-900")} value={genre} onChange={(e) => setGenre(e.target.value)}>
              {DRAMA_GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">集数（3-12）</label>
              <input className={inputCls} type="number" min={3} max={12} value={episodes} onChange={(e) => setEpisodes(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">每集镜头（3-8）</label>
              <input className={inputCls} type="number" min={3} max={8} value={shotsPerEpisode} onChange={(e) => setShotsPerEpisode(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">视觉风格（可选）</label>
            <input className={inputCls} value={style} onChange={(e) => setStyle(e.target.value)} placeholder="默认：竖屏短剧质感，写实光影" />
          </div>
          {state === "running" ? (
            <button className={cx(btnGhost, "w-full")} onClick={stop}>
              <Loader2 className="h-4 w-4 animate-spin" />
              停止生成
            </button>
          ) : (
            <button className={cx(btnPrimary, "w-full")} onClick={() => void generate()}>
              <Sparkles className="h-4 w-4" />
              生成剧本
            </button>
          )}
          <p className="text-[11px] leading-5 text-zinc-600">剧本生成按文本配额计；逐镜头视频各自消耗视频配额，互相独立。</p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Clapperboard className="h-4 w-4 text-indigo-400" />
            剧本结果
          </div>

          {state === "idle" && !plan && (
            <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-600">
              填写左侧题材后点击「生成剧本」
            </div>
          )}
          {state === "running" && (
            <div className="flex h-24 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 text-sm text-zinc-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在生成分集剧本与镜头提示词…
            </div>
          )}

          {plan && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">{plan.title}</h2>
                {plan.logline && <p className="mt-1 text-sm leading-6 text-zinc-400">{plan.logline}</p>}
                <p className="mt-1 text-[11px] text-zinc-600">
                  历史已记录 · {plan.episodes.length} 集 × {plan.episodes[0]?.shots.length ?? 0} 镜头/集
                </p>
              </div>
              {plan.episodes.map((ep, epIdx) => (
                <div key={ep.number} className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <h3 className="text-sm font-medium text-zinc-100">
                    第 {ep.number} 集 · {ep.title}
                  </h3>
                  {ep.summary && <p className="text-xs leading-5 text-zinc-400">{ep.summary}</p>}
                  {ep.shots.length === 0 ? (
                    <p className="text-xs text-zinc-600">无镜头</p>
                  ) : (
                    ep.shots.map((s) => (
                      <DramaShotRow key={s.shot} epIdx={epIdx} shot={s} onUrl={(k, url) => setShotUrls((prev) => ({ ...prev, [k]: url }))} />
                    ))
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <button className={cx(btnPrimary, "text-xs")} disabled={saving} onClick={() => void saveAsDraft()}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  存为剧集草稿（未发布）
                </button>
                <button className={cx(btnGhost, "text-xs")} onClick={() => void generate()}>
                  <Play className="h-3.5 w-3.5" />
                  重新生成
                </button>
              </div>
              {saveErr && <p className="text-sm text-red-400">{saveErr}</p>}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}
        </section>
      </div>
    </div>
  );
}
