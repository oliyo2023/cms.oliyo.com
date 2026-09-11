import Link from "next/link";
import { cx } from "@/components/ui";
import { SeriesManager, ShowcaseGrid } from "./client";

type Tab = "gallery" | "video" | "series";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "gallery", label: "画廊" },
  { value: "video", label: "视频成片" },
  { value: "series", label: "剧集" },
];

export default async function ShowcasePage({ searchParams }: { searchParams: Promise<{ tab?: string; cat?: string }> }) {
  const sp = await searchParams;
  const raw = sp.tab ?? sp.cat;
  const tab: Tab = raw === "video" || raw === "series" ? raw : "gallery";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-zinc-100">作品展示</h1>
        <p className="mt-1 text-sm text-zinc-500">管理公开站画廊、视频成片与剧集内容。</p>
      </header>

      <nav className="flex w-fit gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <Link
              key={t.value}
              href={`/manage/showcase?tab=${t.value}`}
              className={cx(
                "rounded-lg px-4 py-1.5 text-sm transition",
                active ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab === "series" ? <SeriesManager /> : <ShowcaseGrid category={tab} />}
    </div>
  );
}
