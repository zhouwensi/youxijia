# 🔒 一句话游戏 - 安全防护指南

## 概述

本项目实施了多层次的安全防护措施，以保护网站和用户数据免受常见的网络攻击。

## 已实施的安全措施

### 1. HTTP 安全头 (Helmet)

通过 `helmet` 中间件自动设置多种 HTTP 安全头：

| 安全头 | 作用 |
|--------|------|
| Content-Security-Policy | 防止 XSS 攻击，限制资源加载来源 |
| X-Content-Type-Options | 防止 MIME 类型嗅探 |
| X-Frame-Options | 防止点击劫持 |
| X-XSS-Protection | 启用浏览器 XSS 过滤 |
| Referrer-Policy | 控制 Referer 头信息 |
| Strict-Transport-Security | 强制 HTTPS（生产环境） |

### 2. API 速率限制

不同类型的API有不同的速率限制：

| API 类型 | 限制 | 说明 |
|----------|------|------|
| 通用 API | 200次/15分钟 | 所有API请求 |
| 敏感操作 | 10次/分钟 | 登录、注册、密码修改 |
| 游戏生成 | 5次/分钟 | LLM调用，资源密集 |
| 管理员 API | 30次/分钟 | 管理后台操作 |

### 3. 输入验证与清理

- **XSS 清理**：自动移除用户输入中的 `<script>` 标签和 `javascript:` 协议
- **长度限制**：标题100字符、描述2000字符、昵称20字符
- **攻击模式检测**：自动拦截 SQL 注入、命令注入等模式

### 4. 路径遍历防护

自动拦截以下恶意请求：
- `..` 路径遍历
- `/etc/`、`/bin/` 系统目录访问
- `%2e%2e` 编码攻击
- `%00` 空字节注入

### 5. 管理员保护

- **登录尝试限制**：5次失败后锁定15分钟
- **统一认证**：所有 `/api/admin/*` 接口自动验证
- **操作审计**：记录所有管理员操作

### 6. 密码安全

- **bcrypt 哈希**：使用 bcrypt 算法（12轮）
- **向后兼容**：自动兼容旧版 SHA256 密码
- **密码升级**：登录时自动升级旧密码格式

### 7. 安全审计日志

记录以下安全事件：
- 路径遍历攻击尝试
- 攻击模式检测
- 管理员认证失败
- 输入验证失败
- 服务器启动/重启

## 环境配置

在 `.env` 文件中配置以下安全相关变量：

```env
# 运行环境（生产环境启用更严格的安全策略）
NODE_ENV=production

# 管理员密钥（建议32位以上随机字符串）
ADMIN_KEY=your-very-secure-admin-key-here

# 允许的 CORS 来源（生产环境）
ALLOWED_ORIGINS=https://yijuhuayouxi.com,https://www.yijuhuayouxi.com
```

### 生成安全的 ADMIN_KEY

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 管理员 API

### 获取安全状态

```
GET /api/admin/security-status
Header: X-Admin-Key: your-admin-key
```

### 获取安全审计日志

```
GET /api/admin/security-logs?limit=100
Header: X-Admin-Key: your-admin-key
```

## 安全事件类型

| 类型 | 说明 |
|------|------|
| `SERVER_STARTED` | 服务器启动 |
| `PATH_TRAVERSAL_BLOCKED` | 路径遍历攻击被阻止 |
| `ATTACK_PATTERN_DETECTED` | 攻击模式被检测 |
| `ADMIN_AUTH_FAILED` | 管理员认证失败 |
| `ADMIN_ACCESS` | 管理员API访问 |
| `VALIDATION_FAILED` | 输入验证失败 |
| `URL_DECODE_FAILED` | URL解码失败 |
| `OVERSIZED_REQUEST` | 请求体过大 |

## 依赖包

安全相关的 npm 包：

```json
{
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.1.5",
  "bcrypt": "^5.1.1",
  "express-validator": "^7.0.1",
  "hpp": "^0.2.3",
  "xss-clean": "^0.1.4"
}
```

## 最佳实践

1. **生产环境务必设置**：
   - `NODE_ENV=production`
   - 强密码的 `ADMIN_KEY`
   - 正确的 `ALLOWED_ORIGINS`

2. **定期检查**：
   - 安全审计日志
   - 依赖包更新

3. **HTTPS**：
   - 生产环境务必使用 HTTPS
   - Helmet 会自动启用 HSTS

4. **备份**：
   - 定期备份数据库
   - 保护备份文件安全

## 文件结构

```
├── security.js        # 安全模块（所有安全功能）
├── server.js          # 主服务器（集成安全中间件）
├── .env.example       # 环境变量示例
└── SECURITY.md        # 本文档
```

## 联系

如发现安全漏洞，请通过以下方式报告：
- 不要公开披露
- 提供详细的复现步骤
- 等待修复后再公开
