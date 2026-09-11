import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import SiteHeader, { SiteFooter } from "@/components/site-header";
import { getShowcaseItem } from "@/lib/repos/showcase";
import { mediaUrl } from "@/lib/refs";

export const dynamic = "force-dynamic";

type Params = { category: string; id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, id } = await params;
  if (category !== "gallery" && category !== "video") return { title: "作品" };
  const item = await getShowcaseItem(id);
  return { title: item ? item.title : "作品" };
}

export default async function WorkPage({ params }: { params: Promise<Params> }) {
  const { category, id } = await params;
  if (category !== "gallery" && category !== "video") notFound();
  const item = await getShowcaseItem(id);
  if (!item || !item.published) notFound();
  const isVideo = category === "video";
  const src = mediaUrl(item.media);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-200">
          <ChevronLeft className="h-4 w-4" />
          返回首页
        </Link>
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black">
          {isVideo ? (
            <video src={src} controls className="max-h-[70vh] w-full" poster={item.thumb ? mediaUrl(item.thumb) : undefined} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={item.title} className="mx-auto max-h-[70vh] w-auto" />
          )}
        </div>
        <div className="mt-6">
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-600/15 px-2 py-0.5 text-[11px] text-indigo-300">
              {category === "video" ? "视频成片" : "画廊"}
            </span>
            <h1 className="text-xl font-semibold text-zinc-100">{item.title}</h1>
          </div>
          {item.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-400">{item.description}</p>}
          <p className="mt-4 text-xs text-zinc-600">
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("zh-CN") : ""}
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
