# 一句话游戏

用 AI（DeepSeek / OpenAI 等）把一句话描述变成可玩的 HTML5 小游戏。**正式线上环境不依赖你自备的物理机或本机长期跑 Node**：网站走静态托管，接口走 **Cloudflare Worker**；微信小程序请求同一套 API 域名。

## 推荐架构（无自有服务器）

| 部分 | 部署方式 | 说明 |
|------|----------|------|
| 网站 | **GitHub Pages**（`public/` 构建产物） | Actions 见 `.github/workflows/pages.yml` |
| API | **Cloudflare Worker**（`worker/`） | 子域示例：`https://api.yijuhuayouxi.com` |
| 小程序 | 微信上传 | `miniprogram/app.js` 里 `baseUrl` / `webUrl` 与合法域名、业务域名一致 |

详细密钥与开关：**[DEPLOY.md](./DEPLOY.md)**。

构建时会把 `public/js/api-base.js` 写成带 `window.__API_BASE__` 的脚本，供浏览器把 `/api/...` 指到 Worker：

- 未设置环境变量 **`API_BASE_URL`** 时，**默认**为 `https://api.yijuhuayouxi.com`（与 `build.js` 一致）。
- 若要与页面**同域**调 API（例如本地 `npm start` 只开 Node），请在构建前设置：`API_BASE_URL=`（空字符串）或省略由 `.env` 覆盖（`build.js` 会尝试 `dotenv`）。

```bash
npm ci
npm run build   # 生成 api-base.js + 混淆 public/js
```

---

## 可选：其它部署方式

- **Vercel**（Serverless + KV）、**Railway / Render**（`server.js` 长驻 Node）仍保留在仓库中，适合 fork 后自选托管商；**它们也不是「必须有一台你家服务器」**，只是另一种后端形态。
- 本地调试：`npm start` + `.env`（见 `.env.example`）。

---

## 功能概览

- AI 生成游戏、多模型、云端存游戏（Worker + KV）
- 分享链接、移动端适配
- 微信小程序（`miniprogram/`，详见其 [README](./miniprogram/README.md)）

---

## 目录结构（节选）

```
├── worker/           # Cloudflare Worker（线上 API）
├── public/           # 静态前端（Pages 发布此目录构建结果）
├── src/js/           # 前端源码（构建进 public/js）
├── miniprogram/      # 微信小程序
├── api/              # Vercel Serverless（可选）
├── server.js         # 可选 Node 一体化服务（本地或其它 PaaS）
└── build.js          # 混淆 + 写入 api-base.js
```

---

## API 说明

接口路径以 `/api/` 为前缀；浏览器端通过 `resolveApiUrl()` 拼到 `__API_BASE__`。主要路由见 **[DEPLOY.md](./DEPLOY.md)** 与 `worker/src/index.js`。

---

## 安全

- 密钥勿提交仓库；历史若曾泄露请轮换（见 **SECURITY.md**）。

---

## 贡献与许可证

欢迎 Issue / PR。MIT License。
