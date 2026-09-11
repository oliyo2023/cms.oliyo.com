import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft } from "lucide-react";
import SiteHeader, { SiteFooter } from "@/components/site-header";
import { getArticle } from "@/lib/repos/articles";
import { mediaUrl } from "@/lib/refs";
import { getSiteSeo } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const a = await getArticle(id);
  return { title: a && a.status === "published" ? a.title : "文章" };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getArticle(id);
  if (!a || a.status !== "published") notFound();
  const seo = await getSiteSeo();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-200">
          <ChevronLeft className="h-4 w-4" />
          返回首页
        </Link>
        <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-white text-zinc-800">
          {a.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(a.cover)} alt={a.title} className="max-h-80 w-full object-cover" />
          )}
          <div className="px-7 py-8 sm:px-10">
            <h1 className="text-2xl font-bold leading-9 text-zinc-900">{a.title}</h1>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("zh-CN") : ""}
              <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-500">{seo.name}出品</span>
            </div>
            {a.summary && <p className="mt-4 text-sm leading-6 text-zinc-500">{a.summary}</p>}
            <div
              className="mt-6 border-t border-zinc-100 pt-6 [&_section]:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: a.contentHtml || "<p>（正文为空）</p>" }}
            />
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
