# 游戏家 - AI 游戏生成平台

## Pages + Worker：只能你本人完成的操作

其余（改代码、push、Worker 部署、防再次提交 `.env`）已由仓库内 workflow 自动化。

1. **密钥只放在平台，不进 Git**  
   - GitHub **Settings → Secrets → Actions**：`CLOUDFLARE_API_TOKEN`、`CF_KV_NAMESPACE_ID`；可选 `WX_APPSECRET`、`DEEPSEEK_API_KEY`、**`ADMIN_KEY`**（管理后台 `/admin.html`）。  
   - 本地开发：自己维护 **`.env`**（从 `.env.example` 复制），**勿提交**。若曾泄露：**微信公众平台重置 AppSecret**，并换新 `ADMIN_KEY` 等（见 `SECURITY.md`）。
2. **微信小程序**：**服务器域名** 与 `miniprogram/app.js` 里 `baseUrl` 一致（如 `https://api.yijuhuayouxi.com`）。  
3. **GitHub Pages**（要自动发站时）：**Settings → Pages → Source：GitHub Actions**。

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

`games.db` 已加入 `.gitignore` 且**不再纳入 Git 跟踪**；新克隆仓库后首次 `npm start` 会自动生成 SQLite 文件（或按你现有迁移流程导入）。

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

---


## ☁️ 部署到 Cloudflare Pages + D1（推荐：无自有服务器）

与 `xiyouce` 相同思路：**静态资源走 `public/`，API 走 `functions/api`，数据在 D1**，域名可绑 Cloudflare 或自定义域；小程序 `baseUrl` 指向同一域名即可（需在小程序后台配置 request 合法域名）。

### 1. 本机一次性准备

```bash
npm install
npm run login
npm run cf:provision
npm run cf:db:remote
```

在 Cloudflare 控制台为 Pages 项目绑定 D1（若控制台提示未绑定，选择与 `wrangler.toml` 中一致的 `youxijia-db`）。

**若 `api.*` 自定义域仍绑在旧 Worker（`worker/wrangler.toml` 的 KV Worker）上**，而小程序微信登录已走 **Pages Functions + D1**，会出现「能登录但改昵称 401/失败」：请在旧 Worker 的环境变量中设置 **`PAGES_API_ORIGIN`**（例如 `https://youxijia.pages.dev`，与当前 Pages 项目子域一致），使 `POST /api/wechat/login`、`GET /api/account`、`PUT /api/account/nickname` 转发到 Pages；**更推荐**将 api 子域改为只指向 Pages 项目，下线该 Worker 路由。

### 2. 大模型 API Key（二选一或同时）

- **推荐**：`npx wrangler secret put LLM_DEFAULT_API_KEY`（生产密钥，不写进仓库）
- 或在 D1 表 `system_config` 中维护 `llm_default_api_key`（适合后台改配置）

可选：`npx wrangler secret put LLM_DEFAULT_BASE_URL` 覆盖默认 OpenAI 兼容基址。

### 3. 部署

```bash
npm run cf:deploy
```

### 4. GitHub Actions

仓库 Settings → Secrets → 添加 `CLOUDFLARE_API_TOKEN`（需含 D1、Pages 写权限）。推送 `main`/`master` 时工作流会执行 `npm ci`、`npm run build`、远程 D1 迁移与 `pages deploy`。

**从旧 SQLite 迁数据**：用 `wrangler d1 execute youxijia-db --remote --file=...sql` 或导出 `games.db` 为 SQL 后导入（注意与 `migrations/0001_init.sql` 表结构一致）。

---


## GitHub Pages + Cloudflare Worker（推荐：无自有服务器）

架构：**静态站点**（`public/`）由 GitHub Actions 发布到 Pages；**API** 在 Cloudflare Worker（建议子域 `api.yijuhuayouxi.com`）。`npm run build` 未设置 `API_BASE_URL` 时也会默认写入该 API 地址到 `public/js/api-base.js`，静态站不再误走「同域 /api」从而依赖本机 Node。

