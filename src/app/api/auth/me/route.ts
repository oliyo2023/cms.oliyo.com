import { currentUserFromRequest, fail, json } from "@/lib/api";
import { publicUser } from "@/lib/repos/settings";
import { usageThisMonth } from "@/lib/repos/quota";

export async function GET(req: Request) {
  const user = await currentUserFromRequest(req);
  if (!user) return fail(401, "未登录");
  const [textChars, rewriteChars, images, videos] = await Promise.all([
    usageThisMonth(user.id, "text_chars"),
    usageThisMonth(user.id, "rewrite_chars"),
    usageThisMonth(user.id, "images"),
    usageThisMonth(user.id, "videos"),
  ]);
  return json({
    user: publicUser(user),
    usage: { textChars, rewriteChars, images, videos },
  });
}
