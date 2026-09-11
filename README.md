# 创作台 cms.oliyo.com

AI 内容创作与作品展示平台：AI 生成图文、智能洗稿、公众号排版，产出在公开站以画廊 / 剧集 / 文章 / 视频成片的形式展示。

## 功能

**公开站**

- 首页聚合：分类计数锚点导航 + 各内容区块（画廊方图、剧集横卡、文章列表、视频网格）
- 文章、剧集（含单集）、画廊作品、视频成片详情页

**创作台（登录后）**

- AI 图文：生成文章 / 配图 / 视频，SSE 流式输出
- 智能洗稿、公众号排版（微信排版样式 `.wx-content`）
- 素材库：R2 存储的图片 / 视频素材管理
- 历史记录：AI 操作留痕与结果回看

**管理端（仅 admin）**

- 用户与配额：按用户管理四类配额（文本 / 洗稿 / 图片 / 视频），用量进度条，配额弹窗
- 系统设置：模型凭据与参数 + 账户安全（修改密码），密钥仅管理员可改，保存即时生效
- 第三方登录配置：GitHub / Google OAuth 全部后台可配（含密钥，读取脱敏）

**认证**

- 邮箱密码：PBKDF2-SHA256（10 万次迭代）+ HttpOnly 会话 cookie（30 天）
- GitHub / Google OAuth：PKCE（Google）、HMAC 签名 state（绑定 provider / next / 过期），
  仅接受已验证邮箱，同邮箱自动绑定，一个账号可绑多个 provider
- 登录入口按「是否已配置 Client ID」自动显隐，无需重启

## 技术栈

- Next.js 16（App Router, RSC）+ React 19 + Tailwind CSS 4
- Cloudflare Workers（OpenNext 适配）+ D1（SQLite / Drizzle ORM）+ R2（素材存储）
- motion（Framer Motion）、lucide-react

## 本地开发

```bash
pnpm install
pnpm dev          # predev 自动跑 scripts/migrate-dev.ts，建 dev-data/dev.db
pnpm seed         # 种子管理员（ADMIN_EMAIL / ADMIN_PASSWORD，见 .dev.vars.example）
pnpm typecheck
```

打开 http://localhost:3000 。`dev-data/`、`.env.local`、`.dev.vars` 均不入库（见 `.gitignore`）。

## 配置

优先级：**管理端设置页（D1 `settings` 表） > 部署环境变量/Secret > 内置默认**。

| 用途 | 变量 | 说明 |
| --- | --- | --- |
| AI 模型 | `AGNES_API_KEY`、`LLM_*`、`IMAGE_*`、`VIDEO_*` | 共享 Key + 分模型覆盖，见 `.dev.vars.example` |
| 第三方登录 | `SITE_URL`、`OAUTH_STATE_SECRET`、`GITHUB_CLIENT_ID/SECRET`、`GOOGLE_CLIENT_ID/SECRET` | 全部可在后台「系统设置 → 第三方登录」配置 |
| 注册 | `REGISTRATION_OPEN`、`NEW_USER_*_QUOTA` | 注册开关与新用户默认配额 |
| 种子管理员 | `ADMIN_EMAIL`、`ADMIN_PASSWORD` | 仅 `pnpm seed` 使用 |

### OAuth 接入步骤

1. GitHub：<https://github.com/settings/developers> 建 OAuth App，回调 `https://<域名>/api/auth/github/callback`
2. Google：<https://console.cloud.google.com/apis/credentials> 建 OAuth Client（Web），
   回调 `https://<域名>/api/auth/google/callback`，scope 仅 `openid email profile`
3. 把 Client ID / Secret 填入后台「系统设置 → 第三方登录」（或用 `wrangler secret put`），
   生成一个 ≥32 位随机串填入「State 签名密钥」，`SITE_URL` 填生产域名

安全设计：state 经 HMAC 签名且绑定 provider；Google 走 PKCE；只信任 provider 侧已验证邮箱
（未验证邮箱的「同邮箱自动绑定」会被拒绝，防账号接管）；Client Secret 读取接口只返回尾号。

## 部署（Cloudflare）

```bash
pnpm db:remote     # 应用 drizzle 迁移到远端 D1
pnpm deploy        # opennextjs-cloudflare build && wrangler deploy
```

敏感变量用 `wrangler secret put <NAME>` 配置；`wrangler.jsonc` 的 `vars` 只放非敏感项。

## 目录结构

```
src/app/            路由（公开站 / manage 管理端 / api）
src/components/     共享组件（Modal、站点头尾、首页区块）
src/lib/            auth / oauth / config / db(D1) / repos(Drizzle)
drizzle/            迁移 SQL（0001 初始结构、0002 oauth_accounts）
scripts/            本地迁移、种子、AI stub（E2E 用）
```

## License

[MIT](./LICENSE) © oliyo2023
