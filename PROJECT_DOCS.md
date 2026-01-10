# 🎮 AI游戏工坊 - 项目技术文档

> 此文档专为 AI 助手准备，用于快速了解项目结构和技术细节，提高开发效率。

---

## 📋 项目概述

**项目名称**: AI游戏工坊 (ai-game-workshop)  
**版本**: 2.0.0  
**功能**: 一句话描述生成 HTML5 游戏的在线平台  
**技术栈**: Node.js + Express + SQLite (本地) / Vercel KV (云端) + 原生 HTML/CSS/JS

---

## 🏗️ 项目架构

### 目录结构
```
youxijia/
├── server.js              # 🔥 本地开发服务器 (3569行，包含所有后端逻辑)
├── api/                   # Vercel Serverless Functions (云部署用)
│   ├── _lib/
│   │   └── db.js          # Vercel KV 数据库操作
│   ├── games/
│   │   ├── [id]/
│   │   │   ├── index.js   # 获取/更新游戏
│   │   │   ├── like.js    # 点赞
│   │   │   └── verify.js  # 验证作者
│   │   ├── search/
│   │   │   └── [keyword].js
│   │   ├── featured.js    # 推荐游戏
│   │   ├── recent.js      # 最近游戏
│   │   └── index.js       # 创建游戏
│   └── generate.js        # AI生成游戏
├── public/                # 前端静态文件
│   ├── index.html         # 主页
│   ├── games.html         # 游戏播放页
│   ├── admin.html         # 管理后台
│   ├── css/
│   │   └── style.css      # 全局样式
│   ├── js/
│   │   └── app.js         # 🔥 前端主逻辑 (4725行)
│   └── images/
├── package.json
├── vercel.json            # Vercel 配置
├── railway.json           # Railway 配置
├── render.yaml            # Render 配置
├── zeabur.json            # Zeabur 配置
└── wrangler.toml          # Cloudflare Workers 配置
```

### 部署模式
1. **本地开发**: `server.js` + SQLite (`games.db`)
2. **云端部署**: Vercel Serverless + Vercel KV (Redis)

---

## 💾 数据库结构

### 1. games 表 - 游戏数据
```sql
CREATE TABLE games (
  id TEXT PRIMARY KEY,              -- UUID
  title TEXT NOT NULL,              -- 游戏标题
  prompt TEXT NOT NULL,             -- 用户输入的描述
  code TEXT NOT NULL,               -- 生成的HTML代码
  author_name TEXT DEFAULT '匿名',   -- 作者名
  author_token TEXT NOT NULL,       -- 作者身份令牌
  play_count INTEGER DEFAULT 0,     -- 播放次数
  like_count INTEGER DEFAULT 0,     -- 点赞数
  favorite_count INTEGER DEFAULT 0, -- 收藏数
  is_featured INTEGER DEFAULT 0,    -- 是否推荐 (0/1)
  is_hidden INTEGER DEFAULT 0,      -- 是否隐藏 (0/1)
  category TEXT DEFAULT '其他',     -- 游戏分类
  created_at DATETIME,
  updated_at DATETIME
);
```

