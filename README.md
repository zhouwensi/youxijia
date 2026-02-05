# 🎮 一句话游戏

一句话生成 HTML5 游戏的在线平台。使用 AI (DeepSeek/OpenAI) 将您的创意转化为可玩的游戏！

## ✨ 功能特点

- 🤖 **AI 生成游戏** - 一句话描述，自动生成完整的 HTML5 游戏
- 🎯 **多 LLM 支持** - 支持 DeepSeek、OpenAI 及自定义 API
- 💾 **云端存储** - 游戏自动保存，随时访问
- 🔗 **分享功能** - 生成链接，分享到微信、微博
- ✏️ **作者编辑** - 原作者可重新编辑游戏
- 📱 **移动适配** - 完美支持手机和微信浏览

## 🚀 Vercel 一键部署（推荐）

### 第一步：Fork 仓库

点击 GitHub 右上角的 Fork 按钮，将仓库 Fork 到你的账号。

### 第二步：创建 Vercel KV 数据库

1. 登录 [Vercel](https://vercel.com)
2. 进入 Dashboard → Storage → Create Database
3. 选择 **KV** (Redis)
4. 创建一个免费的数据库
5. 记录下数据库的连接信息

### 第三步：导入项目到 Vercel

1. 在 Vercel Dashboard 点击 **Add New → Project**
2. 选择你 Fork 的仓库
3. 配置环境变量（见下方）
4. 点击 **Deploy**

### 第四步：配置环境变量

在 Vercel 项目设置中添加以下环境变量：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `KV_URL` | Vercel KV 连接 URL | ✅ 是 |
| `KV_REST_API_URL` | Vercel KV REST API URL | ✅ 是 |
| `KV_REST_API_TOKEN` | Vercel KV REST API Token | ✅ 是 |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel KV 只读 Token | ✅ 是 |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（可选，用户也可自己配置）| ❌ 否 |

> 💡 **提示**: Vercel KV 的连接信息可以在 Storage → 你的数据库 → Settings 中找到。

### 完成！

部署成功后，你会获得一个 `https://your-project.vercel.app` 的地址。

---

## �️ 本地开发

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/ai-game-workshop.git
cd ai-game-workshop

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key

# 4. 启动服务器
npm start
```

### Windows 用户

直接双击运行：
1. `install.bat` - 安装依赖
2. `start.bat` - 启动服务器

---

## 🔧 环境变量说明

### 本地开发 (.env 文件)

```env
# DeepSeek API 配置（推荐）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 服务器端口（可选）
PORT=80
```

### Vercel 部署

除了上述变量外，还需要配置 Vercel KV 相关变量（自动生成）。

---

## 📁 项目结构

```
ai-game-workshop/
├── api/                    # Vercel Serverless Functions
│   ├── _lib/              # 共享库
│   │   └── db.js          # 数据库操作（Vercel KV）
│   ├── games/             # 游戏相关 API
│   │   ├── [id]/          # 动态路由
│   │   │   ├── index.js   # 获取/更新游戏
│   │   │   ├── like.js    # 点赞
│   │   │   └── verify.js  # 验证作者
│   │   ├── search/        # 搜索
│   │   ├── featured.js    # 推荐游戏
│   │   ├── recent.js      # 最近游戏
│   │   └── index.js       # 创建游戏
│   └── generate.js        # AI 生成游戏
├── public/                 # 静态文件
│   ├── css/
│   ├── js/
│   └── index.html
├── server.js              # 本地开发服务器
├── vercel.json            # Vercel 配置
└── package.json
```

---

## 🎯 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/generate` | POST | 生成游戏 |
| `/api/games` | POST | 保存游戏 |
| `/api/games/recent` | GET | 最近游戏列表 |
| `/api/games/featured` | GET | 推荐游戏列表 |
| `/api/games/search/:keyword` | GET | 搜索游戏 |
| `/api/games/:id` | GET | 获取游戏详情 |
| `/api/games/:id` | PUT | 更新游戏 |
| `/api/games/:id/like` | POST | 点赞游戏 |
| `/api/games/:id/verify` | POST | 验证作者权限 |

---

## 🔒 安全说明

- API Key 存储在环境变量中，不会暴露到前端
- 用户可以使用自己的 API Key（存储在浏览器本地）
- 作者令牌用于验证编辑权限

---

## � 使用的技术

- **前端**: 原生 HTML/CSS/JavaScript
- **后端**: Vercel Serverless Functions
- **数据库**: Vercel KV (Redis)
- **AI**: DeepSeek / OpenAI API

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License