import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Layers, Play } from "lucide-react";
import SiteHeader, { SiteFooter } from "@/components/site-header";
import { db } from "@/lib/drizzle";
import { series, showcaseItems } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { mediaUrl } from "@/lib/refs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const rows = await db().select().from(series).where(eq(series.id, id)).limit(1);
  return { title: rows[0] ? `${rows[0].title} — 创作台` : "创作台" };
}

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db().select().from(series).where(eq(series.id, id)).limit(1);
  const s = rows[0];
  if (!s || !s.published) notFound();
  const episodes = await db()
    .select()
    .from(showcaseItems)
    .where(and(eq(showcaseItems.seriesId, id), eq(showcaseItems.published, true)))
    .orderBy(showcaseItems.sort);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-200">
          <ChevronLeft className="h-4 w-4" />
          返回首页
        </Link>
        <div className="flex items-start gap-4">
          {s.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(s.cover)} alt={s.title} className="h-28 w-44 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-400">
                <Layers className="h-4 w-4" />
              </span>
              <h1 className="truncate text-2xl font-semibold text-zinc-100">{s.title}</h1>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{s.description || "—"}</p>
            <p className="mt-2 text-xs text-zinc-600">{episodes.length} 集</p>
          </div>
        </div>

        <ul className="mt-8 space-y-3">
          {episodes.map((ep, i) => (
            <li key={ep.id}>
              <Link
                href={`/works/video/${ep.id}`}
                className="group flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 transition hover:border-indigo-600/60"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-zinc-800 text-sm font-semibold text-zinc-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-100 group-hover:text-indigo-300">{ep.title}</div>
                  {ep.description && <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{ep.description}</p>}
                </div>
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-indigo-600/20 text-indigo-300 opacity-0 transition group-hover:opacity-100">
                  <Play className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