### 2. user_accounts 表 - 用户账号
```sql
CREATE TABLE user_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT UNIQUE NOT NULL,  -- 格式: player_xxxxxx
  nickname TEXT DEFAULT '游戏玩家',
  password_hash TEXT,               -- SHA256加密
  email TEXT,
  user_token TEXT UNIQUE NOT NULL,  -- 用户唯一标识
  has_password INTEGER DEFAULT 0,
  device_fingerprint TEXT,          -- 设备指纹
  last_ip TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

### 3. user_credits 表 - 用户积分
```sql
CREATE TABLE user_credits (
  user_token TEXT PRIMARY KEY,
  credits INTEGER DEFAULT 5,        -- 当前积分
  total_earned INTEGER DEFAULT 5,   -- 总获得
  total_used INTEGER DEFAULT 0,     -- 总消耗
  first_gen_used INTEGER DEFAULT 0, -- 首次免费是否已用
  followed_wechat INTEGER DEFAULT 0,-- 是否已关注公众号
  last_ad_date TEXT,                -- 上次看广告日期
  ad_count_today INTEGER DEFAULT 0, -- 今日广告次数
  created_at DATETIME,
  updated_at DATETIME
);
```

### 4. credit_logs 表 - 积分记录
```sql
CREATE TABLE credit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  amount INTEGER NOT NULL,          -- 变动数量 (正/负)
  type TEXT NOT NULL,               -- initial/generate/follow_wechat/watch_ad/admin
  description TEXT,
  created_at DATETIME
);
```

### 5. system_config 表 - 系统配置
```sql
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME
);
-- 关键配置项:
-- wechat_verify_code: 微信验证码
-- credits_initial: 新用户初始积分 (默认5)
-- credits_follow_wechat: 关注公众号奖励 (默认3)
-- llm_default_model: 默认LLM模型
-- llm_default_api_key: 默认API密钥
-- llm_default_base_url: 默认API地址
-- llm_enabled: LLM功能开关
-- site_name: 网站名称
-- site_announcement: 公告
```

### 6. user_likes 表 - 用户点赞记录
```sql
CREATE TABLE user_likes (
  user_token TEXT,
  game_id TEXT,
  created_at DATETIME,
  PRIMARY KEY (user_token, game_id)
);
```

### 7. user_favorites 表 - 用户收藏记录
```sql
CREATE TABLE user_favorites (
  user_token TEXT,
  game_id TEXT,
  created_at DATETIME,
  PRIMARY KEY (user_token, game_id)
);
```

### 8. user_follows 表 - 用户关注关系 ⭐新增
```sql
CREATE TABLE user_follows (
  follower_token TEXT,          -- 关注者的用户token
  following_token TEXT,         -- 被关注者的用户token
  created_at DATETIME,
  PRIMARY KEY (follower_token, following_token),
  UNIQUE(follower_token, following_token)
);
```

### 9. referral_records 表 - 邀请记录 ⭐新增
```sql
CREATE TABLE referral_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_token TEXT NOT NULL,      -- 邀请人token
  referred_token TEXT NOT NULL,      -- 被邀请人token
  referrer_credited INTEGER DEFAULT 0, -- 邀请人是否已获得积分
  referred_credited INTEGER DEFAULT 0, -- 被邀请人是否已获得积分
  created_at DATETIME
);
```

---

## 🔌 API 接口清单

### 游戏相关
| 路径 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/generate` | POST | AI生成游戏 | `{prompt, llmConfig}` |
| `/api/games` | POST | 保存游戏 | `{title, prompt, code, authorName}` |
| `/api/games/recent` | GET | 最近游戏 | `?limit=12&offset=0` |
| `/api/games/featured` | GET | 推荐游戏 | `?limit=12&offset=0` |
| `/api/games/hot` | GET | 热门游戏 | `?limit=12&offset=0` |
| `/api/games/search/:keyword` | GET | 搜索游戏 | - |
| `/api/games/:id` | GET | 获取游戏 | - |
| `/api/games/:id` | PUT | 更新游戏 | `{title, code}` |
| `/api/games/:id/verify` | POST | 验证作者 | `{authorToken}` |
| `/api/games/:id/like` | POST | 点赞/取消 | - |
| `/api/games/:id/favorite` | POST | 收藏/取消 | - |

### 用户账号
| 路径 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/account/init` | POST | 初始化账号 | `{deviceFingerprint}` |
| `/api/account` | GET | 获取账号信息 | Header: `X-User-Token` |
| `/api/account/recover` | POST | 恢复账号 | `{accountId}` |
| `/api/account/nickname` | PUT | 修改昵称 | `{nickname}` |
| `/api/account/password` | POST | 设置密码 | `{password, oldPassword?}` |
| `/api/account/login` | POST | 登录 | `{accountId, password}` |

### 积分系统
| 路径 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/credits` | GET | 获取积分信息 | Header: `X-User-Token` |
| `/api/credits/use` | POST | 消耗积分 | - |
| `/api/credits/follow-wechat` | POST | 关注公众号得积分 | `{verifyCode}` |
| `/api/credits/watch-ad` | POST | 看广告得积分 | `{adId}` |
| `/api/credits/daily-login` | POST | 每日登录积分 ⭐新增 | Header: `X-User-Token` |
| `/api/credits/referral` | POST | 邀请链接积分 ⭐新增 | `{referrerToken}` |

