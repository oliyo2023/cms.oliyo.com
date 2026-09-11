import { resolveVar } from "@/lib/config";
import { codeChallengeS256, issueOAuthState, newCodeVerifier, safeNext, siteUrl } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Google 登录入口：发 state + PKCE → 302 跳 Google 授权页。 */
export async function GET(req: Request) {
  const clientId = await resolveVar("GOOGLE_CLIENT_ID");
  if (!clientId) return Response.redirect(new URL("/login?oauth_error=misconfigured&provider=google", req.url), 302);
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const verifier = newCodeVerifier();
  const { state, header } = await issueOAuthState(req, "google", next, verifier);
  const callback = `${siteUrl(req, await resolveVar("SITE_URL"))}/api/auth/google/callback`;
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email profile");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", await codeChallengeS256(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("prompt", "select_account");
  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), "Set-Cookie": header },
  });
}
