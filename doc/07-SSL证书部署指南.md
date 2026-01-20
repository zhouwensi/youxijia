# SSL 证书部署指南（Cloudflare）

本文档介绍如何为游戏家网站配置 Cloudflare SSL 证书。

## 📋 目录

1. [方式一：Cloudflare 代理模式（推荐）](#方式一cloudflare-代理模式推荐)
2. [方式二：Cloudflare Origin 证书](#方式二cloudflare-origin-证书)
3. [一键部署脚本](#一键部署脚本)
4. [常见问题](#常见问题)

---

## 方式一：Cloudflare 代理模式（推荐）

这是最简单的方式，无需在服务器上配置证书。

### 工作原理

```
用户 ←→ [HTTPS] ←→ Cloudflare ←→ [HTTP/HTTPS] ←→ 您的服务器
```

Cloudflare 作为代理，负责处理 HTTPS 加密，您的服务器可以继续使用 HTTP。

### 配置步骤

#### 1. 确保域名已添加到 Cloudflare

登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)，确保您的域名已经添加并激活。

#### 2. 配置 DNS 记录

进入 **DNS** → **Records**：

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|----------|
| A | @ | 您的服务器 IP | 已代理 (橙色云朵) |
| A | www | 您的服务器 IP | 已代理 (橙色云朵) |

> ⚠️ **重要**：确保代理状态显示为**橙色云朵**（已代理），而不是灰色。

#### 3. 配置 SSL/TLS 模式

进入 **SSL/TLS** → **概述**：

- **灵活 (Flexible)**：如果您的服务器没有 SSL 证书
- **完全 (Full)**：如果您的服务器有自签名证书
- **完全（严格）(Full Strict)**：如果您的服务器有 Cloudflare Origin 证书

对于代理模式，选择 **灵活** 即可。

#### 4. 开启强制 HTTPS

进入 **SSL/TLS** → **边缘证书**：

- ✅ 开启 **始终使用 HTTPS**
- ✅ 开启 **自动 HTTPS 重写**
- ✅ 开启 **HSTS**（可选，增强安全性）

#### 5. 完成

配置完成后，用户访问 `https://yourdomain.com` 即可自动获得 HTTPS 加密。

您的服务器继续以 HTTP 方式运行（端口 80），无需任何修改。

---

## 方式二：Cloudflare Origin 证书

如果您需要全程加密（Cloudflare 到服务器也使用 HTTPS），请使用此方式。

### 步骤 1：获取 Origin 证书

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择您的域名
3. 进入 **SSL/TLS** → **源服务器**
4. 点击 **创建证书**
5. 保持默认选项（RSA，15年有效期）
6. 点击 **创建**
7. **重要**：复制并保存证书和私钥！私钥只显示一次！

### 步骤 2：保存证书文件

在项目根目录创建 `ssl` 文件夹，保存两个文件：

```
ssl/
├── cert.pem    # 证书内容
└── key.pem     # 私钥内容
```

**cert.pem** 示例格式：
```
-----BEGIN CERTIFICATE-----
MIIEojCCA4qgAwIBAgIUXXXXXXXX...
...
-----END CERTIFICATE-----
```

**key.pem** 示例格式：
```
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEF...
...
-----END PRIVATE KEY-----
```

### 步骤 3：运行部署脚本

双击运行 `scripts/setup-ssl.bat`，选择选项 2。

脚本会自动创建：
- `server-ssl.js` - HTTPS 服务器配置
- `start-ssl.bat` - SSL 启动脚本

### 步骤 4：启动 HTTPS 服务器

```bash
# 使用新的启动脚本
start-ssl.bat

# 或者手动运行
node server-ssl.js
```

### 步骤 5：配置 Cloudflare

在 **SSL/TLS** → **概述** 中选择 **完全（严格）** 模式。

---

## 一键部署脚本

运行以下脚本进行交互式配置：

```bash
# Windows
scripts\setup-ssl.bat
```

脚本会引导您完成配置，并自动生成所需文件。

---

## 常见问题

### Q: 选择哪种模式？

| 场景 | 推荐模式 |
|------|----------|
| 快速部署，不想折腾 | 代理模式 + 灵活 SSL |
| 需要全程加密 | Origin 证书 + 完全（严格）|
| 已有第三方 SSL 证书 | 完全 或 完全（严格）|

### Q: 为什么显示 "您的连接不是私密连接"？

1. DNS 未正确指向 Cloudflare
2. Cloudflare 代理未开启（云朵是灰色的）
3. SSL 模式配置错误

### Q: 端口 443 被占用怎么办？

```bash
# Windows 查看端口占用
netstat -ano | findstr :443

# 结束占用进程
taskkill /PID <进程ID> /F
```

### Q: 如何测试 SSL 是否生效？

1. 访问 `https://yourdomain.com`
2. 查看浏览器地址栏的锁图标
3. 使用 [SSL Labs](https://www.ssllabs.com/ssltest/) 测试

### Q: 证书过期怎么办？

- **Cloudflare 边缘证书**：自动续期，无需操作
- **Origin 证书**：默认 15 年有效期，到期前重新生成

---

## 安全建议

1. **不要将私钥提交到 Git**
   ```
   # .gitignore
   ssl/
   *.pem
   ```

2. **定期检查 SSL 配置**
   使用 [SSL Labs](https://www.ssllabs.com/ssltest/) 进行安全评估

3. **开启 HSTS**
   在 Cloudflare 边缘证书设置中开启 HSTS

4. **使用 TLS 1.3**
   在 Cloudflare SSL/TLS → 边缘证书中设置最低 TLS 版本为 1.2

---

## 相关文件

- `scripts/setup-ssl.bat` - SSL 部署脚本
- `server-ssl.js` - HTTPS 服务器（脚本生成）
- `start-ssl.bat` - SSL 启动脚本（脚本生成）
- `ssl/cert.pem` - 证书文件
- `ssl/key.pem` - 私钥文件
