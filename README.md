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

## 提交与推送

```bash
pnpm ship -m "<提交说明>" -- <改动的文件...>
```

一条命令完成 **类型检查 → 暂存指定文件 → 提交 → 推送**：

- 先跑 `pnpm typecheck`，不通过就中止，不产生提交（确实要跳过时加 `--skip-checks`）。
- 只暂存 `--` 之后列出的文件，避免把并发编辑中的半成品一起提交；不传文件则暂存全部改动并给出警告。
- 拒绝暂存 `.env*`、`.dev.vars`、`dev-data/`、`.wrangler/`、`.commandcode/`、`*.pem`、`*.key` 等敏感路径。
- 无 upstream 的分支自动 `push -u origin <分支>`。

编码代理的自动收尾约定写在 `.omp/rules/auto-ship.md`（always-apply 规则）：任务改动了文件即自行 `pnpm ship`，无需额外交代；删除该文件即可关闭。

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

推送到 `main` 由 GitHub Actions 自动构建并部署（`.github/workflows/deploy.yml`），也可在 Actions 页面手动触发。
生产地址：<https://ai-wechat-cms.oliyo.workers.dev>

### 已绑定的资源（写在 `wrangler.jsonc`，均非密钥）

| 绑定 | 资源 |
| --- | --- |
| Worker | `ai-wechat-cms` |
| `DB` | D1 `ai-wechat-cms`（`220cb18f-4bb1-46d4-aa20-1a1e79dd1e5e`） |
| `MEDIA` | R2 `ai-wechat-cms-media` |
| `NEXT_INC_CACHE_R2_BUCKET` | R2 `ai-wechat-cms-opennext-cache` |
| `WORKER_SELF_REFERENCE` | `ai-wechat-cms`（绑到自己，OpenNext 需要） |

> 该 D1 原先属于早期 `ai-wechat-cms` 应用，其表结构与本项目不兼容，已清理后重新迁移。
> 旧表结构与数据备份在 `dev-data/d1-backup/`（不入库）。

### CI 前置：配置仓库 secrets

Settings → Secrets and variables → Actions：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | 部署凭据，需 Workers Scripts:Edit、D1:Edit、R2:Edit 权限 |
| `CLOUDFLARE_ACCOUNT_ID` | 目标账户（`cf27b7d24f93d064d112620267c93645`） |

### 首次部署后的一次性设置

1. **模型密钥**（不配则 AI 功能报「未配置」）：`pnpm exec wrangler secret put AGNES_API_KEY`
   （或在后台「系统设置」页保存到 D1 `settings` 表，优先级更高）。
2. **管理员账号**：生产 D1 初始无用户。`REGISTRATION_OPEN=true` 时可在 `/login?register=1` 注册，
   但注册出来的是普通用户（`role='user'`）。首个管理员需手工提升：

   ```bash
   pnpm exec wrangler d1 execute ai-wechat-cms --remote \
     --command "UPDATE users SET role='admin' WHERE email='you@example.com';"
   ```

### 手动部署

```bash
pnpm db:remote      # 应用 drizzle 迁移到远端 D1（结构变更需人工确认，CI 不自动执行）
pnpm run deploy     # opennextjs-cloudflare build && wrangler deploy
```

> 注意：不要用 `pnpm deploy`——那是 pnpm 内置的 workspace 部署命令，会静默走错分支。
> 仓库脚本一律用 `pnpm run <script>` 调用。

敏感变量用 `wrangler secret put <NAME>` 配置；`wrangler.jsonc` 的 `vars` 只放非敏感项。

## 目录结构

```
src/app/            路由（公开站 / manage 管理端 / api）
src/components/     共享组件（Modal、站点头尾、首页区块）
src/lib/            auth / oauth / config / db(D1) / repos(Drizzle)
drizzle/            迁移 SQL（0001 初始结构、0002 oauth_accounts）
scripts/            本地迁移、种子、AI stub（E2E 用）、ship（提交推送）
.omp/rules/         编码代理规则（auto-ship：收尾自动提交推送）
```

## License

[MIT](./LICENSE) © oliyo2023
