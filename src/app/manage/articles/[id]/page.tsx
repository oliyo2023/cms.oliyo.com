import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { getArticle } from "@/lib/repos/articles";
import Editor from "../editor";

export const dynamic = "force-dynamic";

export default async function ArticleEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (id === "new") {
    return <Editor articleJson="null" />;
  }
  const article = await getArticle(id);
  if (!article) redirect("/manage/articles");
  if (article.ownerId !== user.id && user.role !== "admin") redirect("/manage/articles");
  return <Editor articleJson={JSON.stringify(article)} />;
}
