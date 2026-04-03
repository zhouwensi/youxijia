# 游戏家 - AI 游戏生成平台

## Pages + Worker：只有这些必须你本人点（无法由脚本代填）

以下涉及**你的账号与密钥**，任何人/CI 都**不能**替你完成，除此之外推送 `main` 后会自动部署 Worker 与（可选）Pages。

1. **GitHub** → 仓库 **Settings → Secrets and variables → Actions**，新建 Secret：  
   - `CLOUDFLARE_API_TOKEN`：Cloudflare **API 令牌**里用模板「编辑 Cloudflare Workers」生成后**整串粘贴**（只显示一次）。  
   - `CF_KV_NAMESPACE_ID`：`wrangler kv namespace create` 得到的 **KV id**（若已加可忽略）。  
2. **微信小程序** → **开发管理 → 服务器域名** → **request 合法域名** 添加 `https://api.yijuhuayouxi.com`（与 `miniprogram/app.js` 的 `baseUrl` 一致）。  
3. **GitHub Pages**（若要自动发布网站）：仓库 **Settings → Pages** → **Source** 选 **GitHub Actions**（只需设一次）。

---

## 🚀 部署到 Railway

### 1. 准备工作
- 注册 [Railway](https://railway.app/) 账号
- 将代码推送到 GitHub

### 2. 一键部署
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/youxijia)

或者手动部署：
1. 登录 Railway
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择你的仓库
4. Railway 会自动检测 Node.js 项目并部署

### 3. 配置环境变量
在 Railway 项目设置中添加：
- `ADMIN_KEY`: 管理员密钥
- `TRIAL_API_KEY`: 体验模式 API Key（可选，可在后台配置）
- `PORT`: 80（Railway 会自动设置）

### 4. 持久化存储
Railway 提供持久化存储，SQLite 数据库会自动保存。

---

## 🌐 部署到 Render

### 1. 创建 render.yaml
已包含在项目中。

### 2. 连接 GitHub
1. 登录 [Render](https://render.com/)
2. 点击 "New" → "Web Service"
3. 连接你的 GitHub 仓库
4. Render 会自动使用 `render.yaml` 配置

---

## 💻 本地开发

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 访问
open http://localhost:80
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | 80 |
| `ADMIN_KEY` | 管理员密钥 | - |
| `TRIAL_API_KEY` | 体验模式 API Key | - |
| `DEEPSEEK_API_KEY` | 备用 API Key | - |

---

## GitHub Pages + Cloudflare Worker（推荐：无自有服务器）

架构：**静态站点**（`public/`）由 GitHub Actions 发布到 Pages；**API** 在 Cloudflare Worker（建议子域 `api.yijuhuayouxi.com`）。

### 1. Worker（`worker/` 目录）

```bash
cd worker
npm install
npx wrangler kv namespace create USER_KV
```

将 `wrangler.toml` 里 `REPLACE_WITH_KV_NAMESPACE_ID` 换成上一步输出的 **production** id。

```bash
npx wrangler secret put DEEPSEEK_API_KEY   # 或依赖用户自带 Key 调 /api/generate
npx wrangler secret put WX_APPSECRET      # 小程序正式登录必填
```

在 `wrangler.toml` 的 `[vars]` 中填写 `WX_APPID`（AppId 可公开）。部署：

```bash
npx wrangler deploy
```

在 Cloudflare 控制台为该 Worker 绑定自定义域 **`api.yijuhuayouxi.com`**（或你在 `ALLOWED_ORIGINS` 里允许的 API 域）。

#### 一次性：本机登录（仅当你选择本地部署时）

```bash
cd worker && npx wrangler login
```

之后可在本机执行 `npx wrangler deploy`；**若使用下方 GitHub Actions，可不必本机登录。**

#### GitHub Actions 自动部署 Worker（推荐）

工作流：`.github/workflows/cloudflare-worker.yml`。修改 **`worker/`** 下文件并推送到 **`main` / `master`** 即会部署（也可在 Actions 里 **Run workflow** 手动触发）。

**仓库 Settings → Secrets and variables → Actions**

| 类型 | 名称 | 说明 |
|------|------|------|
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare 个人资料 → API Tokens，模板选 **Edit Cloudflare Workers** 或自定义含 Workers 编辑权限 |
| Secret | `CF_KV_NAMESPACE_ID` | 先在本地或任意环境执行一次 `npx wrangler kv namespace create USER_KV`，把输出的 **id** 粘到这里（勿提交进 Git） |
| Secret | `WX_APPSECRET` | 小程序 AppSecret（可选；不配则 Worker 内为 mock 微信登录） |
| Secret | `DEEPSEEK_API_KEY` | 默认 LLM Key（可选；不配则仅靠用户自带 Key 调生成） |
| Variable | `WX_APPID` | 小程序 AppID（可选；与 `WX_APPSECRET` 成对使用） |

说明：流水线会在构建时用 `CF_KV_NAMESPACE_ID` **替换** `wrangler.toml` 里的占位符；**仓库里的 `wrangler.toml` 仍可保留 `REPLACE_WITH_KV_NAMESPACE_ID`**，勿把真实 id 提交进公开仓库。

### 2. GitHub Pages

仓库 **Settings → Pages**：**Build and deployment** 里 **Source 必须选 GitHub Actions**（不要停留在 “Deploy from a branch”）。**未切换时**，`deploy` 任务常会报 `Resource not found` / `Creating pages deployment failed`。

推送 `main`/`master` 后工作流会执行 `npm ci`、`npm run build`（`NODE_ENV=production`），并把 **`public/`** 作为站点根目录上传。

构建时会写入 `public/js/api-base.js` 中的 **`API_BASE_URL`**（工作流里默认为 `https://api.yijuhuayouxi.com`）。若你的 API 域名不同，请编辑 `.github/workflows/pages.yml` 中的 `API_BASE_URL`。

另：**Settings → Actions → General → Workflow permissions** 建议为 **Read and write**（或保持默认由 workflow 内 `permissions` 声明）；组织若强制只读，需放行 `pages: write` / `id-token: write`。

### 3. 微信小程序

1. 公众平台 → **开发管理 → 服务器域名**：将 **`https://api.yijuhuayouxi.com`**（或你的 Worker 域）加入 **request 合法域名**。
2. 小程序内 `miniprogram/app.js` 已默认 `baseUrl` 指向 `https://api.yijuhuayouxi.com`，`webUrl` 指向网站 `https://www.yijuhuayouxi.com`；按实际域名改好后重新上传代码。

### 4. 说明

- 当前 Worker 已实现：**健康检查、站点配置、`/api/generate`、微信登录（KV 用户）、大量只读桩接口**；**游戏库、编辑、管理后台等**仍返回空数据或 501，需后续接 D1/R2 或从旧 `server.js` 逐步迁移。
- 旧 **`games.db` / `public/g/`** 可按需做一次性导入（不在本流程内自动完成）。
