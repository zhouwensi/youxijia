# AI游戏工坊 - API接口文档

所有API基于RESTful设计，返回JSON格式数据。

## 通用约定

### 请求头
```
Content-Type: application/json
Authorization: Bearer <token>  (需要认证的接口)
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
- **User Token** (`aigame-user-token`): 用户身份标识（设备指纹或账号Token）
- **Author Token** (`aigame-author-token`): 作者标识（用于识别游戏创建者）

---

## 游戏相关API

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
| status | string | 状态筛选（管理员） |

**响应**：
```json
{
  "success": true,
  "data": {
    "games": [...],
    "total": 100,
    "page": 1,
    "totalPages": 5
  }
}
```

---

### 获取单个游戏

```
GET /api/games/:id
```

**响应**：
```json
{
  "success": true,
  "data": {
    "id": "xxx",
    "title": "游戏标题",
    "description": "描述",
    "code": "<html>...</html>",
    "author_name": "作者",
    "play_count": 100,
    "like_count": 10,
    ...
  }
}
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
  "author_name": "游客123"
}
```

**请求头**（重要）：
```
x-author-id: <author_token>
x-user-token: <user_token>
```

**响应**：
```json
{
  "success": true,
  "data": {
    "id": "新游戏ID",
    "title": "贪吃蛇",
    "code": "<html>...</html>",
    ...
  }
}
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
  "description": "新描述",
  "status": "public"
}
```

---

### 删除游戏

```
DELETE /api/games/:id
```

---

### 继续生成/优化游戏

```
POST /api/games/:id/continue
```

**请求体**：
```json
{
  "prompt": "添加音效",
  "type": "optimize"
}
```

---

### 增加游玩次数

```
POST /api/games/:id/play
```

---

## 用户交互API

### 点赞游戏

```
POST /api/games/:id/like
```

**请求头**：
```
x-user-token: <user_token>
```

---

### 取消点赞

```
DELETE /api/games/:id/like
```

---

### 收藏游戏

```
POST /api/games/:id/favorite
```

---

### 取消收藏

```
DELETE /api/games/:id/favorite
```

---

### 检查点赞/收藏状态

```
GET /api/games/:id/status
```

**参数**：
```
?user_id=<user_token>
```

**响应**：
```json
{
  "liked": true,
  "favorited": false
}
```

---

## 用户数据API（"我的"页面）

### 获取我的游戏

```
GET /api/my-games
```

**请求头**：
```
x-author-id: <author_token>
```

---

### 获取我的点赞

```
GET /api/my-likes
```

**请求头**：
```
x-user-token: <user_token>
```

---

### 获取我的收藏

```
GET /api/my-favorites
```

**请求头**：
```
x-user-token: <user_token>
```

---

### 获取游戏历史

```
GET /api/game-history
```

---

## 评论API

### 获取游戏评论

```
GET /api/games/:id/comments
```

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
DELETE /api/comments/:id
```

---

## 账号系统API

### 注册

```
POST /api/auth/register
```

**请求体**：
```json
{
  "email": "user@example.com",
  "password": "密码",
  "nickname": "昵称"
}
```

---

### 登录

```
POST /api/auth/login
```

**请求体**：
```json
{
  "email": "user@example.com",
  "password": "密码"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": {
      "id": "xxx",
      "nickname": "昵称",
      "points": 100
    }
  }
}
```

---

### 获取用户信息

```
GET /api/user/profile
```

---

### 更新用户信息

```
PUT /api/user/profile
```

---

## 积分系统API

### 获取积分余额

```
GET /api/user/points
```

---

### 积分充值

```
POST /api/user/points/recharge
```

---

### 积分记录

```
GET /api/user/points/history
```

---

## 统计API

### 站点统计

```
GET /api/stats
```

**响应**：
```json
{
  "total_games": 1000,
  "total_plays": 50000,
  "today_games": 50
}
```

---

### 获取游戏分类

```
GET /api/categories
```

**响应**：
```json
{
  "success": true,
  "data": [
    { "name": "益智", "count": 100 },
    { "name": "动作", "count": 80 }
  ]
}
```

---

## 管理后台API

需要管理员认证。

### 管理员登录

```
POST /api/admin/login
```

**请求体**：
```json
{
  "password": "管理员密码"
}
```

---

### 获取所有游戏（含隐藏）

```
GET /api/admin/games
```

---

### 批量管理游戏

```
POST /api/admin/games/batch
```

**请求体**：
```json
{
  "action": "delete|hide|feature",
  "ids": ["id1", "id2"]
}
```

---

### 获取系统设置

```
GET /api/admin/settings
```

---

### 更新系统设置

```
PUT /api/admin/settings
```

---

### 获取用户列表

```
GET /api/admin/users
```

---

### 管理用户

```
PUT /api/admin/users/:id
```

---

## 其他API

### 健康检查

```
GET /api/health
```

---

### 获取公告

```
GET /api/announcement
```

---

### 提交反馈

```
POST /api/feedback
```

---

## 错误码参考

| 错误码 | 说明 |
|--------|------|
| AUTH_REQUIRED | 需要登录 |
| PERMISSION_DENIED | 权限不足 |
| NOT_FOUND | 资源不存在 |
| RATE_LIMITED | 请求频率过高 |
| POINTS_INSUFFICIENT | 积分不足 |
| GENERATION_FAILED | 游戏生成失败 |
| INVALID_PARAMS | 参数无效 |
