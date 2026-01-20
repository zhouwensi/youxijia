# AI游戏工坊 - API接口文档

所有API基于RESTful设计，返回JSON格式数据。后端共有142个API端点。

## 通用约定

### 请求头
```
Content-Type: application/json
x-user-token: <user_token>     (用户身份)
x-author-id: <author_token>    (作者身份)
Authorization: Bearer <token>   (管理员接口)
```

### 响应格式
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息",
  "code": "ERROR_CODE"
}
```

### 认证方式

项目使用双重Token机制：
- **User Token** (`x-user-token`): 用户身份标识（设备指纹或账号Token）
- **Author Token** (`x-author-id`): 作者标识（用于识别游戏创建者）

---

## 一、游戏相关API

### 获取游戏列表

```
GET /api/games
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码，默认1 |
| limit | number | 每页数量，默认20 |
| sort | string | 排序方式：latest/popular/random |
| category | string | 游戏分类 |
| search | string | 搜索关键词 |
| author_id | string | 作者ID |

---

### 获取单个游戏

```
GET /api/games/:id
```

---

### 获取最新游戏

```
GET /api/games/recent
```

---

### 获取精选游戏

```
GET /api/games/featured
```

---

### 获取热门游戏

```
GET /api/games/hot
```

---

### 搜索游戏

```
GET /api/games/search/:keyword
```

---

### 生成新游戏

```
POST /api/generate
```

**请求体**：
```json
{
  "prompt": "做一个贪吃蛇游戏",
  "author_name": "游客123",
  "model": "deepseek-v3",
  "advancedSettings": {
    "speed": "balanced",
    "quality": "high"
  }
}
```

**请求头**（重要）：
```
x-author-id: <author_token>
x-user-token: <user_token>
```

---

### 试玩生成（免费额度）

```
POST /api/trial/generate
```

**请求体**：
```json
{
  "prompt": "做一个贪吃蛇游戏",
  "draftId": "可选，继续生成"
}
```

---

### 获取试玩状态

```
GET /api/trial/status
```

---

### 取消生成

```
POST /api/cancel-generation
```

**请求体**：
```json
{
  "draftId": "草稿ID"
}
```

---

### 获取加速模型列表

```
GET /api/turbo-models
```

---

### 编辑游戏（AI辅助）

```
POST /api/games/:id/edit
```

**请求体**：
```json
{
  "message": "添加音效",
  "currentCode": "<html>...</html>",
  "chatHistory": []
}
```

---

### 取消编辑

```
POST /api/cancel-edit
```

---

### 更新游戏

```
PUT /api/games/:id
```

**请求体**：
```json
{
  "title": "新标题",
  "code": "<html>...</html>",
  "visibility": "public"
}
```

---

### 保存游戏

```
POST /api/games
```

---

### 删除游戏

```
DELETE /api/games/:id
```

---

### 增加游玩次数

```
POST /api/games/:id/play
```

---

### 记录分享

```
POST /api/games/:id/share
```

---

### 获取分享信息

```
GET /api/games/:id/share-info
```

---

### 获取游戏统计

```
GET /api/games/:id/stats
```

---

### 验证游戏归属

```
POST /api/games/:id/verify
```

---

## 二、用户交互API

### 点赞游戏

```
POST /api/games/:id/like
```

---

### 获取点赞状态

```
GET /api/games/:id/like-status
```

---

### 收藏游戏

```
POST /api/games/:id/favorite
```

---

### 获取收藏状态

```
GET /api/games/:id/favorite-status
```

---

## 三、评论API

### 获取游戏评论

```
GET /api/games/:id/comments
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| limit | number | 每页数量 |

---

### 发表评论

```
POST /api/games/:id/comments
```

**请求体**：
```json
{
  "content": "评论内容",
  "user_name": "用户昵称"
}
```

---

### 删除评论

```
DELETE /api/games/:id/comments/:commentId
```

---

## 四、用户数据API（"我的"页面）

### 获取我的游戏

```
GET /api/my-games
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| limit | number | 每页数量 |
| status | string | 状态筛选：all/published/draft |

---

### 获取我的点赞

```
GET /api/my-likes
```

---

### 获取我的收藏

```
GET /api/my-favorites
```

---

### 获取我的评论

```
GET /api/my-comments
```

---

### 切换评论隐藏状态

```
POST /api/my-comments/:id/toggle-hidden
```

---

### 删除我的评论

```
DELETE /api/my-comments/:id
```

---

## 五、账号系统API

### 初始化账号

```
POST /api/account/init
```

**请求体**：
```json
{
  "deviceFingerprint": "设备指纹"
}
```

---

### 获取账号信息

```
GET /api/account
```

---

### 恢复账号

```
POST /api/account/recover
```

**请求体**：
```json
{
  "accountId": "玩家12345"
}
```

---

### 安全恢复（带密码）

