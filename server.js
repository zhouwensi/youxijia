require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ==================== 静态游戏文件系统 ====================

// 静态游戏存储目录
const GAMES_STATIC_DIR = path.join(__dirname, 'public', 'g');

// 确保游戏目录存在
function ensureGameDir(gameId) {
  // 使用游戏ID前2位作为子目录，避免单目录文件过多
  const subDir = gameId.substring(0, 2);
  const gameDir = path.join(GAMES_STATIC_DIR, subDir);
  if (!fs.existsSync(gameDir)) {
    fs.mkdirSync(gameDir, { recursive: true });
  }
  return gameDir;
}

// 获取游戏静态文件路径
function getGameFilePath(gameId) {
  const subDir = gameId.substring(0, 2);
  return path.join(GAMES_STATIC_DIR, subDir, `${gameId}.html`);
}

// 获取游戏静态访问URL
function getGameStaticUrl(gameId) {
  const subDir = gameId.substring(0, 2);
  return `/g/${subDir}/${gameId}.html`;
}

// HTML属性转义（用于srcdoc）
function escapeHtmlAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// HTML内容转义
function escapeHtmlSafe(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 保存游戏静态文件
function saveGameStaticFile(gameId, gameCode, gameInfo) {
  try {
    // 确保目录存在
    ensureGameDir(gameId);
    
    // 生成独立页面HTML
    const standaloneHtml = generateStandaloneGameHtml(gameCode, {
      ...gameInfo,
      gameId
    });
    
    // 写入文件
    const filePath = getGameFilePath(gameId);
    fs.writeFileSync(filePath, standaloneHtml, 'utf-8');
    
    console.log(`[INFO] 游戏静态文件已保存: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] 保存游戏静态文件失败: ${error.message}`);
    return false;
  }
}

// 删除游戏静态文件
function deleteGameStaticFile(gameId) {
  try {
    const filePath = getGameFilePath(gameId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[INFO] 游戏静态文件已删除: ${filePath}`);
    }
    return true;
  } catch (error) {
    console.error(`[ERROR] 删除游戏静态文件失败: ${error.message}`);
    return false;
  }
}

// 生成独立游戏HTML页面（直接嵌入游戏代码，不使用iframe，微信兼容）
function generateStandaloneGameHtml(gameCode, gameInfo) {
  const { title, authorName, gameId, prompt } = gameInfo;
  
  const safeTitle = escapeHtmlSafe(title || '未命名游戏');
  const safeAuthor = escapeHtmlSafe(authorName || '匿名');
  const safePrompt = escapeHtmlSafe(prompt || title || '');
  
  // 从游戏代码中提取<head>和<body>内容
  let headContent = '';
  let bodyContent = '';
  let bodyAttrs = '';
  
  // 提取<head>内容
  const headMatch = gameCode.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    headContent = headMatch[1];
    // 移除原有的title标签，我们会添加自己的
    headContent = headContent.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
  }
  
  // 提取<body>内容和属性
  const bodyMatch = gameCode.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    bodyAttrs = bodyMatch[1] || '';
    bodyContent = bodyMatch[2];
  } else {
    // 如果没有body标签，使用整个代码
    bodyContent = gameCode;
  }
  
  // 移除游戏代码中原有的 aigame-watermark 水印按钮（我们已有自己的推广栏）
  bodyContent = bodyContent.replace(/<a[^>]*class="aigame-watermark"[^>]*>[\s\S]*?<\/a>/gi, '');
  // 移除相关的样式（如果在style标签内）
  headContent = headContent.replace(/\.aigame-watermark[\s\S]*?(?=\})\}/g, '');
  
  // 底部推广栏的样式和HTML（会注入到游戏页面底部）
  const promoBarStyle = `
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
  background: rgba(0,0,0,0.5) !important;
  color: #fff !important;
  text-decoration: none !important;
  padding: 6px 12px !important;
  border-radius: 20px !important;
  font-size: 12px !important;
  z-index: 999998 !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
}
/* TikTok 风格组件 */
.tiktok-author-info {
  position: fixed !important;
  left: 16px !important;
  bottom: 80px !important;
  display: flex !important;
  align-items: flex-start !important;
  flex-direction: column !important;
  gap: 8px !important;
  z-index: 999998 !important;
  padding: 0 !important;
  pointer-events: auto !important;
}
.tiktok-author-row {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
.tiktok-author-avatar {
  width: 44px !important;
  height: 44px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1.5rem !important;
  border: 2px solid rgba(255, 255, 255, 0.5) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
  cursor: pointer !important;
  transition: transform 0.2s, box-shadow 0.2s !important;
  text-decoration: none !important;
}
.tiktok-author-avatar:hover {
  transform: scale(1.05) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
}
.tiktok-author-details {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 10px !important;
}
.tiktok-author-name {
  color: white !important;
  font-size: 1rem !important;
  font-weight: 700 !important;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8) !important;
  cursor: pointer !important;
  transition: opacity 0.2s !important;
}
.tiktok-author-name:hover {
  opacity: 0.8 !important;
}
.tiktok-follow-btn {
  background: #fe2c55 !important;
  color: white !important;
  border: none !important;
  padding: 6px 16px !important;
  border-radius: 4px !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  transition: all 0.2s ease !important;
  text-shadow: none !important;
}
.tiktok-follow-btn:hover {
  background: #e6284d !important;
  transform: scale(1.02) !important;
}
.tiktok-follow-btn:active {
  transform: scale(0.95) !important;
}
.tiktok-sidebar {
  position: fixed !important;
  right: 12px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
  z-index: 999998 !important;
  pointer-events: auto !important;
}
.tiktok-action {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 4px !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  -webkit-tap-highlight-color: transparent !important;
}
.tiktok-action:active {
  transform: scale(0.9) !important;
}
.tiktok-icon {
  width: 48px !important;
  height: 48px !important;
  border-radius: 50% !important;
  background: rgba(0, 0, 0, 0.6) !important;
  backdrop-filter: blur(8px) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 24px !important;
  transition: all 0.2s ease !important;
  border: 2px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  color: #fff !important;
}
.tiktok-action:hover .tiktok-icon {
  transform: scale(1.1) !important;
  background: rgba(0, 0, 0, 0.8) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
}
.tiktok-count {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: #fff !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8) !important;
  white-space: nowrap !important;
}
.tiktok-action.liked .tiktok-icon {
  background: rgba(239, 68, 68, 0.8) !important;
  border-color: #ef4444 !important;
  animation: likePopTiktok 0.3s ease !important;
}
@keyframes likePopTiktok {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
.tiktok-action.favorited .tiktok-icon {
  background: rgba(251, 191, 36, 0.8) !important;
  border-color: #fbbf24 !important;
}
.tiktok-action.tiktok-info {
  cursor: default !important;
  opacity: 0.8 !important;
}
/* 为推广栏预留底部空间 */
body {
  padding-bottom: 65px !important;
}
`;

  // 从gameInfo获取authorToken
  const authorToken = gameInfo.authorToken || '';
  
  const promoBarHtml = `
<!-- 游戏家顶部导航 -->
<a class="yxj-promo-home" href="/" title="更多游戏">🏠 更多游戏</a>

<!-- 抖音风格左下角作者信息 -->
<div class="tiktok-author-info" id="tiktok-author-info">
  <div class="tiktok-author-row">
    <div class="tiktok-author-avatar" id="author-avatar" onclick="openAuthorProfile()">👤</div>
    <div class="tiktok-author-details">
      <span class="tiktok-author-name" id="author-name" onclick="openAuthorProfile()">${safeAuthor}</span>
      <button class="tiktok-follow-btn" id="tiktok-follow-btn" data-token="${authorToken}" onclick="toggleFollow()">
        <span class="follow-icon">+</span> 关注
      </button>
    </div>
  </div>
</div>

<!-- TikTok风格右侧互动栏 -->
<div class="tiktok-sidebar">
  <div class="tiktok-action" id="stat-like-btn" onclick="likeGame()">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    </div>
    <span class="tiktok-count" id="stat-likes">0</span>
  </div>
  <div class="tiktok-action" id="stat-fav-btn" onclick="toggleFavorite()">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
    </div>
  </div>
  <div class="tiktok-action" onclick="openSharePanel()">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
    </div>
  </div>
  <div class="tiktok-action tiktok-info" title="游玩次数">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
    </div>
    <span class="tiktok-count" id="stat-plays">0</span>
  </div>
</div>

<!-- 关注弹窗 -->
<div id="promo-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;align-items:center;justify-content:center;" onclick="document.getElementById('promo-modal').style.display='none'">
  <div style="background:transparent;border-radius:12px;padding:10px;width:90%;max-width:400px;text-align:center;position:relative;" onclick="event.stopPropagation()">
    <button onclick="document.getElementById('promo-modal').style.display='none'" style="position:absolute;right:0;top:0;border:none;background:rgba(0,0,0,0.5);width:28px;height:28px;border-radius:50%;font-size:18px;cursor:pointer;color:#fff;z-index:1;">×</button>
    <img src="/images/wechat-qrcode.png" style="width:100%;height:auto;display:block;border-radius:12px;">
  </div>
</div>

<!-- 游戏家推广栏 -->
<div class="yxj-promo-bar" id="yxj-promo" onclick="showPromoModal()" style="cursor:pointer;">
  <button class="yxj-promo-close" onclick="event.stopPropagation();document.getElementById('yxj-promo').classList.add('yxj-hidden');document.body.style.paddingBottom='0';">×</button>
  <div class="yxj-promo-qr">
    <img src="/images/getqrcode.png" alt="公众号">
  </div>
  <div class="yxj-promo-info">
    <strong>🎮 关注「游戏开发技术教程」</strong>
    <span>一句话免费生成你的专属游戏！</span>
  </div>
</div>

<!-- 分享面板 -->
<div id="share-panel" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;align-items:flex-end;justify-content:center;" onclick="closeSharePanel()">
  <div style="background:#fff;border-radius:16px 16px 0 0;padding:20px;width:100%;max-width:500px;text-align:center;position:relative;max-height:80vh;overflow-y:auto;" onclick="event.stopPropagation()">
    <div style="width:40px;height:4px;background:#ddd;border-radius:2px;margin:0 auto 15px;"></div>
    <h3 style="margin:0 0 15px;font-size:18px;">📤 分享游戏</h3>
    <div style="background:#f5f5f5;border-radius:8px;padding:12px;margin-bottom:15px;">
      <textarea id="share-text" readonly style="width:100%;border:none;background:transparent;font-size:14px;resize:none;min-height:80px;outline:none;"></textarea>
    </div>
    <button onclick="copyShareText()" style="width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:10px;">📋 复制分享内容</button>
    <button onclick="closeSharePanel()" style="width:100%;padding:12px;background:#f0f0f0;color:#666;border:none;border-radius:8px;font-size:14px;cursor:pointer;">取消</button>
  </div>
</div>

<!-- 作者主页弹窗 -->
<div id="author-profile-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:999999;align-items:center;justify-content:center;" onclick="closeAuthorProfile()">
  <div style="background:#fff;border-radius:12px;padding:20px;width:90%;max-width:360px;text-align:center;position:relative;" onclick="event.stopPropagation()">
    <button onclick="closeAuthorProfile()" style="position:absolute;right:10px;top:10px;border:none;background:none;font-size:24px;cursor:pointer;color:#999;">×</button>
    <div id="author-profile-content" style="min-height:150px;"></div>
  </div>
</div>

<script>
// 获取游戏ID和作者信息
const gameId = '${gameId}';
const gameTitle = '${safeTitle}';
const authorToken = '${authorToken}';
const authorName = '${safeAuthor}';
const API_BASE = '/api/games';

// 调试日志
console.log('[DEBUG] 游戏页面初始化');
console.log('[DEBUG] gameId:', gameId);
console.log('[DEBUG] authorToken:', authorToken);
console.log('[DEBUG] authorName:', authorName);

// 辅助函数
function showPromoModal() {
  console.log('[DEBUG] showPromoModal 被调用');
  document.getElementById('promo-modal').style.display = 'flex';
}

function getUserToken() {
  return localStorage.getItem('aigame-user-token') || '';
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = getUserToken();
  if (token) {
    headers['X-User-Token'] = token;
  }
  return headers;
}

// 记录游玩
(function(){
  try {
    fetch(API_BASE + '/' + gameId + '/play', { method: 'POST', headers: getAuthHeaders() }).catch(function(){});
  } catch(e) {}
})();

// 获取统计数据和用户状态
function loadStats() {
  // 获取游戏统计
  fetch(API_BASE + '/' + gameId, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const likesEl = document.getElementById('stat-likes');
        const count = data.game.likes_count || data.game.like_count || 0;
        likesEl.innerText = count;
        document.getElementById('stat-plays').innerText = data.game.play_count || 0;
      }
    })
    .catch(err => console.error('加载统计失败', err));
  
  // 获取用户点赞状态
  const userToken = getUserToken();
  if (userToken) {
    fetch(API_BASE + '/' + gameId + '/like-status', { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.liked) {
          document.getElementById('stat-like-btn').classList.add('liked');
        }
      })
      .catch(() => {});
    
    // 获取用户收藏状态
    fetch(API_BASE + '/' + gameId + '/favorite-status', { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.favorited) {
          document.getElementById('stat-fav-btn').classList.add('favorited');
        }
      })
      .catch(() => {});
    
    // 检查关注状态
    if (authorToken && authorToken !== userToken) {
      checkFollowStatus();
    } else if (authorToken === userToken) {
      // 隐藏自己的关注按钮
      const followBtn = document.getElementById('tiktok-follow-btn');
      if (followBtn) followBtn.style.display = 'none';
    }
  }
}

// 点赞（支持取消）
function likeGame() {
  const btn = document.getElementById('stat-like-btn');
  const isLiked = btn.classList.contains('liked');
  const countEl = document.getElementById('stat-likes');
  let count = parseInt(countEl.innerText) || 0;
  
  // 乐观UI更新
  if (isLiked) {
    btn.classList.remove('liked');
    countEl.innerText = Math.max(0, count - 1);
  } else {
    btn.classList.add('liked');
    countEl.innerText = count + 1;
  }
  
  fetch(API_BASE + '/' + gameId + '/like', { 
    method: 'POST',
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // 更新实际数量
        countEl.innerText = data.like_count || data.likeCount || countEl.innerText;
        if (data.liked !== undefined) {
          btn.classList.toggle('liked', data.liked);
        }
      } else {
        // 失败回滚
        btn.classList.toggle('liked', isLiked);
        countEl.innerText = count;
      }
    })
    .catch(err => {
      console.error(err);
      btn.classList.toggle('liked', isLiked);
      countEl.innerText = count;
    });
}

// 收藏
function toggleFavorite() {
  const btn = document.getElementById('stat-fav-btn');
  const isFav = btn.classList.contains('favorited');
  
  // 乐观UI切换
  btn.classList.toggle('favorited', !isFav);
  
  fetch(API_BASE + '/' + gameId + '/favorite', { 
    method: 'POST', 
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.favorited !== undefined) {
        btn.classList.toggle('favorited', data.favorited);
      }
    })
    .catch(() => {
      // 失败回滚
      btn.classList.toggle('favorited', isFav);
    });
}

// 打开分享面板
function openSharePanel() {
  const url = window.location.href;
  const shareText = '🎮 我发现了一个有趣的AI游戏：「' + gameTitle + '」\\n\\n👆 点击链接立即游玩：\\n' + url + '\\n\\n💡 关注公众号「游戏开发技术教程」，一句话免费生成你的专属游戏！';
  document.getElementById('share-text').value = shareText;
  document.getElementById('share-panel').style.display = 'flex';
}

// 关闭分享面板
function closeSharePanel() {
  document.getElementById('share-panel').style.display = 'none';
}

// 复制分享内容
function copyShareText() {
  const text = document.getElementById('share-text').value;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      alert('分享内容已复制，快去分享给好友吧！');
      closeSharePanel();
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  alert('分享内容已复制，快去分享给好友吧！');
  closeSharePanel();
}

// 打开作者主页
function openAuthorProfile() {
  console.log('[DEBUG] openAuthorProfile 被调用, authorToken:', authorToken);
  if (!authorToken) {
    console.log('[DEBUG] authorToken为空，显示推广弹窗');
    showPromoModal();
    return;
  }
  
  console.log('[DEBUG] 显示作者主页弹窗');
  const modal = document.getElementById('author-profile-modal');
  const content = document.getElementById('author-profile-content');
  content.innerHTML = '<div style="padding:20px;color:#999;">加载中...</div>';
  modal.style.display = 'flex';
  
  // 加载作者信息
  Promise.all([
    fetch('/api/users/' + authorToken + '/profile', { headers: getAuthHeaders() }).then(r => r.json()).catch(() => ({})),
    fetch('/api/users/' + authorToken + '/follow-stats', { headers: getAuthHeaders() }).then(r => r.json()).catch(() => ({})),
    fetch('/api/users/' + authorToken + '/games?limit=4', { headers: getAuthHeaders() }).then(r => r.json()).catch(() => ({ games: [] }))
  ]).then(([profileData, statsData, gamesData]) => {
    const nickname = (profileData.profile && profileData.profile.nickname) || authorName || '游戏创作者';
    const followers = statsData.followerCount || statsData.followers || 0;
    const following = statsData.followingCount || statsData.following || 0;
    const games = gamesData.games || [];
    
    let gamesHtml = '';
    if (games.length > 0) {
      gamesHtml = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:15px;">' +
        games.slice(0, 4).map(g => '<a href="/g/' + g.id.substring(0,2) + '/' + g.id + '.html" style="background:#f5f5f5;border-radius:8px;padding:10px;text-decoration:none;color:#333;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🎮 ' + (g.title || '未命名').substring(0, 10) + '</a>').join('') +
        '</div>';
    }
    
    content.innerHTML = 
      '<div style="margin-bottom:15px;">' +
        '<div style="width:60px;height:60px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:28px;">👤</div>' +
        '<div style="font-size:18px;font-weight:600;color:#333;">' + nickname + '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:center;gap:30px;margin-bottom:15px;">' +
        '<div style="text-align:center;"><strong style="font-size:20px;color:#333;display:block;">' + following + '</strong><span style="color:#999;font-size:12px;">关注</span></div>' +
        '<div style="text-align:center;"><strong style="font-size:20px;color:#333;display:block;">' + followers + '</strong><span style="color:#999;font-size:12px;">粉丝</span></div>' +
        '<div style="text-align:center;"><strong style="font-size:20px;color:#333;display:block;">' + games.length + '</strong><span style="color:#999;font-size:12px;">作品</span></div>' +
      '</div>' +
      '<button id="profile-follow-btn" onclick="toggleFollowFromProfile()" style="width:100%;padding:10px;background:#fe2c55;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">+ 关注</button>' +
      gamesHtml;
    
    // 检查关注状态
    checkFollowStatusForProfile();
  }).catch(() => {
    content.innerHTML = '<div style="padding:20px;color:#999;">加载失败</div>';
  });
}

