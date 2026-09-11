"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clapperboard,
  Eye,
  EyeOff,
  Fingerprint,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  TextCursorInput,
} from "lucide-react";
import { btnGhost, btnPrimary, cx, inputCls } from "@/components/ui";

type Field = {
  name: string;
  label: string;
  secret: boolean;
  hint?: string;
  hasValue: boolean;
  tail: string | null;
  fromDb: boolean;
  hasEnv: boolean;
  value?: string;
};

/** 每个服务标签页的元信息与字段清单；「共享 Key」单独成卡，置顶常驻。 */
type TabDef = {
  id: string;
  title: string;
  desc: string;
  icon: typeof TextCursorInput;
  names: string[];
  /** 需要占满整行的长字段（URL、模型名等）。 */
  wide?: string[];
};

const SHARED = "AGNES_API_KEY";

const TABS: TabDef[] = [
  {
    id: "llm",
    title: "文本生成",
    desc: "文章 / 洗稿使用的对话模型（OpenAI 兼容接口）。",
    icon: TextCursorInput,
    names: ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL"],
    wide: ["LLM_BASE_URL", "LLM_MODEL"],
  },
  {
    id: "image",
    title: "图像生成",
    desc: "配图生成模型；尺寸与画幅留空则使用服务默认。",
    icon: ImageIcon,
    names: ["IMAGE_API_KEY", "IMAGE_BASE_URL", "IMAGE_MODEL", "IMAGE_SIZE", "IMAGE_RATIO"],
    wide: ["IMAGE_BASE_URL", "IMAGE_MODEL"],
  },
  {
    id: "video",
    title: "视频生成",
    desc: "视频任务模型；分辨率可选 1K/2K/3K，Flash 固定 720P。",
    icon: Clapperboard,
    names: [
      "VIDEO_API_KEY",
      "VIDEO_BASE_URL",
      "VIDEO_MODEL",
      "VIDEO_SIZE",
      "VIDEO_ASPECT",
      "VIDEO_SECONDS",
      "VIDEO_POLL_URL",
    ],
    wide: ["VIDEO_BASE_URL", "VIDEO_MODEL", "VIDEO_POLL_URL"],
  },
  {
    id: "oauth",
    title: "第三方登录",
    desc: "GitHub / Google 登录；Client ID 留空即隐藏对应登录入口，改动立即生效。",
    icon: Fingerprint,
    names: [
      "SITE_URL",
      "OAUTH_STATE_SECRET",
      "GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
    ],
    wide: ["SITE_URL", "OAUTH_STATE_SECRET"],
  },
];

function SourceBadge({ field }: { field: Field }) {
  const badge = field.fromDb
    ? { text: "后台配置", cls: "bg-indigo-600/20 text-indigo-300" }
    : field.hasEnv
      ? { text: "环境变量", cls: "bg-zinc-700/60 text-zinc-300" }
      : { text: "默认", cls: "bg-zinc-800 text-zinc-500" };
  return <span className={cx("shrink-0 rounded px-1.5 py-0.5 text-[10px]", badge.cls)}>{badge.text}</span>;
}

function FieldLabel({ field }: { field: Field }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label className="text-sm text-zinc-300">{field.label}</label>
      <SourceBadge field={field} />
    </div>
  );
}

