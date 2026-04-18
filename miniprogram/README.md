# 一句话游戏 - 微信小程序

微信小程序简化版，提供游戏列表展示、游戏详情查看、用户登录等功能。由于个人主体小程序限制，游戏创作和游戏游玩需跳转到网页版完成。

## 账号与网站一致

- **邮箱注册 / 邮箱登录**与网站调用同一套 Worker 接口（`POST /api/account/register`、`/api/account/login`），**同一邮箱即同一用户**：积分、作品、昵称等在 KV 中共存。
- **微信一键登录**会生成与网站同一 `user_accounts` 记录；若要在**浏览器网站**用密码登录，请先在 **我的 → 设置 → 设置网站登录密码（网页登录用）** 设密（调用 `POST /api/account/password`），再在网站用 **账号 ID 或已绑邮箱 + 密码** 登录。也可在 **我的 → 绑定邮箱** 同时绑定邮箱与密码，网站侧用邮箱登录。
- **领取、兑换积分**仅在小程序内完成（Worker 对非小程序来源的积分类 POST 会拒绝）；**消耗积分**在网站生成游戏时同样扣的是该账号在 KV 中的积分。

## 📁 项目结构

```
miniprogram/
├── app.js                 # 小程序入口文件
├── app.json               # 小程序全局配置
├── app.wxss               # 全局样式
├── project.config.json    # 项目配置
├── sitemap.json           # 站点地图配置
├── assets/
│   └── icons/             # TabBar图标
│       └── README.md
├── pages/
│   ├── index/             # 首页 - 游戏列表
│   │   ├── index.js
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   ├── mine/              # 我的 - 个人中心
│   │   ├── mine.js
│   │   ├── mine.wxml
│   │   ├── mine.wxss
│   │   └── mine.json
│   └── game-detail/       # 游戏详情页
│       ├── game-detail.js
│       ├── game-detail.wxml
│       ├── game-detail.wxss
│       └── game-detail.json
└── README.md              # 本文档
```

## 🚀 快速开始

### 1. 准备工作

