import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Film, ImageIcon, Layers, Newspaper, Play } from "lucide-react";
import SiteHeader, { SiteFooter } from "@/components/site-header";
import MotionRoot from "@/components/motion-root";
import Hero from "@/components/home/hero";
import WorksTrack, { type FeaturedWork } from "@/components/home/featured-works";
import { CursorSpotlight } from "@/components/home/effects";
import { Reveal, Tilt } from "@/components/home/reveal";
import { currentUser } from "@/lib/api";
import { listPublishedArticles } from "@/lib/repos/articles";
import { listShowcaseItems, seriesWithEpisodeCount } from "@/lib/repos/showcase";
import { getSiteSeo } from "@/lib/seo";
import { isVideoRef, mediaUrl } from "@/lib/refs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** 首页每类内容的首屏展示上限；超出部分在区块脚注中说明。 */
const LIMITS = { gallery: 12, series: 6, articles: 9, videos: 9 } as const;

export default async function HomePage() {
  const [videos, gallery, allSeries, articles, user] = await Promise.all([
    listShowcaseItems({ category: "video", publishedOnly: true }),
    listShowcaseItems({ category: "gallery", publishedOnly: true }),
    seriesWithEpisodeCount(),
    listPublishedArticles(60),
    currentUser(),
  ]);
  const publishedSeries = allSeries.filter((s) => s.published);
  const seo = await getSiteSeo();
  const canEdit = user !== null;

  // 首屏视频墙用成片素材：素材库没有静帧，背景只能用视频拼
  const heroTiles = videos.slice(0, 4).map((v) => mediaUrl(v.media)).filter(Boolean);

  const stats = [
    { label: "画廊", value: gallery.length, href: "#gallery" },
    { label: "剧集", value: publishedSeries.length, href: "#series" },
    { label: "文章", value: articles.length, href: "#articles" },
    { label: "视频成片", value: videos.length, href: "#videos" },
  ];

  const videoWorks: FeaturedWork[] = videos
    .map((v) => ({
      id: v.id,
      href: `/works/video/${v.id}`,
      title: v.title,
      subtitle: v.description || "—",
      media: mediaUrl(v.thumb || v.media),
      kind: "视频成片",
    }))
    .filter((w) => Boolean(w.media));

  return (
    <MotionRoot>
      <SiteHeader />
      <CursorSpotlight />
      <main className="pb-10">
        <Hero
          tiles={heroTiles}
          stats={stats}
          primaryHref={canEdit ? "/manage" : "/login?register=1"}
          primaryLabel={canEdit ? "进入控制台" : "开始创作"}
          browseHref="#gallery"
          siteName={seo.name}
        />

        <Section
          id="gallery"
          title="画廊"
          icon={<ImageIcon className="h-4 w-4" />}
          total={gallery.length}
          limit={LIMITS.gallery}
          empty="暂无画廊作品"
          editHref="/manage/showcase?tab=gallery"
          canEdit={canEdit}
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.slice(0, LIMITS.gallery).map((g, i) => (
              <li key={g.id}>
                <Reveal delay={Math.min(i * 0.04, 0.28)}>
                  <Tilt max={5}>
                    <Link
                      href={`/works/gallery/${g.id}`}
                      className="group relative block aspect-square overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition-colors duration-300 hover:border-indigo-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                    >
                      {g.media ? (
                        isVideoRef(g.media) ? (
                          <video
                            src={mediaUrl(g.media)}
                            muted
                            playsInline
                            preload="metadata"
                            aria-hidden="true"
                            tabIndex={-1}
                            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaUrl(g.media)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                          />
                        )
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-zinc-700" aria-hidden="true" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
                        <span className="block truncate text-sm font-medium text-white">{g.title}</span>
                      </span>
                    </Link>
                  </Tilt>
                </Reveal>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="series"
          title="剧集"
          icon={<Layers className="h-4 w-4" />}
          total={publishedSeries.length}
          limit={LIMITS.series}
          empty="暂无剧集"
          editHref="/manage/showcase?tab=series"
          canEdit={canEdit}
        >
          <ul className="grid gap-4 sm:grid-cols-2">
            {publishedSeries.slice(0, LIMITS.series).map((s, i) => (
              <li key={s.id}>
                <Reveal delay={Math.min(i * 0.06, 0.3)}>
                  <Tilt className="h-full">
                    <Link
                      href={`/series/${s.id}`}
                      className="group flex h-full gap-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 transition-colors duration-300 hover:border-indigo-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                    >
                      <span className="block w-32 shrink-0 overflow-hidden rounded-lg bg-zinc-950 sm:w-40">
                        {s.cover ? (
                          isVideoRef(s.cover) ? (
                            <video
                              src={mediaUrl(s.cover)}
                              muted
                              playsInline
                              preload="metadata"
                              aria-hidden="true"
                              tabIndex={-1}
                              className="aspect-video h-full w-full object-cover"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mediaUrl(s.cover)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="aspect-video h-full w-full object-cover"
                            />
                          )
                        ) : (
                          <span className="flex aspect-video h-full w-full items-center justify-center">
                            <Layers className="h-6 w-6 text-zinc-700" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-medium text-zinc-100 group-hover:text-indigo-300">
                            {s.title}
                          </h3>
                          <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            {s.episodeCount} 集
                          </span>
                        </span>
                        <span className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-400">
                          {s.description || "—"}
                        </span>
                      </span>
                    </Link>
                  </Tilt>
                </Reveal>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="articles"
          title="文章"
          icon={<Newspaper className="h-4 w-4" />}
          total={articles.length}
          limit={LIMITS.articles}
          empty="暂无文章"
          editHref="/manage/articles"
          canEdit={canEdit}
        >
          <ul className="divide-y divide-zinc-800/70 border-y border-zinc-800/70">
            {articles.slice(0, LIMITS.articles).map((a, i) => (
              <li key={a.id}>
                <Reveal delay={Math.min(i * 0.04, 0.24)} y={16}>
                  <Link
                    href={`/article/${a.id}`}
                    className="group grid gap-1 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 sm:grid-cols-[7rem_minmax(0,1fr)_5rem] sm:items-baseline sm:gap-5"
                  >
                    <span className="text-xs tabular-nums text-zinc-400">
                      {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("zh-CN") : ""}
                    </span>
                    <span className="min-w-0">
                      <h3 className="text-sm font-medium leading-6 text-zinc-100 group-hover:text-indigo-300">
                        {a.title}
                      </h3>
                      {a.summary && (
                        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-zinc-400">{a.summary}</span>
                      )}
                    </span>
                    <span className="hidden items-center gap-1 text-xs text-indigo-400/80 transition group-hover:text-indigo-300 sm:flex sm:justify-end">
                      阅读
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </Section>

        <WorksTrack
          id="videos"
          title="视频成片"
          icon={<Film className="h-4 w-4" />}
          description="横向滚动浏览全部成片"
          items={videoWorks}
          total={videos.length}
          limit={LIMITS.videos}
          empty="暂无视频成片"
          editHref="/manage/showcase?tab=video"
          canEdit={canEdit}
        />

        <Reveal className="mx-auto mt-4 max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
            <span aria-hidden="true" className="aurora aurora-1 -left-24 -top-32 h-80 w-80 opacity-70" />
            <span aria-hidden="true" className="aurora aurora-2 -bottom-32 -right-16 h-72 w-72 opacity-70" />
            <div className="relative">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">准备好开始创作了吗</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400">
                注册后即可使用 AI 生成图文、智能洗稿与公众号排版，作品会自动收录到展示页。
              </p>
              <Link
                href={canEdit ? "/manage" : "/login?register=1"}
                className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-colors duration-200 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              >
                {canEdit ? "进入控制台" : "开始创作"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Reveal>
      </main>
      <SiteFooter />
    </MotionRoot>
  );
}

/** 内容区块：统一的分隔线节奏 + 计数标题 + 截断说明 + 空态。 */
function Section({
  id,
  title,
  icon,
  total,
  limit,
  empty,
  editHref,
  canEdit,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  total: number;
  limit: number;
  empty: string;
  editHref: string;
  canEdit: boolean;
  children: ReactNode;
}) {
  const hidden = total - Math.min(total, limit);
  return (
    <section id={id} className="scroll-mt-20 border-t border-zinc-800/70 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mb-5">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-400"
              aria-hidden="true"
            >
              {icon}
            </span>
            <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
            <span className="text-sm tabular-nums text-zinc-400">{total}</span>
            {canEdit && (
              <Link href={editHref} className="ml-auto text-xs text-zinc-400 transition hover:text-indigo-300">
                管理 →
              </Link>
            )}
          </div>
        </Reveal>
        {total === 0 ? (
          <Empty text={empty} canEdit={canEdit} editHref={editHref} />
        ) : (
          <>
            {children}
            {hidden > 0 && (
              <p className="mt-4 text-xs text-zinc-400">
                共 {total} 件，此处展示前 {limit} 件。
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Empty({ text, canEdit, editHref }: { text: string; canEdit: boolean; editHref: string }) {
  return (
    <p className="mx-auto max-w-md rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-center text-xs text-zinc-400">
      {text}
      {canEdit ? (
        <>
          {" · "}
          <Link href={editHref} className="text-indigo-400 transition hover:underline">
            去发布 →
          </Link>
        </>
      ) : (
        <>
          {" · "}
          <Link href="/login" className="text-indigo-400 transition hover:underline">
            登录后发布 →
          </Link>
        </>
      )}
    </p>
  );
}