```
POST /api/account/secure-recover
```

**请求体**：
```json
{
  "accountId": "玩家12345",
  "password": "密码"
}
```

---

### 更新昵称

```
PUT /api/account/nickname
```

**请求体**：
```json
{
  "nickname": "新昵称"
}
```

---

### 设置密码

```
POST /api/account/password
```

**请求体**：
```json
{
  "password": "新密码"
}
```

---

### 账号登录

```
POST /api/account/login
```

**请求体**：
```json
{
  "accountId": "玩家12345",
  "password": "密码"
}
```

---

### 检查账号是否存在

```
GET /api/account/check/:accountId
```

---

### 获取设备关联账号

```
GET /api/account/device-accounts
```

---

## 六、积分系统API

### 获取积分余额

```
GET /api/credits
```

---

### 使用积分

```
POST /api/credits/use
```

**请求体**：
```json
{
  "amount": 10,
  "reason": "生成游戏"
}
```

---

### 关注公众号获取积分

```
POST /api/credits/follow-wechat
```

---

### 观看广告获取积分

```
POST /api/credits/watch-ad
```

---

### 每日登录奖励

```
POST /api/credits/daily-login
```

---

## 七、社交功能API

### 关注用户

```
POST /api/users/:token/follow
```

---

### 获取关注状态

```
GET /api/users/:token/follow-status
```

---

### 获取关注统计

```
GET /api/users/:token/follow-stats
```

**响应**：
```json
{
  "following": 10,
  "followers": 20
}
```

---

### 获取用户资料

```
GET /api/users/:token/profile
```

---

### 获取用户作品

```
GET /api/users/:token/games
```

---

### 获取用户关注列表

```
GET /api/users/:token/following
```

---

### 获取用户粉丝列表

```
GET /api/users/:token/followers
```

---

## 八、邀请系统API

### 获取我的邀请链接

```
GET /api/invite/my-link
```

---

### 记录链接访问

```
POST /api/invite/link-visit
```

---

### 记录分享访问

```
POST /api/invite/share-visit
```

---

### 获取我的邀请码

```
GET /api/invite/my-code
```

---

### 生成邀请码

```
POST /api/invite/generate
```

---

### 使用邀请码

```
POST /api/invite/use
```

**请求体**：
```json
{
  "code": "ABC123"
}
```

---

### 记录推荐

```
POST /api/referral/record
```

---

### 领取推荐奖励

```
POST /api/referral/reward
```

---

## 九、排行榜API

### 作者榜单（新）