1. **注册小程序账号**
   - 访问 [微信公众平台](https://mp.weixin.qq.com)
   - 选择"小程序"注册
   - 完成主体认证

2. **下载开发者工具**
   - 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
   - 安装并登录

### 2. 配置项目

1. **修改 AppID**
   
   打开 `project.config.json`，将 `appid` 改为你的小程序 AppID：
   ```json
   {
     "appid": "你的AppID"
   }
   ```

2. **配置服务器域名**
   
   在微信公众平台 → 开发管理 → 开发设置 → 服务器域名，添加（与 `app.js` 里 `baseUrl` / `webUrl` 一致）：
   - **request 合法域名**：`https://api.yijuhuayouxi.com`（API 走 Cloudflare Worker，**不依赖你本机或自建 VPS**）
   - **业务域名 / web-view**（若使用）：`https://www.yijuhuayouxi.com`（网站静态站 + 自定义域）

### 3. 导入项目

1. 打开微信开发者工具
2. 点击"导入项目"
3. 选择 `miniprogram` 文件夹
4. 填入你的 AppID
5. 点击"导入"

### 4. 准备图标

在 `assets/icons/` 文件夹中放入以下图标文件：
- `home.png` - 首页图标（未选中）
- `home-active.png` - 首页图标（选中）
- `mine.png` - 我的图标（未选中）
- `mine-active.png` - 我的图标（选中）

图标尺寸：81×81 像素，PNG格式

## 🔧 后端适配

线上一律走 **Cloudflare Worker**（`../worker/`，路由含 `/api/wechat/login`、`/api/site-config` 等），**不需要**在你本机或 VPS 上跑 `server.js`。

以下为历史说明：若你仍用旧版一体化 Node 服务，可参考其中登录逻辑（字段名以当前 Worker / `server.js` 实现为准）。

### （可选）在自建 Node 中实现登录接口

```javascript
// server.js 中添加（可选；与 Worker 二选一）

// 微信小程序登录接口
app.post('/api/wechat/login', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.json({ success: false, error: '缺少code参数' });
  }

  try {
    // 使用code换取openid
    const wxRes = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    const { openid, session_key, errcode, errmsg } = wxRes.data;
    
    if (errcode) {
      return res.json({ success: false, error: errmsg || '微信登录失败' });
    }

    // 查找或创建用户
    let user = db.prepare('SELECT * FROM users WHERE wechat_openid = ?').get(openid);
    
    if (!user) {
      // 创建新用户
      const user_token = generateUUID();
      const account_id = '玩家' + Math.random().toString(36).substr(2, 6).toUpperCase();
      
      db.prepare(`
        INSERT INTO users (user_token, account_id, wechat_openid, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(user_token, account_id, openid);
      
      user = db.prepare('SELECT * FROM users WHERE user_token = ?').get(user_token);
    }

    // 返回用户信息
    res.json({
      success: true,
      data: {
        token: user.user_token,
        userInfo: {
          account_id: user.account_id,
          nickname: user.nickname,
          avatar_emoji: user.avatar_emoji,
          credits: user.credits
        }
      }
    });
    
  } catch (err) {
    console.error('微信登录错误:', err);
    res.json({ success: false, error: '服务器错误' });
  }
});
```

### 数据库表修改

在 users 表中添加微信 openid 字段：

```sql
ALTER TABLE users ADD COLUMN wechat_openid TEXT;
CREATE INDEX idx_users_wechat_openid ON users(wechat_openid);
```

### 环境变量

在 `.env` 文件中添加：

```env
# 微信小程序配置
WECHAT_APPID=你的小程序AppID
WECHAT_SECRET=你的小程序AppSecret
```

## 📱 功能说明

### 首页（游戏列表）
- 精选/最新/热门游戏切换
- 下拉刷新
- 上拉加载更多
- 点击进入游戏详情

### 游戏详情页
- 游戏信息展示
- 点赞、收藏功能
- 分享给好友
- "去网页玩游戏"按钮（复制链接到剪贴板）

### 我的页面
- 微信登录
- 用户信息展示
- 积分查看
- 跳转网页版

## ⚠️ 限制说明

由于**个人主体小程序**不支持 `web-view` 组件，以下功能需要引导用户到网页完成：

1. **游戏创作** - 点击按钮复制网页链接
2. **游戏游玩** - 点击按钮复制游戏链接
3. **评论发表** - 显示已有评论，发表需去网页

如果升级为**企业主体**，可以使用 web-view 直接嵌入网页游玩。

## 🚀 发布流程

### 1. 上传代码

在微信开发者工具中：
1. 点击右上角"上传"
2. 填写版本号（如 1.0.0）
3. 填写项目备注
4. 点击"上传"

### 2. 提交审核

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入"版本管理"
3. 在"开发版本"中找到刚上传的版本
4. 点击"提交审核"
5. 填写审核信息

### 3. 发布上线

审核通过后（通常1-7天）：
1. 在"审核版本"中点击"发布"
2. 小程序即刻上线

## 🔄 CI/CD 自动上传（可选）

使用 miniprogram-ci 实现自动上传：

### 安装

```bash
npm install miniprogram-ci --save-dev
```

### 配置密钥

1. 在微信公众平台 → 开发管理 → 开发设置
2. 点击"小程序代码上传密钥"→"生成"
3. 下载密钥文件到项目目录

### 上传脚本

```javascript
// upload.js
const ci = require('miniprogram-ci');

const project = new ci.Project({
  appid: '你的AppID',
  type: 'miniProgram',
  projectPath: './miniprogram',
  privateKeyPath: './private.key',
  ignores: ['node_modules/**/*']
});

async function upload() {
  const uploadResult = await ci.upload({
    project,
    version: '1.0.0',
    desc: '自动上传',
    setting: {
      es6: true,
      minify: true
    }
  });
  console.log('上传成功:', uploadResult);
}

upload().catch(console.error);
```

### 运行上传

```bash
node upload.js
```

## 📝 更新日志

### v1.0.0 (2026-01-24)
- 初始版本
- 首页游戏列表
- 游戏详情页
- 我的页面
- 微信登录功能
