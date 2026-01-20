/**
 * 修复损坏的游戏文件
 * 从数据库提取原始代码，重新生成静态游戏文件
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const GAME_ID = process.argv[2] || '27aa0968-1906-4f49-8616-4b284ca680c4';

console.log(`修复游戏文件: ${GAME_ID}`);

const db = new Database('./games.db', { readonly: true });

try {
  const row = db.prepare(
    `SELECT id, title, code, author_name, author_token, created_at FROM games WHERE id = ?`
  ).get(GAME_ID);
  
  if (!row) {
    console.error('游戏不存在');
    process.exit(1);
  }
  
  console.log(`游戏标题: ${row.title}`);
  console.log(`作者: ${row.author_name}`);
  console.log(`创建时间: ${row.created_at}`);
  console.log(`代码长度: ${row.code.length} 字符`);
  
  // 生成完整的游戏HTML文件
  const gameHtml = buildGameHtml(row);
  
  // 计算保存路径
  const subDir = GAME_ID.substring(0, 2);
  const outputDir = path.join('public', 'g', subDir);
  const outputFile = path.join(outputDir, `${GAME_ID}.html`);
  
  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // 备份原文件
  if (fs.existsSync(outputFile)) {
    const backupFile = outputFile + '.bak.' + Date.now();
    fs.copyFileSync(outputFile, backupFile);
    console.log(`已备份原文件到: ${backupFile}`);
  }
  
  // 写入修复后的文件
  fs.writeFileSync(outputFile, gameHtml, 'utf-8');
  console.log(`✅ 已修复游戏文件: ${outputFile}`);
  console.log(`文件大小: ${gameHtml.length} 字符`);
  
} finally {
  db.close();
}

function buildGameHtml(game) {
  // 解析原始代码，提取 head 和 body 内容
  let headContent = '';
  let bodyContent = game.code;
  
  const headMatch = game.code.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    headContent = headMatch[1];
  }
  
  const bodyMatch = game.code.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyContent = bodyMatch[1];
  } else {
    // 如果没有 body 标签，清理掉 html/head 结构
    bodyContent = bodyContent.replace(/<!DOCTYPE[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<html[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<\/html>/gi, '');
    bodyContent = bodyContent.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    bodyContent = bodyContent.replace(/<body[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<\/body>/gi, '');
  }
  
  // 格式化日期
  const createdAt = new Date(game.created_at);
  const dateStr = `${createdAt.getFullYear()}年${createdAt.getMonth() + 1}月${createdAt.getDate()}日`;
  
  // 构建完整的游戏页面（包含推广栏）
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="format-detection" content="telephone=no">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#1a1a2e">
  <meta name="description" content="${game.title} - AI一句话生成的游戏">
  <meta property="og:title" content="${game.title} - AI游戏">
  <meta property="og:description" content="这个游戏由AI一句话生成！关注公众号「游戏开发技术教程」，你也可以免费生成游戏！">
  <meta property="og:type" content="website">
  <title>${game.title} - AI游戏</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎮</text></svg>">
  <!-- 推广栏样式 -->
  <style>
/* 游戏家推广栏 - 固定在底部 */
.yxj-promo-bar {
  position: fixed !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 60px !important;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
  padding: 8px 12px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 10px !important;
  z-index: 999999 !important;
  box-shadow: 0 -2px 15px rgba(99, 102, 241, 0.4) !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}