### 关注系统 ⭐新增
| 路径 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/users/:token/follow` | POST | 关注/取关用户 | Header: `X-User-Token` |
| `/api/users/:token/follow-stats` | GET | 获取关注统计 | - |
| `/api/users/:token/following` | GET | 获取关注列表 | `?limit&offset` |
| `/api/users/:token/followers` | GET | 获取粉丝列表 | `?limit&offset` |

### 配置接口 ⭐新增
| 路径 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/config/model-times` | GET | 获取LLM模型预计时间 | - |

### 管理接口
| 路径 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/admin/*` | * | 管理功能 | Header: `X-Admin-Key` |

---

## 🎨 前端架构 (app.js)

### 全局状态对象
```javascript
const state = {
  currentGame: null,
  currentGameId: null,
  isGenerating: false,
  credits: 5,
  mainTab: {
    current: 'recent',  // recent/hot/likes/favorites/featured
    tabs: ['recent', 'hot', 'likes', 'favorites', 'featured'],
    offsets: {},
    hasMore: {},
    isLoading: {}
  },
  account: {
    accountId: '',
    nickname: '',
    hasPassword: false,
    loaded: false
  },
  settings: {
    llmModelId: 'deepseek-v3',
    llmApiKey: '',
    llmBaseUrl: '',
    authorName: ''
  }
};
```

### 主要函数
```javascript
// 初始化
initApp()                    // 应用初始化入口
initAccount()                // 账号初始化 (支持设备指纹自动恢复)

// 游戏生成
generateGame()               // 生成游戏主函数
saveGame(gameData)           // 保存游戏

// 游戏列表
loadRecentGames()            // 加载最近游戏
loadFeaturedGames()          // 加载推荐游戏
loadHotGames()               // 加载热门游戏

// 用户交互
likeGame(id)                 // 点赞
favoriteGame(id)             // 收藏
shareGame(id)                // 分享

// 积分
loadCredits()                // 加载积分信息
useCredits()                 // 消耗积分

// 设备指纹
generateDeviceFingerprint()  // 生成设备指纹
getDeviceFingerprint()       // 获取缓存的指纹
```

### 模型注册表 (MODEL_REGISTRY)
```javascript
{
  'deepseek-v3': { provider: 'deepseek', model: 'deepseek-chat', ... },
  'deepseek-r1': { provider: 'deepseek', model: 'deepseek-reasoner', ... },
  'gpt-4o': { provider: 'openai', model: 'gpt-4o', ... },
  'claude-4-sonnet': { provider: 'anthropic', model: '...', ... },
  // ... 更多模型
}
```

---

## ⚙️ 关键配置

### 品牌水印 (server.js)
```javascript
const BRAND_CONFIG = {
  name: '游戏开发技术教程',
  slogan: '一句话，AI帮你写游戏',
  wechatId: 'GameDevLearning',
  description: '网易十年游戏开发老兵｜聚焦Unity3D/UE4/UE5引擎',
};
```

### 积分配置 (server.js)
```javascript
const CREDITS_CONFIG = {
  initial: 1,           // 新用户初始积分
  followWechat: 3,      // 关注公众号奖励
  watchAd: 1,           // 看广告奖励
  dailyLimit: 10,       // 每日广告上限
  shareGame: 1,         // 分享奖励
  inviteFriend: 2,      // 邀请好友奖励
};
```

### 游戏模板库 (server.js)
预置了经典游戏模板: 贪吃蛇、2048、俄罗斯方块、打砖块、Flappy Bird、扫雷、飞机大战等

### 周挑战主题 (server.js)
```javascript
const WEEKLY_CHALLENGES = [
  { theme: '复古像素风', bonus: 5, prompt: '...' },
  { theme: '音乐节奏', bonus: 5, prompt: '...' },
  // ...
];
```

---

## 🛠️ 开发要点

### 1. 本地开发启动
```bash
npm install
npm start       # 启动 server.js
# 访问 http://localhost:3000
```

### 2. 测试模式
```javascript
// server.js 顶部
const TEST_MODE = false;  // 设为 true 使用本地HTML文件
const TEST_HTML_PATH = path.join(__dirname, 'temp', 'test.html');
```

### 3. 用户身份验证
- 所有需要用户身份的API通过 `X-User-Token` Header 传递
- Token 存储在 localStorage: `aigame-user-token` / `aigame-author-token`
- 支持设备指纹自动恢复账号

### 4. AI生成流程
1. 前端调用 `/api/credits/use` 扣积分
2. 前端调用 `/api/generate` 生成游戏
3. LLM 返回代码后,`extractHtmlFromResponse()` 提取HTML
4. `injectBrandWatermark()` 注入品牌水印
5. 前端调用 `/api/games` 保存游戏

### 5. 敏感词过滤
```javascript
const SENSITIVE_WORDS = ['政治敏感词', '暴力色情词', ...];
function containsSensitiveWords(text) { ... }
```

---

## 📝 待办事项

### ✅ 已完成 (本次更新)
- [x] 点赞收藏UI参考抖音优化 → TikTok风格右侧互动栏
- [x] 游戏水印持续显示但不影响游戏 → `pointer-events: none` 非交互水印
- [x] 把邀请码改成邀请链接 → `/api/credits/referral` + URL参数 `?ref=`
- [x] 每日登录无积分时自动获得1积分 → `/api/credits/daily-login`
- [x] 游戏游玩界面优化，默认全屏 → 全屏模式 + 悬浮控制按钮
- [x] 添加关注和粉丝功能 → `user_follows` 表 + 关注/粉丝列表弹窗
- [x] 我的界面从横向改成竖向布局 → 竖向卡片式游戏列表
- [x] 删除生成游戏的取消功能 → 已从UI移除
- [x] 后台配置LLM预计生成时间 → 管理后台配置 + 生成进度条

### ✅ 已完成 (2026-01-10)
- [x] 修复他人主页数据不正确 → 添加 `is_public` 字段默认值，新增 `/api/users/:token/profile` API
- [x] 切换账号后数据更新不及时 → 登录/恢复账号后调用 `loadProfilePageData()`
- [x] 个人主页账号位置调整 → 账号ID显示在昵称下方，字体小颜色淡，参考抖音
- [x] 切换账号后昵称显示错误 → 优先从服务器获取昵称，未设置则显示账号ID
- [x] 内测版本提示 → 横幅文字改为"内测版本 - 有问题或建议欢迎反馈"
- [x] 公众号按钮合并 → 游戏界面只保留一个"公众号"按钮，点击弹出关注页面含验证码输入
- [x] 创作中作品显示 → 添加 `status` 字段，我的作品显示草稿并带"创作中"标识
- [x] 下拉刷新功能 → 主页和我的页面支持下拉刷新
- [x] 游戏分享优化 → 分享内容为"文字+链接"，支持后台配置分享文案
- [x] 游戏制作界面滑动问题 → 添加 `overscroll-behavior: contain` 和 `body.overlay-open` 防止背景滚动

### 待评估
- [ ] 已生成游戏的编辑功能是否有用？

---

## 🐛 已知问题

1. **编辑功能**: 已生成的游戏无法继续对话编辑（可能需要隐藏）
2. **密码重置**: 存在调试用的 `/api/debug/reset-password` 接口（上线需删除）

---

## 📦 依赖包

```json
{
  "express": "^4.18.2",        // Web框架
  "better-sqlite3": "^9.4.3",  // SQLite数据库
  "uuid": "^9.0.0",            // UUID生成
  "cors": "^2.8.5",            // 跨域支持
  "dotenv": "^16.4.1",         // 环境变量
  "@vercel/kv": "^1.0.1"       // Vercel KV (云端)
}
```

---

## 🔑 环境变量

```env
# 本地开发 (.env)
DEEPSEEK_API_KEY=sk-xxx       # DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
PORT=3000
ADMIN_KEY=xxx                 # 管理后台密钥
TRIAL_API_KEY=xxx             # 游客体验模式API Key

# Vercel 部署 (额外需要)
KV_URL=xxx
KV_REST_API_URL=xxx
KV_REST_API_TOKEN=xxx
KV_REST_API_READ_ONLY_TOKEN=xxx
```

---

## 💡 开发建议

1. **修改后端逻辑**: 主要编辑 `server.js`
2. **修改前端逻辑**: 主要编辑 `public/js/app.js`
3. **修改样式**: 主要编辑 `public/css/style.css`
4. **添加新API**: 在 `server.js` 中添加路由，同时在 `api/` 目录添加对应的 Vercel 函数
5. **数据库变更**: 在 `server.js` 初始化部分用 `ALTER TABLE` 添加字段（有try-catch保护）

---

*文档生成时间: 2026-01-09*
*如有更新，请同步维护此文档*