**与旧自建机 / 游戏墓地**：按推荐方式部署时，**不依赖**原先那台 VPS 或同机反代。游戏墓地（youximudi）已可单独用 GitHub Pages 发布（见其仓库 `README.md`）。本仓库根目录的 `server.js` 里曾有「`youximudi.com` → 本机端口」反代，现已改为**仅当**在 `.env` 中显式设置 `YOUXIMUDI_UPSTREAM` 才启用；默认不假设本机跑着墓地服务。

### 1. Worker（`worker/` 目录）

```bash
cd worker
npm install
npx wrangler kv namespace create USER_KV
```

将 `wrangler.toml` 里 `REPLACE_WITH_KV_NAMESPACE_ID` 换成上一步输出的 **production** id。

```bash
npx wrangler secret put DEEPSEEK_API_KEY   # 默认 LLM；不配则生成接口需用户自带 Key
npx wrangler secret put WX_APPSECRET      # 小程序正式登录必填
npx wrangler secret put ADMIN_KEY         # 管理后台密钥（与本地 .env 的 ADMIN_KEY 可相同或不同）
```

在 `wrangler.toml` 的 `[vars]` 中填写 `WX_APPID`（AppId 可公开）。部署：

```bash
npx wrangler deploy
```

在 Cloudflare 控制台为该 Worker 绑定自定义域 **`api.yijuhuayouxi.com`**（或你在 `ALLOWED_ORIGINS` 里允许的 API 域）。

#### Worker 管理后台（`public/admin.html`）

- 浏览器打开 **`https://你的站点域名/admin.html`**（与首页同源，由 Pages 托管）。
- 页面已通过 **`/js/api-base.js`** 把 `/api/admin/*` 请求发到 **Worker API 域名**，不再误请求 Pages 上的 `/api`。
- 在 Worker 配置 **`ADMIN_KEY`**（`wrangler secret put ADMIN_KEY` 或 GitHub Actions Secret 同名）后，用该密钥登录。
- **已实现（KV）**：概览统计、站点配置读写（存 KV `admin:system_config`）、游戏列表/推荐与隐藏/删除、源码下载、模型列表展示、登录统计与安全日志占位等。
- **未迁移（仍为 501）**：依赖 SQLite 的用户管理、积分工具、评论后台、封禁、静态文件批量生成等；需使用本地 **`server.js`** 或后续继续移植。

#### Worker 侧 LLM（生成游戏）

- **`DEEPSEEK_API_KEY`**（Secret）：写入 Worker 后，`/api/generate` 在用户未自带 `llmConfig.apiKey` 时作为默认 Key 调用 DeepSeek（见 `worker/src/generate.js`）。
- 可选在 **`wrangler.toml` 的 `[vars]`** 增加 `DEEPSEEK_BASE_URL` 指向兼容 OpenAI 格式的网关（默认 `https://api.deepseek.com`）。
- 前端「自定义接口 / 自带 Key」仍会随请求体传入 `llmConfig`，优先于环境变量。

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
| Secret | `ADMIN_KEY` | 管理后台密钥（可选；不配则 `/admin.html` 无法通过 Worker 校验） |
| Variable | `WX_APPID` | 小程序 AppID（可选；与 `WX_APPSECRET` 成对使用） |

说明：流水线会在构建时用 `CF_KV_NAMESPACE_ID` **替换** `wrangler.toml` 里的占位符；**仓库里的 `wrangler.toml` 仍可保留 `REPLACE_WITH_KV_NAMESPACE_ID`**，勿把真实 id 提交进公开仓库。

### 2. GitHub Pages

仓库 **Settings → Pages**：**Build and deployment** 里 **Source 必须选 GitHub Actions**（不要停留在 “Deploy from a branch”）。**未切换时**，`deploy` 任务常会报 `Resource not found` / `Creating pages deployment failed`。

