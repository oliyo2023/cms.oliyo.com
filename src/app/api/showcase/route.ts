import { currentUserFromRequest, fail, json } from "@/lib/api";
import {
  createShowcaseItem,
  listShowcaseItems,
  type Category,
} from "@/lib/repos/showcase";

export const dynamic = "force-dynamic";

const CATS: Category[] = ["gallery", "video", "episode"];

export async function GET(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const url = new URL(req.url);
  const cat = url.searchParams.get("cat");
  const seriesId = url.searchParams.get("series");
  const category = cat && CATS.includes(cat as Category) ? (cat as Category) : undefined;
  const items = await listShowcaseItems({
    ...(category ? { category } : {}),
    ...(seriesId ? { seriesId } : {}),
  });
  return json({ items });
}

export async function POST(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  let body: {
    category?: Category;
    title?: string;
    description?: string;
    media?: string;
    thumb?: string;
    shots?: string;
    seriesId?: string | null;
    sort?: number;
    published?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return fail(400, "请求格式错误");
  }
  const category = body.category;
  if (!category || !CATS.includes(category)) return fail(400, "缺少分类");
  const title = body.title?.trim() ?? "";
  if (!title) return fail(400, "请填写标题");
  const item = await createShowcaseItem({
    category,
    title,
    description: body.description ?? "",
    media: body.media ?? "",
    thumb: body.thumb ?? "",
    shots: body.shots ?? "[]",
    seriesId: body.seriesId ?? null,
    sort: body.sort ?? 0,
    published: body.published ?? true,
  });
  return json({ item }, { status: 201 });
}
