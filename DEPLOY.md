# 游戏家 - AI 游戏生成平台

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
- `PORT`: 3000（Railway 会自动设置）

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
open http://localhost:3000
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `ADMIN_KEY` | 管理员密钥 | - |
| `TRIAL_API_KEY` | 体验模式 API Key | - |
| `DEEPSEEK_API_KEY` | 备用 API Key | - |
