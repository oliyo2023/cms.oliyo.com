import { resolveVar } from "@/lib/config";
import { issueOAuthState, safeNext, siteUrl } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** GitHub 登录入口：发 state → 302 跳 GitHub 授权页。 */
export async function GET(req: Request) {
  const clientId = await resolveVar("GITHUB_CLIENT_ID");
  if (!clientId) return Response.redirect(new URL("/login?oauth_error=misconfigured&provider=github", req.url), 302);
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const { state, header } = await issueOAuthState(req, "github", next);
  const callback = `${siteUrl(req, await resolveVar("SITE_URL"))}/api/auth/github/callback`;
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("scope", "read:user user:email");
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), "Set-Cookie": header },
  });
}
