import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { btnPrimary } from "@/components/ui";
import { currentUser } from "@/lib/api";
import { listArticles } from "@/lib/repos/articles";
import ArticlesClient from "./client";

export const dynamic = "force-dynamic";

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const showAll = user.role === "admin" && sp.all === "1";
  const rows = await listArticles(showAll ? {} : { ownerId: user.id });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">公众号文章</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {showAll ? "全部成员的文章（管理员视图）" : "我的文章与草稿；进入编辑器排版后复制到公众号。"}
          </p>
        </div>
        <Link href="/manage/articles/new" className={btnPrimary}>
          <Plus className="h-4 w-4" />
          新建文章
        </Link>
      </header>
      <ArticlesClient initialJson={JSON.stringify(rows)} isAdmin={user.role === "admin"} showAll={showAll} />
    </div>
  );
}
