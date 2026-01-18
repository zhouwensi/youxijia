# AI游戏工坊 - 项目文档目录

> 本文档目录旨在帮助开发者快速了解项目结构，在新会话中可直接提供给AI助手阅读，以提高开发效率和准确性。

## 📚 文档列表

| 文档 | 描述 | 适用场景 |
|------|------|----------|
| [01-项目架构概览](./01-项目架构概览.md) | 技术栈、目录结构、核心文件说明 | 初次了解项目 |
| [02-数据库架构](./02-数据库架构.md) | 所有数据表结构和关系 | 涉及数据操作时 |
| [03-API接口文档](./03-API接口文档.md) | 完整的REST API说明 | 开发前后端交互时 |
| [04-前端架构](./04-前端架构.md) | 前端模块、状态管理、路由机制 | 开发UI功能时 |
| [05-开发指南与常见问题](./05-开发指南与常见问题.md) | 开发环境、调试技巧、FAQ | 遇到问题时 |
| [06-网站功能使用教程](./06-网站功能使用教程.md) | 用户使用指南、功能介绍 | 用户宣传推广 |

---

## 🔑 快速参考

### 核心文件位置

```
server.js           → 后端API和数据库逻辑（约9500行，126个API端点）
src/js/app.js       → 前端主逻辑（约8500行）
public/index.html   → 主页面（SPA，约2200行）
public/games.html   → 游戏列表页
public/admin.html   → 管理后台
public/css/style.css → 全局样式（赛博朋克主题）
```

### 重要Token（LocalStorage）

```javascript
'aigame-user-token'    // 用户/作者标识Token（设备指纹）
'aigame-author-token'  // 作者标识Token（通常与user-token相同）
'aigame-author-name'   // 作者昵称（如 "玩家12345"）
'aigame-device-fp'     // 设备指纹缓存
'aigame-credits'       // 积分余额
'aigame-email'         // 用户邮箱
'aigame-email-verified' // 邮箱验证状态
'aigame-liked'         // 已点赞游戏列表（JSON数组）
'aigame-settings'      // 用户设置（JSON）
'aigame-generating-state' // 生成状态持久化（JSON）
'user_token'           // 旧版Token键名（兼容用）
```

### 关键API分组

| 功能模块 | 主要API |
|----------|---------|
| 游戏浏览 | `GET /api/games`, `/api/games/:id`, `/api/games/hot` |
| 游戏生成 | `POST /api/generate`, `/api/trial/generate` |
| 游戏编辑 | `POST /api/games/:id/edit`, `PUT /api/games/:id` |
| 用户数据 | `GET /api/my-games`, `/api/my-likes`, `/api/my-favorites` |
| 互动功能 | `POST /api/games/:id/like`, `/api/games/:id/favorite` |
| 社交功能 | `POST /api/users/:token/follow`, `/api/games/:id/comments` |
| 积分系统 | `GET /api/credits`, `/api/credits/daily-login` |
| 邀请系统 | `GET /api/invite/my-link`, `/api/invite/my-code` |
| 排行榜 | `GET /api/leaderboard/games`, `/api/leaderboard/hot` |
| 管理后台 | `GET /api/admin/*`, `PUT /api/admin/*` |

### 路由参数

```
/?tab=profile          → 切换到"我的"页面
/?tab=create           → 切换到"创作"页面
/?game=xxx             → 打开游戏详情
/games.html?source=my-games      → 我的游戏列表
/games.html?source=my-favorites  → 我的收藏列表
/games.html?source=my-likes      → 我的点赞列表
/games.html?category=xxx         → 按分类筛选
/games.html?sort=popular         → 按热度排序
```

---

## 🛠️ 常见修改场景

### 场景1: 修改游戏列表展示
- 卡片样式 → `public/css/style.css`
- 卡片渲染 → `src/js/app.js` 中的 `renderGameCard()`, `createGameCard()`
- 列表数据 → `server.js` 中的 `GET /api/games`

### 场景2: 修改用户页面
- 页面布局 → `public/index.html` 的 `#profile-page`
- 交互逻辑 → `src/js/app.js` 中的 `loadProfilePageData()`, `switchProfilePageTab()` 等
- 数据接口 → `server.js` 中的 `/api/my-*` 路由

### 场景3: 修改游戏生成功能
- 生成逻辑 → `src/js/app.js` 中的 `generateGame()`, `generateWithTrial()`
- 后端处理 → `server.js` 中的 `POST /api/generate`
- 加速选项 → `showTurboOptions()`, `selectTurboModel()`

### 场景4: 修改游戏编辑器
- 编辑器UI → `public/index.html` 中的游戏编辑区域
- 编辑逻辑 → `src/js/app.js` 中的 `openGameEditor()`, `sendEditMessage()`
- 后端处理 → `server.js` 中的 `POST /api/games/:id/edit`

### 场景5: 添加新功能
1. 后端：在 `server.js` 添加API路由
2. 前端：在 `src/js/app.js` 添加调用函数
3. 样式：在 `public/css/style.css` 添加样式
4. 文档：更新相关文档

---

## ⚠️ 注意事项

1. **Token一致性**: 不同页面必须使用相同的LocalStorage键名
2. **代码混淆**: 生产部署前需运行 `node build.js`
3. **数据库**: 使用SQLite，文件为 `games.db`
4. **游戏文件**: 生成的游戏HTML存储在 `/public/g/{xx}/{id}.html`
5. **积分系统**: 游戏生成消耗积分，可通过多种途径获取
6. **安全机制**: 包含设备指纹、封禁系统、开发者工具检测

---

## 💡 给AI助手的提示

在新会话中，可以这样引导AI：

> "请先阅读 `doc/README.md` 和相关文档，了解项目结构后再进行修改。"

或针对特定任务：

> "这是一个Node.js+SQLite的游戏生成平台，前端是原生JS。请阅读 `doc/04-前端架构.md` 后帮我修改游戏卡片的展示样式。"

> "请阅读 `doc/03-API接口文档.md`，帮我添加一个新的API接口。"

---

*文档最后更新: 2026年1月*