.yxj-promo-bar.yxj-hidden {
  display: none !important;
}
.yxj-promo-qr {
  width: 44px !important;
  height: 44px !important;
  background: #fff !important;
  border-radius: 6px !important;
  padding: 2px !important;
  flex-shrink: 0 !important;
}
.yxj-promo-qr img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block !important;
}
.yxj-promo-info {
  color: #fff !important;
  font-size: 12px !important;
  line-height: 1.3 !important;
  text-align: left !important;
}
.yxj-promo-info strong {
  display: block !important;
  font-size: 13px !important;
  margin-bottom: 2px !important;
}
.yxj-promo-info span {
  opacity: 0.9 !important;
  font-size: 11px !important;
}
.yxj-promo-close {
  position: absolute !important;
  right: 6px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  background: rgba(255,255,255,0.2) !important;
  border: none !important;
  color: #fff !important;
  width: 22px !important;
  height: 22px !important;
  border-radius: 50% !important;
  cursor: pointer !important;
  font-size: 14px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  line-height: 1 !important;
}
.yxj-promo-home {
  position: fixed !important;
  top: 10px !important;
  left: 10px !important;
  width: 44px !important;
  height: 44px !important;
  background: rgba(30, 30, 50, 0.8) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  color: var(--text-secondary, #888) !important;
  text-decoration: none !important;
  padding: 0 !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  z-index: 999998 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgba(99, 102, 241, 0.3) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
  transition: all 0.2s ease !important;
  cursor: pointer !important;
}
.yxj-promo-home:hover {
  background: rgba(99, 102, 241, 0.2) !important;
  border-color: rgba(99, 102, 241, 0.5) !important;
  color: #fff !important;
}
.yxj-promo-home:active {
  transform: scale(0.92) !important;
  background: rgba(99, 102, 241, 0.3) !important;
}
.yxj-promo-home svg {
  width: 22px !important;
  height: 22px !important;
  stroke: currentColor !important;
}
/* TikTok 风格组件 */
.tiktok-author-info {
  position: fixed !important;
  left: 16px !important;
  bottom: 80px !important;
  z-index: 999997 !important;
  max-width: calc(100% - 100px) !important;
}
.tiktok-author-row {
  display: flex !important;
  align-items: flex-start !important;
  gap: 12px !important;
}
.tiktok-author-avatar {
  width: 48px !important;
  height: 48px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 24px !important;
  color: white !important;
  flex-shrink: 0 !important;
  cursor: pointer !important;
  border: 2px solid rgba(255,255,255,0.3) !important;
}
.tiktok-author-details {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 2px !important;
}
.tiktok-author-name {
  color: #fff !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5) !important;
}
.tiktok-publish-time {
  color: rgba(255,255,255,0.6) !important;
  font-size: 0.6875rem !important;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
  text-align: left !important;
  display: block !important;
  margin-top: 2px !important;
}
.tiktok-follow-btn {
  background: #fe2c55 !important;
  color: #fff !important;
  border: none !important;
  padding: 6px 16px !important;
  border-radius: 4px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}
.tiktok-follow-btn.following {
  background: rgba(255,255,255,0.2) !important;
}
.tiktok-side-actions {
  position: fixed !important;
  right: 12px !important;
  bottom: 120px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 20px !important;
  z-index: 999997 !important;
}
.tiktok-action-btn {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 4px !important;
  cursor: pointer !important;
}
.tiktok-action-icon {
  width: 48px !important;
  height: 48px !important;
  border-radius: 50% !important;
  background: rgba(255,255,255,0.1) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 24px !important;
  color: #fff !important;
  backdrop-filter: blur(8px) !important;
}
.tiktok-action-btn.active .tiktok-action-icon {
  color: #fe2c55 !important;
}
.tiktok-action-count {
  color: #fff !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5) !important;
}
/* 为推广栏预留底部空间 */
body { padding-bottom: 70px !important; }
canvas { max-height: calc(100vh - 70px) !important; }
  </style>
  ${headContent}
</head>
<body>
${bodyContent}

<!-- 游戏家顶部导航 - 返回按钮 -->
<button class="yxj-promo-home" onclick="window.history.length > 1 ? window.history.back() : window.location.href='/'" title="返回">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
</button>

<!-- 抖音风格左下角作者信息 -->
<div class="tiktok-author-info" id="tiktok-author-info">
  <div class="tiktok-author-row">
    <div class="tiktok-author-avatar" id="author-avatar" onclick="openAuthorProfile()">👤</div>
    <div class="tiktok-author-details">
      <div style="display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="tiktok-author-name" id="author-name" onclick="openAuthorProfile()">${game.author_name || '匿名用户'}</span>
          <button class="tiktok-follow-btn" id="tiktok-follow-btn" data-token="${game.author_token}" onclick="toggleFollow()">
            <span class="follow-icon">+</span> 关注
          </button>
        </div>
        <span class="tiktok-publish-time">发布于 ${dateStr}</span>
      </div>
    </div>
  </div>
</div>

<!-- 抖音风格右侧互动按钮 -->
<div class="tiktok-side-actions">
  <div class="tiktok-action-btn" id="like-btn" onclick="toggleLike()">
    <div class="tiktok-action-icon" id="like-icon">❤️</div>
    <span class="tiktok-action-count" id="like-count">0</span>
  </div>
  <div class="tiktok-action-btn" onclick="shareGame()">
    <div class="tiktok-action-icon">↗️</div>
    <span class="tiktok-action-count">分享</span>
  </div>
  <div class="tiktok-action-btn" id="favorite-btn" onclick="toggleFavorite()">
    <div class="tiktok-action-icon" id="favorite-icon">⭐</div>
    <span class="tiktok-action-count" id="favorite-count">收藏</span>
  </div>
</div>

<!-- 游戏家推广栏 -->
<div class="yxj-promo-bar" id="yxj-promo" onclick="showPromoModal()" style="cursor:pointer;">
  <div class="yxj-promo-qr">
    <img src="/images/getqrcode.png" alt="二维码" onerror="this.parentElement.innerHTML='🎮'">
  </div>
  <div class="yxj-promo-info">
    <strong>🎮 想要自己生成游戏?</strong>
    <span>关注公众号「游戏开发技术教程」免费制作</span>
  </div>
  <button class="yxj-promo-close" onclick="event.stopPropagation();closePromo()">×</button>
</div>

<!-- 互动功能脚本 -->
<script>
const GAME_ID = '${game.id}';

// 关闭推广栏
function closePromo() {
  document.getElementById('yxj-promo').classList.add('yxj-hidden');
}

// 显示推广弹窗
function showPromoModal() {
  window.open('https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=MzU5MjY1NTkwMA==', '_blank');
}

// 打开作者主页
function openAuthorProfile() {
  window.location.href = '/?author=' + encodeURIComponent(document.getElementById('author-name').textContent);
}

// 关注/取消关注
function toggleFollow() {
  const btn = document.getElementById('tiktok-follow-btn');
  btn.classList.toggle('following');
  if (btn.classList.contains('following')) {
    btn.innerHTML = '✓ 已关注';
  } else {
    btn.innerHTML = '<span class="follow-icon">+</span> 关注';
  }
}

// 点赞
function toggleLike() {
  const btn = document.getElementById('like-btn');
  const icon = document.getElementById('like-icon');
  const count = document.getElementById('like-count');
  
  btn.classList.toggle('active');
  const liked = btn.classList.contains('active');
  
  fetch('/api/games/' + GAME_ID + '/like', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ liked })
  }).then(r => r.json()).then(data => {
    if (data.like_count !== undefined) {
      count.textContent = data.like_count;
    }
  }).catch(() => {});
}

// 收藏
function toggleFavorite() {
  const btn = document.getElementById('favorite-btn');
  btn.classList.toggle('active');
  // TODO: 实现收藏功能
}

// 分享
function shareGame() {
  if (navigator.share) {
    navigator.share({
      title: '${game.title} - AI游戏',
      text: '这个游戏由AI一句话生成！',
      url: window.location.href
    });
  } else {
    // 复制链接
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('链接已复制！');
    });
  }
}

// 加载互动数据
fetch('/api/games/' + GAME_ID)
  .then(r => r.json())
  .then(data => {
    if (data.like_count !== undefined) {
      document.getElementById('like-count').textContent = data.like_count;
    }
  }).catch(() => {});
</script>
</body>
</html>`;
}