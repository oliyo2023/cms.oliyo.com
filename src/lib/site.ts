/**
 * 站点绝对基址：固定配置优先，绝不从 Host 头推导（防回调劫持 / 素材地址伪造）。
 * OAuth 回调与视频生成的素材绝对化都需要它，故独立于 oauth 模块。
 */
export function siteUrl(req: Request, fallback: string | undefined): string {
  if (fallback) return fallback.replace(/\/$/, "");
  return new URL(req.url).origin;
}