推送 `main`/`master` 后工作流会执行 `npm ci`、`npm run build`（`NODE_ENV=production`），并把 **`public/`** 作为站点根目录上传。

构建时会写入 `public/js/api-base.js` 中的 **`API_BASE_URL`**（工作流里默认为 `https://api.yijuhuayouxi.com`）。若你的 API 域名不同，请编辑 `.github/workflows/pages.yml` 中的 `API_BASE_URL`。

另：**Settings → Actions → General → Workflow permissions** 建议为 **Read and write**（或保持默认由 workflow 内 `permissions` 声明）；组织若强制只读，需放行 `pages: write` / `id-token: write`。

仓库已包含 **`public/CNAME`**（`www.yijuhuayouxi.com`）与 **`public/.nojekyll`**，推送到 `main` 后由 Pages 工作流一并发布，便于 GitHub 识别自定义域。

#### 关本机 / 停掉 `start.bat` 后，https://www.yijuhuayouxi.com 打不开？

这与**代码无关**，几乎都是 **DNS 仍指向你的电脑或旧 VPS**。`start.bat` 只会打开 **http://localhost**，正式站必须走公网域名 + **GitHub Pages**。

请按顺序自检（在域名 DNS 托管处操作，常见为 **Cloudflare** 或与注册商处）：

1. **不要用内网或本机地址访问**  
   收藏夹里若是 `http://localhost`、`http://127.0.0.1` 或 `http://192.168.x.x`，关电脑后必然打不开；请改用 **`https://www.yijuhuayouxi.com`**。

2. **删掉指向旧服务器 / 家里宽带的 A 记录**  
   若 **`@`（根域）或 `www` 的 A 记录** 仍是你以前那台机器或路由器的公网 IP，关那台机后网站即挂。**只走 GitHub Pages 时，根域不要再用这些 A。**

3. **按 GitHub 官方要求改指向 Pages**（与 [GitHub 文档](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain) 一致）  
   - **根域 `yijuhuayouxi.com`（@）**：添加 **4 条 A 记录**，分别为 `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`。  
   - **`www`**：一条 **CNAME**，指向 **`zhouwensi.github.io`**（不要带 `https://` 和路径；仓库名为 `youxijia` 时，项目站即挂在此用户名下）。  

4. **GitHub 仓库侧**  
   **Settings → Pages → Custom domain** 填写 `www.yijuhuayouxi.com`（或根域，与 DNS 一致），保存后等待校验通过，再勾选 **Enforce HTTPS**。

5. **Cloudflare 橙云**  
   若校验或证书长期异常，可先将上述 A / CNAME 设为 **仅 DNS（灰云）**，通过后再按需开代理。

6. **本机 `hosts`**  
   若曾把 `yijuhuayouxi.com` 指到 `127.0.0.1`，删除该条后再试。

确认 **Actions → Deploy GitHub Pages** 最近一次为成功（绿勾）后，再访问自定义域。

### 3. 微信小程序

1. 公众平台 → **开发管理 → 服务器域名**：将 **`https://api.yijuhuayouxi.com`**（或你的 Worker 域）加入 **request 合法域名**。
2. 小程序内 `miniprogram/app.js` 已默认 `baseUrl` 指向 `https://api.yijuhuayouxi.com`，`webUrl` 指向网站 `https://www.yijuhuayouxi.com`；按实际域名改好后重新上传代码。

### 4. 说明

- 当前 Worker 已实现：**健康检查、站点配置、`/api/generate`、微信登录（KV 用户）、大量只读桩接口**；**游戏库、编辑、管理后台等**仍返回空数据或 501，需后续接 D1/R2 或从旧 `server.js` 逐步迁移。
- 旧 **`games.db` / `public/g/`** 可按需做一次性导入（不在本流程内自动完成）。