// 关闭作者主页
function closeAuthorProfile() {
  document.getElementById('author-profile-modal').style.display = 'none';
}

// 检查关注状态
function checkFollowStatus() {
  if (!authorToken) return;
  fetch('/api/users/' + authorToken + '/follow-status', { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.following) {
        const btn = document.getElementById('tiktok-follow-btn');
        if (btn) {
          btn.classList.add('following');
          btn.innerHTML = '✓ 已关注';
        }
      }
    })
    .catch(() => {});
}

// 检查关注状态（主页弹窗）
function checkFollowStatusForProfile() {
  if (!authorToken) return;
  fetch('/api/users/' + authorToken + '/follow-status', { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      const btn = document.getElementById('profile-follow-btn');
      if (btn && data.success && data.following) {
        btn.style.background = '#eee';
        btn.style.color = '#666';
        btn.innerHTML = '✓ 已关注';
      }
    })
    .catch(() => {});
}

// 切换关注状态
function toggleFollow() {
  console.log('[DEBUG] toggleFollow 被调用, authorToken:', authorToken);
  if (!authorToken) {
    console.log('[DEBUG] authorToken为空，显示推广弹窗');
    showPromoModal();
    return;
  }
  
  const userToken = getUserToken();
  console.log('[DEBUG] userToken:', userToken);
  if (!userToken) {
    alert('请先登录');
    return;
  }
  if (authorToken === userToken) {
    alert('不能关注自己哦');
    return;
  }
  
  const btn = document.getElementById('tiktok-follow-btn');
  const isFollowing = btn.classList.contains('following');
  
  // 乐观更新
  if (isFollowing) {
    btn.classList.remove('following');
    btn.innerHTML = '<span class="follow-icon">+</span> 关注';
  } else {
    btn.classList.add('following');
    btn.innerHTML = '✓ 已关注';
  }
  
  fetch('/api/users/' + authorToken + '/follow', {
    method: 'POST',
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        btn.classList.toggle('following', data.following);
        btn.innerHTML = data.following ? '✓ 已关注' : '<span class="follow-icon">+</span> 关注';
      } else {
        // 回滚
        btn.classList.toggle('following', isFollowing);
        btn.innerHTML = isFollowing ? '✓ 已关注' : '<span class="follow-icon">+</span> 关注';
      }
    })
    .catch(() => {
      btn.classList.toggle('following', isFollowing);
      btn.innerHTML = isFollowing ? '✓ 已关注' : '<span class="follow-icon">+</span> 关注';
    });
}

// 从主页弹窗切换关注
function toggleFollowFromProfile() {
  if (!authorToken) return;
  
  const userToken = getUserToken();
  if (!userToken) {
    alert('请先登录');
    return;
  }
  
  const btn = document.getElementById('profile-follow-btn');
  const isFollowing = btn.innerHTML.includes('已关注');
  
  // 乐观更新
  if (isFollowing) {
    btn.style.background = '#fe2c55';
    btn.style.color = '#fff';
    btn.innerHTML = '+ 关注';
  } else {
    btn.style.background = '#eee';
    btn.style.color = '#666';
    btn.innerHTML = '✓ 已关注';
  }
  
  fetch('/api/users/' + authorToken + '/follow', {
    method: 'POST',
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (data.following) {
          btn.style.background = '#eee';
          btn.style.color = '#666';
          btn.innerHTML = '✓ 已关注';
        } else {
          btn.style.background = '#fe2c55';
          btn.style.color = '#fff';
          btn.innerHTML = '+ 关注';
        }
        // 同步更新底部的关注按钮
        const tikBtn = document.getElementById('tiktok-follow-btn');
        if (tikBtn) {
          tikBtn.classList.toggle('following', data.following);
          tikBtn.innerHTML = data.following ? '✓ 已关注' : '<span class="follow-icon">+</span> 关注';
        }
      }
    })
    .catch(() => {});
}

// 初始化
window.addEventListener('load', loadStats);
</script>
`;
  
  // 生成最终的独立HTML页面 - 直接嵌入游戏代码
  const standaloneHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="format-detection" content="telephone=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#1a1a2e">
  <meta name="description" content="${safePrompt} - AI一句话生成的游戏">
  <meta property="og:title" content="${safeTitle} - AI游戏">
  <meta property="og:description" content="这个游戏由AI一句话生成！关注公众号「${BRAND_CONFIG.name}」，你也可以免费生成游戏！">
  <meta property="og:type" content="website">
  <title>${safeTitle} - AI游戏</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎮</text></svg>">
  <!-- 推广栏样式 -->
  <style>${promoBarStyle}</style>
  <!-- 原游戏head内容 -->
  ${headContent}
</head>
<body${bodyAttrs}>
  <!-- 原游戏body内容 -->
  ${bodyContent}
  <!-- 推广栏 -->
  ${promoBarHtml}
</body>
</html>`;

  return standaloneHtml;
}

const app = express();
const PORT = process.env.PORT || 3000;

// 测试模式：设为 true 将使用本地HTML文件而不调用LLM
const TEST_MODE = false;
const TEST_HTML_PATH = path.join(__dirname, 'temp', 'test.html');

// ==================== 品牌水印系统 ====================

// 品牌配置
const BRAND_CONFIG = {
  name: '游戏开发技术教程',
  slogan: '一句话，AI帮你写游戏',
  website: '',  // 替换为实际域名
  wechatId: 'GameDevLearning',
  description: '网易十年游戏开发老兵｜聚焦Unity3D/UE4/UE5引擎',
};

// 注入品牌水印到游戏代码中
// 注意：由于静态游戏页面已有完整的底部推广栏和TikTok风格交互组件，
// 此函数不再注入额外的水印，直接返回原始代码
function injectBrandWatermark(htmlCode) {
  // 不再注入水印，因为静态页面已经有推广栏了
  return htmlCode;
}

// 从AI响应中提取HTML代码（增强版）
function extractHtmlFromResponse(response) {
  if (!response) return response;
  
  let code = response;
  
  // 方法1: 匹配 ```html ... ``` (最常见的格式)
  const htmlMatch = code.match(/```html\s*\n?([\s\S]*?)```/i);
  if (htmlMatch && htmlMatch[1]) {
    console.log('[INFO] 成功从 ```html 代码块提取');
    return htmlMatch[1].trim();
  }
  
  // 方法2: 匹配 ``` ... ``` (不带语言标识)
  const plainMatch = code.match(/```\s*\n([\s\S]*?)```/);
  if (plainMatch && plainMatch[1] && (plainMatch[1].includes('<html') || plainMatch[1].includes('<!DOCTYPE'))) {
    console.log('[INFO] 成功从普通 ``` 代码块提取');
    return plainMatch[1].trim();
  }
  
  // 方法3: 查找 <!DOCTYPE 到文件结束或最后的 </html>
  const doctypeIndex = code.indexOf('<!DOCTYPE');
  const doctypeLowerIndex = code.indexOf('<!doctype');
  const startIndex = doctypeIndex !== -1 ? doctypeIndex : doctypeLowerIndex;
  
  if (startIndex !== -1) {
    // 找到 </html> 结束标签
    const htmlEndIndex = code.lastIndexOf('</html>');
    if (htmlEndIndex !== -1) {
      const extracted = code.substring(startIndex, htmlEndIndex + 7);
      console.log('[INFO] 从 DOCTYPE 到 </html> 提取代码');
      return extracted.trim();
    } else {
      // 没有 </html>，可能有 ``` 结尾
      let endIndex = code.indexOf('```', startIndex);
      if (endIndex !== -1) {
        const extracted = code.substring(startIndex, endIndex);
        console.log('[INFO] 从 DOCTYPE 到 ``` 提取代码');
        return extracted.trim();
      }
      // 直接取到结尾
      console.log('[INFO] 从 DOCTYPE 到结尾提取代码');
      return code.substring(startIndex).trim();
    }
  }
  
  // 方法4: 查找 <html 开头
  const htmlStartIndex = code.indexOf('<html');
  if (htmlStartIndex !== -1) {
    const htmlEndIndex = code.lastIndexOf('</html>');
    if (htmlEndIndex !== -1) {
      const extracted = code.substring(htmlStartIndex, htmlEndIndex + 7);
      console.log('[INFO] 从 <html> 到 </html> 提取代码');
      return extracted.trim();
    }
  }
  
  // 方法5: 清理开头的 markdown 标记
  if (code.startsWith('```')) {
    // 去掉开头的 ```html 或 ```
    const firstNewline = code.indexOf('\n');
    if (firstNewline !== -1) {
      code = code.substring(firstNewline + 1);
    }
    // 去掉结尾的 ```
    if (code.endsWith('```')) {
      code = code.slice(0, -3);
    }
    console.log('[INFO] 手动清理 markdown 标记');
    return code.trim();
  }
  
  console.log('[WARN] 无法识别代码格式，原样返回');
  return code.trim();
}

// ==================== 系统配置 ====================

// 游客模式配置（让用户无需API Key即可体验）
const TRIAL_CONFIG = {
  enabled: true,                              // 是否启用游客模式
  dailyQuota: 50,                             // 每日全站免费配额
  perUserLimit: 2,                            // 每用户每日次数 (已废弃，改用积分系统)
  apiKey: process.env.TRIAL_API_KEY || '',    // 游客模式使用的API Key（可在管理后台配置）
  model: 'deepseek-chat',                     // 游客模式使用的模型
  baseUrl: 'https://api.deepseek.com',        // 体验模式API地址
};

// 获取体验模式API配置的函数（支持从管理后台配置读取）
function getTrialApiConfig() {
  // 优先使用环境变量
  if (TRIAL_CONFIG.apiKey) {
    return {
      apiKey: TRIAL_CONFIG.apiKey,
      model: TRIAL_CONFIG.model,
      baseUrl: TRIAL_CONFIG.baseUrl
    };
  }
  
  // 其次使用管理后台配置的默认LLM
  const defaultApiKey = getConfig('llm_default_api_key', '');
  const defaultModel = getConfig('llm_default_model', 'deepseek-chat');
  const defaultBaseUrl = getConfig('llm_default_base_url', 'https://api.deepseek.com');
  
  if (defaultApiKey) {
    return {
      apiKey: defaultApiKey,
      model: defaultModel,
      baseUrl: defaultBaseUrl || 'https://api.deepseek.com'
    };
  }
  
  return null;
}

// 积分系统配置
const CREDITS_CONFIG = {
  initial: 3,              // 新用户初始次数（改为3）
  followWechat: 3,         // 关注公众号获得次数
  watchAd: 1,              // 看一次广告获得次数
  dailyLimit: 10,          // 每日广告上限
  shareGame: 1,            // 分享游戏获得次数
  inviteFriend: 3,         // 通过邀请链接邀请好友获得次数
  inviteBonus: 3,          // 被邀请者获得次数
  shareViewBonus: 1,       // 游戏分享被访问奖励
  dailyLogin: 1,           // 每日登录奖励（无积分时）
};

// 敏感词列表（可从数据库或文件加载）
const SENSITIVE_WORDS = [
  // 政治敏感
  '习近平', '共产党', '天安门', '法轮功', '六四',
  // 暴力色情
  '色情', '裸体', '性爱', '暴力', '杀人', '自杀',
  // 其他敏感词
  '赌博', '毒品', '枪支',
];

// 游戏模板库
const GAME_TEMPLATES = {
  'snake': {
    name: '贪吃蛇',
    icon: '🐍',
    keywords: ['贪吃蛇', 'snake', '蛇'],
    basePrompt: '经典贪吃蛇游戏，使用方向键或滑动控制蛇移动，吃到食物变长，碰到墙壁或自己游戏结束',
    template: null  // 可以预置完整代码模板
  },
  '2048': {
    name: '2048',
    icon: '🔢',
    keywords: ['2048', '数字合并'],
    basePrompt: '2048数字合并游戏，滑动合并相同数字，目标是得到2048',
  },
  'tetris': {
    name: '俄罗斯方块',
    icon: '🧱',
    keywords: ['俄罗斯方块', 'tetris', '方块'],
    basePrompt: '俄罗斯方块游戏，方向键控制方块移动和旋转，消除整行得分',
  },
  'breakout': {
    name: '打砖块',
    icon: '🎯',
    keywords: ['打砖块', '弹球', 'breakout'],
    basePrompt: '打砖块弹球游戏，控制挡板反弹小球打掉所有砖块',
  },
  'flappy': {
    name: 'Flappy Bird',
    icon: '🐦',
    keywords: ['flappy', '飞翔的小鸟', '小鸟'],
    basePrompt: '像素小鸟飞行游戏，点击屏幕让小鸟跳跃穿过管道',
  },
  'minesweeper': {
    name: '扫雷',
    icon: '💣',
    keywords: ['扫雷', 'minesweeper', '地雷'],
    basePrompt: '经典扫雷游戏，点击格子揭开，避开地雷，数字表示周围地雷数量',
  },
  'shooter': {
    name: '飞机大战',
    icon: '🚀',
    keywords: ['飞机', '射击', 'shooter', '太空'],
    basePrompt: '太空飞机射击游戏，控制飞机躲避敌机和子弹，射击消灭敌人',
  },
  'puzzle': {
    name: '拼图',
    icon: '🧩',
    keywords: ['拼图', 'puzzle', '滑块'],
    basePrompt: '滑块拼图游戏，移动方块还原图案',
  },
  'memory': {
    name: '记忆翻牌',
    icon: '🃏',
    keywords: ['记忆', '翻牌', 'memory', '配对'],
    basePrompt: '记忆翻牌配对游戏，翻开两张相同的牌即可消除',
  },
  'jump': {
    name: '跳跃游戏',
    icon: '🦘',
    keywords: ['跳跃', 'jump', '跑酷'],
    basePrompt: '无尽跑酷跳跃游戏，点击让角色跳跃躲避障碍',
  },
};

// 挑战赛主题（每周更换）- 包含详细的游戏描述以提高AI生成质量
const WEEKLY_CHALLENGES = [
  { 
    theme: '复古像素风', 
    description: '创作一个复古像素风格的游戏',
    prompt: '复古像素风格的平台跳跃游戏，8-bit风格画面，玩家控制小人左右移动和跳跃，收集金币并躲避敌人，有多个平台和关卡，像素化的角色和背景，显示得分和生命值',
    bonus: 5 
  },
  { 
    theme: '音乐节奏', 
    description: '创作一个与音乐节奏相关的游戏',
    prompt: '音乐节奏游戏，音符从上方下落，玩家需要在音符到达判定线时按下对应按键(A/S/D/F)，完美击中得高分，有连击系统和评分等级(Perfect/Good/Miss)，背景随节奏变化',
    bonus: 5 
  },
  { 
    theme: '太空冒险', 
    description: '创作一个太空主题的游戏',
    prompt: '太空飞船射击冒险游戏，控制飞船上下左右移动，自动发射激光击落外星敌人，收集能量补给升级武器，躲避陨石和敌方子弹，有Boss战，显示分数和护盾值',
    bonus: 5 
  },
  { 
    theme: '益智解谜', 
    description: '创作一个烧脑的解谜游戏',
    prompt: '益智解谜游戏，类似华容道或数独，玩家需要移动方块或填入数字解开谜题，有多个难度级别，显示用时和步数，完成后可进入下一关，有提示功能',
    bonus: 5 
  },
  { 
    theme: '动物世界', 
    description: '创作一个以动物为主角的游戏',
    prompt: '可爱动物主角的冒险游戏，玩家扮演小兔子在森林中跳跃收集胡萝卜，躲避狐狸和陷阱，有双段跳和冲刺技能，收集够一定数量过关，卡通可爱的画风',
    bonus: 5 
  },
];