```
GET /api/author-leaderboard/:type
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 榜单类型：`fans`(粉丝榜) / `works`(作品榜) / `credits`(积分榜) / `popularity`(人气榜) / `newstar`(新星榜) |
| limit | number | 返回数量，默认20，最大100 |
| offset | number | 分页偏移 |
| period | string | 时间范围：`all`(总榜) / `week`(周榜) / `month`(月榜)，默认all（新星榜不支持） |

**响应示例**：
```json
{
  "success": true,
  "type": "fans",
  "title": "🏆 粉丝榜",
  "list": [
    {
      "rank": 1,
      "user_token": "xxx",
      "account_id": "玩家12345",
      "nickname": "游戏大师",
      "avatar_emoji": "🎮",
      "value": 1520,
      "label": "粉丝"
    }
  ],
  "total": 100,
  "myRank": 25,
  "updated_at": "2025-01-19T12:00:00Z"
}
```

**榜单类型说明**：
| 类型 | 排序依据 | 说明 |
|------|---------|------|
| `fans` | 粉丝数量 | 按关注者数量排名 |
| `works` | 作品数量 | 按发布的公开作品数排名 |
| `credits` | 积分余额 | 按用户积分排名 |
| `popularity` | 综合人气值 | 作品总点赞×10 + 总播放次数 |
| `newstar` | 新人综合分 | 近30天注册用户：粉丝×5 + 作品×10 + 点赞×2 |

**周期说明**：
| 周期 | 说明 |
|------|------|
| `all` | 总榜，不限时间范围 |
| `week` | 周榜，仅统计近7天内注册用户的数据 |
| `month` | 月榜，仅统计近30天内注册用户的数据 |

> 注：`newstar` 新星榜不支持周期参数，固定为近30天注册的用户

---

### 游戏排行榜

```
GET /api/leaderboard/games
```

---

### 创作者排行榜

```
GET /api/leaderboard/creators
```

---

### 精选排行榜

```
GET /api/leaderboard/featured
```

---

### 收藏排行榜

```
GET /api/leaderboard/favorites
```

---

### 点赞排行榜

```
GET /api/leaderboard/likes
```

---

### 热度排行榜

```
GET /api/leaderboard/hot
```

---

### 评论排行榜

```
GET /api/leaderboard/comments
```

---

## 十、配置API

### 获取全局配置

```
GET /api/config
```

---

### 获取生成提示语

```
GET /api/config/tips
```

---

### 获取模型预估时间

```
GET /api/config/model-times
```

---

### 获取分享文案

```
GET /api/config/share-text
```

---

### 获取模板列表

```
GET /api/templates
```

---

### 获取挑战信息

```
GET /api/challenge/current
```

---

### 获取挑战参赛作品

```
GET /api/challenge/entries
```

---

## 十一、安全API

### 检查封禁状态

```
GET /api/check-ban
```

---

### 获取用户状态

```
GET /api/user/status
```

---

## 十二、管理后台API

需要管理员认证（Bearer Token）。

### 获取统计数据

```
GET /api/admin/stats
```

---

### 获取全局配置

```
GET /api/admin/config
```

---

### 更新全局配置

```
PUT /api/admin/config
```

---

### 获取模型列表

```
GET /api/admin/models
```

---

### 游戏管理

```
GET /api/admin/games          # 获取游戏列表
PUT /api/admin/games/:id      # 更新游戏
DELETE /api/admin/games/:id   # 删除游戏
POST /api/admin/games/batch   # 批量操作
POST /api/admin/games/:id/repair  # 修复游戏
GET /api/admin/games/:id/source   # 获取源码
```

---

### 用户管理

```
GET /api/admin/users          # 获取用户列表
POST /api/admin/add-credits   # 添加积分
PUT /api/admin/credits-config # 更新积分配置
```

---

### 封禁管理

```
GET /api/admin/ban            # 获取封禁列表
POST /api/admin/ban           # 添加封禁
DELETE /api/admin/ban         # 解除封禁
```

---

### 评论管理

```
GET /api/admin/comments                    # 获取评论列表
DELETE /api/admin/comments/:commentId      # 删除评论
POST /api/admin/comments/:commentId/restore  # 恢复评论
DELETE /api/admin/comments/:commentId/permanent  # 永久删除
```

---

### 开发者工具白名单

```
GET /api/admin/devtools       # 获取白名单
PUT /api/admin/devtools       # 更新白名单
DELETE /api/admin/devtools    # 删除白名单项
```

---

### CORS配置

```
GET /api/admin/cors           # 获取CORS配置
PUT /api/admin/cors           # 更新CORS配置
DELETE /api/admin/cors        # 删除CORS项
```

---

### 系统工具

```
POST /api/admin/tools/reset-credits         # 重置积分
POST /api/admin/tools/reset-ad-count        # 重置广告计数
POST /api/admin/tools/reset-first-gen       # 重置首次生成
POST /api/admin/tools/cleanup-old-games     # 清理旧游戏
POST /api/admin/tools/cleanup-inactive-users # 清理不活跃用户
POST /api/admin/tools/cleanup-logs          # 清理日志
POST /api/admin/tools/vacuum                # 数据库优化
POST /api/admin/tools/reindex               # 重建索引
GET /api/admin/tools/db-stats               # 数据库统计
POST /api/admin/tools/batch-add-credits     # 批量添加积分
POST /api/admin/tools/reset-follow-status   # 重置关注状态
```

---

### 静态文件管理

```
GET /api/admin/static-files-stats           # 静态文件统计
POST /api/admin/generate-static-files       # 生成静态文件
```

---

### 安全日志

```
GET /api/admin/security-logs                # 获取安全日志
GET /api/admin/security-status              # 获取安全状态
```

---

### 测试账号（开发用）

```
POST /api/admin/create-test-account         # 创建测试账号
GET /api/admin/test-accounts                # 获取测试账号列表
DELETE /api/admin/test-account/:accountId   # 删除测试账号
POST /api/debug/reset-password              # 重置密码（调试）
```

---

### 榜单管理（新）

```
GET /api/admin/leaderboard/excludes                  # 获取榜单排除名单
POST /api/admin/leaderboard/exclude                  # 添加榜单排除
DELETE /api/admin/leaderboard/exclude/:user_token   # 移除榜单排除
GET /api/admin/user/search?keyword=xxx              # 搜索用户（用于添加排除）
```

**添加排除请求体**：
```json
{
  "user_token": "用户Token",
  "exclude_types": ["all"],  // 或 ["fans", "works", "credits", "popularity"]
  "reason": "官方账号"
}
```

---

## 错误码参考

| 错误码 | 说明 |
|--------|------|
| AUTH_REQUIRED | 需要登录 |
| PERMISSION_DENIED | 权限不足 |
| NOT_FOUND | 资源不存在 |
| RATE_LIMITED | 请求频率过高 |
| CREDITS_INSUFFICIENT | 积分不足 |
| GENERATION_FAILED | 游戏生成失败 |
| INVALID_PARAMS | 参数无效 |
| ACCOUNT_BANNED | 账号已封禁 |
| API_KEY_INVALID | API Key无效 |
| MODEL_NOT_AVAILABLE | 模型不可用 |