function SecretRow({
  field,
  draft,
  onDraft,
  hint,
}: {
  field: Field;
  draft: string | undefined;
  onDraft: (v: string | undefined) => void;
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const editing = draft !== undefined;
  return (
    <div>
      <FieldLabel field={field} />
      {editing ? (
        <div className="flex items-start gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              type={show ? "text" : "password"}
              className={cx(inputCls, "pr-9 font-mono")}
              value={draft}
              placeholder="粘贴完整 key；留空保存 = 清除并回退环境变量"
              onChange={(e) => onDraft(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "隐藏密钥" : "显示密钥"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 transition hover:text-zinc-300"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button type="button" className={cx(btnGhost, "shrink-0")} onClick={() => onDraft(undefined)}>
            取消
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            className={cx(btnGhost, "w-full justify-start text-zinc-400")}
            onClick={() => onDraft("")}
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            {field.hasValue ? `更换 key（尾号 ····${field.tail}）` : "设置 key"}
          </button>
          {(hint ?? field.hint) && <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{hint ?? field.hint}</p>}
        </div>
      )}
    </div>
  );
}

function TextRow({
  field,
  value,
  onChange,
  wide,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <div className={cx(wide && "sm:col-span-2")}>
      <FieldLabel field={field} />
      <input
        className={cx(inputCls, "font-mono text-xs")}
        value={value}
        placeholder="留空 = 使用默认/环境变量"
        onChange={(e) => onChange(e.target.value)}
      />
      {field.hint && <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{field.hint}</p>}
    </div>
  );
}

export default function SettingsClient() {
  const router = useRouter();
  const [fields, setFields] = useState<Field[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [active, setActive] = useState("llm");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const flash = (ok: boolean, text: string) => {
    setNotice({ ok, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  async function load() {
    const res = await fetch("/api/admin/settings");
    const data = (await res.json()) as { fields?: Field[] };
    setFields(Array.isArray(data.fields) ? data.fields : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (Object.keys(drafts).length === 0) {
      flash(true, "没有需要保存的修改");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: drafts }),
      });
      const data = (await res.json()) as { ok?: boolean; updated?: number; error?: string };
      if (!res.ok) {
        flash(false, data.error ?? "保存失败");
        return;
      }
      flash(true, `已保存 ${data.updated ?? 0} 项，立即生效`);
      setDrafts({});
      await load();
      router.refresh();
    } catch {
      flash(false, "网络错误");
    } finally {
      setBusy(false);
    }
  }

  async function testLlm() {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/settings", { method: "PUT" });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      flash(data.ok === true, data.message ?? "测试完成");
    } catch {
      flash(false, "网络错误");
    } finally {
      setTesting(false);
    }
  }

  const dirtyList = Object.keys(drafts).filter((n) => drafts[n] !== "");
  const dirtyTabTitles = TABS.filter((t) => dirtyList.some((n) => t.names.includes(n))).map((t) => t.title);
  const sharedDirty = dirtyList.includes(SHARED);
  const hasDrafts = dirtyList.length > 0;

  function onDraft(name: string, v: string | undefined) {
    setDrafts((prev) => {
      if (v === undefined) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return { ...prev, [name]: v };
    });
  }

  function switchTab(idx: number) {
    setActive(TABS[idx].id);
  }

  function onTabKey(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (idx + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
      switchTab(next);
      tabRefs.current[next]?.focus();
    }
  }

  if (fields === null) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="配置加载中">
        <div className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
        <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" />
      </div>
    );
  }

  const activeTab = TABS.find((t) => t.id === active) ?? TABS[0];
  const shared = fields.find((f) => f.name === SHARED);

  return (
    <div className="space-y-5">
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={cx(
            "rounded-lg border px-4 py-2.5 text-sm",
            notice.ok
              ? "border-emerald-800 bg-emerald-900/30 text-emerald-300"
              : "border-red-900 bg-red-950/40 text-red-300",
          )}
        >
          {notice.text}
        </div>
      )}

      {/* 共享 Key：跨服务的凭据，独立成卡常驻 */}
      {shared && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">共享 API Key</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                三个服务共用一份凭据；各服务内的独立 Key 仅在需要覆盖共享值时填写。
              </p>
            </div>
            <SecretRow
              field={shared}
              draft={drafts[SHARED]}
              onDraft={(v) => onDraft(SHARED, v)}
              hint="优先级：服务独立 Key > 共享 Key > 环境变量；留空保存 = 清除并回退环境变量。"
            />
          </div>
        </section>
      )}

      {/* 服务标签页：一次只展示一个服务的字段，避免长表单拥挤 */}
      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div role="tablist" aria-label="AI 服务" className="flex gap-1 overflow-x-auto border-b border-zinc-800 px-2 pt-2">
          {TABS.map((t, i) => {
            const on = t.id === active;
            const dirty = dirtyList.some((n) => t.names.includes(n));
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                id={`tab-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => switchTab(i)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={cx(
                  "relative flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm transition",
                  on
                    ? "bg-zinc-950/60 font-medium text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300",
                )}
              >
                <t.icon className="h-4 w-4" aria-hidden="true" />
                {t.title}
                {dirty && (
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" role="img" aria-label="有未保存的修改" />
                )}
                {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-indigo-500" />}
              </button>
            );
          })}
        </div>

        <div
          key={activeTab.id}
          role="tabpanel"
          id={`panel-${activeTab.id}`}
          aria-labelledby={`tab-${activeTab.id}`}
          tabIndex={0}
          className="p-6 outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
        >
          <p className="text-sm text-zinc-400">{activeTab.desc}</p>
          <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {activeTab.names.map((name) => {
              const f = fields.find((x) => x.name === name);
              if (!f) return null;
              if (f.secret) {
                return (
                  <div key={name} className="sm:col-span-2 sm:max-w-md">
                    <SecretRow field={f} draft={drafts[name]} onDraft={(v) => onDraft(name, v)} />
                  </div>
                );
              }
              return (
                <TextRow
                  key={name}
                  field={f}
                  wide={activeTab.wide?.includes(name)}
                  value={drafts[name] ?? f.value ?? ""}
                  onChange={(v) => onDraft(name, v)}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* 粘性操作栏：草稿跨标签页保留，未保存状态随时可见 */}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3.5 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 lg:py-4">
        <button
          className={cx(btnPrimary, hasDrafts && "ring-2 ring-indigo-500/40")}
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          保存修改
        </button>
        <button
          className={btnGhost}
          disabled={testing}
          onClick={() => void testLlm()}
          title="用当前已保存配置真实请求一次文本模型"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlugZap className="h-4 w-4" aria-hidden="true" />}
          测试文本模型连通
        </button>
        <span className="ml-auto text-xs text-zinc-500" aria-live="polite">
          {hasDrafts
            ? `未保存：${[...dirtyTabTitles, ...(sharedDirty ? ["共享 Key"] : [])].join("、")}`
            : "密钥仅管理员可改；保存后立即对全部用户生效，无需重启。"}
        </span>
      </div>
    </div>
  );
}