// 支持的LLM模型配置
const LLM_MODELS = {
  // DeepSeek 系列 - 性价比之王
  'deepseek-v3': { name: 'DeepSeek V3', provider: 'deepseek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com', tier: 'free', recommended: true },
  'deepseek-r1': { name: 'DeepSeek R1', provider: 'deepseek', model: 'deepseek-reasoner', baseUrl: 'https://api.deepseek.com', tier: 'free' },
  
  // OpenAI 系列
  'gpt-4o': { name: 'GPT-4o', provider: 'openai', model: 'gpt-4o', baseUrl: 'https://api.openai.com', tier: 'pro' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com', tier: 'free' },
  'gpt-5': { name: 'GPT 5', provider: 'openai', model: 'gpt-5', baseUrl: 'https://api.openai.com', tier: 'pro' },
  'gpt-5.1': { name: 'GPT 5.1', provider: 'openai', model: 'gpt-5.1', baseUrl: 'https://api.openai.com', tier: 'pro' },
  'gpt-5.1-codex': { name: 'GPT 5.1 Codex', provider: 'openai', model: 'gpt-5.1-codex', baseUrl: 'https://api.openai.com', tier: 'pro' },
  
  // Claude 系列
  'claude-4.5-opus': { name: 'Claude 4.5 Opus', provider: 'anthropic', model: 'claude-sonnet-4-5-20250514', baseUrl: 'https://api.anthropic.com', tier: 'pro', new: true },
  'claude-4.5-sonnet': { name: 'Claude 4.5 Sonnet', provider: 'anthropic', model: 'claude-4.5-sonnet', baseUrl: 'https://api.anthropic.com', tier: 'pro' },
  'claude-4.5-haiku': { name: 'Claude 4.5 Haiku', provider: 'anthropic', model: 'claude-4.5-haiku', baseUrl: 'https://api.anthropic.com', tier: 'free' },
  'claude-4-sonnet': { name: 'Claude 4 Sonnet', provider: 'anthropic', model: 'claude-4-sonnet', baseUrl: 'https://api.anthropic.com', tier: 'pro' },
  'claude-3.7-sonnet': { name: 'Claude 3.7 Sonnet', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', baseUrl: 'https://api.anthropic.com', tier: 'free' },
  
  // Google Gemini 系列
  'gemini-3-pro': { name: 'Gemini 3 Pro', provider: 'google', model: 'gemini-3-pro', baseUrl: 'https://generativelanguage.googleapis.com', tier: 'pro', new: true },
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', provider: 'google', model: 'gemini-2.5-pro', baseUrl: 'https://generativelanguage.googleapis.com', tier: 'free' },
  
  // 国产模型
  'glm-4.7': { name: 'GLM 4.7', provider: 'zhipu', model: 'glm-4.7', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', tier: 'free', new: true },
  'glm-4.6': { name: 'GLM 4.6', provider: 'zhipu', model: 'glm-4.6', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', tier: 'free' },
  'glm-4.5': { name: 'GLM 4.5', provider: 'zhipu', model: 'glm-4.5', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', tier: 'free' },
  'kimi-k2': { name: 'Kimi K2', provider: 'moonshot', model: 'kimi-k2', baseUrl: 'https://api.moonshot.cn', tier: 'free' },
  'qwen3-coder-plus': { name: 'Qwen3 Coder Plus', provider: 'alibaba', model: 'qwen-coder-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode', tier: 'free' },
};

// 中间件
app.use(cors());
app.use(express.json());

// 安全中间件：过滤恶意URL请求（阻止路径遍历攻击）
app.use((req, res, next) => {
  try {
    // 检测路径遍历攻击模式
    const suspiciousPatterns = [
      /\.\./, // 路径遍历
      /cgi-bin/i, // CGI目录攻击
      /\/bin\//i, // 系统目录
      /\/etc\//i, // 配置目录
      /%2e%2e/i, // 编码的..
      /\.%32%65/i, // 双重编码攻击
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(req.path) || pattern.test(req.originalUrl)) {
        console.log('[SECURITY] 拦截可疑请求:', req.originalUrl);
        return res.status(400).send('Bad Request');
      }
    }
    
    // 尝试解码URL，如果失败则拒绝请求
    try {
      decodeURIComponent(req.path);
    } catch (e) {
      console.log('[SECURITY] URL解码失败，拦截请求:', req.originalUrl);
      return res.status(400).send('Bad Request');
    }
    
    next();
  } catch (e) {
    console.log('[SECURITY] 请求处理异常:', e.message);
    return res.status(400).send('Bad Request');
  }
});

app.use(express.static('public'));

// 初始化数据库
const db = new Database('games.db');

// 创建游戏表
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    code TEXT NOT NULL,
    author_name TEXT DEFAULT '匿名',
    author_token TEXT NOT NULL,
    play_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    is_featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 添加 is_hidden 字段（如果不存在）
try {
  db.exec(`ALTER TABLE games ADD COLUMN is_hidden INTEGER DEFAULT 0`);
  console.log('[DB] 添加 is_hidden 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 category 字段（如果不存在）
try {
  db.exec(`ALTER TABLE games ADD COLUMN category TEXT DEFAULT '其他'`);
  console.log('[DB] 添加 category 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 favorite_count 字段（如果不存在）
try {
  db.exec(`ALTER TABLE games ADD COLUMN favorite_count INTEGER DEFAULT 0`);
  console.log('[DB] 添加 favorite_count 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 llm_model 字段（如果不存在）- 记录生成游戏使用的模型
try {
  db.exec(`ALTER TABLE games ADD COLUMN llm_model TEXT DEFAULT 'deepseek-v3'`);
  console.log('[DB] 添加 llm_model 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 is_public 字段（如果不存在）- 游戏是否公开，默认公开
try {
  db.exec(`ALTER TABLE games ADD COLUMN is_public INTEGER DEFAULT 1`);
  console.log('[DB] 添加 is_public 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 status 字段（如果不存在）- 游戏状态：draft(草稿)/published(已发布)
try {
  db.exec(`ALTER TABLE games ADD COLUMN status TEXT DEFAULT 'published'`);
  console.log('[DB] 添加 status 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 share_count 字段（如果不存在）
try {
  db.exec(`ALTER TABLE games ADD COLUMN share_count INTEGER DEFAULT 0`);
  console.log('[DB] 添加 share_count 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_games_featured ON games(is_featured DESC, like_count DESC);
`);

// ==================== 用户账号系统 ====================
// 创建用户账号表
db.exec(`
  CREATE TABLE IF NOT EXISTS user_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT UNIQUE NOT NULL,
    nickname TEXT DEFAULT '游戏玩家',
    password_hash TEXT,
    email TEXT,
    user_token TEXT UNIQUE NOT NULL,
    has_password INTEGER DEFAULT 0,
    device_fingerprint TEXT,
    last_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 添加设备指纹字段（如果不存在）
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN device_fingerprint TEXT`);
  console.log('[DB] 添加 device_fingerprint 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 last_ip 字段（如果不存在）
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN last_ip TEXT`);
  console.log('[DB] 添加 last_ip 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 创建账号索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_accounts_account_id ON user_accounts(account_id);
  CREATE INDEX IF NOT EXISTS idx_user_accounts_user_token ON user_accounts(user_token);
  CREATE INDEX IF NOT EXISTS idx_user_accounts_device_fingerprint ON user_accounts(device_fingerprint);
`);

// 生成唯一账号ID的函数
function generateAccountId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'player_' + suffix;
}

// 确保账号ID唯一
function getUniqueAccountId() {
  let accountId;
  let attempts = 0;
  do {
    accountId = generateAccountId();
    const exists = db.prepare('SELECT 1 FROM user_accounts WHERE account_id = ?').get(accountId);
    if (!exists) break;
    attempts++;
  } while (attempts < 100);
  return accountId;
}

// 简单的密码哈希（生产环境建议使用bcrypt）
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'aigame_salt_2025').digest('hex');
}

// 创建系统配置表
db.exec(`
  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 初始化默认配置
const defaultConfigs = [
  { key: 'wechat_verify_code', value: 'AIGAME2025', description: '微信关注验证码' },
  { key: 'credits_initial', value: '3', description: '新用户初始积分' },
  { key: 'credits_follow_wechat', value: '3', description: '关注公众号奖励' },
  { key: 'credits_watch_ad', value: '1', description: '看广告奖励' },
  { key: 'credits_daily_ad_limit', value: '3', description: '每日广告上限' },
  { key: 'credits_share_game', value: '1', description: '分享游戏奖励' },
  { key: 'site_name', value: 'AI游戏工坊', description: '网站名称' },
  { key: 'site_announcement', value: '', description: '网站公告' },
  // LLM 默认配置
  { key: 'llm_default_model', value: 'deepseek-chat', description: '默认LLM模型' },
  { key: 'llm_default_api_key', value: '', description: '默认LLM API密钥' },
  { key: 'llm_default_base_url', value: '', description: '默认LLM API地址（可选）' },
  { key: 'llm_enabled', value: 'true', description: '是否启用LLM生成功能' },
  // 分享文案配置
  { key: 'share_text_template', value: '我用一句话做了个游戏《{title}》，快来玩！', description: '分享文案模板，支持{title}变量' },
  { key: 'share_text_weibo', value: '我用一句话做了个游戏：{title} 快来玩！#AI游戏# #一句话生成游戏#', description: '微博分享文案' },
  { key: 'share_text_qq', value: '一句话生成的AI游戏，快来玩！', description: 'QQ分享描述' },
];

const insertConfig = db.prepare(`
  INSERT OR IGNORE INTO system_config (key, value, description) VALUES (?, ?, ?)
`);
defaultConfigs.forEach(config => {
  insertConfig.run(config.key, config.value, config.description);
});

// 获取系统配置的辅助函数
function getConfig(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setConfig(key, value) {
  db.prepare(`
    INSERT INTO system_config (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `).run(key, value, value);
}

// 创建用户积分表
db.exec(`
  CREATE TABLE IF NOT EXISTS user_credits (
    user_token TEXT PRIMARY KEY,
    credits INTEGER DEFAULT 5,
    total_earned INTEGER DEFAULT 5,
    total_used INTEGER DEFAULT 0,
    first_gen_used INTEGER DEFAULT 0,
    followed_wechat INTEGER DEFAULT 0,
    last_ad_date TEXT,
    ad_count_today INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 添加 first_gen_used 字段（兼容旧数据库）
try {
  db.exec('ALTER TABLE user_credits ADD COLUMN first_gen_used INTEGER DEFAULT 0');
} catch (e) {
  // 字段已存在，忽略
}

// 添加每日登录相关字段
try {
  db.exec('ALTER TABLE user_credits ADD COLUMN last_login_date TEXT');
} catch (e) {
  // 字段已存在，忽略
}
try {
  db.exec('ALTER TABLE user_credits ADD COLUMN daily_login_claimed INTEGER DEFAULT 0');
} catch (e) {
  // 字段已存在，忽略
}

// 创建积分记录表
db.exec(`
  CREATE TABLE IF NOT EXISTS credit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 确保用户积分记录存在的辅助函数
function ensureUserCredits(userToken) {
  let credits = db.prepare('SELECT * FROM user_credits WHERE user_token = ?').get(userToken);
  
  if (!credits) {
    const initialCredits = parseInt(getConfig('credits_initial')) || 3;
    db.prepare(`
      INSERT INTO user_credits (user_token, credits, total_earned, first_gen_used) 
      VALUES (?, ?, ?, 0)
    `).run(userToken, initialCredits, initialCredits);
    
    credits = db.prepare('SELECT * FROM user_credits WHERE user_token = ?').get(userToken);
  }
  
  return credits;
}

// ==================== 账号系统 API ====================

// 获取客户端IP
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
}

// 获取或创建用户账号信息（支持设备指纹自动恢复）
app.post('/api/account/init', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { deviceFingerprint } = req.body;
    const clientIP = getClientIP(req);
    
    console.log('[DEBUG] 账号初始化:', { 
      userToken: userToken ? userToken.substring(0, 10) + '...' : 'null', 
      deviceFingerprint: deviceFingerprint ? deviceFingerprint.substring(0, 10) + '...' : 'null',
      clientIP 
    });
    
    let account = null;
    let isRecovered = false;
    let newToken = userToken;
    
    // 1. 先尝试用 userToken 查找
    if (userToken) {
      account = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(userToken);
      if (account) {
        console.log('[DEBUG] 通过 token 找到账号:', account.account_id);
      }
    }
    
    // 2. 如果 token 无效，尝试用设备指纹恢复
    if (!account && deviceFingerprint) {
      account = db.prepare('SELECT * FROM user_accounts WHERE device_fingerprint = ?').get(deviceFingerprint);
      if (account) {
        console.log('[DEBUG] 通过设备指纹恢复账号:', account.account_id);
        isRecovered = true;
        newToken = account.user_token;
      }
    }
    
    // 注意：不再使用IP恢复账号，因为IP会变化导致频繁创建新账号
    // 账号识别优先级：token > 设备指纹
    
    // 3. 都没有，创建新账号
    if (!account) {
      const accountId = getUniqueAccountId();
      newToken = userToken || require('crypto').randomUUID();
      
      db.prepare(`
        INSERT INTO user_accounts (account_id, nickname, user_token, device_fingerprint, last_ip)
        VALUES (?, ?, ?, ?, ?)
      `).run(accountId, '游戏玩家', newToken, deviceFingerprint, clientIP);
      
      account = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(newToken);
      console.log('[DEBUG] 创建新账号:', account.account_id);
      
      // 给新用户初始积分
      const initialCredits = parseInt(db.prepare("SELECT value FROM system_config WHERE key = 'credits_initial'").get()?.value || '3');
      db.prepare(`
        INSERT OR IGNORE INTO user_credits (user_token, credits)
        VALUES (?, ?)
      `).run(newToken, initialCredits);
    } else {
      // 更新设备指纹和IP（如果有变化）
      if (deviceFingerprint || clientIP) {
        db.prepare(`
          UPDATE user_accounts 
          SET device_fingerprint = COALESCE(?, device_fingerprint),
              last_ip = COALESCE(?, last_ip),
              updated_at = CURRENT_TIMESTAMP 
          WHERE user_token = ?
        `).run(deviceFingerprint, clientIP, account.user_token);
      }
    }
    
    res.json({
      success: true,
      recovered: isRecovered,
      userToken: newToken,
      account: {
        accountId: account.account_id,
        nickname: account.nickname,
        hasPassword: !!account.has_password,
        createdAt: account.created_at
      }
    });
  } catch (error) {
    console.error('[ERROR] 账号初始化失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取用户账号信息（兼容旧接口）
app.get('/api/account', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    const account = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(userToken);
    
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在，请刷新页面' });
    }
    
    res.json({
      success: true,
      account: {
        accountId: account.account_id,
        nickname: account.nickname,
        hasPassword: !!account.has_password,
        email: account.email,
        createdAt: account.created_at
      }
    });
  } catch (error) {
    console.error('[ERROR] 获取账号信息失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 通过账号ID或昵称恢复账号（换设备时使用）
app.post('/api/account/recover', (req, res) => {
  try {
    const { accountId } = req.body;
    const { deviceFingerprint } = req.body;
    const clientIP = getClientIP(req);
    
    if (!accountId) {
      return res.status(400).json({ success: false, error: '请输入账号ID或昵称' });
    }
    
    // 查找账号
    let account = db.prepare('SELECT * FROM user_accounts WHERE account_id = ?').get(accountId);
    if (!account) {
      account = db.prepare('SELECT * FROM user_accounts WHERE nickname = ? COLLATE NOCASE').get(accountId);
    }
    
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    
    // 更新设备指纹和IP
    db.prepare(`
      UPDATE user_accounts 
      SET device_fingerprint = COALESCE(?, device_fingerprint),
          last_ip = COALESCE(?, last_ip),
          updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(deviceFingerprint, clientIP, account.user_token);
    
    console.log('[DEBUG] 账号恢复成功:', account.account_id);
    
    res.json({
      success: true,
      userToken: account.user_token,
      account: {
        accountId: account.account_id,
        nickname: account.nickname,
        hasPassword: !!account.has_password,
        createdAt: account.created_at
      }
    });
  } catch (error) {
    console.error('[ERROR] 账号恢复失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 更新用户昵称
app.put('/api/account/nickname', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { nickname } = req.body;
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    if (!nickname || nickname.trim().length === 0) {
      return res.status(400).json({ success: false, error: '昵称不能为空' });
    }
    
    if (nickname.length > 20) {
      return res.status(400).json({ success: false, error: '昵称不能超过20个字符' });
    }
    
    db.prepare('UPDATE user_accounts SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE user_token = ?')
      .run(nickname.trim(), userToken);
    
    res.json({ success: true, nickname: nickname.trim() });
  } catch (error) {
    console.error('[ERROR] 更新昵称失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 设置密码（首次设置或修改）
app.post('/api/account/password', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { password, oldPassword } = req.body;
    
    console.log('[DEBUG] 设置密码请求:', { userToken: userToken ? userToken.substring(0, 10) + '...' : 'null', hasPassword: !!password });
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: '密码至少6位' });
    }
    
    const account = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    
    // 如果提供了旧密码，则验证旧密码（可选）
    // 既然用户已经通过 token 认证，允许直接修改密码
    if (oldPassword && account.has_password && account.password_hash) {
      if (hashPassword(oldPassword) !== account.password_hash) {
        return res.status(400).json({ success: false, error: '原密码错误' });
      }
    }
    
    const passwordHash = hashPassword(password);
    db.prepare('UPDATE user_accounts SET password_hash = ?, has_password = 1, updated_at = CURRENT_TIMESTAMP WHERE user_token = ?')
      .run(passwordHash, userToken);
    
    res.json({ success: true, message: '密码设置成功' });
  } catch (error) {
    console.error('[ERROR] 设置密码失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 账号登录（用账号ID/昵称 + 密码换取 userToken）
app.post('/api/account/login', (req, res) => {
  try {
    const { accountId, password } = req.body;
    
    console.log('[DEBUG] 登录尝试:', { accountId, hasPassword: !!password });
    
    if (!accountId || !password) {
      return res.status(400).json({ success: false, error: '请输入账号和密码' });
    }
    
    // 支持用账号ID或昵称登录
    let account = db.prepare('SELECT * FROM user_accounts WHERE account_id = ?').get(accountId);
    console.log('[DEBUG] 按账号ID查找:', account ? '找到' : '未找到');
    
    // 如果用账号ID找不到，尝试用昵称查找（不区分大小写）
    if (!account) {
      account = db.prepare('SELECT * FROM user_accounts WHERE nickname = ? COLLATE NOCASE').get(accountId);
      console.log('[DEBUG] 按昵称查找:', account ? '找到' : '未找到');
    }
    
    // 如果还是找不到，尝试用作者名在games表中查找对应的user_token
    if (!account) {
      const game = db.prepare('SELECT author_token FROM games WHERE author_name = ? COLLATE NOCASE LIMIT 1').get(accountId);
      console.log('[DEBUG] 按作者名查找:', game ? '找到游戏' : '未找到');
      if (game && game.author_token) {
        account = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(game.author_token);
        console.log('[DEBUG] 通过游戏作者token查找账号:', account ? '找到' : '未找到');
      }
    }
    
    if (!account) {
      // 列出所有账号供调试
      const allAccounts = db.prepare('SELECT account_id, nickname FROM user_accounts').all();
      console.log('[DEBUG] 所有账号:', allAccounts);
      return res.status(400).json({ success: false, error: '账号不存在，请使用账号ID或已设置的昵称登录' });
    }
    
    console.log('[DEBUG] 账号信息:', { 
      account_id: account.account_id, 
      nickname: account.nickname,
      has_password: account.has_password, 
      password_hash_exists: !!account.password_hash 
    });
    
    if (!account.has_password || !account.password_hash) {
      console.log('[DEBUG] 密码未设置');
      return res.status(400).json({ success: false, error: '该账号未设置密码，无法登录' });
    }
    
    const inputHash = hashPassword(password);
    console.log('[DEBUG] 密码验证:', { 
      inputHash: inputHash.substring(0, 10) + '...', 
      storedHash: account.password_hash.substring(0, 10) + '...',
      match: inputHash === account.password_hash
    });
    
    if (inputHash !== account.password_hash) {
      return res.status(400).json({ success: false, error: '密码错误' });
    }
    
    res.json({
      success: true,
      userToken: account.user_token,
      account: {
        accountId: account.account_id,
        nickname: account.nickname,
        hasPassword: true
      }
    });
  } catch (error) {
    console.error('[ERROR] 登录失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// [临时调试] 重置密码接口 - 正式上线时请删除
app.post('/api/debug/reset-password', (req, res) => {
  try {
    const { accountId, newPassword } = req.body;
    if (!accountId || !newPassword) {
      return res.status(400).json({ success: false, error: '需要账号ID和新密码' });
    }
    
    let account = db.prepare('SELECT * FROM user_accounts WHERE account_id = ?').get(accountId);
    if (!account) {
      account = db.prepare('SELECT * FROM user_accounts WHERE nickname = ? COLLATE NOCASE').get(accountId);
    }
    
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    
    const passwordHash = hashPassword(newPassword);
    db.prepare('UPDATE user_accounts SET password_hash = ?, has_password = 1 WHERE user_token = ?')
      .run(passwordHash, account.user_token);
    
    console.log('[DEBUG] 密码已重置:', account.account_id);
    res.json({ success: true, message: '密码已重置' });
  } catch (error) {
    console.error('[ERROR] 重置密码失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 检查账号是否存在（用于登录时提示）
app.get('/api/account/check/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;
    const account = db.prepare('SELECT account_id, has_password FROM user_accounts WHERE account_id = ?').get(accountId);
    
    res.json({
      success: true,
      exists: !!account,
      hasPassword: account ? !!account.has_password : false
    });
  } catch (error) {
    console.error('[ERROR] 检查账号失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取当前设备已登录的账号列表（用于账号切换）
app.get('/api/account/device-accounts', (req, res) => {
  try {
    const deviceFingerprint = req.headers['x-device-fingerprint'];
    if (!deviceFingerprint) {
      return res.json({ success: true, accounts: [] });
    }
    
    // 获取该设备曾经登录过的所有账号
    const accounts = db.prepare(`
      SELECT account_id, nickname, has_password, created_at 
      FROM user_accounts 
      WHERE device_fingerprint = ?
      ORDER BY updated_at DESC
    `).all(deviceFingerprint);
    
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('[ERROR] 获取设备账号列表失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 创建单个测试账号（管理员使用）
app.post('/api/admin/create-test-account', (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, error: '未授权' });
    }
    
    const { nickname, password } = req.body;
    if (!nickname || nickname.trim().length === 0) {
      return res.status(400).json({ success: false, error: '请输入账号昵称' });
    }
    
    const trimmedNickname = nickname.trim();
    const accountPassword = password && password.trim() ? password.trim() : '123456';
    
    // 检查账号是否已存在
    const existing = db.prepare('SELECT * FROM user_accounts WHERE nickname = ?').get(trimmedNickname);
    if (existing) {
      return res.status(400).json({ success: false, error: '该昵称已存在' });
    }
    
    // 创建新测试账号
    const accountId = 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const userToken = require('crypto').randomUUID();
    const passwordHash = hashPassword(accountPassword);
    
    db.prepare(`
      INSERT INTO user_accounts (account_id, nickname, user_token, password_hash, has_password)
      VALUES (?, ?, ?, ?, 1)
    `).run(accountId, trimmedNickname, userToken, passwordHash);
    
    // 给测试账号初始积分
    db.prepare(`
      INSERT OR IGNORE INTO user_credits (user_token, credits)
      VALUES (?, 100)
    `).run(userToken);
    
    res.json({ 
      success: true, 
      account: {
        accountId,
        nickname: trimmedNickname,
        password: accountPassword
      },
      message: `账号"${trimmedNickname}"创建成功`
    });
  } catch (error) {
    console.error('[ERROR] 创建测试账号失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取所有测试账号列表（管理员使用）
app.get('/api/admin/test-accounts', (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, error: '未授权' });
    }
    
    // 获取所有以test_开头的账号，或者has_password=1的账号（便于测试）
    const accounts = db.prepare(`
      SELECT account_id, nickname, has_password, created_at 
      FROM user_accounts 
      WHERE account_id LIKE 'test_%' OR has_password = 1
      ORDER BY created_at DESC
    `).all();
    
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('[ERROR] 获取测试账号列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除测试账号（管理员使用）
app.delete('/api/admin/test-account/:accountId', (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ success: false, error: '未授权' });
    }
    
    const { accountId } = req.params;
    
    // 只能删除test_开头的账号
    if (!accountId.startsWith('test_')) {
      return res.status(400).json({ success: false, error: '只能删除测试账号' });
    }
    
    const account = db.prepare('SELECT * FROM user_accounts WHERE account_id = ?').get(accountId);
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    
    // 删除账号
    db.prepare('DELETE FROM user_accounts WHERE account_id = ?').run(accountId);
    // 删除积分
    db.prepare('DELETE FROM user_credits WHERE user_token = ?').run(account.user_token);
    
    res.json({ success: true, message: '账号已删除' });
  } catch (error) {
    console.error('[ERROR] 删除测试账号失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 安全恢复账号（需要验证设备或密码）
app.post('/api/account/secure-recover', (req, res) => {
  try {
    const { accountId, password, deviceFingerprint } = req.body;
    const clientIP = getClientIP(req);
    
    if (!accountId) {
      return res.status(400).json({ success: false, error: '请输入账号ID或昵称' });
    }
    
    // 查找账号
    let account = db.prepare('SELECT * FROM user_accounts WHERE account_id = ?').get(accountId);
    if (!account) {
      account = db.prepare('SELECT * FROM user_accounts WHERE nickname = ? COLLATE NOCASE').get(accountId);
    }
    
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    
    // 安全检查：必须满足以下条件之一
    // 1. 账号设置了密码且密码正确
    // 2. 设备指纹匹配（同一设备）
    // 3. 账号未设置密码（允许无密码恢复，但会提示设置密码）
    
    const isSameDevice = deviceFingerprint && account.device_fingerprint === deviceFingerprint;
    const hasPassword = account.has_password && account.password_hash;
    const passwordCorrect = hasPassword && password && hashPassword(password) === account.password_hash;
    
    if (hasPassword && !passwordCorrect && !isSameDevice) {
      // 账号有密码，但密码错误且不是同设备
      return res.status(400).json({ 
        success: false, 
        error: '该账号已设置密码，请输入正确密码',
        needPassword: true 
      });
    }
    
    // 更新设备指纹和IP
    db.prepare(`
      UPDATE user_accounts 
      SET device_fingerprint = COALESCE(?, device_fingerprint),
          last_ip = COALESCE(?, last_ip),
          updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(deviceFingerprint, clientIP, account.user_token);
    
    console.log('[DEBUG] 安全账号恢复成功:', account.account_id, { isSameDevice, passwordCorrect });
    
    res.json({
      success: true,
      userToken: account.user_token,
      account: {
        accountId: account.account_id,
        nickname: account.nickname,
        hasPassword: !!account.has_password,
        createdAt: account.created_at
      },
      warning: !hasPassword ? '建议设置密码以保护账号安全' : null
    });
  } catch (error) {
    console.error('[ERROR] 安全账号恢复失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// ==================== 积分系统 API ====================

// 获取用户积分信息
app.get('/api/credits', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    let user = db.prepare('SELECT * FROM user_credits WHERE user_token = ?').get(userToken);
    
    // 如果用户不存在，创建新用户
    if (!user) {
      db.prepare(`
        INSERT INTO user_credits (user_token, credits, total_earned) 
        VALUES (?, ?, ?)
      `).run(userToken, CREDITS_CONFIG.initial, CREDITS_CONFIG.initial);
      
      // 记录初始积分
      db.prepare(`
        INSERT INTO credit_logs (user_token, amount, type, description)
        VALUES (?, ?, 'initial', '新用户初始积分')
      `).run(userToken, CREDITS_CONFIG.initial);
      
      user = db.prepare('SELECT * FROM user_credits WHERE user_token = ?').get(userToken);
    }
    
    // 检查是否需要重置每日广告计数
    const today = new Date().toISOString().split('T')[0];
    if (user.last_ad_date !== today) {
      db.prepare('UPDATE user_credits SET ad_count_today = 0, last_ad_date = ? WHERE user_token = ?')
        .run(today, userToken);
      user.ad_count_today = 0;
    }
    
    res.json({
      success: true,
      credits: user.credits,
      totalEarned: user.total_earned,
      totalUsed: user.total_used,
      followedWechat: user.followed_wechat === 1,
      adCountToday: user.ad_count_today,
      config: CREDITS_CONFIG
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 消耗积分（生成游戏时调用）
app.post('/api/credits/use', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    const user = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    if (!user) {
      return res.status(400).json({ success: false, error: '用户不存在', needInit: true });
    }
    
    if (user.credits < 1) {
      return res.status(400).json({ success: false, error: '积分不足', credits: 0 });
    }
    
    // 扣除积分
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits - 1, total_used = total_used + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(userToken);
    
    // 记录日志
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, -1, 'generate', '生成游戏消耗')
    `).run(userToken);
    
    const updated = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    res.json({ success: true, credits: updated.credits });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 关注公众号获取积分
app.post('/api/credits/follow-wechat', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { verifyCode } = req.body;
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    const user = db.prepare('SELECT * FROM user_credits WHERE user_token = ?').get(userToken);
    
    if (!user) {
      return res.status(400).json({ success: false, error: '用户不存在' });
    }
    
    if (user.followed_wechat === 1) {
      return res.status(400).json({ success: false, error: '已经领取过关注奖励' });
    }
    
    // TODO: 验证公众号关注状态（需要接入微信公众号API）
    // 这里简单用验证码模拟，实际需要接入微信服务
    // 优先从数据库获取验证码，其次环境变量，最后默认值
    const validCode = getConfig('wechat_verify_code') || process.env.WECHAT_VERIFY_CODE || 'AIGAME2025';
    if (verifyCode !== validCode) {
      return res.status(400).json({ success: false, error: '验证码无效' });
    }
    
    // 增加积分
    const reward = CREDITS_CONFIG.followWechat;
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, followed_wechat = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(reward, reward, userToken);
    
    // 记录日志
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'follow_wechat', '关注公众号奖励')
    `).run(userToken, reward);
    
    const updated = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    res.json({ 
      success: true, 
      credits: updated.credits, 
      earned: reward,
      message: `恭喜获得 ${reward} 次生成机会！`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 看广告获取积分
app.post('/api/credits/watch-ad', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { adId } = req.body;
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    const user = db.prepare('SELECT * FROM user_credits WHERE user_token = ?').get(userToken);
    
    if (!user) {
      return res.status(400).json({ success: false, error: '用户不存在' });
    }
    
    // 检查今日广告次数
    const today = new Date().toISOString().split('T')[0];
    let adCountToday = user.ad_count_today || 0;
    
    if (user.last_ad_date !== today) {
      adCountToday = 0;
    }
    
    if (adCountToday >= CREDITS_CONFIG.dailyLimit) {
      return res.status(400).json({ success: false, error: '今日观看次数已达上限' });
    }
    
    // TODO: 验证广告是否真的观看完成（需要接入广告SDK）
    
    // 增加积分
    const reward = CREDITS_CONFIG.watchAd;
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, 
          ad_count_today = ?, last_ad_date = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(reward, reward, adCountToday + 1, today, userToken);
    
    // 记录日志
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'watch_ad', '观看广告奖励')
    `).run(userToken, reward);
    
    const updated = db.prepare('SELECT credits, ad_count_today FROM user_credits WHERE user_token = ?').get(userToken);
    
    res.json({ 
      success: true, 
      credits: updated.credits, 
      earned: reward,
      adCountToday: updated.ad_count_today,
      dailyLimit: CREDITS_CONFIG.dailyLimit,
      message: `获得 ${reward} 次生成机会！`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 每日登录领取积分（无积分时自动获得1积分）
app.post('/api/credits/daily-login', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    const user = db.prepare('SELECT * FROM user_credits WHERE user_token = ?').get(userToken);
    
    if (!user) {
      return res.status(400).json({ success: false, error: '用户不存在' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // 检查今日是否已领取
    if (user.last_login_date === today) {
      return res.json({ 
        success: false, 
        error: '今日已领取',
        alreadyClaimed: true,
        credits: user.credits 
      });
    }
    
    // 检查是否有积分（只有无积分时才能领取）
    if (user.credits > 0) {
      // 更新登录日期但不给积分
      db.prepare('UPDATE user_credits SET last_login_date = ? WHERE user_token = ?')
        .run(today, userToken);
      return res.json({ 
        success: false, 
        error: '当前有积分，无法领取',
        hasCredits: true,
        credits: user.credits 
      });
    }
    
    // 发放每日登录积分
    const reward = CREDITS_CONFIG.dailyLogin || 1;
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, 
          last_login_date = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(reward, reward, today, userToken);
    
    // 记录日志
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'daily_login', '每日登录奖励')
    `).run(userToken, reward);
    
    const updated = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    res.json({ 
      success: true, 
      credits: updated.credits, 
      earned: reward,
      message: `每日登录获得 ${reward} 次生成机会！`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取系统配置（包括模型列表）
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    models: LLM_MODELS,
    credits: CREDITS_CONFIG
  });
});

// 获取Tips配置
app.get('/api/config/tips', (req, res) => {
  try {
    const homeTips = getConfig('tips_home') || '';
    const generateTips = getConfig('tips_generate') || '';
    
    res.json({
      success: true,
      homeTips: homeTips.split('\n').filter(t => t.trim()),
      generateTips: generateTips.split('\n').filter(t => t.trim())
    });
  } catch (error) {
    console.error('获取Tips配置失败:', error);
    res.json({ success: true, homeTips: [], generateTips: [] });
  }
});

// 获取模型预计生成时间
app.get('/api/config/model-times', (req, res) => {
  try {
    const times = {};
    const stmt = db.prepare("SELECT key, value FROM system_config WHERE key LIKE 'llm_time_%'");
    const rows = stmt.all();

    rows.forEach(row => {
      // 提取模型名: llm_time_deepseek-v3 -> deepseek-v3
      const modelName = row.key.replace('llm_time_', '');
      times[modelName] = parseInt(row.value) || 30;
    });

    // 确保有默认值
    if (!times.default) {
      times.default = 30;
    }

    res.json({ success: true, times });
  } catch (error) {
    console.error('获取模型时间失败:', error);
    res.json({ success: true, times: { default: 30 } });
  }
});

// 获取分享文案配置
app.get('/api/config/share-text', (req, res) => {
  try {
    const shareConfig = {
      template: getConfig('share_text_template', '我用一句话做了个游戏《{title}》，快来玩！'),
      weibo: getConfig('share_text_weibo', '我用一句话做了个游戏：{title} 快来玩！#AI游戏# #一句话生成游戏#'),
      qq: getConfig('share_text_qq', '一句话生成的AI游戏，快来玩！'),
    };
    res.json({ success: true, shareConfig });
  } catch (error) {
    console.error('获取分享配置失败:', error);
    res.json({ success: true, shareConfig: {
      template: '我用一句话做了个游戏《{title}》，快来玩！',
      weibo: '我用一句话做了个游戏：{title} 快来玩！',
      qq: '一句话生成的AI游戏，快来玩！'
    }});
  }
});

// 管理接口：更新积分配置（需要管理员权限）
app.put('/api/admin/credits-config', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  const newConfig = req.body;
  Object.assign(CREDITS_CONFIG, newConfig);
  
  res.json({ success: true, config: CREDITS_CONFIG });
});

// 管理接口：手动给用户加积分
app.post('/api/admin/add-credits', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  const { userToken, amount, reason } = req.body;
  
  if (!userToken || !amount) {
    return res.status(400).json({ success: false, error: '缺少参数' });
  }
  
  try {
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(amount, amount > 0 ? amount : 0, userToken);
    
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'admin', ?)
    `).run(userToken, amount, reason || '管理员调整');
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取最近的游戏列表
app.get('/api/games/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;
    const offset = parseInt(req.query.offset) || 0;
    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, is_featured, created_at 
      FROM games 
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL)
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取推荐的游戏列表
app.get('/api/games/featured', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;
    const offset = parseInt(req.query.offset) || 0;
    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, favorite_count, is_featured, created_at 
      FROM games 
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL) AND (is_featured = 1 OR like_count >= 5)
      ORDER BY is_featured DESC, like_count DESC, play_count DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个游戏详情
app.get('/api/games/:id', (req, res) => {
  try {
    // 禁用缓存，确保获取最新数据
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const game = db.prepare(`
      SELECT id, title, prompt, code, author_name, author_token, llm_model, play_count, like_count, created_at, status
      FROM games 
      WHERE id = ?
    `).get(req.params.id);
    
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 增加播放次数
    db.prepare('UPDATE games SET play_count = play_count + 1 WHERE id = ?').run(req.params.id);
    
    // 添加静态URL
    const staticUrl = getGameStaticUrl(req.params.id);
    
    res.json({ success: true, game, staticUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 验证作者权限
app.post('/api/games/:id/verify', (req, res) => {
  try {
    const { authorToken } = req.body;
    const game = db.prepare('SELECT author_token FROM games WHERE id = ?').get(req.params.id);
    
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    const isAuthor = game.author_token === authorToken;
    res.json({ success: true, isAuthor });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 生成游戏（调用LLM）
app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  console.log('\n========== 开始生成游戏 ==========');
  
  try {
    const { prompt, llmConfig, draftId } = req.body;
    const userToken = req.headers['x-user-token'] || null;
    const authorToken = req.headers['x-author-token'] || null;
    console.log('[INFO] 收到生成请求:', { prompt, provider: llmConfig?.provider, user: userToken, draftId });
    
    if (!prompt || prompt.trim().length === 0) {
      console.log('[ERROR] 游戏描述为空');
      return res.status(400).json({ success: false, error: '请输入游戏描述' });
    }

    // 测试模式：直接返回本地HTML文件
    if (TEST_MODE) {
      console.log('[TEST] 测试模式启用，读取本地HTML文件:', TEST_HTML_PATH);
      
      if (!fs.existsSync(TEST_HTML_PATH)) {
        console.log('[ERROR] 测试文件不存在');
        return res.status(500).json({ success: false, error: '测试文件不存在: ' + TEST_HTML_PATH });
      }
      
      const code = fs.readFileSync(TEST_HTML_PATH, 'utf-8');
      const titleMatch = code.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : '测试游戏';
      
      console.log('[TEST] 成功读取测试文件，代码长度:', code.length);
      console.log('[TEST] 游戏标题:', title);
      
      // 模拟API延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const totalTime = Date.now() - startTime;
      console.log(`[SUCCESS] 测试模式生成完成，总耗时: ${totalTime}ms`);
      console.log('========================================\n');
      
      return res.json({
        success: true,
        code,
        title,
        prompt,
        debug: {
          codeLength: code.length,
          apiTime: 0,
          totalTime,
          testMode: true
        }
      });
    }

    // 检查LLM功能是否启用
    const llmEnabled = getConfig('llm_enabled', 'true') === 'true';
    if (!llmEnabled) {
      console.log('[ERROR] LLM功能已被管理员禁用');
      return res.status(503).json({ success: false, error: '游戏生成功能暂时不可用，请稍后再试' });
    }

    // 获取默认LLM配置
    const defaultModel = getConfig('llm_default_model', 'deepseek-chat');
    const defaultApiKey = getConfig('llm_default_api_key', '');
    const defaultBaseUrl = getConfig('llm_default_base_url', '');
    
    // 根据模型确定provider
    const getProviderFromModel = (model) => {
      if (model.includes('claude')) return 'anthropic';
      if (model.includes('gpt') || model.includes('o1') || model.includes('o3') || model.includes('o4')) return 'openai';
      if (model.includes('gemini')) return 'google';
      if (model.includes('qwen')) return 'qwen';
      return 'deepseek';
    };

    // 确定使用的模型和配置 - 用户配置优先，否则使用默认配置
    const useUserConfig = llmConfig?.apiKey && llmConfig.apiKey.length > 0;
    const finalModel = useUserConfig ? (llmConfig?.model || defaultModel) : defaultModel;
    const finalProvider = getProviderFromModel(finalModel);
    
    // 根据provider确定默认baseUrl
    const getDefaultBaseUrl = (provider) => {
      switch (provider) {
        case 'anthropic': return 'https://api.anthropic.com';
        case 'openai': return 'https://api.openai.com';
        case 'google': return 'https://generativelanguage.googleapis.com';
        case 'qwen': return 'https://dashscope.aliyuncs.com/compatible-mode';
        default: return 'https://api.deepseek.com';
      }
    };

    const config = {
      provider: finalProvider,
      apiKey: useUserConfig ? llmConfig.apiKey : (defaultApiKey || process.env.DEEPSEEK_API_KEY),
      baseUrl: useUserConfig ? (llmConfig?.baseUrl || getDefaultBaseUrl(finalProvider)) : (defaultBaseUrl || getDefaultBaseUrl(finalProvider)),
      model: finalModel
    };
    
    // 调试：显示API Key信息（隐藏中间部分）
    const keyPreview = config.apiKey ? 
      `${config.apiKey.substring(0, 8)}...${config.apiKey.substring(config.apiKey.length - 4)}` : 
      '未设置';
    console.log('[INFO] LLM配置:', { 
      provider: config.provider, 
      baseUrl: config.baseUrl, 
      model: config.model,
      apiKeyPreview: keyPreview,
      apiKeyLength: config.apiKey?.length || 0
    });

    if (!config.apiKey) {
      console.log('[ERROR] API Key未配置');
      return res.status(400).json({ success: false, error: '请配置API Key' });
    }
    
    // 验证API Key格式（DeepSeek的Key通常以sk-开头）
    if (config.provider === 'deepseek' && !config.apiKey.startsWith('sk-')) {
      console.log('[WARN] DeepSeek API Key格式可能不正确，通常应以sk-开头');
    }

    const systemPrompt = `你是一个专业的HTML5游戏开发专家。用户会给你一句话描述，你需要生成一个完整的、可直接运行的HTML5游戏。

【重要要求】：
1. 必须生成完整的HTML文件，包含<!DOCTYPE html>、<html>、<head>、<body>标签
2. 所有CSS样式写在<style>标签内，所有JavaScript写在<script>标签内
3. 游戏画面必须在页面加载后立即可见，不能是空白
4. 使用Canvas绑定要在DOM加载完成后进行
5. 必须包含游戏初始化代码，确保游戏元素正确渲染

【游戏要求】：
1. 游戏要有趣、可玩性强，逻辑完整
2. 必须有清晰的游戏界面：开始画面、游戏画面、结束画面
3. 包含操作说明（支持键盘和触屏）
4. 界面美观，使用现代化深色主题设计
5. 适配手机和电脑屏幕

【代码结构】：
\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>游戏名称</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #1a1a2e; overflow: hidden; }
        /* 其他样式 */
    </style>
</head>
<body>
    <!-- 游戏容器 -->
    <script>
        // 确保DOM加载完成后初始化
        document.addEventListener('DOMContentLoaded', function() {
            // 游戏初始化代码
        });
    </script>
</body>
</html>
\`\`\`

只返回完整的HTML代码，用\`\`\`html和\`\`\`包裹，不要有任何解释文字。`;

    console.log('[INFO] 开始调用LLM API...');
    const apiStartTime = Date.now();
    
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请生成游戏：${prompt}` }
        ],
        temperature: 0.7,
        max_tokens: 8000
      })
    });

    const apiTime = Date.now() - apiStartTime;
    console.log(`[INFO] LLM API响应时间: ${apiTime}ms, 状态: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.log('[ERROR] LLM API错误:', errorData);
      throw new Error(`LLM API错误: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log('[INFO] LLM响应成功, tokens使用:', data.usage);
    
    let code = data.choices[0].message.content;
    console.log('[INFO] 原始响应长度:', code.length);
    console.log('[DEBUG] 响应前100字符:', code.substring(0, 100));
    
    // 提取HTML代码 - 增强版，处理各种markdown格式
    code = extractHtmlFromResponse(code);
    
    // 验证HTML结构
    const hasDoctype = code.includes('<!DOCTYPE') || code.includes('<!doctype');
    const hasHtml = code.includes('<html');
    const hasBody = code.includes('<body');
    const hasScript = code.includes('<script');
    
    console.log('[INFO] HTML结构检查:', { hasDoctype, hasHtml, hasBody, hasScript });
    console.log('[INFO] 最终代码长度:', code.length);

    // 生成标题
    const titleMatch = code.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : prompt.slice(0, 50);
    console.log('[INFO] 游戏标题:', title);

    // 注入品牌水印
    code = injectBrandWatermark(code);
    console.log('[INFO] 已注入品牌水印');

    // 如果有草稿ID，自动更新草稿为已发布状态
    if (draftId && authorToken) {
      try {
        const draftGame = db.prepare('SELECT author_token FROM games WHERE id = ?').get(draftId);
        if (draftGame && draftGame.author_token === authorToken) {
          db.prepare(`
            UPDATE games 
            SET title = ?, code = ?, status = 'published', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(title, code, draftId);
          
          // 生成静态文件
          saveGameStaticFile(draftId, code, {
            title: title,
            authorName: '匿名', // 从草稿中获取作者名会更好
            prompt: prompt,
            authorToken: authorToken
          });
          
          console.log(`[INFO] 草稿已自动发布: ${draftId}`);
        } else {
          console.log(`[WARN] 草稿权限验证失败或草稿不存在: ${draftId}`);
        }
      } catch (draftError) {
        console.error('[ERROR] 自动更新草稿失败:', draftError.message);
        // 继续执行，不影响返回结果
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[SUCCESS] 游戏生成完成，总耗时: ${totalTime}ms`);
    console.log('========================================\n');

    res.json({ 
      success: true, 
      code,
      title,
      prompt,
      draftId: draftId || null,  // 返回草稿ID供前端使用
      debug: {
        codeLength: code.length,
        apiTime,
        totalTime,
        tokens: data.usage
      }
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[ERROR] 生成游戏失败 (耗时${totalTime}ms):`, error.message);
    console.log('========================================\n');
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存游戏（支持创建草稿：status='draft' 时 code 可为空）
app.post('/api/games', (req, res) => {
  try {
    const { title, prompt, code, authorName, authorToken, status } = req.body;
    
    // 草稿模式：只需要prompt，不需要code
    const isDraft = status === 'draft';
    
    if (!isDraft && (!code || !prompt)) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    if (isDraft && !prompt) {
      return res.status(400).json({ success: false, error: '草稿需要提供描述' });
    }

    const id = uuidv4();
    const token = authorToken || uuidv4();
    
    const gameTitle = title || prompt.slice(0, 50);
    const gameAuthor = authorName || '匿名';
    const gameCode = code || ''; // 草稿时code为空
    const gameStatus = isDraft ? 'draft' : 'published';
    
    db.prepare(`
      INSERT INTO games (id, title, prompt, code, author_name, author_token, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, gameTitle, prompt, gameCode, gameAuthor, token, gameStatus);

    // 只有已发布的游戏才生成静态文件
    if (!isDraft && code) {
      saveGameStaticFile(id, code, {
        title: gameTitle,
        authorName: gameAuthor,
        prompt: prompt,
        authorToken: token
      });
    }

    console.log(`[INFO] 游戏${isDraft ? '草稿' : ''}已创建: ${id}, status: ${gameStatus}`);
    res.json({ success: true, id, authorToken: token, staticUrl: isDraft ? null : getGameStaticUrl(id) });
  } catch (error) {
    console.error('[ERROR] 创建游戏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新游戏（支持草稿发布：status 从 draft 变为 published）
app.put('/api/games/:id', (req, res) => {
  try {
    const { title, prompt, code, authorName, authorToken, status, visibility } = req.body;
    const headerToken = req.headers['x-author-token'];
    const effectiveToken = authorToken || headerToken;
    
    // 验证作者权限
    const game = db.prepare('SELECT author_token, status FROM games WHERE id = ?').get(req.params.id);
    
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    if (game.author_token !== effectiveToken) {
      console.log(`[WARN] 更新游戏权限验证失败: game.token=${game.author_token?.slice(0,8)}..., req.token=${effectiveToken?.slice(0,8)}...`);
      return res.status(403).json({ success: false, error: '无权限编辑此游戏' });
    }

    // 构建更新SQL（只更新提供的字段）
    const updates = [];
    const params = [];
    
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (prompt !== undefined) { updates.push('prompt = ?'); params.push(prompt); }
    if (code !== undefined) { updates.push('code = ?'); params.push(code); }
    if (authorName !== undefined) { updates.push('author_name = ?'); params.push(authorName); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    // 处理可见性设置
    if (visibility !== undefined) {
      const isPublic = visibility === 'public' ? 1 : 0;
      updates.push('is_public = ?');
      params.push(isPublic);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    
    db.prepare(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // 如果更新为已发布状态且有代码，生成静态文件
    const newStatus = status || game.status;
    if (newStatus === 'published' && code) {
      saveGameStaticFile(req.params.id, code, {
        title: title || prompt?.slice(0, 50),
        authorName: authorName || '匿名',
        prompt: prompt,
        authorToken: game.author_token
      });
    }

    console.log(`[INFO] 游戏已更新: ${req.params.id}, status: ${newStatus}`);
    res.json({ success: true, staticUrl: newStatus === 'published' ? getGameStaticUrl(req.params.id) : null });
  } catch (error) {
    console.error('[ERROR] 更新游戏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 点赞游戏
app.post('/api/games/:id/like', (req, res) => {
  try {
    const gameId = req.params.id;
    const userToken = req.headers['x-user-token'];
    
    // 检查游戏是否存在
    const game = db.prepare('SELECT id, like_count FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    let liked = true;
    let newLikeCount = game.like_count;
    
    if (userToken) {
      // 检查是否已点赞
      const existingLike = db.prepare('SELECT id FROM user_likes WHERE user_token = ? AND game_id = ?').get(userToken, gameId);
      
      if (existingLike) {
        // 取消点赞
        db.prepare('DELETE FROM user_likes WHERE user_token = ? AND game_id = ?').run(userToken, gameId);
        db.prepare('UPDATE games SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(gameId);
        liked = false;
        newLikeCount = Math.max(0, newLikeCount - 1);
      } else {
        // 添加点赞
        db.prepare('INSERT INTO user_likes (user_token, game_id) VALUES (?, ?)').run(userToken, gameId);
        db.prepare('UPDATE games SET like_count = like_count + 1 WHERE id = ?').run(gameId);
        newLikeCount = newLikeCount + 1;
      }
    } else {
      // 匿名点赞（只增加计数，不记录）
      db.prepare('UPDATE games SET like_count = like_count + 1 WHERE id = ?').run(gameId);
      newLikeCount = newLikeCount + 1;
    }
    
    res.json({ success: true, liked, likeCount: newLikeCount });
  } catch (error) {
    console.error('[ERROR] 点赞失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 检查点赞状态
app.get('/api/games/:id/like-status', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const gameId = req.params.id;
    
    if (!userToken) {
      return res.json({ success: true, liked: false });
    }
    
    const like = db.prepare('SELECT id FROM user_likes WHERE user_token = ? AND game_id = ?').get(userToken, gameId);
    res.json({ success: true, liked: !!like });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 搜索游戏
app.get('/api/games/search/:keyword', (req, res) => {
  try {
    const keyword = `%${req.params.keyword}%`;
    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, created_at 
      FROM games 
      WHERE title LIKE ? OR prompt LIKE ? OR author_name LIKE ?
      ORDER BY like_count DESC, created_at DESC
      LIMIT 20
    `).all(keyword, keyword, keyword);
    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 我的游戏管理 ====================

// 获取我的游戏列表（包括草稿）
app.get('/api/my-games', (req, res) => {
  try {
    const authorToken = req.headers['x-author-token'];
    if (!authorToken) {
      return res.json({ success: true, games: [], stats: { count: 0, plays: 0, likes: 0 } });
    }

    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, created_at,
             COALESCE(status, 'published') as status,
             CASE WHEN is_public = 0 THEN 'private' ELSE 'public' END as visibility
      FROM games
      WHERE author_token = ?
      ORDER BY created_at DESC
    `).all(authorToken);

    // 计算总统计（只统计已发布的）
    const publishedGames = games.filter(g => g.status !== 'draft');
    const stats = {
      count: publishedGames.length,
      plays: publishedGames.reduce((sum, g) => sum + (g.play_count || 0), 0),
      likes: publishedGames.reduce((sum, g) => sum + (g.like_count || 0), 0)
    };

    res.json({ success: true, games, stats });
  } catch (error) {
    console.error('[ERROR] 获取我的游戏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除我的游戏
app.delete('/api/games/:id', (req, res) => {
  try {
    const authorToken = req.headers['x-author-token'];
    const gameId = req.params.id;
    
    if (!authorToken) {
      return res.status(401).json({ success: false, error: '未授权' });
    }
    
    // 验证是否是作者本人
    const game = db.prepare('SELECT author_token FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    if (game.author_token !== authorToken) {
      return res.status(403).json({ success: false, error: '无权删除此游戏' });
    }
    
    // 删除游戏
    db.prepare('DELETE FROM games WHERE id = ?').run(gameId);
    
    // 删除静态文件
    deleteGameStaticFile(gameId);
    
    console.log(`[INFO] 游戏已删除: ${gameId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[ERROR] 删除游戏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 扩展数据库表 ====================

// 创建用户点赞表
db.exec(`
  CREATE TABLE IF NOT EXISTS user_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    game_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, game_id)
  )
`);

// 创建用户收藏表
db.exec(`
  CREATE TABLE IF NOT EXISTS user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    game_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, game_id)
  )
`);

// 创建用户关注表
db.exec(`
  CREATE TABLE IF NOT EXISTS user_follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_token TEXT NOT NULL,
    following_token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_token, following_token)
  )
`);

// 获取我点赞的游戏
app.get('/api/my-likes', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.json({ success: true, games: [], count: 0 });
    }
    
    const games = db.prepare(`
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.created_at, ul.created_at as liked_at
      FROM user_likes ul
      JOIN games g ON ul.game_id = g.id
      WHERE ul.user_token = ?
      ORDER BY ul.created_at DESC
    `).all(userToken);
    
    res.json({ success: true, games, count: games.length });
  } catch (error) {
    console.error('[ERROR] 获取我的点赞失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取我收藏的游戏
app.get('/api/my-favorites', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.json({ success: true, games: [], count: 0 });
    }
    
    const games = db.prepare(`
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.created_at, uf.created_at as favorited_at
      FROM user_favorites uf
      JOIN games g ON uf.game_id = g.id
      WHERE uf.user_token = ?
      ORDER BY uf.created_at DESC
    `).all(userToken);
    
    res.json({ success: true, games, count: games.length });
  } catch (error) {
    console.error('[ERROR] 获取我的收藏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 收藏游戏
app.post('/api/games/:id/favorite', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const gameId = req.params.id;
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 检查游戏是否存在
    const game = db.prepare('SELECT id FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 检查是否已收藏
    const existing = db.prepare('SELECT id FROM user_favorites WHERE user_token = ? AND game_id = ?').get(userToken, gameId);
    
    if (existing) {
      // 已收藏，则取消收藏
      db.prepare('DELETE FROM user_favorites WHERE user_token = ? AND game_id = ?').run(userToken, gameId);
      // 更新游戏的收藏计数
      db.prepare('UPDATE games SET favorite_count = MAX(0, favorite_count - 1) WHERE id = ?').run(gameId);
      res.json({ success: true, favorited: false });
    } else {
      // 未收藏，添加收藏
      db.prepare('INSERT INTO user_favorites (user_token, game_id) VALUES (?, ?)').run(userToken, gameId);
      // 更新游戏的收藏计数
      db.prepare('UPDATE games SET favorite_count = favorite_count + 1 WHERE id = ?').run(gameId);
      res.json({ success: true, favorited: true });
    }
  } catch (error) {
    console.error('[ERROR] 收藏操作失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 检查收藏状态
app.get('/api/games/:id/favorite-status', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const gameId = req.params.id;
    
    if (!userToken) {
      return res.json({ success: true, favorited: false });
    }
    
    const favorite = db.prepare('SELECT id FROM user_favorites WHERE user_token = ? AND game_id = ?').get(userToken, gameId);
    res.json({ success: true, favorited: !!favorite });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 关注系统 ====================

// 关注/取消关注用户
app.post('/api/users/:token/follow', (req, res) => {
  try {
    const followerToken = req.headers['x-user-token'];
    const followingToken = req.params.token;
    
    if (!followerToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    if (followerToken === followingToken) {
      return res.status(400).json({ success: false, error: '不能关注自己' });
    }
    
    // 检查是否已关注
    const existing = db.prepare('SELECT id FROM user_follows WHERE follower_token = ? AND following_token = ?')
      .get(followerToken, followingToken);
    
    if (existing) {
      // 已关注，取消关注
      db.prepare('DELETE FROM user_follows WHERE follower_token = ? AND following_token = ?')
        .run(followerToken, followingToken);
      res.json({ success: true, following: false });
    } else {
      // 未关注，添加关注
      db.prepare('INSERT INTO user_follows (follower_token, following_token) VALUES (?, ?)')
        .run(followerToken, followingToken);
      res.json({ success: true, following: true });
    }
  } catch (error) {
    console.error('[ERROR] 关注操作失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 检查关注状态
app.get('/api/users/:token/follow-status', (req, res) => {
  try {
    const followerToken = req.headers['x-user-token'];
    const followingToken = req.params.token;
    
    if (!followerToken) {
      return res.json({ success: true, following: false });
    }
    
    const follow = db.prepare('SELECT id FROM user_follows WHERE follower_token = ? AND following_token = ?')
      .get(followerToken, followingToken);
    res.json({ success: true, following: !!follow });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取用户的关注数和粉丝数
app.get('/api/users/:token/follow-stats', (req, res) => {
  try {
    const userToken = req.params.token;

    // 关注数（我关注了多少人）
    const followingCount = db.prepare('SELECT COUNT(*) as count FROM user_follows WHERE follower_token = ?')
      .get(userToken)?.count || 0;

    // 粉丝数（多少人关注我）
    const followerCount = db.prepare('SELECT COUNT(*) as count FROM user_follows WHERE following_token = ?')
      .get(userToken)?.count || 0;

    res.json({
      success: true,
      followingCount,
      followerCount
    });
  } catch (error) {
    console.error('[ERROR] 获取关注统计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取用户基本信息
app.get('/api/users/:token/profile', (req, res) => {
  try {
    const userToken = req.params.token;

    // 从用户账号表获取昵称
    const account = db.prepare('SELECT account_id, nickname FROM user_accounts WHERE user_token = ?')
      .get(userToken);

    // 如果账号表没有，从游戏表获取作者名
    let nickname = account?.nickname;
    let accountId = account?.account_id;

    if (!nickname || nickname === '游戏玩家') {
      const game = db.prepare('SELECT author_name FROM games WHERE author_token = ? LIMIT 1')
        .get(userToken);
      nickname = game?.author_name || '游戏家用户';
    }

    // 获取作品数
    const gamesCount = db.prepare('SELECT COUNT(*) as count FROM games WHERE author_token = ? AND (is_public = 1 OR is_public IS NULL)')
      .get(userToken)?.count || 0;

    // 获取获赞数
    const likesCount = db.prepare('SELECT SUM(like_count) as total FROM games WHERE author_token = ?')
      .get(userToken)?.total || 0;

    res.json({
      success: true,
      profile: {
        token: userToken,
        accountId: accountId,
        nickname: nickname,
        gamesCount: gamesCount,
        likesCount: likesCount
      }
    });
  } catch (error) {
    console.error('[ERROR] 获取用户信息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取用户的游戏列表
app.get('/api/users/:token/games', (req, res) => {
  try {
    const userToken = req.params.token;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // 修复：is_public 可能为 NULL（旧数据），所以用 OR is_public IS NULL
    const games = db.prepare(`
      SELECT id, title, author_name, play_count, like_count, share_count, created_at
      FROM games
      WHERE author_token = ? AND (is_public = 1 OR is_public IS NULL) AND (is_hidden = 0 OR is_hidden IS NULL)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(userToken, limit, offset);

    res.json({ success: true, games, count: games.length });
  } catch (error) {
    console.error('[ERROR] 获取用户游戏列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取关注列表
app.get('/api/users/:token/following', (req, res) => {
  try {
    const userToken = req.params.token;
    const currentUserToken = req.headers['x-user-token'];
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const users = db.prepare(`
      SELECT uf.following_token as token, uf.created_at as followed_at,
             (SELECT author_name FROM games WHERE author_token = uf.following_token LIMIT 1) as nickname,
             (SELECT COUNT(*) FROM games WHERE author_token = uf.following_token) as games_count,
             (SELECT COUNT(*) FROM user_follows WHERE following_token = uf.following_token) as followers_count
      FROM user_follows uf
      WHERE uf.follower_token = ?
      ORDER BY uf.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userToken, limit, offset);

    // 添加 is_following 字段（当前用户是否关注了这个人）
    const usersWithFollowStatus = users.map(user => {
      let is_following = false;
      if (currentUserToken) {
        const followCheck = db.prepare('SELECT 1 FROM user_follows WHERE follower_token = ? AND following_token = ?')
          .get(currentUserToken, user.token);
        is_following = !!followCheck;
      }
      return { ...user, is_following };
    });

    res.json({ success: true, users: usersWithFollowStatus, count: usersWithFollowStatus.length });
  } catch (error) {
    console.error('[ERROR] 获取关注列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取粉丝列表
app.get('/api/users/:token/followers', (req, res) => {
  try {
    const userToken = req.params.token;
    const currentUserToken = req.headers['x-user-token'];
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const users = db.prepare(`
      SELECT uf.follower_token as token, uf.created_at as followed_at,
             (SELECT author_name FROM games WHERE author_token = uf.follower_token LIMIT 1) as nickname,
             (SELECT COUNT(*) FROM games WHERE author_token = uf.follower_token) as games_count,
             (SELECT COUNT(*) FROM user_follows WHERE following_token = uf.follower_token) as followers_count
      FROM user_follows uf
      WHERE uf.following_token = ?
      ORDER BY uf.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userToken, limit, offset);

    // 添加 is_following 字段（当前用户是否关注了这个粉丝）
    const usersWithFollowStatus = users.map(user => {
      let is_following = false;
      if (currentUserToken) {
        const followCheck = db.prepare('SELECT 1 FROM user_follows WHERE follower_token = ? AND following_token = ?')
          .get(currentUserToken, user.token);
        is_following = !!followCheck;
      }
      return { ...user, is_following };
    });

    res.json({ success: true, users: usersWithFollowStatus, count: usersWithFollowStatus.length });
  } catch (error) {
    console.error('[ERROR] 获取粉丝列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建邀请码表
db.exec(`
  CREATE TABLE IF NOT EXISTS invite_codes (
    code TEXT PRIMARY KEY,
    creator_token TEXT NOT NULL,
    used_by TEXT,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建数据统计表
db.exec(`
  CREATE TABLE IF NOT EXISTS stats_daily (
    date TEXT PRIMARY KEY,
    total_games INTEGER DEFAULT 0,
    total_plays INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    total_generations INTEGER DEFAULT 0,
    trial_uses INTEGER DEFAULT 0
  )
`);

// 创建用户扩展表（邀请码、体验次数等）
db.exec(`
  CREATE TABLE IF NOT EXISTS user_extras (
    user_token TEXT PRIMARY KEY,
    invite_code TEXT,
    invited_by TEXT,
    trial_count_today INTEGER DEFAULT 0,
    trial_last_date TEXT,
    share_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建游戏社交统计表（详细的分享追踪）
db.exec(`
  CREATE TABLE IF NOT EXISTS game_stats (
    game_id TEXT PRIMARY KEY,
    share_count INTEGER DEFAULT 0,
    share_wechat INTEGER DEFAULT 0,
    share_weibo INTEGER DEFAULT 0,
    share_qq INTEGER DEFAULT 0,
    share_link INTEGER DEFAULT 0,
    unique_players INTEGER DEFAULT 0,
    avg_play_time INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建游戏点赞记录表（防止重复点赞）
db.exec(`
  CREATE TABLE IF NOT EXISTS game_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    user_token TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_token)
  )
`);

// 创建游玩记录表（记录每次游玩，用于统计）
db.exec(`
  CREATE TABLE IF NOT EXISTS game_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    user_token TEXT,
    ip_address TEXT,
    play_duration INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建分享记录表
db.exec(`
  CREATE TABLE IF NOT EXISTS share_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    user_token TEXT,
    platform TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_game_likes_game ON game_likes(game_id);
  CREATE INDEX IF NOT EXISTS idx_game_plays_game ON game_plays(game_id);
  CREATE INDEX IF NOT EXISTS idx_share_logs_game ON share_logs(game_id);
`);

// ==================== 辅助函数 ====================

// 敏感词检测
function containsSensitiveWords(text) {
  const lowerText = text.toLowerCase();
  for (const word of SENSITIVE_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return { found: true, word };
    }
  }
  return { found: false };
}

// 匹配游戏模板
function matchGameTemplate(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  for (const [key, template] of Object.entries(GAME_TEMPLATES)) {
    for (const keyword of template.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        return { matched: true, template: key, ...template };
      }
    }
  }
  return { matched: false };
}

// 生成邀请码
function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// 获取当前周的挑战主题
function getCurrentChallenge() {
  const weekOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 604800000);
  return WEEKLY_CHALLENGES[weekOfYear % WEEKLY_CHALLENGES.length];
}

// 检查体验模式配额
function checkTrialQuota(userToken) {
  // 检查是否有可用的API配置
  const apiConfig = getTrialApiConfig();
  if (!TRIAL_CONFIG.enabled || !apiConfig) {
    return { allowed: false, reason: '游客模式未启用，请在管理后台配置默认LLM API Key' };
  }
  
  // 使用积分系统检查配额
  const userCredits = ensureUserCredits(userToken);
  
  // 首次生成免费检查
  if (!userCredits.first_gen_used) {
    return { 
      allowed: true, 
      remaining: userCredits.credits + 1, // 加上首次免费的一次
      globalRemaining: 999,
      isFreeFirst: true
    };
  }
  
  // 检查积分
  if (userCredits.credits <= 0) {
    return { allowed: false, reason: '积分不足，请观看广告获取积分或配置自己的API Key' };
  }
  
  return { 
    allowed: true, 
    remaining: userCredits.credits,
    globalRemaining: 999
  };
}

// 记录体验使用（消耗积分）
function recordTrialUse(userToken) {
  const today = new Date().toISOString().split('T')[0];
  
  // 更新全站统计
  db.prepare('UPDATE stats_daily SET trial_uses = trial_uses + 1 WHERE date = ?').run(today);
  
  // 检查是否是首次生成
  const userCredits = ensureUserCredits(userToken);
  
  if (!userCredits.first_gen_used) {
    // 首次生成免费，只标记已使用
    db.prepare('UPDATE user_credits SET first_gen_used = 1, updated_at = CURRENT_TIMESTAMP WHERE user_token = ?')
      .run(userToken);
    console.log(`[Credits] 用户 ${userToken.substring(0, 8)}... 使用首次免费生成`);
  } else {
    // 消耗积分
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits - 1, total_used = total_used + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(userToken);
    console.log(`[Credits] 用户 ${userToken.substring(0, 8)}... 消耗1积分，剩余 ${userCredits.credits - 1}`);
  }
}

// ==================== 体验模式 API ====================

// 检查体验模式状态
app.get('/api/trial/status', (req, res) => {
  const userToken = req.headers['x-user-token'];
  
  if (!TRIAL_CONFIG.enabled) {
    return res.json({ success: true, enabled: false });
  }
  
  const apiConfig = getTrialApiConfig();
  const quota = checkTrialQuota(userToken || 'anonymous');
  const userCredits = userToken ? ensureUserCredits(userToken) : null;
  
  res.json({
    success: true,
    enabled: TRIAL_CONFIG.enabled && !!apiConfig,
    allowed: quota.allowed,
    remaining: quota.remaining || 0,
    userRemaining: quota.remaining || 0, // 兼容前端
    globalRemaining: quota.globalRemaining || 0,
    perUserLimit: TRIAL_CONFIG.perUserLimit,
    reason: quota.reason,
    // 积分系统信息
    credits: userCredits?.credits || 0,
    firstGenUsed: userCredits?.first_gen_used || 0,
    isFreeFirst: quota.isFreeFirst || false
  });
});

// 使用体验模式生成游戏
app.post('/api/trial/generate', async (req, res) => {
  const startTime = Date.now();
  const userToken = req.headers['x-user-token'] || 'anonymous-' + Date.now();
  const authorToken = req.headers['x-author-token'] || null;
  
  try {
    const { prompt, draftId } = req.body;
    console.log('[TRIAL] 收到生成请求:', { prompt, draftId, authorToken: authorToken ? authorToken.slice(0, 8) + '...' : null });
    
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ success: false, error: '请输入游戏描述' });
    }
    
    // 敏感词检测
    const sensitiveCheck = containsSensitiveWords(prompt);
    if (sensitiveCheck.found) {
      return res.status(400).json({ success: false, error: '输入内容包含敏感词，请修改后重试' });
    }
    
    // 检查体验配额
    const quota = checkTrialQuota(userToken);
    if (!quota.allowed) {
      return res.status(429).json({ success: false, error: quota.reason, needApiKey: true });
    }
    
    // 匹配模板优化 prompt
    const templateMatch = matchGameTemplate(prompt);
    let enhancedPrompt = prompt;
    if (templateMatch.matched) {
      enhancedPrompt = `${prompt}。参考要求：${templateMatch.basePrompt}`;
      console.log(`[TRIAL] 匹配到模板: ${templateMatch.name}`);
    }
    
    console.log(`[TRIAL] 开始游客模式生成: ${prompt}`);
    
    // 【重要】在发送LLM请求前先扣除积分，防止滥用
    recordTrialUse(userToken);
    console.log(`[TRIAL] 已扣除积分`);
    
    const systemPrompt = `你是一个专业的HTML5游戏开发专家。用户会给你一句话描述，你需要生成一个完整的、可直接运行的HTML5游戏。

【重要要求】：
1. 必须生成完整的HTML文件，包含<!DOCTYPE html>、<html>、<head>、<body>标签
2. 所有CSS样式写在<style>标签内，所有JavaScript写在<script>标签内
3. 游戏画面必须在页面加载后立即可见，不能是空白
4. 使用Canvas绑定要在DOM加载完成后进行
5. 必须包含游戏初始化代码，确保游戏元素正确渲染

【游戏要求】：
1. 游戏要有趣、可玩性强，逻辑完整
2. 必须有清晰的游戏界面：开始画面、游戏画面、结束画面
3. 包含操作说明（支持键盘和触屏）
4. 界面美观，使用现代化深色主题设计
5. 适配手机和电脑屏幕

【移动端适配】：
1. 添加触屏控制支持（虚拟摇杆或触屏按钮）
2. 监听 touchstart/touchmove/touchend 事件
3. 防止页面滚动：在游戏区域阻止默认触摸行为

只返回完整的HTML代码，用\`\`\`html和\`\`\`包裹，不要有任何解释文字。`;

    // 获取API配置（支持环境变量或管理后台配置）
    const apiConfig = getTrialApiConfig();
    if (!apiConfig) {
      throw new Error('游客模式未配置API Key');
    }

    // 带重试机制的API请求
    const MAX_RETRIES = 2;
    let response;
    let lastError;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时
      
      try {
        console.log(`[TRIAL] 发送API请求 (尝试${attempt}/${MAX_RETRIES}): ${apiConfig.baseUrl}/v1/chat/completions`);
        response = await fetch(`${apiConfig.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`,
            'Connection': 'keep-alive'
          },
          body: JSON.stringify({
            model: apiConfig.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `请生成游戏：${enhancedPrompt}` }
            ],
            temperature: 0.7,
            max_tokens: 8000
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log(`[TRIAL] API响应状态: ${response.status}`);
        
        // 成功获取响应，跳出重试循环
        if (response.ok) {
          break;
        }
        
        // 非重试错误码，直接抛出
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          const errorData = await response.text();
          console.error('[TRIAL ERROR]', errorData);
          throw new Error('AI服务暂时不可用，请稍后重试');
        }
        
        lastError = new Error(`API响应错误: ${response.status}`);
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        lastError = fetchError;
        console.error(`[TRIAL ERROR] 请求失败 (尝试${attempt}/${MAX_RETRIES}):`, fetchError.name, fetchError.message);
        
        if (fetchError.name === 'AbortError') {
          console.error('[TRIAL ERROR] 请求超时（2分钟）');
          lastError = new Error('生成超时，AI服务响应时间过长，请稍后重试');
          break; // 超时不重试
        }
        
        // 可重试的错误
        const isRetryableError = (
          fetchError.message === 'terminated' || 
          fetchError.message?.includes('terminated') ||
          fetchError.cause?.code === 'ECONNRESET' ||
          fetchError.cause?.code === 'ETIMEDOUT' ||
          fetchError.cause?.code === 'EPIPE'
        );
        
        if (!isRetryableError || attempt === MAX_RETRIES) {
          // 最后一次尝试或不可重试的错误
          if (fetchError.message === 'terminated' || fetchError.message?.includes('terminated')) {
            console.error('[TRIAL ERROR] 连接被终止');
            lastError = new Error('AI服务连接中断，请稍后重试');
          } else if (fetchError.cause?.code === 'ECONNRESET') {
            lastError = new Error('AI服务连接被重置，请稍后重试');
          } else if (fetchError.cause?.code === 'ECONNREFUSED') {
            lastError = new Error('AI服务拒绝连接，请检查服务是否可用');
          } else if (fetchError.cause?.code === 'ETIMEDOUT') {
            lastError = new Error('AI服务连接超时，请稍后重试');
          } else {
            lastError = new Error(`网络错误: ${fetchError.message || '请检查网络后重试'}`);
          }
          break;
        }
        
        // 等待后重试
        console.log(`[TRIAL] 等待2秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!response || !response.ok) {
      throw lastError || new Error('AI服务请求失败');
    }

    const data = await response.json();
    let code = data.choices[0].message.content;
    
    // 提取HTML代码 - 使用增强版提取函数
    code = extractHtmlFromResponse(code);
    
    // 生成标题
    const titleMatch = code.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : prompt.slice(0, 50);
    
    // 注入品牌水印
    code = injectBrandWatermark(code);

    // 如果有草稿ID，自动更新草稿为已发布状态
    if (draftId && authorToken) {
      try {
        const draftGame = db.prepare('SELECT author_token, author_name FROM games WHERE id = ?').get(draftId);
        if (draftGame && draftGame.author_token === authorToken) {
          db.prepare(`
            UPDATE games 
            SET title = ?, code = ?, status = 'published', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(title, code, draftId);
          
          // 生成静态文件
          saveGameStaticFile(draftId, code, {
            title: title,
            authorName: draftGame.author_name || '匿名',
            prompt: prompt,
            authorToken: authorToken
          });
          
          console.log(`[TRIAL] 草稿已自动发布: ${draftId}`);
        } else {
          console.log(`[TRIAL WARN] 草稿权限验证失败或草稿不存在: ${draftId}`);
        }
      } catch (draftError) {
        console.error('[TRIAL ERROR] 自动更新草稿失败:', draftError.message);
        // 继续执行，不影响返回结果
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[TRIAL SUCCESS] 生成完成，耗时: ${totalTime}ms`);

    res.json({
      success: true,
      code,
      title,
      prompt,
      trialMode: true,
      draftId: draftId || null,  // 返回草稿ID供前端使用
      remaining: quota.remaining - 1,
      debug: {
        codeLength: code.length,
        totalTime,
        templateUsed: templateMatch.matched ? templateMatch.name : null
      }
    });
  } catch (error) {
    console.error('[TRIAL ERROR]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 邀请链接系统 ====================

// 获取我的邀请链接（基于用户token生成唯一短码）
app.get('/api/invite/my-link', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    // 使用用户token的前8位作为邀请码（简单且唯一）
    const inviteCode = userToken.substring(0, 8).toUpperCase();
    
    // 确保invite_codes表中有记录
    const existing = db.prepare('SELECT code FROM invite_codes WHERE creator_token = ?').get(userToken);
    if (!existing) {
      db.prepare('INSERT OR IGNORE INTO invite_codes (code, creator_token) VALUES (?, ?)').run(inviteCode, userToken);
    }
    
    res.json({ 
      success: true, 
      code: inviteCode,
      link: `/?ref=${inviteCode}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 处理邀请链接访问（新用户通过邀请链接首次访问 +3积分）
app.post('/api/invite/link-visit', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { refCode } = req.body;
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    if (!refCode) {
      return res.json({ success: false, error: '缺少邀请码' });
    }
    
    // 检查用户是否已被邀请过
    const userExtra = db.prepare('SELECT invited_by FROM user_extras WHERE user_token = ?').get(userToken);
    if (userExtra?.invited_by) {
      return res.json({ success: false, error: '你已经使用过邀请链接了', alreadyUsed: true });
    }
    
    // 查找邀请者
    const inviter = db.prepare('SELECT creator_token FROM invite_codes WHERE code = ?').get(refCode.toUpperCase());
    if (!inviter) {
      return res.json({ success: false, error: '邀请链接无效' });
    }
    
    // 不能自己邀请自己
    if (inviter.creator_token === userToken) {
      return res.json({ success: false, error: '不能使用自己的邀请链接' });
    }
    
    // 记录被邀请关系
    db.prepare('INSERT OR REPLACE INTO user_extras (user_token, invited_by) VALUES (?, ?)')
      .run(userToken, inviter.creator_token);
    
    // 被邀请者获得奖励 (inviteBonus: 3积分)
    const newUserReward = CREDITS_CONFIG.inviteBonus;
    db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
      .run(newUserReward, newUserReward, userToken);
    db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
      .run(userToken, newUserReward, 'invite_bonus', '通过邀请链接注册奖励');
    
    // 邀请者获得奖励 (inviteFriend: 3积分)
    const inviterReward = CREDITS_CONFIG.inviteFriend;
    db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
      .run(inviterReward, inviterReward, inviter.creator_token);
    db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
      .run(inviter.creator_token, inviterReward, 'invite_success', '成功邀请新用户奖励');
    
    const updated = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    res.json({
      success: true,
      earned: newUserReward,
      credits: updated?.credits || newUserReward,
      message: `🎉 欢迎！通过邀请链接注册获得 ${newUserReward} 次生成机会！`
    });
  } catch (error) {
    console.error('邀请链接处理失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 处理游戏分享链接访问（分享者 +1积分）
app.post('/api/invite/share-visit', (req, res) => {
  try {
    const visitorToken = req.headers['x-user-token'];
    const { gameId, sharerToken } = req.body;
    
    if (!visitorToken || !gameId) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }
    
    // 如果没有sharerToken，不处理积分
    if (!sharerToken) {
      return res.json({ success: true, message: '无需处理' });
    }
    
    // 不能自己给自己加分
    if (sharerToken === visitorToken) {
      return res.json({ success: true, message: '访问自己的分享链接' });
    }
    
    // 使用复合键检查是否已记录过此次分享访问（防止重复计分）
    const visitKey = `${gameId}_${visitorToken}_${sharerToken}`;
    const existing = db.prepare('SELECT id FROM share_visit_logs WHERE visit_key = ?').get(visitKey);
    if (existing) {
      return res.json({ success: true, message: '已记录过此次访问' });
    }
    
    // 记录分享访问
    try {
      db.prepare('INSERT INTO share_visit_logs (visit_key, game_id, visitor_token, sharer_token) VALUES (?, ?, ?, ?)')
        .run(visitKey, gameId, visitorToken, sharerToken);
    } catch (e) {
      // 可能表不存在，尝试创建
      db.exec(`
        CREATE TABLE IF NOT EXISTS share_visit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          visit_key TEXT UNIQUE,
          game_id TEXT,
          visitor_token TEXT,
          sharer_token TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.prepare('INSERT INTO share_visit_logs (visit_key, game_id, visitor_token, sharer_token) VALUES (?, ?, ?, ?)')
        .run(visitKey, gameId, visitorToken, sharerToken);
    }
    
    // 分享者获得奖励 (shareViewBonus: 1积分)
    const reward = CREDITS_CONFIG.shareViewBonus;
    db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
      .run(reward, reward, sharerToken);
    db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
      .run(sharerToken, reward, 'share_view', `游戏分享被访问奖励`);
    
    res.json({
      success: true,
      message: '分享访问已记录'
    });
  } catch (error) {
    console.error('分享访问处理失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 邀请码系统（兼容旧版） ====================

// 获取我的邀请码（GET）- 兼容旧版，返回邀请链接格式
app.get('/api/invite/my-code', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    // 检查是否已有邀请码
    let existing = db.prepare('SELECT code FROM invite_codes WHERE creator_token = ? AND used_by IS NULL').get(userToken);
    
    if (existing) {
      return res.json({ success: true, code: existing.code });
    }
    
    // 自动生成新邀请码
    const code = generateInviteCode();
    db.prepare('INSERT INTO invite_codes (code, creator_token) VALUES (?, ?)').run(code, userToken);
    
    res.json({ success: true, code });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 生成我的邀请码
app.post('/api/invite/generate', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    // 检查是否已有邀请码
    let existing = db.prepare('SELECT code FROM invite_codes WHERE creator_token = ? AND used_by IS NULL').get(userToken);
    
    if (existing) {
      return res.json({ success: true, code: existing.code, isNew: false });
    }
    
    // 生成新邀请码
    const code = generateInviteCode();
    db.prepare('INSERT INTO invite_codes (code, creator_token) VALUES (?, ?)').run(code, userToken);
    
    res.json({ success: true, code, isNew: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 使用邀请码
app.post('/api/invite/use', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { code } = req.body;
    
    if (!userToken || !code) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }
    
    // 检查邀请码是否有效
    const invite = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code.toUpperCase());
    
    if (!invite) {
      return res.status(400).json({ success: false, error: '邀请码无效' });
    }
    
    if (invite.used_by) {
      return res.status(400).json({ success: false, error: '邀请码已被使用' });
    }
    
    if (invite.creator_token === userToken) {
      return res.status(400).json({ success: false, error: '不能使用自己的邀请码' });
    }
    
    // 检查用户是否已被邀请过
    const userExtra = db.prepare('SELECT invited_by FROM user_extras WHERE user_token = ?').get(userToken);
    if (userExtra?.invited_by) {
      return res.status(400).json({ success: false, error: '你已经使用过邀请码了' });
    }
    
    // 使用邀请码
    db.prepare('UPDATE invite_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?')
      .run(userToken, code.toUpperCase());
    
    // 记录被邀请
    db.prepare('INSERT OR REPLACE INTO user_extras (user_token, invited_by) VALUES (?, ?)')
      .run(userToken, invite.creator_token);
    
    // 双方获得奖励
    const reward = CREDITS_CONFIG.inviteFriend;
    
    // 邀请者获得奖励
    db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
      .run(reward, reward, invite.creator_token);
    db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
      .run(invite.creator_token, reward, 'invite', `邀请好友奖励`);
    
    // 被邀请者获得奖励
    db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
      .run(reward, reward, userToken);
    db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
      .run(userToken, reward, 'invited', `被邀请奖励`);
    
    const updated = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    res.json({
      success: true,
      earned: reward,
      credits: updated?.credits || reward,
      message: `邀请码使用成功，你和邀请者各获得 ${reward} 次生成机会！`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 排行榜 ====================

// 热门游戏排行
app.get('/api/leaderboard/games', (req, res) => {
  try {
    const type = req.query.type || 'likes'; // likes, plays, recent
    const limit = parseInt(req.query.limit) || 20;
    
    let orderBy = 'like_count DESC, play_count DESC';
    if (type === 'plays') orderBy = 'play_count DESC, like_count DESC';
    if (type === 'recent') orderBy = 'created_at DESC';
    
    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, created_at 
      FROM games 
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL)
      ORDER BY ${orderBy}
      LIMIT ?
    `).all(limit);
    
    res.json({ success: true, games, type });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创作者排行
app.get('/api/leaderboard/creators', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const creators = db.prepare(`
      SELECT 
        author_name,
        COUNT(*) as game_count,
        SUM(like_count) as total_likes,
        SUM(play_count) as total_plays
      FROM games 
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL)
      GROUP BY author_token
      ORDER BY total_likes DESC, game_count DESC
      LIMIT ?
    `).all(limit);
    
    res.json({ success: true, creators });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 每周挑战赛 ====================

// 获取当前挑战
app.get('/api/challenge/current', (req, res) => {
  const challenge = getCurrentChallenge();
  res.json({ success: true, challenge });
});

// 获取挑战作品
app.get('/api/challenge/entries', (req, res) => {
  try {
    const challenge = getCurrentChallenge();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    // 简单匹配：标题或描述包含挑战主题关键词
    const keywords = challenge.theme.split('').filter(c => c.match(/[\u4e00-\u9fa5a-zA-Z]/)).join('%');
    
    const entries = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, created_at 
      FROM games 
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL) 
        AND created_at >= ? AND (title LIKE ? OR prompt LIKE ?)
      ORDER BY like_count DESC, play_count DESC
      LIMIT 20
    `).all(weekStart.toISOString(), `%${keywords}%`, `%${keywords}%`);
    
    res.json({ success: true, challenge, entries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 数据统计 ====================

// 获取统计概览（管理员）
app.get('/api/admin/stats', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const totalGames = db.prepare('SELECT COUNT(*) as count FROM games').get().count;
    const totalPlays = db.prepare('SELECT SUM(play_count) as count FROM games').get().count || 0;
    const totalLikes = db.prepare('SELECT SUM(like_count) as count FROM games').get().count || 0;
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM user_credits').get().count;
    
    const today = new Date().toISOString().split('T')[0];
    const todayStats = db.prepare('SELECT * FROM stats_daily WHERE date = ?').get(today) || {};
    
    const last7Days = db.prepare(`
      SELECT date, total_generations, trial_uses 
      FROM stats_daily 
      ORDER BY date DESC 
      LIMIT 7
    `).all();
    
    res.json({
      success: true,
      overview: { totalGames, totalPlays, totalLikes, totalUsers },
      today: todayStats,
      last7Days
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取游戏模板列表
app.get('/api/templates', (req, res) => {
  const templates = Object.entries(GAME_TEMPLATES).map(([key, value]) => ({
    id: key,
    name: value.name,
    icon: value.icon,
    prompt: value.basePrompt
  }));
  
  res.json({ success: true, templates });
});

// ==================== 管理员API扩展 ====================

// 获取所有系统配置
app.get('/api/admin/config', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const configs = db.prepare('SELECT * FROM system_config ORDER BY key').all();
    res.json({ success: true, configs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新系统配置
app.put('/api/admin/config', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { configs } = req.body;
    if (!configs || !Array.isArray(configs)) {
      return res.status(400).json({ success: false, error: '无效的配置数据' });
    }
    
    configs.forEach(({ key, value }) => {
      if (key && value !== undefined) {
        setConfig(key, value);
      }
    });
    
    res.json({ success: true, message: '配置已更新' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取游戏列表（管理员，包含隐藏的）
app.get('/api/admin/games', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const filter = req.query.filter || 'all'; // all, featured, hidden
    
    let whereClause = '1=1';
    const params = [];
    
    if (search) {
      whereClause += ' AND (title LIKE ? OR prompt LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (filter === 'featured') {
      whereClause += ' AND is_featured = 1';
    } else if (filter === 'hidden') {
      whereClause += ' AND is_hidden = 1';
    }
    
    const total = db.prepare(`SELECT COUNT(*) as count FROM games WHERE ${whereClause}`).get(...params).count;
    
    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, favorite_count,
             is_featured, is_hidden, category, created_at
      FROM games 
      WHERE ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    
    res.json({ 
      success: true, 
      games, 
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新游戏状态（推荐/隐藏）
app.put('/api/admin/games/:id', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { id } = req.params;
    const { is_featured, is_hidden, category } = req.body;
    
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    const updates = [];
    const params = [];
    
    if (is_featured !== undefined) {
      updates.push('is_featured = ?');
      params.push(is_featured ? 1 : 0);
    }
    if (is_hidden !== undefined) {
      updates.push('is_hidden = ?');
      params.push(is_hidden ? 1 : 0);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      db.prepare(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    res.json({ success: true, message: '游戏已更新' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除游戏（管理员）
app.delete('/api/admin/games/:id', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { id } = req.params;
    
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 删除相关数据
    db.prepare('DELETE FROM user_likes WHERE game_id = ?').run(id);
    db.prepare('DELETE FROM user_favorites WHERE game_id = ?').run(id);
    db.prepare('DELETE FROM games WHERE id = ?').run(id);
    
    res.json({ success: true, message: '游戏已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量操作游戏
app.post('/api/admin/games/batch', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { action, gameIds } = req.body;
    
    if (!gameIds || !Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ success: false, error: '请选择游戏' });
    }
    
    const placeholders = gameIds.map(() => '?').join(',');
    
    switch (action) {
      case 'feature':
        db.prepare(`UPDATE games SET is_featured = 1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(...gameIds);
        break;
      case 'unfeature':
        db.prepare(`UPDATE games SET is_featured = 0, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(...gameIds);
        break;
      case 'hide':
        db.prepare(`UPDATE games SET is_hidden = 1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(...gameIds);
        break;
      case 'show':
        db.prepare(`UPDATE games SET is_hidden = 0, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(...gameIds);
        break;
      case 'delete':
        gameIds.forEach(id => {
          db.prepare('DELETE FROM user_likes WHERE game_id = ?').run(id);
          db.prepare('DELETE FROM user_favorites WHERE game_id = ?').run(id);
        });
        db.prepare(`DELETE FROM games WHERE id IN (${placeholders})`).run(...gameIds);
        break;
      default:
        return res.status(400).json({ success: false, error: '未知操作' });
    }
    
    res.json({ success: true, message: `已处理 ${gameIds.length} 个游戏` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取用户列表（管理员）
app.get('/api/admin/users', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const total = db.prepare('SELECT COUNT(*) as count FROM user_credits').get().count;
    
    const users = db.prepare(`
      SELECT user_token, credits, total_earned, total_used, followed_wechat, 
             ad_count_today, created_at, updated_at
      FROM user_credits 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    res.json({ 
      success: true, 
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 前端排行榜API ====================

// 获取推荐榜（管理员推荐）
app.get('/api/leaderboard/featured', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, favorite_count, created_at
      FROM games 
      WHERE is_featured = 1 AND is_hidden = 0
      ORDER BY updated_at DESC, like_count DESC
      LIMIT ?
    `).all(limit);
    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取收藏榜
app.get('/api/leaderboard/favorites', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    // 直接使用 games 表中的 favorite_count 字段
    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, favorite_count, created_at
      FROM games
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL)
      ORDER BY favorite_count DESC, like_count DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 全部游戏列表 API ====================
app.get('/api/games', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const sort = req.query.sort || 'newest';
    const category = req.query.category || 'all';
    
    // 构建排序条件
    let orderBy = 'created_at DESC';
    switch (sort) {
      case 'newest':
        orderBy = 'created_at DESC';
        break;
      case 'oldest':
        orderBy = 'created_at ASC';
        break;
      case 'hot':
        orderBy = '(play_count + like_count * 5 + favorite_count * 3) DESC';
        break;
      case 'likes':
        orderBy = 'like_count DESC, created_at DESC';
        break;
      case 'favorites':
        orderBy = 'favorite_count DESC, created_at DESC';
        break;
      case 'plays':
        orderBy = 'play_count DESC, created_at DESC';
        break;
    }
    
    // 构建分类条件
    let categoryWhere = '';
    const params = [];
    
    if (category && category !== 'all') {
      // 简单的关键词匹配分类
      const categoryKeywords = {
        'puzzle': ['2048', '拼图', '消除', '解谜', '益智', '数独', '连连看'],
        'action': ['射击', '飞机', '打砖块', '弹球', '跑酷', '格斗', '动作'],
        'arcade': ['贪吃蛇', '俄罗斯方块', '方块', '街机', '经典'],
        'casual': ['翻牌', '记忆', '休闲', '点击', '小鸟', 'flappy'],
        'strategy': ['塔防', '策略', '棋', '卡牌']
      };
      
      const keywords = categoryKeywords[category];
      if (keywords && keywords.length > 0) {
        const conditions = keywords.map(() => `(title LIKE ? OR prompt LIKE ?)`).join(' OR ');
        categoryWhere = `AND (${conditions})`;
        keywords.forEach(kw => {
          params.push(`%${kw}%`, `%${kw}%`);
        });
      }
    }
    
    // 获取总数（排除草稿和私密）
    const countSql = `SELECT COUNT(*) as total FROM games WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL) AND COALESCE(status, 'published') = 'published' ${categoryWhere}`;
    const totalResult = db.prepare(countSql).get(...params);
    const total = totalResult ? totalResult.total : 0;
    
    // 获取游戏列表（排除草稿和私密）
    const sql = `
      SELECT id, title, prompt, author_name, play_count, like_count, favorite_count, created_at,
             (play_count + like_count * 5 + favorite_count * 3) as hot_score
      FROM games 
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL) AND COALESCE(status, 'published') = 'published' ${categoryWhere}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;
    
    const games = db.prepare(sql).all(...params, limit, offset);
    
    res.json({ 
      success: true, 
      games,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + games.length < total
      }
    });
  } catch (error) {
    console.error('获取游戏列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取点赞榜
app.get('/api/leaderboard/likes', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, favorite_count, created_at
      FROM games 
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL)
      ORDER BY like_count DESC, play_count DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取热门榜（综合浏览和点赞）
app.get('/api/leaderboard/hot', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const games = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count, favorite_count, created_at,
             (play_count + like_count * 5 + favorite_count * 3) as score
      FROM games 
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL)
      ORDER BY score DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 分享海报生成 ====================

// 获取游戏分享信息
app.get('/api/games/:id/share-info', (req, res) => {
  try {
    const game = db.prepare(`
      SELECT id, title, prompt, author_name, play_count, like_count 
      FROM games WHERE id = ?
    `).get(req.params.id);
    
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    const shareUrl = `${req.protocol}://${req.get('host')}/game/${game.id}`;
    
    res.json({
      success: true,
      shareInfo: {
        title: game.title,
        description: `我用AI生成了「${game.title}」，快来玩吧！`,
        author: game.author_name,
        plays: game.play_count,
        likes: game.like_count,
        url: shareUrl,
        // 微信分享配置
        wechat: {
          title: `🎮 ${game.title}`,
          desc: `我用一句话让AI生成了这个游戏，快来挑战！`,
          link: shareUrl,
          imgUrl: `${req.protocol}://${req.get('host')}/images/share-default.png`
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 游戏社交统计系统 ====================

// 获取游戏完整统计数据
app.get('/api/games/:id/stats', (req, res) => {
  try {
    // 禁用缓存，确保获取最新数据
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const gameId = req.params.id;
    const userToken = req.headers['x-user-token'];
    
    // 基础游戏信息
    const game = db.prepare(`
      SELECT id, title, author_name, play_count, like_count, created_at 
      FROM games WHERE id = ?
    `).get(gameId);
    
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 获取详细统计
    let stats = db.prepare('SELECT * FROM game_stats WHERE game_id = ?').get(gameId);
    if (!stats) {
      // 初始化统计记录
      db.prepare('INSERT OR IGNORE INTO game_stats (game_id) VALUES (?)').run(gameId);
      stats = { share_count: 0, share_wechat: 0, share_weibo: 0, share_qq: 0, share_link: 0, unique_players: 0 };
    }
    
    // 检查当前用户是否已点赞（统一使用 user_likes 表）
    let hasLiked = false;
    if (userToken) {
      const like = db.prepare('SELECT 1 FROM user_likes WHERE game_id = ? AND user_token = ?').get(gameId, userToken);
      hasLiked = !!like;
    }
    
    // 今日游玩次数
    const today = new Date().toISOString().split('T')[0];
    const todayPlays = db.prepare(`
      SELECT COUNT(*) as count FROM game_plays 
      WHERE game_id = ? AND DATE(created_at) = ?
    `).get(gameId, today)?.count || 0;
    
    res.json({
      success: true,
      stats: {
        gameId,
        title: game.title,
        author: game.author_name,
        // 核心数据
        playCount: game.play_count,
        likeCount: game.like_count,
        shareCount: stats.share_count,
        // 今日数据
        todayPlays,
        // 分享渠道细分
        shareBreakdown: {
          wechat: stats.share_wechat,
          weibo: stats.share_weibo,
          qq: stats.share_qq,
          link: stats.share_link
        },
        // 用户状态
        hasLiked,
        // 热度指标 (plays * 1 + likes * 5 + shares * 3)
        hotScore: game.play_count + game.like_count * 5 + stats.share_count * 3,
        createdAt: game.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 记录游戏游玩（带防重复和时长追踪）
app.post('/api/games/:id/play', (req, res) => {
  try {
    const gameId = req.params.id;
    const userToken = req.headers['x-user-token'];
    const { duration } = req.body; // 可选：游玩时长（秒）
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // 检查游戏是否存在
    const game = db.prepare('SELECT id FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 检查最近是否已记录（同一用户/IP 5分钟内不重复计数）
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const identifier = userToken || ip;
    
    const recentPlay = db.prepare(`
      SELECT id FROM game_plays 
      WHERE game_id = ? AND (user_token = ? OR ip_address = ?) AND created_at > ?
    `).get(gameId, identifier, ip, fiveMinutesAgo);
    
    if (!recentPlay) {
      // 记录游玩
      db.prepare(`
        INSERT INTO game_plays (game_id, user_token, ip_address, play_duration)
        VALUES (?, ?, ?, ?)
      `).run(gameId, userToken || null, ip, duration || 0);
      
      // 更新游戏总游玩次数
      db.prepare('UPDATE games SET play_count = play_count + 1 WHERE id = ?').run(gameId);
      
      // 更新统计表
      db.prepare(`
        INSERT INTO game_stats (game_id, unique_players) VALUES (?, 1)
        ON CONFLICT(game_id) DO UPDATE SET 
          unique_players = unique_players + 1,
          updated_at = CURRENT_TIMESTAMP
      `).run(gameId);
    }
    
    // 获取最新统计
    const updated = db.prepare('SELECT play_count, like_count FROM games WHERE id = ?').get(gameId);
    const stats = db.prepare('SELECT share_count FROM game_stats WHERE game_id = ?').get(gameId);
    
    res.json({
      success: true,
      playCount: updated.play_count,
      likeCount: updated.like_count,
      shareCount: stats?.share_count || 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// 记录分享行为
app.post('/api/games/:id/share', (req, res) => {
  try {
    const gameId = req.params.id;
    const userToken = req.headers['x-user-token'];
    const { platform } = req.body; // 'wechat', 'weibo', 'qq', 'link'
    
    // 检查游戏是否存在
    const game = db.prepare('SELECT id, author_token FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 记录分享日志
    db.prepare(`
      INSERT INTO share_logs (game_id, user_token, platform)
      VALUES (?, ?, ?)
    `).run(gameId, userToken || null, platform || 'link');
    
    // 更新统计
    const platformColumn = {
      'wechat': 'share_wechat',
      'weibo': 'share_weibo',
      'qq': 'share_qq',
      'link': 'share_link'
    }[platform] || 'share_link';
    
    db.prepare(`
      INSERT INTO game_stats (game_id, share_count, ${platformColumn}) 
      VALUES (?, 1, 1)
      ON CONFLICT(game_id) DO UPDATE SET 
        share_count = share_count + 1,
        ${platformColumn} = ${platformColumn} + 1,
        updated_at = CURRENT_TIMESTAMP
    `).run(gameId);
    
    // 获取更新后的统计
    const stats = db.prepare('SELECT share_count FROM game_stats WHERE game_id = ?').get(gameId);
    const gameInfo = db.prepare('SELECT play_count, like_count FROM games WHERE id = ?').get(gameId);
    
    // 生成分享链接
    const shareUrl = `${req.protocol}://${req.get('host')}/play/${gameId}`;
    
    res.json({
      success: true,
      shareCount: stats?.share_count || 1,
      playCount: gameInfo.play_count,
      likeCount: gameInfo.like_count,
      shareUrl,
      message: '分享成功！'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取热门游戏（带完整统计）
app.get('/api/games/hot', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const period = req.query.period || 'all'; // 'today', 'week', 'month', 'all'
    
    let dateFilter = '';
    if (period === 'today') {
      dateFilter = `AND DATE(g.created_at) = DATE('now')`;
    } else if (period === 'week') {
      dateFilter = `AND g.created_at >= DATE('now', '-7 days')`;
    } else if (period === 'month') {
      dateFilter = `AND g.created_at >= DATE('now', '-30 days')`;
    }
    
    const games = db.prepare(`
      SELECT 
        g.id, g.title, g.prompt, g.author_name,
        g.play_count, g.like_count,
        COALESCE(s.share_count, 0) as share_count,
        g.created_at,
        (g.play_count + g.like_count * 5 + COALESCE(s.share_count, 0) * 3) as hot_score
      FROM games g
      LEFT JOIN game_stats s ON g.id = s.game_id
      WHERE g.is_hidden = 0 AND (g.is_public = 1 OR g.is_public IS NULL) ${dateFilter}
      ORDER BY hot_score DESC, g.created_at DESC
      LIMIT ?
    `).all(limit);
    
    res.json({ success: true, games, period });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 分享成功回调（记录分享获得积分）
app.post('/api/games/:id/shared', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const gameId = req.params.id;
    
    if (!userToken) {
      return res.json({ success: true }); // 静默处理
    }
    
    // 检查用户是否是游戏作者
    const game = db.prepare('SELECT author_token FROM games WHERE id = ?').get(gameId);
    if (!game || game.author_token !== userToken) {
      return res.json({ success: true }); // 只有作者分享才能获得积分
    }
    
    // 更新分享计数
    const userExtra = db.prepare('SELECT share_count FROM user_extras WHERE user_token = ?').get(userToken);
    const shareCount = (userExtra?.share_count || 0) + 1;
    
    db.prepare('INSERT OR REPLACE INTO user_extras (user_token, share_count) VALUES (?, ?)')
      .run(userToken, shareCount);
    
    // 每分享3次获得1次积分（防止滥用）
    if (shareCount % 3 === 0) {
      const reward = CREDITS_CONFIG.shareGame;
      db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
        .run(reward, reward, userToken);
      db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
        .run(userToken, reward, 'share', '分享游戏奖励');
      
      return res.json({ success: true, earned: reward, message: `分享成功，获得 ${reward} 次生成机会！` });
    }
    
    res.json({ success: true, shareCount, nextRewardAt: 3 - (shareCount % 3) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 管理员数据工具 API ====================

// 重置用户积分
app.post('/api/admin/tools/reset-credits', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { userToken } = req.body;
    const initialCredits = parseInt(getConfig('credits_initial')) || 5;
    
    if (userToken) {
      // 重置指定用户
      const result = db.prepare('UPDATE user_credits SET credits = ?, total_earned = ?, total_used = 0 WHERE user_token = ?')
        .run(initialCredits, initialCredits, userToken);
      if (result.changes === 0) {
        return res.json({ success: false, error: '用户不存在' });
      }
      res.json({ success: true, message: `已重置指定用户积分为 ${initialCredits}` });
    } else {
      // 重置所有用户
      const result = db.prepare('UPDATE user_credits SET credits = ?, total_earned = ?, total_used = 0')
        .run(initialCredits, initialCredits);
      res.json({ success: true, message: `已重置 ${result.changes} 个用户的积分为 ${initialCredits}` });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重置今日广告次数
app.post('/api/admin/tools/reset-ad-count', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { userToken } = req.body;
    
    if (userToken) {
      db.prepare("UPDATE user_credits SET ad_count_today = 0, last_ad_date = NULL WHERE user_token = ?")
        .run(userToken);
      res.json({ success: true, message: '已重置指定用户的今日广告次数' });
    } else {
      const result = db.prepare("UPDATE user_credits SET ad_count_today = 0, last_ad_date = NULL").run();
      res.json({ success: true, message: `已重置 ${result.changes} 个用户的今日广告次数` });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重置首次生成免费状态
app.post('/api/admin/tools/reset-first-gen', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { userToken } = req.body;
    
    if (userToken) {
      db.prepare("UPDATE user_credits SET first_gen_used = 0 WHERE user_token = ?").run(userToken);
      res.json({ success: true, message: '已重置指定用户的首次生成免费状态' });
    } else {
      const result = db.prepare("UPDATE user_credits SET first_gen_used = 0").run();
      res.json({ success: true, message: `已重置 ${result.changes} 个用户的首次生成免费状态` });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清理30天前的隐藏游戏
app.post('/api/admin/tools/cleanup-old-games', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const result = db.prepare(`
      DELETE FROM games 
      WHERE is_hidden = 1 AND created_at < datetime('now', '-30 days')
    `).run();
    res.json({ success: true, message: `已清理 ${result.changes} 个过期隐藏游戏` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清理无活动空用户
app.post('/api/admin/tools/cleanup-inactive-users', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    // 清理没有创建过游戏、没有点赞、没有收藏、积分未变动的用户
    const result = db.prepare(`
      DELETE FROM user_credits 
      WHERE user_token NOT IN (SELECT DISTINCT author_token FROM games WHERE author_token IS NOT NULL)
        AND user_token NOT IN (SELECT DISTINCT user_token FROM user_likes WHERE user_token IS NOT NULL)
        AND user_token NOT IN (SELECT DISTINCT user_token FROM user_favorites WHERE user_token IS NOT NULL)
        AND total_used = 0
        AND followed_wechat = 0
        AND created_at < datetime('now', '-7 days')
    `).run();
    res.json({ success: true, message: `已清理 ${result.changes} 个无活动空用户` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清理旧日志
app.post('/api/admin/tools/cleanup-logs', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    let cleaned = 0;
    // 清理各种可能存在的日志表
    try {
      const r1 = db.prepare("DELETE FROM credit_logs WHERE created_at < datetime('now', '-30 days')").run();
      cleaned += r1.changes;
    } catch (e) {}
    
    try {
      const r2 = db.prepare("DELETE FROM game_play_logs WHERE created_at < datetime('now', '-30 days')").run();
      cleaned += r2.changes;
    } catch (e) {}
    
    res.json({ success: true, message: `已清理 ${cleaned} 条旧日志记录` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 优化数据库
app.post('/api/admin/tools/vacuum', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    db.exec('VACUUM');
    res.json({ success: true, message: '数据库优化完成' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重建索引
app.post('/api/admin/tools/reindex', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    db.exec('REINDEX');
    res.json({ success: true, message: '索引重建完成' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取数据库统计
app.get('/api/admin/tools/db-stats', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const stats = {
      games: db.prepare('SELECT COUNT(*) as count FROM games').get().count,
      users: db.prepare('SELECT COUNT(*) as count FROM user_credits').get().count,
      accounts: 0,
      likes: 0,
      favorites: 0
    };
    
    try {
      stats.accounts = db.prepare('SELECT COUNT(*) as count FROM user_accounts').get().count;
    } catch (e) {}
    
    try {
      stats.likes = db.prepare('SELECT COUNT(*) as count FROM user_likes').get().count;
    } catch (e) {}
    
    try {
      stats.favorites = db.prepare('SELECT COUNT(*) as count FROM user_favorites').get().count;
    } catch (e) {}
    
    // 获取数据库文件大小
    try {
      const fs = require('fs');
      const dbPath = path.join(__dirname, 'games.db');
      const dbStats = fs.statSync(dbPath);
      const sizeMB = (dbStats.size / 1024 / 1024).toFixed(2);
      stats.dbSize = `${sizeMB} MB`;
    } catch (e) {
      stats.dbSize = '未知';
    }
    
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量添加积分
app.post('/api/admin/tools/batch-add-credits', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0 || amount > 100) {
      return res.json({ success: false, error: '积分数量无效 (1-100)' });
    }
    
    const result = db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ?')
      .run(amount, amount);
    res.json({ success: true, message: `已给 ${result.changes} 个用户各添加 ${amount} 积分` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重置所有关注状态
app.post('/api/admin/tools/reset-follow-status', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const result = db.prepare('UPDATE user_credits SET followed_wechat = 0').run();
    res.json({ success: true, message: `已重置 ${result.changes} 个用户的公众号关注状态` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 静态游戏文件管理 API ====================

// 管理API：获取静态文件统计
app.get('/api/admin/static-files-stats', (req, res) => {
  try {
    let totalFiles = 0;
    
    if (fs.existsSync(GAMES_STATIC_DIR)) {
      const subdirs = fs.readdirSync(GAMES_STATIC_DIR);
      for (const subdir of subdirs) {
        const subdirPath = path.join(GAMES_STATIC_DIR, subdir);
        if (fs.statSync(subdirPath).isDirectory()) {
          const files = fs.readdirSync(subdirPath).filter(f => f.endsWith('.html'));
          totalFiles += files.length;
        }
      }
    }
    
    const totalGames = db.prepare(`
      SELECT COUNT(*) as count FROM games 
      WHERE COALESCE(status, 'published') = 'published'
    `).get().count;
    
    res.json({ 
      success: true, 
      staticFiles: totalFiles,
      totalGames: totalGames,
      coverage: totalGames > 0 ? ((totalFiles / totalGames) * 100).toFixed(1) + '%' : '0%'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理API：手动触发生成所有静态文件
// 参数 force=true 可强制重新生成所有文件
app.post('/api/admin/generate-static-files', (req, res) => {
  try {
    const forceRegenerate = req.body.force === true || req.query.force === 'true';
    // 同步执行并返回结果
    const result = generateAllStaticFiles(forceRegenerate);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: result.message,
        generated: result.generated,
        skipped: result.skipped,
        total: result.total
      });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 所有其他路由返回首页（必须放在所有API路由之后）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== 启动时生成静态游戏文件 ====================

// 生成所有已发布游戏的静态文件
// forceRegenerate: 如果为true，强制重新生成所有文件（包括已存在的）
// 返回生成结果统计
function generateAllStaticFiles(forceRegenerate = false) {
  try {
    console.log(`[INFO] 开始${forceRegenerate ? '强制重新' : '检查并'}生成游戏静态文件...`);
    
    // 确保基础目录存在
    if (!fs.existsSync(GAMES_STATIC_DIR)) {
      fs.mkdirSync(GAMES_STATIC_DIR, { recursive: true });
    }
    
    // 获取所有已发布的游戏
    const games = db.prepare(`
      SELECT id, title, prompt, code, author_name, author_token 
      FROM games 
      WHERE COALESCE(status, 'published') = 'published'
      ORDER BY created_at DESC
    `).all();
    
    console.log(`[INFO] 找到 ${games.length} 个已发布游戏`);
    
    let generated = 0;
    let skipped = 0;
    
    for (const game of games) {
      const filePath = getGameFilePath(game.id);
      
      // 如果强制重新生成，或者文件不存在，则生成
      if (forceRegenerate || !fs.existsSync(filePath)) {
        saveGameStaticFile(game.id, game.code, {
          title: game.title,
          authorName: game.author_name,
          prompt: game.prompt,
          authorToken: game.author_token
        });
        generated++;
      } else {
        skipped++;
      }
    }
    
    const resultMsg = `静态文件生成完成: ${forceRegenerate ? '重新生成' : '新生成'} ${generated} 个, 跳过 ${skipped} 个`;
    console.log(`[INFO] ${resultMsg}`);
    
    return { success: true, generated, skipped, total: games.length, message: resultMsg };
  } catch (error) {
    console.error('[ERROR] 生成静态文件失败:', error.message);
    return { success: false, error: error.message };
  }
}

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  
  // 启动后延迟生成静态文件（避免阻塞启动）
  setTimeout(() => {
    generateAllStaticFiles();
  }, 3000);
});
