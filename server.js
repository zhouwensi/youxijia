require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ==================== 安全模块引入 ====================
const security = require('./security');

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
  const { title, authorName, gameId, prompt, created_at } = gameInfo;
  
  const safeTitle = escapeHtmlSafe(title || '未命名游戏');
  const safeAuthor = escapeHtmlSafe(authorName || '匿名');
  const safePrompt = escapeHtmlSafe(prompt || title || '');
  
  // 格式化发布时间
  const publishTime = created_at ? new Date(created_at).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';
  
  // 从游戏代码中提取<head>和<body>内容
  let headContent = '';
  let bodyContent = '';
  let bodyAttrs = '';
  
  // 提取<head>内容 - 使用贪婪匹配找到最后一个</head>
  const headMatch = gameCode.match(/<head[^>]*>([\s\S]*)<\/head>/i);
  if (headMatch) {
    headContent = headMatch[1];
    // 移除原有的title、meta和其他不需要重复的标签
    headContent = headContent.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
    headContent = headContent.replace(/<meta[^>]*charset[^>]*>/gi, '');
    headContent = headContent.replace(/<meta[^>]*viewport[^>]*>/gi, '');
    headContent = headContent.replace(/<!DOCTYPE[^>]*>/gi, '');
    headContent = headContent.replace(/<html[^>]*>/gi, '');
    headContent = headContent.replace(/<\/html>/gi, '');
    headContent = headContent.replace(/<head[^>]*>/gi, '');
    headContent = headContent.replace(/<\/head>/gi, '');
  }
  
  // 提取<body>内容和属性 - 使用贪婪匹配找到最后一个</body>
  const bodyMatch = gameCode.match(/<body([^>]*)>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    bodyAttrs = bodyMatch[1] || '';
    bodyContent = bodyMatch[2];
    // 清理可能嵌套的HTML结构
    bodyContent = bodyContent.replace(/<!DOCTYPE[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<html[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<\/html>/gi, '');
    bodyContent = bodyContent.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    bodyContent = bodyContent.replace(/<body[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<\/body>/gi, '');
  } else {
    // 如果没有body标签，尝试提取有效内容
    bodyContent = gameCode;
    // 清理HTML结构标签
    bodyContent = bodyContent.replace(/<!DOCTYPE[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<html[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<\/html>/gi, '');
    bodyContent = bodyContent.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    bodyContent = bodyContent.replace(/<body[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<\/body>/gi, '');
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
  height: 32px !important;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(139, 92, 246, 0.95) 100%) !important;
  padding: 0 2rem 0 0.75rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0 !important;
  z-index: 999999 !important;
  backdrop-filter: blur(4px) !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}
.yxj-promo-bar.yxj-hidden {
  display: none !important;
}
.yxj-promo-text {
  color: #fff !important;
  font-size: 0.75rem !important;
  white-space: nowrap !important;
  text-overflow: ellipsis !important;
  overflow: hidden !important;
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
  left: 12px !important;
  bottom: 44px !important;
  display: flex !important;
  align-items: flex-start !important;
  flex-direction: column !important;
  gap: 4px !important;
  z-index: 999998 !important;
  padding: 0 !important;
  pointer-events: auto !important;
}
.tiktok-author-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}
.tiktok-author-avatar {
  width: 32px !important;
  height: 32px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1rem !important;
  border: 1.5px solid rgba(255, 255, 255, 0.5) !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4) !important;
  cursor: pointer !important;
  transition: transform 0.2s, box-shadow 0.2s !important;
  text-decoration: none !important;
}
.tiktok-author-avatar:hover {
  transform: scale(1.05) !important;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5) !important;
}
.tiktok-author-details {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 8px !important;
}
.tiktok-author-name {
  color: white !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8) !important;
  cursor: pointer !important;
  transition: opacity 0.2s !important;
}
.tiktok-author-name:hover {
  opacity: 0.8 !important;
}
.tiktok-publish-time {
  color: rgba(255, 255, 255, 0.6) !important;
  font-size: 0.6875rem !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8) !important;
  margin-top: 1px !important;
}
.tiktok-follow-btn {
  background: #fe2c55 !important;
  color: white !important;
  border: none !important;
  padding: 4px 10px !important;
  border-radius: 3px !important;
  font-size: 0.6875rem !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  gap: 3px !important;
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
  right: 8px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  z-index: 999998 !important;
  pointer-events: auto !important;
}
.tiktok-sidebar.comments-open {
  display: none !important;
}
.tiktok-author-info.comments-open {
  display: none !important;
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
  width: 40px !important;
  height: 40px !important;
  border-radius: 50% !important;
  background: rgba(0, 0, 0, 0.6) !important;
  backdrop-filter: blur(8px) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 18px !important;
  transition: all 0.2s ease !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
  color: #fff !important;
}
.tiktok-action:hover .tiktok-icon {
  transform: scale(1.1) !important;
  background: rgba(0, 0, 0, 0.8) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
}
.tiktok-count {
  font-size: 11px !important;
  font-weight: 500 !important;
  color: #fff !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8) !important;
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
.tiktok-action.tiktok-info-only {
  cursor: default !important;
  opacity: 0.7 !important;
  pointer-events: none !important;
}
/* 为推广栏预留底部空间 */
body {
  padding-bottom: 36px !important;
}
/* ====== 留言板样式 ====== */
.comments-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: rgba(0, 0, 0, 0.5) !important;
  z-index: 999996 !important;
  opacity: 0 !important;
  visibility: hidden !important;
  transition: opacity 0.3s ease, visibility 0.3s ease !important;
}
.comments-overlay.visible {
  opacity: 1 !important;
  visibility: visible !important;
}
.game-comments-section {
  position: fixed !important;
  bottom: 60px !important;
  left: 0 !important;
  right: 0 !important;
  background: #fff !important;
  z-index: 999997 !important;
  max-height: 0 !important;
  overflow: hidden !important;
  transition: max-height 0.3s ease !important;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.15) !important;
  border-radius: 16px 16px 0 0 !important;
}
.game-comments-section.expanded {
  max-height: 60vh !important;
}
.comments-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 12px 16px !important;
  border-bottom: 1px solid #eee !important;
  background: #f8f9fa !important;
}
.comments-title {
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #333 !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}
.comments-close-btn {
  background: none !important;
  border: none !important;
  font-size: 20px !important;
  cursor: pointer !important;
  color: #999 !important;
  padding: 4px !important;
}
.comments-body {
  max-height: calc(60vh - 120px) !important;
  overflow-y: auto !important;
  padding: 12px 16px !important;
}
.comment-item {
  padding: 12px 0 !important;
  border-bottom: 1px solid #f0f0f0 !important;
}
.comment-item:last-child {
  border-bottom: none !important;
}
.comment-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  margin-bottom: 6px !important;
}
.comment-author-info {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}
.comment-avatar {
  width: 28px !important;
  height: 28px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  color: #fff !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.comment-author-name {
  font-weight: 600 !important;
  color: #333 !important;
  font-size: 14px !important;
}
.comment-time {
  color: #999 !important;
  font-size: 12px !important;
}
.comment-content {
  color: #333 !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  word-break: break-word !important;
}
.comment-delete-btn {
  background: none !important;
  border: none !important;
  color: #999 !important;
  font-size: 12px !important;
  cursor: pointer !important;
  padding: 2px 8px !important;
}
.comment-delete-btn:hover {
  color: #ef4444 !important;
}
.comment-avatar.comment-clickable,
.comment-author-name.comment-clickable {
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}
.comment-avatar.comment-clickable:hover {
  transform: scale(1.1) !important;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3) !important;
}
.comment-author-name.comment-clickable:hover {
  color: #6366f1 !important;
  text-decoration: underline !important;
}
.comments-input-area {
  display: flex !important;
  gap: 8px !important;
  padding: 12px 16px !important;
  border-top: 1px solid #eee !important;
  background: #fff !important;
}
.comments-input-area textarea {
  flex: 1 !important;
  border: 1px solid #ddd !important;
  border-radius: 8px !important;
  padding: 10px 12px !important;
  font-size: 14px !important;
  resize: none !important;
  height: 40px !important;
  min-height: 40px !important;
}
.comments-input-area button {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
  color: #fff !important;
  border: none !important;
  padding: 10px 20px !important;
  border-radius: 8px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  white-space: nowrap !important;
}
.comments-input-area button:disabled {
  opacity: 0.6 !important;
  cursor: not-allowed !important;
}
.comments-login-hint {
  text-align: center !important;
  padding: 12px 16px !important;
  color: #999 !important;
  font-size: 14px !important;
  border-top: 1px solid #eee !important;
}
#comments-load-more-btn {
  display: block !important;
  width: 100% !important;
  padding: 10px !important;
  background: #f5f5f5 !important;
  border: none !important;
  color: #666 !important;
  font-size: 14px !important;
  cursor: pointer !important;
  margin-top: 8px !important;
  border-radius: 8px !important;
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
      <div style="display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="tiktok-author-name" id="author-name" onclick="openAuthorProfile()">${safeAuthor}</span>
          <button class="tiktok-follow-btn" id="tiktok-follow-btn" data-token="${authorToken}" onclick="toggleFollow()">
            <span class="follow-icon">+</span> 关注
          </button>
        </div>
        ${publishTime ? `<span class="tiktok-publish-time">发布于 ${publishTime}</span>` : ''}
      </div>
    </div>
  </div>
</div>

<!-- TikTok风格右侧互动栏 -->
<div class="tiktok-sidebar">
  <div class="tiktok-action" id="stat-like-btn" onclick="likeGame()">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    </div>
    <span class="tiktok-count" id="stat-likes">0</span>
  </div>
  <div class="tiktok-action" id="stat-fav-btn" onclick="toggleFavorite()">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
    </div>
    <span class="tiktok-count" id="stat-favs">0</span>
  </div>
  <div class="tiktok-action" onclick="openSharePanel()">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
    </div>
  </div>
  <div class="tiktok-action" id="stat-comment-btn" onclick="toggleCommentsPanel()">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>
    <span class="tiktok-count" id="stat-comments">0</span>
  </div>
  <div class="tiktok-action tiktok-info-only" title="游玩次数">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
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

<!-- 评论蒙版 -->
<div class="comments-overlay" id="comments-overlay" onclick="toggleCommentsPanel()"></div>

<!-- 评论区域 -->
<div class="game-comments-section" id="game-comments-section">
  <div class="comments-header">
    <span class="comments-title">💬 评论</span>
    <button class="comments-close-btn" onclick="toggleCommentsPanel()">×</button>
  </div>
  <div class="comments-body" id="game-comments-list">
    <div style="text-align:center;padding:30px;color:#999;">加载中...</div>
  </div>
  <button id="comments-load-more-btn" style="display:none;" onclick="loadMoreGameComments()">加载更多</button>
  <div class="comments-login-hint" id="comment-login-hint" style="display:none;">请登录后发表留言</div>
  <div class="comments-input-area" id="comment-input-area" style="display:none;">
    <textarea id="game-comment-input" placeholder="说点什么..." maxlength="500"></textarea>
    <button id="game-comment-submit" onclick="submitGameComment()">发布</button>
  </div>
</div>

<!-- 游戏家推广栏 -->
<div class="yxj-promo-bar" id="yxj-promo" onclick="showPromoModal()" style="cursor:pointer;">
  <button class="yxj-promo-close" onclick="event.stopPropagation();document.getElementById('yxj-promo').classList.add('yxj-hidden');document.body.style.paddingBottom='0';">×</button>
  <span class="yxj-promo-text">👉 点击关注微信公众号「游戏开发技术教程」，一句话免费做游戏！</span>
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
        document.getElementById('stat-favs').innerText = data.game.favorite_count || 0;
        // 更新作者名（从数据库获取最新昵称）
        if (data.game.author_name) {
          const authorNameEl = document.getElementById('author-name');
          if (authorNameEl) authorNameEl.innerText = data.game.author_name;
        }
      }
    })
    .catch(err => console.error('加载统计失败', err));
  
  // 获取作者最新昵称
  if (authorToken) {
    fetch('/api/users/' + authorToken + '/profile', { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user && data.user.nickname) {
          const authorNameEl = document.getElementById('author-name');
          if (authorNameEl) authorNameEl.innerText = data.user.nickname;
        }
      })
      .catch(() => {});
  }
  
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
  const countEl = document.getElementById('stat-favs');
  const isFav = btn.classList.contains('favorited');
  let count = parseInt(countEl.innerText) || 0;
  
  // 乐观UI切换
  btn.classList.toggle('favorited', !isFav);
  if (isFav) {
    countEl.innerText = Math.max(0, count - 1);
  } else {
    countEl.innerText = count + 1;
  }
  
  fetch(API_BASE + '/' + gameId + '/favorite', { 
    method: 'POST', 
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (data.favorited !== undefined) {
          btn.classList.toggle('favorited', data.favorited);
        }
        // 更新实际数量
        if (data.favorite_count !== undefined) {
          countEl.innerText = data.favorite_count;
        }
      } else {
        // 失败回滚
        btn.classList.toggle('favorited', isFav);
        countEl.innerText = count;
      }
    })
    .catch(() => {
      // 失败回滚
      btn.classList.toggle('favorited', isFav);
      countEl.innerText = count;
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
    const accountId = (profileData.profile && profileData.profile.accountId) || '';
    const followers = statsData.followerCount || statsData.followers || 0;
    const following = statsData.followingCount || statsData.following || 0;
    const games = gamesData.games || [];
    const userToken = getUserToken();
    const isSelf = authorToken === userToken;
    
    let gamesHtml = '';
    if (games.length > 0) {
      gamesHtml = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:15px;">' +
        games.slice(0, 4).map(g => '<a href="/g/' + g.id.substring(0,2) + '/' + g.id + '.html" style="background:#f5f5f5;border-radius:8px;padding:10px;text-decoration:none;color:#333;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🎮 ' + (g.title || '未命名').substring(0, 10) + '</a>').join('') +
        '</div>';
    }
    
    // 账号ID显示（小字、浅色、带@前缀）
    const accountIdHtml = accountId ? '<div style="font-size:12px;color:#999;margin-top:2px;">@' + accountId + '</div>' : '';
    
    // 如果是自己，不显示关注按钮
    const followBtnHtml = isSelf ? '' : '<button id="profile-follow-btn" onclick="toggleFollowFromProfile()" style="width:100%;padding:10px;background:#fe2c55;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">+ 关注</button>';
    
    content.innerHTML = 
      '<div style="margin-bottom:15px;">' +
        '<div style="width:60px;height:60px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:28px;">👤</div>' +
        '<div style="font-size:18px;font-weight:600;color:#333;">' + nickname + '</div>' +
        accountIdHtml +
      '</div>' +
      '<div style="display:flex;justify-content:center;gap:30px;margin-bottom:15px;">' +
        '<div style="text-align:center;"><strong style="font-size:20px;color:#333;display:block;">' + following + '</strong><span style="color:#999;font-size:12px;">关注</span></div>' +
        '<div style="text-align:center;"><strong style="font-size:20px;color:#333;display:block;">' + followers + '</strong><span style="color:#999;font-size:12px;">粉丝</span></div>' +
        '<div style="text-align:center;"><strong style="font-size:20px;color:#333;display:block;">' + games.length + '</strong><span style="color:#999;font-size:12px;">作品</span></div>' +
      '</div>' +
      followBtnHtml +
      gamesHtml;
    
    // 检查关注状态（只有不是自己时才检查）
    if (!isSelf) {
      checkFollowStatusForProfile();
    }
  }).catch(() => {
    content.innerHTML = '<div style="padding:20px;color:#999;">加载失败</div>';
  });
}

// 关闭作者主页
function closeAuthorProfile() {
  document.getElementById('author-profile-modal').style.display = 'none';
}

// 打开评论者主页（用于点击评论头像）
function openCommentAuthorProfile(commentAuthorToken) {
  if (!commentAuthorToken) return;
  
  const currentUserToken = getUserToken();
  // 如果是自己的评论，不跳转
  if (commentAuthorToken === currentUserToken) {
    alert('这是您自己的评论');
    return;
  }
  
  // 使用已有的作者主页弹窗展示评论者信息
  const modal = document.getElementById('author-profile-modal');
  const content = document.getElementById('author-profile-content');
  content.innerHTML = '<div style="padding:20px;color:#999;">加载中...</div>';
  modal.style.display = 'flex';
  
  // 加载评论者信息
  Promise.all([
    fetch('/api/users/' + commentAuthorToken + '/profile', { headers: getAuthHeaders() }).then(r => r.json()).catch(() => ({})),
    fetch('/api/users/' + commentAuthorToken + '/follow-stats', { headers: getAuthHeaders() }).then(r => r.json()).catch(() => ({})),
    fetch('/api/users/' + commentAuthorToken + '/games?limit=4', { headers: getAuthHeaders() }).then(r => r.json()).catch(() => ({ games: [] }))
  ]).then(([profileData, statsData, gamesData]) => {
    const nickname = (profileData.profile && profileData.profile.nickname) || '游戏玩家';
    const accountId = (profileData.profile && profileData.profile.accountId) || '';
    const followers = statsData.followerCount || statsData.followers || 0;
    const following = statsData.followingCount || statsData.following || 0;
    const games = gamesData.games || [];
    
    let gamesHtml = '';
    if (games.length > 0) {
      gamesHtml = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:15px;">' +
        games.slice(0, 4).map(g => '<a href="/g/' + g.id.substring(0,2) + '/' + g.id + '.html" style="background:#f5f5f5;border-radius:8px;padding:10px;text-decoration:none;color:#333;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🎮 ' + (g.title || '未命名').substring(0, 10) + '</a>').join('') +
        '</div>';
    }
    
    // 账号ID显示（小字、浅色、带@前缀）
    const accountIdHtml = accountId ? '<div style="font-size:12px;color:#999;margin-top:2px;">@' + accountId + '</div>' : '';
    
    content.innerHTML = 
      '<div style="margin-bottom:15px;">' +
        '<div style="width:60px;height:60px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:28px;">👤</div>' +
        '<div style="font-size:18px;font-weight:600;color:#333;">' + nickname + '</div>' +
        accountIdHtml +
      '</div>' +
      '<div style="display:flex;justify-content:center;gap:30px;margin-bottom:15px;">' +
        '<div style="text-align:center;"><strong style="font-size:20px;color:#333;display:block;">' + following + '</strong><span style="color:#999;font-size:12px;">关注</span></div>' +
        '<div style="text-align:center;"><strong style="font-size:20px;color:#333;display:block;">' + followers + '</strong><span style="color:#999;font-size:12px;">粉丝</span></div>' +
        '<div style="text-align:center;"><strong style="font-size:20px;color:#333;display:block;">' + games.length + '</strong><span style="color:#999;font-size:12px;">作品</span></div>' +
      '</div>' +
      '<button onclick="toggleFollowCommentAuthor(\\'' + commentAuthorToken + '\\')" id="comment-author-follow-btn" style="width:100%;padding:10px;background:#fe2c55;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">+ 关注</button>' +
      gamesHtml;
    
    // 检查是否已关注
    fetch('/api/users/' + commentAuthorToken + '/follow-status', { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.following) {
          const btn = document.getElementById('comment-author-follow-btn');
          if (btn) {
            btn.textContent = '已关注';
            btn.style.background = '#f5f5f5';
            btn.style.color = '#999';
          }
        }
      }).catch(() => {});
  }).catch(() => {
    content.innerHTML = '<div style="padding:20px;color:#999;">加载失败</div>';
  });
}

// 关注/取关评论者
function toggleFollowCommentAuthor(targetToken) {
  const userToken = getUserToken();
  if (!userToken) {
    alert('请先登录后再关注');
    return;
  }
  
  const btn = document.getElementById('comment-author-follow-btn');
  const isFollowing = btn && btn.textContent === '已关注';
  
  fetch('/api/users/' + targetToken + '/follow', {
    method: isFollowing ? 'DELETE' : 'POST',
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && btn) {
        if (isFollowing) {
          btn.textContent = '+ 关注';
          btn.style.background = '#fe2c55';
          btn.style.color = '#fff';
        } else {
          btn.textContent = '已关注';
          btn.style.background = '#f5f5f5';
          btn.style.color = '#999';
        }
      }
    }).catch(() => {
      alert('操作失败，请重试');
    });
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
  
  if (authorToken === userToken) {
    alert('不能关注自己哦');
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

// ==================== 留言板功能 ====================

// 切换留言板面板
function toggleCommentsPanel() {
  const panel = document.getElementById('game-comments-section');
  const sidebar = document.querySelector('.tiktok-sidebar');
  const authorInfo = document.getElementById('tiktok-author-info');
  const overlay = document.getElementById('comments-overlay');
  if (panel) {
    const isExpanding = !panel.classList.contains('expanded');
    panel.classList.toggle('expanded');
    // 评论面板展开时隐藏右侧按钮和作者信息（使用class覆盖!important）
    if (sidebar) {
      sidebar.classList.toggle('comments-open', isExpanding);
    }
    if (authorInfo) {
      authorInfo.classList.toggle('comments-open', isExpanding);
    }
    // 控制蒙版显示
    if (overlay) {
      overlay.classList.toggle('visible', isExpanding);
    }
  }
}

// 留言板状态
let commentsData = {
  comments: [],
  total: 0,
  offset: 0,
  hasMore: false,
  isLoading: false
};

// 加载留言列表
function loadGameComments(isRefresh = true) {
  if (commentsData.isLoading) return;
  commentsData.isLoading = true;
  
  const limit = 20;
  const offset = isRefresh ? 0 : commentsData.offset;
  
  fetch('/api/games/' + gameId + '/comments?limit=' + limit + '&offset=' + offset, {
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (isRefresh) {
          commentsData.comments = data.comments;
          commentsData.offset = data.comments.length;
        } else {
          commentsData.comments = commentsData.comments.concat(data.comments);
          commentsData.offset += data.comments.length;
        }
        commentsData.total = data.total;
        commentsData.hasMore = data.hasMore;
        renderComments();
        updateCommentsCount();
      }
    })
    .catch(err => console.error('加载留言失败:', err))
    .finally(() => { commentsData.isLoading = false; });
}

// 渲染留言列表
function renderComments() {
  const listEl = document.getElementById('game-comments-list');
  const loadMoreBtn = document.getElementById('comments-load-more-btn');
  
  if (!listEl) return;
  
  if (commentsData.comments.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:#999;">💬 还没有留言，快来抢沙发！</div>';
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }
  
  let html = '';
  commentsData.comments.forEach(function(comment) {
    const timeStr = formatCommentTime(comment.created_at);
    const avatarInitial = comment.author_name ? comment.author_name.charAt(0).toUpperCase() : '?';
    const currentUserToken = getUserToken();
    const canDelete = comment.is_mine || (currentUserToken && comment.user_token === currentUserToken);
    const commentUserToken = comment.user_token || '';
    const clickableClass = commentUserToken ? 'comment-clickable' : '';
    const onClickAttr = commentUserToken ? 'onclick="openCommentAuthorProfile(\\'' + commentUserToken + '\\')"' : '';
    
    html += '<div class="comment-item" data-id="' + comment.id + '">' +
      '<div class="comment-header">' +
        '<div class="comment-author-info">' +
          '<div class="comment-avatar ' + clickableClass + '" ' + onClickAttr + '>' + avatarInitial + '</div>' +
          '<span class="comment-author-name ' + clickableClass + '" ' + onClickAttr + '>' + escapeHtml(comment.author_name) + '</span>' +
          '<span class="comment-time">' + timeStr + '</span>' +
        '</div>' +
        (canDelete ? '<button class="comment-delete-btn" onclick="deleteGameComment(' + comment.id + ')">删除</button>' : '') +
      '</div>' +
      '<div class="comment-content">' + escapeHtml(comment.content) + '</div>' +
    '</div>';
  });
  
  listEl.innerHTML = html;
  
  if (loadMoreBtn) {
    loadMoreBtn.style.display = commentsData.hasMore ? 'block' : 'none';
  }
}

// 更新评论数量
function updateCommentsCount() {
  const countEl = document.getElementById('stat-comments');
  if (countEl) countEl.textContent = commentsData.total;
}

// 格式化留言时间
function formatCommentTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return minutes + '分钟前';
  if (hours < 24) return hours + '小时前';
  if (days < 7) return days + '天前';
  return (date.getMonth() + 1) + '/' + date.getDate();
}

// HTML转义
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 发布留言
function submitGameComment() {
  const inputEl = document.getElementById('game-comment-input');
  const submitBtn = document.getElementById('game-comment-submit');
  
  if (!inputEl || !submitBtn) return;
  
  const content = inputEl.value.trim();
  if (!content) {
    alert('请输入留言内容');
    return;
  }
  if (content.length > 500) {
    alert('留言内容不能超过500字');
    return;
  }
  
  const userToken = getUserToken();
  if (!userToken) {
    alert('请先登录后再留言');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = '发布中...';
  
  fetch('/api/games/' + gameId + '/comments', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content: content })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        inputEl.value = '';
        commentsData.comments.unshift(data.comment);
        commentsData.total++;
        renderComments();
        updateCommentsCount();
      } else {
        alert(data.error || '发布失败');
      }
    })
    .catch(err => {
      console.error('发布留言失败:', err);
      alert('网络错误，请重试');
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = '发布';
    });
}

// 删除留言
function deleteGameComment(commentId) {
  if (!confirm('确定要删除这条留言吗？')) return;
  
  fetch('/api/games/' + gameId + '/comments/' + commentId, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        commentsData.comments = commentsData.comments.filter(function(c) { return c.id !== commentId; });
        commentsData.total--;
        renderComments();
        updateCommentsCount();
      } else {
        alert(data.error || '删除失败');
      }
    })
    .catch(err => {
      console.error('删除留言失败:', err);
      alert('网络错误，请重试');
    });
}

// 加载更多留言
function loadMoreGameComments() {
  if (!commentsData.hasMore || commentsData.isLoading) return;
  loadGameComments(false);
}

// 更新留言输入区域显示
function updateCommentInputUI() {
  const loginHint = document.getElementById('comment-login-hint');
  const inputArea = document.getElementById('comment-input-area');
  const userToken = getUserToken();
  
  if (loginHint && inputArea) {
    if (userToken) {
      loginHint.style.display = 'none';
      inputArea.style.display = 'flex';
    } else {
      loginHint.style.display = 'block';
      inputArea.style.display = 'none';
    }
  }
}

// 初始化
window.addEventListener('load', function() {
  loadStats();
  updateCommentInputUI();
  loadGameComments(true);
});
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

// 信任代理，以获取真实客户端IP（用于Nginx等反向代理）
// 设置为 1 表示信任第一个代理，避免 express-rate-limit 警告
app.set('trust proxy', 1);

const PORT = process.env.PORT || 80;

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

// 支持的LLM模型配置 (含积分消耗和速度评级)
// 注意：默认积分为 1，可在后台修改
const LLM_MODELS = {
  // DeepSeek 系列 - 性价比之王 (高质量但可能较慢)
  'deepseek-v3': { name: 'DeepSeek V3', provider: 'deepseek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com', tier: 'standard', creditCost: 1, speed: 'slow', quality: 'high', recommended: true },
  'deepseek-r1': { name: 'DeepSeek R1', provider: 'deepseek', model: 'deepseek-reasoner', baseUrl: 'https://api.deepseek.com', tier: 'standard', creditCost: 1, speed: 'slow', quality: 'very-high' },
  
  // OpenAI 系列 - Turbo加速选项
  'gpt-4o': { name: 'GPT-4o', provider: 'openai', model: 'gpt-4o', baseUrl: 'https://api.openai.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'very-high' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com', tier: 'turbo', creditCost: 1, speed: 'fast', quality: 'medium', turboRecommended: true },
  'gpt-5': { name: 'GPT 5', provider: 'openai', model: 'gpt-5', baseUrl: 'https://api.openai.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'excellent' },
  'gpt-5.1': { name: 'GPT 5.1', provider: 'openai', model: 'gpt-5.1', baseUrl: 'https://api.openai.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'excellent' },
  'gpt-5.1-codex': { name: 'GPT 5.1 Codex', provider: 'openai', model: 'gpt-5.1-codex', baseUrl: 'https://api.openai.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'excellent' },
  
  // Claude 系列
  'claude-4.5-opus': { name: 'Claude 4.5 Opus', provider: 'anthropic', model: 'claude-sonnet-4-5-20250514', baseUrl: 'https://api.anthropic.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'excellent', new: true },
  'claude-4.5-sonnet': { name: 'Claude 4.5 Sonnet', provider: 'anthropic', model: 'claude-4.5-sonnet', baseUrl: 'https://api.anthropic.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'very-high' },
  'claude-4.5-haiku': { name: 'Claude 4.5 Haiku', provider: 'anthropic', model: 'claude-4.5-haiku', baseUrl: 'https://api.anthropic.com', tier: 'turbo', creditCost: 1, speed: 'fast', quality: 'medium' },
  'claude-4-sonnet': { name: 'Claude 4 Sonnet', provider: 'anthropic', model: 'claude-4-sonnet', baseUrl: 'https://api.anthropic.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'high' },
  'claude-3.7-sonnet': { name: 'Claude 3.7 Sonnet', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', baseUrl: 'https://api.anthropic.com', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'high' },
  
  // Google Gemini 系列
  // Google Gemini 系列 - 通过 OpenRouter 代理访问（国内可用）
  'gemini-3-pro': { name: 'Gemini 3 Pro', provider: 'openrouter', model: 'google/gemini-3-pro-preview', baseUrl: 'https://openrouter.ai/api', tier: 'pro', creditCost: 1, speed: 'fast', quality: 'very-high', new: true },
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', provider: 'openrouter', model: 'google/gemini-2.5-pro', baseUrl: 'https://openrouter.ai/api', tier: 'pro', creditCost: 1, speed: 'fast', quality: 'very-high' },
  'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', provider: 'openrouter', model: 'google/gemini-2.5-flash', baseUrl: 'https://openrouter.ai/api', tier: 'standard', creditCost: 1, speed: 'very-fast', quality: 'high' },
  'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', provider: 'openrouter', model: 'google/gemini-2.0-flash-001', baseUrl: 'https://openrouter.ai/api', tier: 'standard', creditCost: 1, speed: 'very-fast', quality: 'high' },
  
  // 国产模型
  'glm-4.7': { name: 'GLM 4.7', provider: 'zhipu', model: 'glm-4.7', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'high', new: true },
  'glm-4.6': { name: 'GLM 4.6', provider: 'zhipu', model: 'glm-4.6', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'medium' },
  'glm-4.5': { name: 'GLM 4.5', provider: 'zhipu', model: 'glm-4.5', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'medium' },
  'kimi-k2': { name: 'Kimi K2', provider: 'moonshot', model: 'kimi-k2', baseUrl: 'https://api.moonshot.cn', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'high' },
  'qwen3-coder-plus': { name: 'Qwen3 Coder Plus', provider: 'alibaba', model: 'qwen-coder-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'high' },
};

// 获取模型的积分消耗（优先从配置读取，否则使用默认值）
function getModelCreditCost(modelId) {
  // 尝试从数据库配置读取
  const configKey = `llm_credits_${modelId}`;
  const configValue = getConfig(configKey, null);
  if (configValue !== null) {
    return parseInt(configValue, 10) || 0;
  }
  // 使用默认值
  const model = LLM_MODELS[modelId];
  return model ? model.creditCost : 0;
}

// 获取模型的效果等级（优先从配置读取）
function getModelQuality(modelId) {
  const configKey = `llm_quality_${modelId}`;
  const configValue = getConfig(configKey, null);
  if (configValue !== null) {
    return configValue;
  }
  const model = LLM_MODELS[modelId];
  return model ? model.quality : 'medium';
}

// 检查模型是否启用（默认只启用 deepseek 和 gemini 相关的模型）
function isModelEnabled(modelId) {
  const configKey = `llm_enabled_${modelId}`;
  const configValue = getConfig(configKey, null);
  
  // 如果有配置值，使用配置值
  if (configValue !== null) {
    return configValue === 'true' || configValue === '1';
  }
  
  // 默认启用的模型：deepseek 和 gemini 相关
  const defaultEnabled = ['deepseek-v3', 'deepseek-r1', 'gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  return defaultEnabled.includes(modelId);
}

// 获取可用的模型列表（用于前端显示，包括免费和付费模型）
function getTurboModels() {
  return Object.entries(LLM_MODELS)
    .filter(([key, config]) => isModelEnabled(key))  // 只返回启用的模型
    .map(([key, config]) => {
      const creditCost = getModelCreditCost(key);
      const quality = getModelQuality(key);
      const apiKeyKey = `llm_apikey_${key}`;
      const hasDefaultKey = getConfig(apiKeyKey, null) !== null && getConfig(apiKeyKey, '').length > 0;
      
      return {
        id: key,
        name: config.name,
        creditCost: creditCost,
        speed: config.speed,
        quality: quality,
        turboRecommended: config.turboRecommended || false,
        hasDefaultKey: hasDefaultKey,  // 是否配置了默认API Key
        needsUserKey: creditCost === 0 && !hasDefaultKey  // 需要用户自己配置Key
      };
    })
    .sort((a, b) => {
      // 先按积分排序，积分相同时按quality排序
      if (a.creditCost !== b.creditCost) {
        return a.creditCost - b.creditCost;
      }
      const qualityOrder = { 'medium': 1, 'high': 2, 'very-high': 3, 'excellent': 4 };
      return (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0);
    });
}

// ============ 请求追踪系统 ============
// 用于追踪活跃的生成请求，支持取消功能
const activeGenerations = new Map(); // requestId -> { userToken, startTime, cancelled }

// 清理过期的请求记录（超过10分钟的）
function cleanupOldGenerations() {
  const now = Date.now();
  const expireTime = 10 * 60 * 1000; // 10分钟
  for (const [requestId, info] of activeGenerations.entries()) {
    if (now - info.startTime > expireTime) {
      activeGenerations.delete(requestId);
    }
  }
}

// 每5分钟清理一次过期请求
setInterval(cleanupOldGenerations, 5 * 60 * 1000);

// 检查请求是否已被取消
function isGenerationCancelled(requestId) {
  const info = activeGenerations.get(requestId);
  return info ? info.cancelled : false;
}

// 标记请求为已取消，并尝试中断 LLM 请求
function cancelGeneration(requestId) {
  const info = activeGenerations.get(requestId);
  if (info) {
    info.cancelled = true;
    // 如果有 AbortController，触发中断
    if (info.abortController) {
      try {
        info.abortController.abort();
        console.log(`[CANCEL] 已中断 LLM 请求: ${requestId}`);
      } catch (e) {
        console.log(`[CANCEL] 中断 LLM 请求失败: ${e.message}`);
      }
    }
    console.log(`[CANCEL] 请求已标记为取消: ${requestId}`);
    return true;
  }
  return false;
}

// ==================== 安全中间件配置 ====================

// 1. Helmet 安全头（必须在最前面）
app.use(security.getHelmetConfig());

// 2. CORS 配置（使用安全模块的配置，从数据库读取白名单）
security.setCorsWhitelistGetter(getCorsWhitelist);
app.use(cors(security.getCorsConfig()));

// 3. 请求体解析（带大小限制）
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 4. 通用速率限制
app.use(security.createGeneralLimiter());

// 5. 安全中间件：过滤恶意URL请求（阻止路径遍历攻击）
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
      /%00/, // 空字节注入
      /<script/i, // URL中的脚本标签
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(req.path) || pattern.test(req.originalUrl)) {
        security.logSecurityEvent({
          type: 'PATH_TRAVERSAL_BLOCKED',
          ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
          details: req.originalUrl.substring(0, 200),
          path: req.path
        });
        return res.status(400).send('Bad Request');
      }
    }
    
    // 尝试解码URL，如果失败则拒绝请求
    try {
      decodeURIComponent(req.path);
    } catch (e) {
      security.logSecurityEvent({
        type: 'URL_DECODE_FAILED',
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        details: req.originalUrl.substring(0, 200),
        path: req.path
      });
      return res.status(400).send('Bad Request');
    }
    
    next();
  } catch (e) {
    console.log('[SECURITY] 请求处理异常:', e.message);
    return res.status(400).send('Bad Request');
  }
});

// 6. XSS清理中间件
app.use(security.xssCleanMiddleware);

// 7. 攻击模式检测（仅对API请求）
app.use('/api', security.attackPatternDetection);

// 8. 静态文件服务
app.use(express.static('public'));

// ==================== 特定路由的安全限制 ====================

// 9. 敏感操作速率限制（账号相关）
const strictLimiter = security.createStrictLimiter();
app.use('/api/account/init', strictLimiter);
app.use('/api/account/login', strictLimiter);
app.use('/api/account/password', strictLimiter);
app.use('/api/account/recover', strictLimiter);
app.use('/api/account/secure-recover', strictLimiter);

// 10. 游戏生成速率限制（资源密集型操作）
const generateLimiter = security.createGenerateLimiter();
app.use('/api/generate', generateLimiter);
app.use('/api/trial/generate', generateLimiter);

// 11. 管理员API保护
const adminLimiter = security.createAdminLimiter();
app.use('/api/admin', adminLimiter);
app.use('/api/admin', security.adminLoginProtection);

// 12. 管理员操作审计日志
app.use('/api/admin', security.createAuditMiddleware('ADMIN_ACCESS'));

// 13. 管理员认证中间件（统一处理认证和失败记录）
const adminAuthMiddleware = (req, res, next) => {
  // 支持从header或query参数获取adminKey（用于下载等场景）
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.ip;
  
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    // 记录登录失败
    security.recordAdminLoginFailure(ip);
    security.logSecurityEvent({
      type: 'ADMIN_AUTH_FAILED',
      ip: ip,
      details: `Path: ${req.path}`,
      path: req.path
    });
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  // 认证成功，重置失败计数
  security.resetAdminLoginAttempts(ip);
  next();
};

// 应用管理员认证中间件到所有 /api/admin 路由
app.use('/api/admin', adminAuthMiddleware);

// ==================== 数据库初始化 ====================

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

// 添加 orientation 字段（如果不存在）- 屏幕方向：portrait(竖屏)/landscape(横屏)
try {
  db.exec(`ALTER TABLE games ADD COLUMN orientation TEXT DEFAULT 'portrait'`);
  console.log('[DB] 添加 orientation 字段成功');
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

// 添加 visibility 字段（如果不存在）- 可见性：public(所有人)/followers(仅粉丝)/private(仅自己)
try {
  db.exec(`ALTER TABLE games ADD COLUMN visibility TEXT DEFAULT 'public'`);
  console.log('[DB] 添加 visibility 字段成功');
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

// ==================== 数据迁移：修复默认作者名 ====================
// 将所有使用默认名称"游戏玩家"的游戏更新为使用账号ID
try {
  // 获取所有使用默认名称且有关联账号的游戏
  const gamesWithDefaultName = db.prepare(`
    SELECT g.id, g.author_token, u.account_id, u.nickname
    FROM games g
    LEFT JOIN user_accounts u ON g.author_token = u.user_token
    WHERE g.author_name = '游戏玩家' AND u.account_id IS NOT NULL
  `).all();
  
  if (gamesWithDefaultName.length > 0) {
    const updateStmt = db.prepare('UPDATE games SET author_name = ? WHERE id = ?');
    let updatedCount = 0;
    
    for (const game of gamesWithDefaultName) {
      // 如果用户设置了自定义昵称（不是默认的"游戏玩家"），使用昵称；否则使用账号ID
      const displayName = (game.nickname && game.nickname !== '游戏玩家') 
        ? game.nickname 
        : game.account_id;
      updateStmt.run(displayName, game.id);
      updatedCount++;
    }
    
    if (updatedCount > 0) {
      console.log(`[DB迁移] 已更新 ${updatedCount} 个游戏的作者名（从"游戏玩家"改为账号ID）`);
    }
  }
} catch (e) {
  console.error('[DB迁移] 更新作者名时出错:', e.message);
}

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

// 密码哈希函数（使用安全模块的bcrypt实现）
// 同步版本，用于兼容现有代码；新代码建议使用 security.hashPasswordSecure
function hashPassword(password) {
  // 保留旧版SHA256用于兼容，新密码使用bcrypt
  // 注意：此函数现在返回的是旧格式，密码验证时会自动处理两种格式
  return crypto.createHash('sha256').update(password + 'aigame_salt_2025').digest('hex');
}

// 异步密码哈希（使用bcrypt，推荐用于新代码）
async function hashPasswordAsync(password) {
  return await security.hashPasswordSecure(password);
}

// 异步密码验证（支持bcrypt和旧版SHA256格式）
async function verifyPasswordAsync(password, hash) {
  return await security.verifyPassword(password, hash);
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

// ==================== 游戏留言表 ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS game_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    user_token TEXT NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0
  )
`);

// 创建留言索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_comments_game_id ON game_comments(game_id, is_deleted);
  CREATE INDEX IF NOT EXISTS idx_comments_user_token ON game_comments(user_token);
`);

// 添加 is_hidden 字段（如果不存在）
try {
  db.exec(`ALTER TABLE game_comments ADD COLUMN is_hidden INTEGER DEFAULT 0`);
  console.log('[DB] 添加 is_hidden 字段成功');
} catch (e) {
  // 字段已存在，忽略错误
}

console.log('[DB] 留言表初始化完成');

// 初始化默认配置
const defaultConfigs = [
  { key: 'wechat_verify_code', value: '2026', description: '微信关注验证码' },
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

/**
 * 获取用于显示的昵称
 * 如果昵称是默认值'游戏玩家'或空，则返回账号ID
 * @param {Object} account - 包含 nickname 和 account_id 的账号对象
 * @returns {string} 用于显示的昵称
 */
function getDisplayNickname(account) {
  if (!account) return '匿名';
  const nickname = account.nickname;
  const accountId = account.account_id;
  if (nickname && nickname !== '游戏玩家' && nickname !== '') {
    return nickname;
  }
  return accountId || '匿名';
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
    
    // 如果昵称是默认值'游戏玩家'，则返回账号ID作为显示名称
    const displayNickname = (account.nickname && account.nickname !== '游戏玩家') 
      ? account.nickname 
      : account.account_id;
    
    res.json({
      success: true,
      recovered: isRecovered,
      userToken: newToken,
      account: {
        accountId: account.account_id,
        nickname: displayNickname,
        rawNickname: account.nickname, // 原始昵称，用于判断是否需要显示"设置昵称"提示
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
    
    // 如果昵称是默认值'游戏玩家'，则返回账号ID作为显示名称
    const displayNickname = (account.nickname && account.nickname !== '游戏玩家') 
      ? account.nickname 
      : account.account_id;
    
    res.json({
      success: true,
      account: {
        accountId: account.account_id,
        nickname: displayNickname,
        rawNickname: account.nickname, // 原始昵称
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
    
    // 如果昵称是默认值'游戏玩家'，则返回账号ID作为显示名称
    const displayNickname = (account.nickname && account.nickname !== '游戏玩家') 
      ? account.nickname 
      : account.account_id;
    
    res.json({
      success: true,
      userToken: account.user_token,
      account: {
        accountId: account.account_id,
        nickname: displayNickname,
        rawNickname: account.nickname,
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
    
    const trimmedNickname = nickname.trim();
    
    // 更新用户账号表中的昵称
    db.prepare('UPDATE user_accounts SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE user_token = ?')
      .run(trimmedNickname, userToken);
    
    // 同步更新该用户所有游戏的作者名（author_name）
    const updateResult = db.prepare('UPDATE games SET author_name = ? WHERE author_token = ?')
      .run(trimmedNickname, userToken);
    
    console.log(`[INFO] 更新昵称成功: ${trimmedNickname}, 同步更新了 ${updateResult.changes} 个游戏的作者名`);
    
    // 重新生成该用户所有游戏的静态文件（更新游戏页面中的作者名显示）
    if (updateResult.changes > 0) {
      try {
        const userGames = db.prepare('SELECT id, title, prompt, code FROM games WHERE author_token = ? AND status = ?')
          .all(userToken, 'published');
        
        let regeneratedCount = 0;
        for (const game of userGames) {
          if (game.code) {
            // 获取游戏创建时间
            const gameData = db.prepare('SELECT created_at FROM games WHERE id = ?').get(game.id);
            saveGameStaticFile(game.id, game.code, {
              title: game.title,
              prompt: game.prompt,
              authorName: trimmedNickname,
              authorToken: userToken,
              created_at: gameData?.created_at
            });
            regeneratedCount++;
          }
        }
        console.log(`[INFO] 重新生成了 ${regeneratedCount} 个游戏的静态文件`);
      } catch (e) {
        console.error('[WARN] 重新生成静态文件时出错:', e.message);
        // 不影响主流程，继续返回成功
      }
    }
    
    res.json({ success: true, nickname: trimmedNickname, updatedGamesCount: updateResult.changes });
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
    
    // 如果昵称是默认值'游戏玩家'，则返回账号ID作为显示名称
    const displayNickname = (account.nickname && account.nickname !== '游戏玩家') 
      ? account.nickname 
      : account.account_id;
    
    res.json({
      success: true,
      userToken: account.user_token,
      account: {
        accountId: account.account_id,
        nickname: displayNickname,
        rawNickname: account.nickname,
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
    
    // 如果昵称是默认值'游戏玩家'，则返回账号ID作为显示名称
    const displayNickname = (account.nickname && account.nickname !== '游戏玩家') 
      ? account.nickname 
      : account.account_id;
    
    res.json({
      success: true,
      userToken: account.user_token,
      account: {
        accountId: account.account_id,
        nickname: displayNickname,
        rawNickname: account.nickname,
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

// 获取可用的加速模型列表
app.get('/api/turbo-models', (req, res) => {
  try {
    const turboModels = getTurboModels();
    
    // 获取默认模型设置
    const defaultModelId = getConfig('llm_default_model', 'deepseek-v3');
    
    res.json({
      success: true,
      models: turboModels,
      defaultModel: defaultModelId  // 返回默认模型ID
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 取消生成请求（用于加速切换时取消旧的慢速请求）
app.post('/api/cancel-generation', (req, res) => {
  try {
    const { requestId } = req.body;
    const userToken = req.headers['x-user-token'];
    
    if (!requestId) {
      return res.status(400).json({ success: false, error: '缺少请求ID' });
    }
    
    // 验证请求属于当前用户
    const info = activeGenerations.get(requestId);
    if (!info) {
      // 请求可能已完成或过期，这不是错误
      console.log(`[CANCEL] 请求不存在或已完成: ${requestId}`);
      return res.json({ success: true, message: '请求不存在或已完成' });
    }
    
    if (info.userToken !== userToken) {
      console.log(`[CANCEL] 用户无权取消此请求: ${requestId}`);
      return res.status(403).json({ success: false, error: '无权取消此请求' });
    }
    
    // 标记请求为已取消
    cancelGeneration(requestId);
    
    res.json({ 
      success: true, 
      message: '请求已标记为取消',
      requestId 
    });
  } catch (error) {
    console.error('[ERROR] 取消请求失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    const validCode = getConfig('wechat_verify_code') || process.env.WECHAT_VERIFY_CODE || '2026';
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
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.is_featured, g.created_at,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
      FROM games g
      WHERE g.is_hidden = 0 AND (g.is_public = 1 OR g.is_public IS NULL) AND (g.is_featured = 1 OR g.like_count >= 5)
      ORDER BY g.is_featured DESC, g.like_count DESC, g.play_count DESC 
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
      SELECT id, title, prompt, code, author_name, author_token, llm_model, play_count, like_count, favorite_count, created_at, status
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

// ==================== 游戏留言板 API ====================

// 获取游戏留言列表
app.get('/api/games/:id/comments', (req, res) => {
  try {
    const gameId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const userToken = req.headers['x-user-token'] || null;
    
    // 获取留言列表（隐藏的评论只对自己可见）
    const comments = db.prepare(`
      SELECT id, author_name, content, created_at, user_token, is_hidden
      FROM game_comments
      WHERE game_id = ? AND is_deleted = 0 
        AND (is_hidden = 0 OR user_token = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(gameId, userToken || '', limit, offset);
    
    // 处理返回数据，标记是否为当前用户的留言
    const processedComments = comments.map(comment => ({
      id: comment.id,
      author_name: comment.author_name,
      content: comment.content,
      created_at: comment.created_at,
      user_token: comment.user_token, // 用于点击头像跳转到用户主页
      is_mine: userToken && comment.user_token === userToken,
      is_hidden: comment.is_hidden === 1
    }));
    
    // 获取总留言数（不包括隐藏的，除非是自己的）
    const totalRow = db.prepare(`
      SELECT COUNT(*) as total FROM game_comments 
      WHERE game_id = ? AND is_deleted = 0 AND (is_hidden = 0 OR user_token = ?)
    `).get(gameId, userToken || '');
    
    res.json({
      success: true,
      comments: processedComments,
      total: totalRow.total,
      hasMore: offset + comments.length < totalRow.total
    });
  } catch (error) {
    console.error('[ERROR] 获取留言失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 发布留言
app.post('/api/games/:id/comments', (req, res) => {
  try {
    // 首先检查发言封禁状态
    const banStatus = checkBanStatus(req, BAN_TYPES.COMMENT);
    if (banStatus.banned) {
      console.log('[BLOCKED] 被禁止发言用户尝试发表留言:', banStatus);
      return res.status(403).json({ 
        success: false, 
        error: `您已被禁止发言。原因：${banStatus.reason}`,
        banned: true
      });
    }
    
    const gameId = req.params.id;
    const userToken = req.headers['x-user-token'];
    const { content } = req.body;
    
    // 验证用户登录
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录后再留言' });
    }
    
    // 获取用户信息
    const user = db.prepare('SELECT account_id, nickname FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!user) {
      return res.status(401).json({ success: false, error: '用户不存在，请重新登录' });
    }
    
    // 验证留言内容
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, error: '留言内容不能为空' });
    }
    
    const trimmedContent = content.trim();
    
    if (trimmedContent.length > 500) {
      return res.status(400).json({ success: false, error: '留言内容不能超过500字' });
    }
    
    // 敏感词检测
    const lowerContent = trimmedContent.toLowerCase();
    for (const word of SENSITIVE_WORDS) {
      if (lowerContent.includes(word.toLowerCase())) {
        return res.status(400).json({ success: false, error: '留言内容包含违禁词，请修改后重试' });
      }
    }
    
    // 验证游戏存在
    const game = db.prepare('SELECT id FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 获取显示名称（优先使用昵称，否则使用账号ID）
    const authorName = (user.nickname && user.nickname !== '游戏玩家') 
      ? user.nickname 
      : user.account_id;
    
    // 插入留言
    const result = db.prepare(`
      INSERT INTO game_comments (game_id, user_token, author_name, content)
      VALUES (?, ?, ?, ?)
    `).run(gameId, userToken, authorName, trimmedContent);
    
    console.log(`[INFO] 新留言: 游戏=${gameId}, 用户=${authorName}, 内容长度=${trimmedContent.length}`);
    
    res.json({
      success: true,
      comment: {
        id: result.lastInsertRowid,
        author_name: authorName,
        content: trimmedContent,
        created_at: new Date().toISOString(),
        is_mine: true
      }
    });
  } catch (error) {
    console.error('[ERROR] 发布留言失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 删除留言（只能删除自己的）
app.delete('/api/games/:id/comments/:commentId', (req, res) => {
  try {
    const { id: gameId, commentId } = req.params;
    const userToken = req.headers['x-user-token'];
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 验证留言存在且属于当前用户
    const comment = db.prepare(`
      SELECT id, user_token FROM game_comments 
      WHERE id = ? AND game_id = ? AND is_deleted = 0
    `).get(commentId, gameId);
    
    if (!comment) {
      return res.status(404).json({ success: false, error: '留言不存在' });
    }
    
    if (comment.user_token !== userToken) {
      return res.status(403).json({ success: false, error: '只能删除自己的留言' });
    }
    
    // 软删除
    db.prepare('UPDATE game_comments SET is_deleted = 1 WHERE id = ?').run(commentId);
    
    console.log(`[INFO] 删除留言: ID=${commentId}, 游戏=${gameId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[ERROR] 删除留言失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 生成游戏（调用LLM）
app.post('/api/generate', async (req, res) => {
  const startTime = Date.now();
  console.log('\n========== 开始生成游戏 ==========');
  
  // 提前提取 requestId，以便在 catch 块中也能访问
  const requestId = req.body?.requestId || null;
  
  try {
    // 首先检查创作封禁状态
    const banStatus = checkBanStatus(req, BAN_TYPES.CREATE);
    if (banStatus.banned) {
      console.log('[BLOCKED] 被禁止创作用户尝试生成游戏:', banStatus);
      return res.status(403).json({ 
        success: false, 
        error: `您已被禁止创作游戏。原因：${banStatus.reason}`,
        banned: true,
        banType: banStatus.type,
        banReason: banStatus.reason
      });
    }
    
    const { prompt, llmConfig, draftId, advancedSettings, turboModel, isTurboSwitch } = req.body;
    const userToken = req.headers['x-user-token'] || null;
    const authorToken = req.headers['x-author-token'] || null;
    console.log('[INFO] 收到生成请求:', { 
      prompt, 
      provider: llmConfig?.provider, 
      user: userToken, 
      draftId, 
      advancedSettings,
      turboModel: turboModel || '无',
      isTurboSwitch: isTurboSwitch || false,
      requestId: requestId || '无'
    });
    
    // 创建 AbortController 用于中断 LLM 请求
    const llmAbortController = new AbortController();
    
    // 注册请求到活跃请求追踪器
    if (requestId) {
      activeGenerations.set(requestId, {
        userToken,
        startTime: Date.now(),
        cancelled: false,
        isTurbo: !!turboModel,
        abortController: llmAbortController  // 保存 AbortController 引用
      });
      console.log(`[TRACK] 已注册请求: ${requestId}`);
    }
    
    if (!prompt || prompt.trim().length === 0) {
      console.log('[ERROR] 游戏描述为空');
      return res.status(400).json({ success: false, error: '请输入游戏描述' });
    }

    // 处理加速模型切换：检查积分并扣除
    let turboModelConfig = null;
    let turboCreditCost = 0;
    if (turboModel && isTurboSwitch) {
      turboModelConfig = LLM_MODELS[turboModel];
      if (!turboModelConfig) {
        console.log('[ERROR] 无效的加速模型:', turboModel);
        return res.status(400).json({ success: false, error: '无效的加速模型' });
      }
      
      // 从配置读取积分消耗（优先数据库配置，否则使用默认值）
      turboCreditCost = getModelCreditCost(turboModel);
      
      if (turboCreditCost > 0 && userToken) {
        // 检查用户积分
        const userCredits = ensureUserCredits(userToken);
        if (userCredits.credits < turboCreditCost) {
          console.log('[ERROR] 积分不足:', { need: turboCreditCost, have: userCredits.credits });
          return res.status(400).json({ 
            success: false, 
            error: `积分不足，需要 ${turboCreditCost} 积分`,
            creditsNeeded: turboCreditCost,
            creditsHave: userCredits.credits
          });
        }
        
        // 扣除积分
        db.prepare(`
          UPDATE user_credits 
          SET credits = credits - ?, total_used = total_used + ?, updated_at = CURRENT_TIMESTAMP 
          WHERE user_token = ?
        `).run(turboCreditCost, turboCreditCost, userToken);
        
        // 记录积分消耗
        db.prepare(`
          INSERT INTO credit_logs (user_token, amount, type, description) 
          VALUES (?, ?, 'turbo_generate', ?)
        `).run(userToken, -turboCreditCost, `加速生成：使用 ${turboModelConfig.name}`);
        
        console.log(`[Credits] 用户 ${userToken.substring(0, 8)}... 消耗 ${turboCreditCost} 积分用于加速生成`);
      }
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

    // 判断用户是否提供了自己的API Key
    const useUserApiKey = llmConfig?.apiKey && llmConfig.apiKey.length > 0;
    
    // 根据provider确定默认baseUrl
    const getDefaultBaseUrl = (provider) => {
      switch (provider) {
        case 'anthropic': return 'https://api.anthropic.com';
        case 'openai': return 'https://api.openai.com';
        case 'google': return 'https://generativelanguage.googleapis.com/v1beta/openai';
        case 'qwen': return 'https://dashscope.aliyuncs.com/compatible-mode';
        case 'zhipu': return 'https://open.bigmodel.cn/api/paas/v4';
        case 'moonshot': return 'https://api.moonshot.cn/v1';
        case 'alibaba': return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        default: return 'https://api.deepseek.com';
      }
    };

    // ========== 模型选择逻辑 ==========
    // 优先级：加速模型(turboModel) > 前端传的modelId > 默认模型
    let finalModel, finalProvider, finalBaseUrl;
    let selectedModelId = null;
    
    if (turboModelConfig) {
      // 使用加速模型
      finalModel = turboModelConfig.model;
      finalProvider = turboModelConfig.provider;
      finalBaseUrl = turboModelConfig.baseUrl;
      selectedModelId = turboModel;
      console.log('[TURBO] 使用加速模型:', turboModelConfig.name);
    } else {
      // 检查前端传来的 modelId（从 llmConfig.provider 获取，前端用这个字段传模型ID）
      const requestedModelId = llmConfig?.provider || null;
      
      // 优先从后端 LLM_MODELS 中获取配置（确保配置一致性）
      if (requestedModelId && LLM_MODELS[requestedModelId]) {
        // 用户选择了一个已知的模型，使用后端配置
        const modelConfig = LLM_MODELS[requestedModelId];
        finalModel = modelConfig.model;
        finalProvider = modelConfig.provider;
        finalBaseUrl = modelConfig.baseUrl;
        selectedModelId = requestedModelId;
        console.log(`[INFO] 使用后端配置的模型: ${modelConfig.name} (${selectedModelId})`);
      } else if (requestedModelId === 'custom' && useUserApiKey) {
        // 用户使用自定义接口（需要自己提供Key和配置）
        finalModel = llmConfig?.model || 'deepseek-chat';
        finalProvider = 'custom';
        finalBaseUrl = llmConfig?.baseUrl || 'https://api.deepseek.com';
        selectedModelId = null;
        console.log('[INFO] 使用用户自定义接口配置');
      } else {
        // 使用后台配置的默认模型
        // 先检查默认模型是否在 LLM_MODELS 中
        if (defaultModel && LLM_MODELS[defaultModel]) {
          const modelConfig = LLM_MODELS[defaultModel];
          finalModel = modelConfig.model;
          finalProvider = modelConfig.provider;
          finalBaseUrl = modelConfig.baseUrl;
          selectedModelId = defaultModel;
        } else {
          // 尝试通过 model 名称匹配
          const matchedId = Object.keys(LLM_MODELS).find(key => LLM_MODELS[key].model === defaultModel);
          if (matchedId) {
            const modelConfig = LLM_MODELS[matchedId];
            finalModel = modelConfig.model;
            finalProvider = modelConfig.provider;
            finalBaseUrl = modelConfig.baseUrl;
            selectedModelId = matchedId;
          } else {
            // 最终回退：使用 deepseek-v3
            const fallbackConfig = LLM_MODELS['deepseek-v3'];
            finalModel = fallbackConfig.model;
            finalProvider = fallbackConfig.provider;
            finalBaseUrl = fallbackConfig.baseUrl;
            selectedModelId = 'deepseek-v3';
          }
        }
        console.log(`[INFO] 使用默认模型: ${selectedModelId}`);
      }
    }

    // ========== 积分/Key 验证逻辑 ==========
    // 获取该模型的积分消耗配置
    const modelCreditCost = selectedModelId ? getModelCreditCost(selectedModelId) : 0;
    
    // 获取模型特定的API Key配置（从数据库）
    const getModelApiKey = (modelId) => {
      if (!modelId) return null;
      const apiKeyKey = `llm_apikey_${modelId}`;
      const configuredKey = getConfig(apiKeyKey, null);
      if (configuredKey && configuredKey.length > 0) {
        return configuredKey;
      }
      return null;
    };
    
    // 确定API Key来源
    let finalApiKey = null;
    let keySource = '';
    
    // API Key优先级（从高到低）：
    // 1. 用户自己配置的Key（如果提供了）
    // 2. 该模型在后台配置的专属Key（llm_apikey_${modelId}）
    // 3. 后台配置的默认Key（llm_default_api_key）
    // 4. 环境变量中的Key（DEEPSEEK_API_KEY）
    
    if (useUserApiKey && llmConfig.apiKey) {
      // 用户自己配置的Key优先级最高
      finalApiKey = llmConfig.apiKey;
      keySource = 'user';
      console.log('[INFO] 使用用户自己配置的API Key');
    } else {
      // 尝试获取模型特定的Key
      const modelSpecificKey = getModelApiKey(selectedModelId);
      if (modelSpecificKey) {
        finalApiKey = modelSpecificKey;
        keySource = 'model_specific';
        console.log(`[INFO] 使用模型 ${selectedModelId} 的专属API Key`);
      } else if (defaultApiKey) {
        finalApiKey = defaultApiKey;
        keySource = 'default';
        console.log('[INFO] 使用后台默认API Key');
      } else if (process.env.DEEPSEEK_API_KEY) {
        finalApiKey = process.env.DEEPSEEK_API_KEY;
        keySource = 'env';
        console.log('[INFO] 使用环境变量API Key');
      }
    }

    const config = {
      provider: finalProvider,
      apiKey: finalApiKey,
      baseUrl: finalBaseUrl,
      model: finalModel,
      isTurbo: !!turboModelConfig,
      turboCreditCost: turboCreditCost,
      keySource: keySource
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
      apiKeyLength: config.apiKey?.length || 0,
      keySource: keySource,
      modelCreditCost: modelCreditCost
    });
    
    // ========== 积分扣除逻辑（非Turbo模式）==========
    // 规则：用户有自己的Key = 免费，使用后台Key = 扣积分
    let actualCreditCost = 0;
    if (!turboModelConfig && keySource !== 'user' && userToken && selectedModelId) {
      // 使用后台Key，需要扣积分
      actualCreditCost = modelCreditCost;
      
      if (actualCreditCost > 0) {
        // 检查用户积分
        const userCredits = ensureUserCredits(userToken);
        if (userCredits.credits < actualCreditCost) {
          console.log('[ERROR] 积分不足:', { need: actualCreditCost, have: userCredits.credits });
          return res.status(400).json({ 
            success: false, 
            error: `积分不足，需要 ${actualCreditCost} 积分`,
            creditsNeeded: actualCreditCost,
            creditsHave: userCredits.credits
          });
        }
        
        // 扣除积分
        db.prepare(`
          UPDATE user_credits 
          SET credits = credits - ?, total_used = total_used + ?, updated_at = CURRENT_TIMESTAMP 
          WHERE user_token = ?
        `).run(actualCreditCost, actualCreditCost, userToken);
        
        // 记录积分消耗
        const modelName = LLM_MODELS[selectedModelId]?.name || selectedModelId;
        db.prepare(`
          INSERT INTO credit_logs (user_token, amount, type, description) 
          VALUES (?, ?, 'generate', ?)
        `).run(userToken, -actualCreditCost, `生成游戏：使用 ${modelName}`);
        
        console.log(`[Credits] 用户 ${userToken.substring(0, 8)}... 消耗 ${actualCreditCost} 积分`);
      }
    } else if (keySource === 'user') {
      console.log('[INFO] 用户使用自己的API Key，免费生成');
    }

    // Key验证：如果不是积分付费模式，必须有Key
    if (!config.apiKey) {
      console.log('[ERROR] API Key未配置');
      
      // 根据模型类型给出具体的提示
      const modelName = selectedModelId ? (LLM_MODELS[selectedModelId]?.name || selectedModelId) : finalModel;
      const providerName = {
        'deepseek': 'DeepSeek',
        'openai': 'OpenAI',
        'anthropic': 'Claude',
        'google': 'Google',
        'zhipu': '智谱AI',
        'moonshot': 'Moonshot',
        'alibaba': '阿里云'
      }[finalProvider] || finalProvider;
      
      return res.status(400).json({ 
        success: false, 
        error: `使用 ${modelName} 需要配置 ${providerName} 的 API Key`,
        needApiKey: true,
        provider: finalProvider,
        hint: `请在设置中配置您的 ${providerName} API Key，或选择其他模型`
      });
    }
    
    // 验证API Key格式（DeepSeek的Key通常以sk-开头）
    if (config.provider === 'deepseek' && !config.apiKey.startsWith('sk-')) {
      console.log('[WARN] DeepSeek API Key格式可能不正确，通常应以sk-开头');
    }

    // 构建高级设置描述
    let advancedHint = '';
    if (advancedSettings) {
      const hints = [];
      
      // 游戏类型
      const gameTypeMap = {
        'action': '动作游戏',
        'puzzle': '益智解谜游戏',
        'casual': '休闲游戏',
        'racing': '竞速游戏',
        'shooting': '射击游戏',
        'platform': '平台跳跃游戏',
        'rpg': 'RPG角色扮演游戏',
        'strategy': '策略游戏'
      };
      if (advancedSettings.gameType && advancedSettings.gameType !== 'auto') {
        hints.push(`游戏类型: ${gameTypeMap[advancedSettings.gameType] || advancedSettings.gameType}`);
      }
      
      // 画风
      const artStyleMap = {
        'pixel': '像素风格',
        'cartoon': '卡通风格',
        'minimalist': '极简风格',
        'retro': '复古风格',
        'neon': '霓虹赛博风格',
        'handdrawn': '手绘风格'
      };
      if (advancedSettings.artStyle && advancedSettings.artStyle !== 'auto') {
        hints.push(`美术风格: ${artStyleMap[advancedSettings.artStyle] || advancedSettings.artStyle}，请在视觉设计上体现这种风格`);
      }
      
      // 横竖屏
      if (advancedSettings.orientation && advancedSettings.orientation !== 'auto') {
        if (advancedSettings.orientation === 'landscape') {
          hints.push('屏幕方向: 横屏优化，适合PC和横向握持手机');
        } else if (advancedSettings.orientation === 'portrait') {
          hints.push('屏幕方向: 竖屏优化，适合手机垂直握持');
        }
      }
      
      // 平台
      if (advancedSettings.platform && advancedSettings.platform !== 'all') {
        if (advancedSettings.platform === 'mobile') {
          hints.push('目标平台: 移动端优化，强化触屏操作体验');
        } else if (advancedSettings.platform === 'pc') {
          hints.push('目标平台: PC端优化，强化键鼠操作体验');
        }
      }
      
      // 难度
      const difficultyMap = {
        'easy': '简单难度，适合休闲玩家',
        'medium': '中等难度，适度挑战',
        'hard': '困难难度，需要较高技巧'
      };
      if (advancedSettings.difficulty && advancedSettings.difficulty !== 'medium') {
        hints.push(`难度设定: ${difficultyMap[advancedSettings.difficulty] || advancedSettings.difficulty}`);
      }
      
      // 音效
      if (advancedSettings.soundEffect && advancedSettings.soundEffect !== '' && advancedSettings.soundEffect !== 'none') {
        if (advancedSettings.soundEffect === 'basic') {
          hints.push('音效: 添加基础音效，使用Web Audio API生成简单的游戏音效（如点击音、得分音、碰撞音）');
        } else if (advancedSettings.soundEffect === 'rich') {
          hints.push('音效: 添加丰富音效，使用Web Audio API生成多样的游戏音效（包括背景音乐循环、多种交互音效、成功/失败音效等）');
        }
      }
      
      if (hints.length > 0) {
        advancedHint = `\n【用户高级设置】：\n${hints.map(h => `- ${h}`).join('\n')}\n请在生成游戏时参考以上设置。`;
      }
    }
    
    // 如果用户指定了游戏名称
    const gameNameHint = advancedSettings?.gameName 
      ? `\n【游戏名称】：请将游戏标题设置为"${advancedSettings.gameName}"`
      : '';

    const systemPrompt = `你是一个专业的HTML5游戏开发专家。用户会给你一句话描述，你需要生成一个完整的、可直接运行的HTML5游戏。

【最重要 - 代码必须完整】：
- 代码必须完整，确保有</script></body></html>结束标签
- 代码要精简高效，避免冗余，控制在800行以内
- 不要写过多注释，保持代码简洁

【基本要求】：
1. 完整HTML文件：<!DOCTYPE html>、<html>、<head>、<body>，必须正确闭合
2. CSS写在<style>内，JS写在<script>内
3. 页面加载后立即显示游戏，不能空白
4. 同时支持键盘和触屏操作

【触摸控制要求 - 非常重要】：
1. 对于需要移动/转向的角色或物体，必须支持手指触摸拖动控制，不要只用按钮
2. 实现触摸方式：监听touchstart/touchmove/touchend事件，根据手指移动方向控制角色
3. 可以使用虚拟摇杆（左下角半透明圆形区域）或直接触摸屏幕任意位置拖动
4. 同时保留键盘方向键/WASD支持，但触屏设备优先使用触摸控制

【游戏界面要求 - 非常重要】：
1. 只有3种界面状态：开始界面、游戏进行中、结束界面
2. 开始界面：显示游戏标题、"开始游戏"按钮、以及"游戏说明"按钮（点击显示操作方法）
3. 游戏进行中：必须隐藏所有遮罩层，只显示Canvas游戏画面。得分、生命值等HUD信息直接用Canvas绑制在画面上，不要用HTML覆盖层
4. 结束界面：游戏结束时才显示结果，可以用半透明遮罩层
5. 点击"开始游戏"后，必须立即隐藏开始界面的遮罩，让玩家看到游戏画面
6. 不要在游戏进行中显示任何全屏或半透明的HTML遮罩层
7. 游戏界面右上角保留一个小的"?"按钮，点击可随时查看游戏说明

【内容合规要求】：
1. 游戏内容必须健康积极，适合所有年龄段
2. 禁止包含暴力血腥、色情低俗、政治敏感、赌博等违规内容
3. 游戏角色和场景设计要正向友好

【游戏要求】：
1. 游戏有趣、逻辑完整
2. 深色主题，适配手机和电脑

【布局要求 - 非常重要】：
1. 游戏必须在一屏内完整显示，禁止出现滚动条
2. 使用 width:100vw; height:100vh; overflow:hidden 确保全屏且不滚动
3. Canvas尺寸动态适配：使用 window.innerWidth 和 window.innerHeight
4. 所有UI元素使用绝对定位或flex布局，不要超出视口范围
5. 监听 resize 事件，窗口大小变化时自动调整Canvas尺寸
${advancedHint}${gameNameHint}
只返回完整的HTML代码，用\`\`\`html和\`\`\`包裹，不要解释。`;

    console.log('[INFO] 开始调用LLM API...');
    const apiStartTime = Date.now();
    
    // 检查是否在发起请求前就被取消了
    if (requestId && isGenerationCancelled(requestId)) {
      console.log(`[CANCELLED] 请求在发起LLM调用前被取消: ${requestId}`);
      activeGenerations.delete(requestId);
      return res.json({
        success: false,
        cancelled: true,
        message: '请求已被取消',
        requestId
      });
    }
    
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
        max_tokens: 3000
      }),
      signal: llmAbortController.signal  // 支持中断 LLM 请求
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
    const hasClosingBody = code.includes('</body>');
    const hasClosingHtml = code.includes('</html>');
    const hasClosingScript = code.includes('</script>');
    
    console.log('[INFO] HTML结构检查:', { hasDoctype, hasHtml, hasBody, hasScript, hasClosingBody, hasClosingHtml, hasClosingScript });
    console.log('[INFO] 最终代码长度:', code.length);
    
    // 检查代码是否被截断
    if (hasScript && !hasClosingScript) {
      console.log('[WARN] 代码可能被截断：缺少</script>标签');
      throw new Error('生成的游戏代码不完整，请重试或尝试简化游戏描述');
    }
    if (hasBody && !hasClosingBody) {
      console.log('[WARN] 代码可能被截断：缺少</body>标签');
      throw new Error('生成的游戏代码不完整，请重试或尝试简化游戏描述');
    }
    if (hasHtml && !hasClosingHtml) {
      console.log('[WARN] 代码可能被截断：缺少</html>标签');
      throw new Error('生成的游戏代码不完整，请重试或尝试简化游戏描述');
    }

    // 生成标题
    const titleMatch = code.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : prompt.slice(0, 50);
    console.log('[INFO] 游戏标题:', title);

    // 注入品牌水印
    code = injectBrandWatermark(code);
    console.log('[INFO] 已注入品牌水印');

    // 检查请求是否已被取消（用户切换到加速模式）
    if (requestId && isGenerationCancelled(requestId)) {
      console.log(`[CANCELLED] 请求已被取消，跳过草稿更新: ${requestId}`);
      // 清理请求记录
      activeGenerations.delete(requestId);
      // 返回特殊响应，告知前端这个结果已过期
      return res.json({
        success: false,
        cancelled: true,
        message: '此请求已被取消（用户已切换到加速模式）',
        requestId
      });
    }

    // 如果有草稿ID，自动更新草稿为已发布状态
    if (draftId && authorToken) {
      try {
        const draftGame = db.prepare('SELECT author_token FROM games WHERE id = ?').get(draftId);
        if (draftGame && draftGame.author_token === authorToken) {
          // 获取orientation和visibility设置
          const gameOrientation = advancedSettings?.orientation || 'portrait';
          const gameVisibility = advancedSettings?.visibility || 'public';
          const isPublic = gameVisibility === 'public' ? 1 : 0;
          
          db.prepare(`
            UPDATE games 
            SET title = ?, code = ?, status = 'published', orientation = ?, visibility = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(title, code, gameOrientation, gameVisibility, isPublic, draftId);
          
          // 生成静态文件
          saveGameStaticFile(draftId, code, {
            title: title,
            authorName: '匿名', // 从草稿中获取作者名会更好
            prompt: prompt,
            authorToken: authorToken,
            created_at: new Date().toISOString()
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

    // 清理请求记录
    if (requestId) {
      activeGenerations.delete(requestId);
      console.log(`[TRACK] 已清理请求记录: ${requestId}`);
    }

    res.json({ 
      success: true, 
      code,
      title,
      prompt,
      draftId: draftId || null,  // 返回草稿ID供前端使用
      requestId: requestId || null, // 返回请求ID供前端确认
      debug: {
        codeLength: code.length,
        apiTime,
        totalTime,
        tokens: data.usage
      }
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // 检查是否是中断错误（用户切换到加速模式）
    if (error.name === 'AbortError') {
      console.log(`[ABORTED] LLM请求被中断 (耗时${totalTime}ms): ${requestId || '无ID'}`);
      console.log('========================================\n');
      // 清理请求记录
      if (requestId) {
        activeGenerations.delete(requestId);
      }
      return res.json({ 
        success: false, 
        cancelled: true, 
        message: 'LLM请求已被中断（用户切换到加速模式）',
        requestId 
      });
    }
    
    console.error(`[ERROR] 生成游戏失败 (耗时${totalTime}ms):`, error.message);
    console.log('========================================\n');
    // 清理请求记录
    if (requestId) {
      activeGenerations.delete(requestId);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存游戏（支持创建草稿：status='draft' 时 code 可为空）
app.post('/api/games', (req, res) => {
  try {
    const { title, prompt, code, authorName, authorToken, status, orientation, visibility } = req.body;
    
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
    const gameOrientation = orientation || 'portrait'; // 默认竖屏
    const gameVisibility = visibility || 'public'; // 默认公开，支持 public/followers/private
    const isPublic = gameVisibility === 'public' ? 1 : 0; // 兼容旧字段
    
    db.prepare(`
      INSERT INTO games (id, title, prompt, code, author_name, author_token, status, orientation, visibility, is_public) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, gameTitle, prompt, gameCode, gameAuthor, token, gameStatus, gameOrientation, gameVisibility, isPublic);

    // 只有已发布的游戏才生成静态文件
    if (!isDraft && code) {
      saveGameStaticFile(id, code, {
        title: gameTitle,
        authorName: gameAuthor,
        prompt: prompt,
        authorToken: token,
        created_at: new Date().toISOString()
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
      updates.push('visibility = ?');
      params.push(visibility);
      updates.push('is_public = ?');
      params.push(isPublic);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    
    db.prepare(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // 如果更新为已发布状态且有代码，生成静态文件
    const newStatus = status || game.status;
    if (newStatus === 'published' && code) {
      // 获取游戏的创建时间
      const gameData = db.prepare('SELECT created_at FROM games WHERE id = ?').get(req.params.id);
      saveGameStaticFile(req.params.id, code, {
        title: title || prompt?.slice(0, 50),
        authorName: authorName || '匿名',
        prompt: prompt,
        authorToken: game.author_token,
        created_at: gameData?.created_at || new Date().toISOString()
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
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.created_at,
             COALESCE(g.status, 'published') as status,
             COALESCE(g.visibility, CASE WHEN g.is_public = 0 THEN 'private' ELSE 'public' END) as visibility,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
      FROM games g
      WHERE g.author_token = ?
      ORDER BY g.created_at DESC
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
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.created_at, ul.created_at as liked_at,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
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
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.created_at, uf.created_at as favorited_at,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
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

// ==================== 我的评论 ====================
// 获取我的评论列表
app.get('/api/my-comments', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.json({ success: true, comments: [], count: 0 });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const comments = db.prepare(`
      SELECT c.id, c.game_id, c.content, c.is_hidden, c.is_deleted, c.created_at,
             g.title as game_title, g.author_name as game_author
      FROM game_comments c
      LEFT JOIN games g ON c.game_id = g.id
      WHERE c.user_token = ? AND c.is_deleted = 0
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userToken, limit, offset);
    
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM game_comments 
      WHERE user_token = ? AND is_deleted = 0
    `).get(userToken);
    
    res.json({ 
      success: true, 
      comments, 
      count: total?.count || 0 
    });
  } catch (error) {
    console.error('[ERROR] 获取我的评论失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 切换评论隐藏状态（隐藏/开放）
app.post('/api/my-comments/:id/toggle-hidden', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const commentId = req.params.id;
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 检查评论是否属于该用户
    const comment = db.prepare(`
      SELECT id, is_hidden FROM game_comments 
      WHERE id = ? AND user_token = ? AND is_deleted = 0
    `).get(commentId, userToken);
    
    if (!comment) {
      return res.status(404).json({ success: false, error: '评论不存在或无权操作' });
    }
    
    // 切换隐藏状态
    const newHidden = comment.is_hidden ? 0 : 1;
    db.prepare('UPDATE game_comments SET is_hidden = ? WHERE id = ?').run(newHidden, commentId);
    
    res.json({ 
      success: true, 
      is_hidden: newHidden === 1,
      message: newHidden ? '评论已隐藏' : '评论已公开'
    });
  } catch (error) {
    console.error('[ERROR] 切换评论隐藏状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除我的评论
app.delete('/api/my-comments/:id', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const commentId = req.params.id;
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 检查评论是否属于该用户
    const comment = db.prepare(`
      SELECT id FROM game_comments 
      WHERE id = ? AND user_token = ? AND is_deleted = 0
    `).get(commentId, userToken);
    
    if (!comment) {
      return res.status(404).json({ success: false, error: '评论不存在或无权操作' });
    }
    
    // 软删除
    db.prepare('UPDATE game_comments SET is_deleted = 1 WHERE id = ?').run(commentId);
    
    res.json({ success: true, message: '评论已删除' });
  } catch (error) {
    console.error('[ERROR] 删除评论失败:', error);
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
      // 获取最新收藏数
      const updated = db.prepare('SELECT favorite_count FROM games WHERE id = ?').get(gameId);
      res.json({ success: true, favorited: false, favorite_count: updated?.favorite_count || 0 });
    } else {
      // 未收藏，添加收藏
      db.prepare('INSERT INTO user_favorites (user_token, game_id) VALUES (?, ?)').run(userToken, gameId);
      // 更新游戏的收藏计数
      db.prepare('UPDATE games SET favorite_count = favorite_count + 1 WHERE id = ?').run(gameId);
      // 获取最新收藏数
      const updated = db.prepare('SELECT favorite_count FROM games WHERE id = ?').get(gameId);
      res.json({ success: true, favorited: true, favorite_count: updated?.favorite_count || 0 });
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

    let accountId = account?.account_id;
    let rawNickname = account?.nickname;
    
    // 如果昵称是默认值'游戏玩家'或空，则使用账号ID
    let nickname;
    if (!rawNickname || rawNickname === '游戏玩家') {
      // 优先使用账号ID，如果没有则从游戏表获取作者名
      if (accountId) {
        nickname = accountId;
      } else {
        const game = db.prepare('SELECT author_name FROM games WHERE author_token = ? LIMIT 1')
          .get(userToken);
        nickname = game?.author_name || '匿名用户';
      }
    } else {
      nickname = rawNickname;
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
      SELECT g.id, g.title, g.author_name, g.play_count, g.like_count, g.share_count, g.created_at,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
      FROM games g
      WHERE g.author_token = ? AND (g.is_public = 1 OR g.is_public IS NULL) AND (g.is_hidden = 0 OR g.is_hidden IS NULL)
      ORDER BY g.created_at DESC
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

// 创建邀请关系表（用于首次生成游戏时触发奖励）
db.exec(`
  CREATE TABLE IF NOT EXISTS referrals (
    invitee_account_id TEXT PRIMARY KEY,
    inviter_code TEXT NOT NULL,
    rewarded INTEGER DEFAULT 0,
    rewarded_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建邀请者每日奖励计数表
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_referral_counts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inviter_code TEXT NOT NULL,
    date TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    UNIQUE(inviter_code, date)
  )
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
    // 检查创作封禁状态（主要针对IP）
    const banStatus = checkBanStatus(req, BAN_TYPES.CREATE);
    if (banStatus.banned) {
      console.log('[BLOCKED] 被禁止创作用户尝试体验模式生成:', banStatus);
      return res.status(403).json({ 
        success: false, 
        error: `您已被禁止创作游戏。原因：${banStatus.reason}`,
        banned: true
      });
    }
    
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

【最重要 - 代码必须完整】：
- 代码必须完整，确保有</script></body></html>结束标签
- 代码要精简高效，避免冗余，控制在800行以内
- 不要写过多注释，保持代码简洁

【基本要求】：
1. 完整HTML文件：<!DOCTYPE html>、<html>、<head>、<body>，必须正确闭合
2. CSS写在<style>内，JS写在<script>内
3. 页面加载后立即显示游戏，不能空白
4. 同时支持键盘和触屏操作

【触摸控制要求 - 非常重要】：
1. 对于需要移动/转向的角色或物体，必须支持手指触摸拖动控制，不要只用按钮
2. 实现触摸方式：监听touchstart/touchmove/touchend事件，根据手指移动方向控制角色
3. 可以使用虚拟摇杆（左下角半透明圆形区域）或直接触摸屏幕任意位置拖动
4. 同时保留键盘方向键/WASD支持，但触屏设备优先使用触摸控制

【游戏界面要求 - 非常重要】：
1. 只有3种界面状态：开始界面、游戏进行中、结束界面
2. 开始界面：显示游戏标题、"开始游戏"按钮、以及"游戏说明"按钮（点击显示操作方法）
3. 游戏进行中：必须隐藏所有遮罩层，只显示Canvas游戏画面。得分、生命值等HUD信息直接用Canvas绑制在画面上，不要用HTML覆盖层
4. 结束界面：游戏结束时才显示结果，可以用半透明遮罩层
5. 点击"开始游戏"后，必须立即隐藏开始界面的遮罩，让玩家看到游戏画面
6. 不要在游戏进行中显示任何全屏或半透明的HTML遮罩层
7. 游戏界面右上角保留一个小的"?"按钮，点击可随时查看游戏说明

【内容合规要求】：
1. 游戏内容必须健康积极，适合所有年龄段
2. 禁止包含暴力血腥、色情低俗、政治敏感、赌博等违规内容
3. 游戏角色和场景设计要正向友好

【游戏要求】：
1. 游戏有趣、逻辑完整
2. 深色主题，适配手机和电脑

【布局要求 - 非常重要】：
1. 游戏必须在一屏内完整显示，禁止出现滚动条
2. 使用 width:100vw; height:100vh; overflow:hidden 确保全屏且不滚动
3. Canvas尺寸动态适配：使用 window.innerWidth 和 window.innerHeight
4. 所有UI元素使用绝对定位或flex布局，不要超出视口范围
5. 监听 resize 事件，窗口大小变化时自动调整Canvas尺寸

只返回完整的HTML代码，用\`\`\`html和\`\`\`包裹，不要解释。`;

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
            max_tokens: 3000
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
    
    // 检查代码完整性
    const hasScript = code.includes('<script');
    const hasBody = code.includes('<body');
    const hasHtml = code.includes('<html');
    const hasClosingScript = code.includes('</script>');
    const hasClosingBody = code.includes('</body>');
    const hasClosingHtml = code.includes('</html>');
    
    console.log('[TRIAL] HTML结构检查:', { hasScript, hasBody, hasHtml, hasClosingScript, hasClosingBody, hasClosingHtml });
    
    // 检查代码是否被截断
    if (hasScript && !hasClosingScript) {
      console.log('[TRIAL WARN] 代码可能被截断：缺少</script>标签');
      throw new Error('生成的游戏代码不完整，请重试或尝试简化游戏描述');
    }
    if (hasBody && !hasClosingBody) {
      console.log('[TRIAL WARN] 代码可能被截断：缺少</body>标签');
      throw new Error('生成的游戏代码不完整，请重试或尝试简化游戏描述');
    }
    if (hasHtml && !hasClosingHtml) {
      console.log('[TRIAL WARN] 代码可能被截断：缺少</html>标签');
      throw new Error('生成的游戏代码不完整，请重试或尝试简化游戏描述');
    }
    
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
          // Trial模式默认竖屏
          const gameOrientation = 'portrait';
          
          db.prepare(`
            UPDATE games 
            SET title = ?, code = ?, status = 'published', orientation = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(title, code, gameOrientation, draftId);
          
          // 生成静态文件
          saveGameStaticFile(draftId, code, {
            title: title,
            authorName: draftGame.author_name || '匿名',
            prompt: prompt,
            authorToken: authorToken,
            created_at: new Date().toISOString()
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

// ==================== 邀请关系系统（延迟奖励） ====================

// 每日邀请奖励上限
const DAILY_REFERRAL_LIMIT = 100;
// 每次邀请奖励积分
const REFERRAL_REWARD_POINTS = 1;

// 记录邀请关系（不立即发放奖励，等首次成功生成游戏时再发放）
app.post('/api/referral/record', (req, res) => {
  try {
    const { inviterCode } = req.body;
    const inviteeAccountId = req.headers['x-account-id'];
    
    if (!inviterCode) {
      return res.status(400).json({ success: false, error: '缺少邀请码' });
    }
    
    if (!inviteeAccountId) {
      return res.status(400).json({ success: false, error: '缺少账户ID' });
    }
    
    // 检查是否已有邀请关系
    const existingReferral = db.prepare('SELECT * FROM referrals WHERE invitee_account_id = ?').get(inviteeAccountId);
    if (existingReferral) {
      return res.json({ 
        success: true, 
        recorded: false, 
        reason: '已有邀请关系',
        alreadyRecorded: true
      });
    }
    
    // 不能自己邀请自己（邀请码通常是账户ID的前8位）
    if (inviteeAccountId.toUpperCase().startsWith(inviterCode.toUpperCase())) {
      return res.json({ 
        success: false, 
        error: '不能使用自己的邀请链接'
      });
    }
    
    // 记录邀请关系
    db.prepare('INSERT INTO referrals (invitee_account_id, inviter_code) VALUES (?, ?)').run(inviteeAccountId, inviterCode.toUpperCase());
    
    console.log(`[REFERRAL] 记录邀请关系: 邀请者=${inviterCode}, 被邀请者=${inviteeAccountId}`);
    
    return res.json({
      success: true,
      recorded: true,
      message: '邀请关系已记录，首次成功生成游戏后双方各得1积分'
    });
    
  } catch (error) {
    console.error('记录邀请关系失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 触发邀请奖励（首次成功生成游戏时调用）
app.post('/api/referral/reward', (req, res) => {
  try {
    const accountId = req.headers['x-account-id'];
    
    if (!accountId) {
      return res.status(400).json({ success: false, error: '缺少账户ID' });
    }
    
    // 检查该用户是否有被邀请记录
    const referral = db.prepare('SELECT * FROM referrals WHERE invitee_account_id = ?').get(accountId);
    
    if (!referral) {
      // 没有邀请关系，不需要处理
      return res.json({ success: true, rewarded: false, reason: '无邀请关系' });
    }
    
    if (referral.rewarded) {
      // 已经奖励过了
      return res.json({ success: true, rewarded: false, reason: '已奖励过' });
    }
    
    // 检查邀请者今日奖励次数是否已达上限
    const today = new Date().toISOString().slice(0, 10);
    const dailyCount = db.prepare('SELECT count FROM daily_referral_counts WHERE inviter_code = ? AND date = ?').get(referral.inviter_code, today);
    
    if (dailyCount && dailyCount.count >= DAILY_REFERRAL_LIMIT) {
      // 邀请者今日已达上限，仍标记为已处理但不发放奖励
      db.prepare('UPDATE referrals SET rewarded = 1, rewarded_at = CURRENT_TIMESTAMP WHERE invitee_account_id = ?').run(accountId);
      return res.json({ 
        success: true, 
        rewarded: false, 
        reason: '邀请者今日奖励已达上限',
        dailyLimit: DAILY_REFERRAL_LIMIT
      });
    }
    
    // 发放奖励
    // 1. 标记邀请关系已奖励
    db.prepare('UPDATE referrals SET rewarded = 1, rewarded_at = CURRENT_TIMESTAMP WHERE invitee_account_id = ?').run(accountId);
    
    // 2. 增加邀请者今日奖励计数
    db.prepare(`
      INSERT INTO daily_referral_counts (inviter_code, date, count) 
      VALUES (?, ?, 1) 
      ON CONFLICT(inviter_code, date) DO UPDATE SET count = count + 1
    `).run(referral.inviter_code, today);
    
    // 3. 通过邀请码查找邀请者的账户
    const inviter = db.prepare('SELECT creator_token FROM invite_codes WHERE code = ?').get(referral.inviter_code);
    
    if (inviter) {
      // 给邀请者增加积分
      db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
        .run(REFERRAL_REWARD_POINTS, REFERRAL_REWARD_POINTS, inviter.creator_token);
      db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
        .run(inviter.creator_token, REFERRAL_REWARD_POINTS, 'referral_inviter', '邀请好友成功生成游戏奖励');
    }
    
    // 4. 给被邀请者增加积分（当前用户）
    // 需要查找当前用户的 user_token
    const currentUser = db.prepare('SELECT user_token FROM user_credits WHERE user_token LIKE ?').get(accountId + '%');
    if (currentUser) {
      db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
        .run(REFERRAL_REWARD_POINTS, REFERRAL_REWARD_POINTS, currentUser.user_token);
      db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
        .run(currentUser.user_token, REFERRAL_REWARD_POINTS, 'referral_invitee', '通过邀请链接成功生成游戏奖励');
    } else {
      // 如果找不到，尝试用 accountId 直接操作
      const exists = db.prepare('SELECT 1 FROM user_credits WHERE user_token = ?').get(accountId);
      if (exists) {
        db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
          .run(REFERRAL_REWARD_POINTS, REFERRAL_REWARD_POINTS, accountId);
        db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
          .run(accountId, REFERRAL_REWARD_POINTS, 'referral_invitee', '通过邀请链接成功生成游戏奖励');
      }
    }
    
    console.log(`[REFERRAL] 邀请奖励触发: 邀请者=${referral.inviter_code}, 被邀请者=${accountId}, 双方各得${REFERRAL_REWARD_POINTS}积分`);
    
    return res.json({
      success: true,
      rewarded: true,
      inviter: referral.inviter_code,
      invitee: accountId,
      rewardPoints: REFERRAL_REWARD_POINTS,
      message: `🎉 邀请奖励已发放！你和邀请者各获得 ${REFERRAL_REWARD_POINTS} 积分`
    });
    
  } catch (error) {
    console.error('处理邀请奖励失败:', error);
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

// 获取所有大模型列表（管理员用，包含完整信息）
app.get('/api/admin/models', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const models = Object.entries(LLM_MODELS).map(([id, config]) => {
      const timeKey = `llm_time_${id}`;
      const creditsKey = `llm_credits_${id}`;
      const qualityKey = `llm_quality_${id}`;
      const apiKeyKey = `llm_apikey_${id}`;
      
      // 从数据库获取配置值
      const configuredTime = getConfig(timeKey, null);
      const configuredCredits = getConfig(creditsKey, null);
      const configuredQuality = getConfig(qualityKey, null);
      const configuredApiKey = getConfig(apiKeyKey, null);
      
      // 实际使用的quality（优先使用配置值）
      const effectiveQuality = configuredQuality || config.quality;
      
      // 遮蔽 API Key，只显示前4位和后4位
      let maskedApiKey = null;
      if (configuredApiKey && configuredApiKey.length > 0) {
        if (configuredApiKey.length <= 8) {
          maskedApiKey = configuredApiKey.substring(0, 2) + '****';
        } else {
          const prefix = configuredApiKey.substring(0, 4);
          const suffix = configuredApiKey.substring(configuredApiKey.length - 4);
          maskedApiKey = `${prefix}****${suffix}`;
        }
      }
      
      return {
        id,
        name: config.name,
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        tier: config.tier,
        speed: config.speed,
        quality: effectiveQuality,  // 使用实际生效的quality
        defaultQuality: config.quality,  // 保留默认值供参考
        // 默认值
        defaultCredits: config.creditCost,
        defaultTime: getDefaultModelTime(id),
        // 配置值（如果有）
        configuredTime: configuredTime !== null ? parseInt(configuredTime) : null,
        configuredCredits: configuredCredits !== null ? parseInt(configuredCredits) : null,
        configuredQuality: configuredQuality,
        hasApiKey: configuredApiKey !== null && configuredApiKey.length > 0,
        maskedApiKey: maskedApiKey,  // 遮蔽后的 API Key
        // 实际使用的值
        creditCost: getModelCreditCost(id),
        estimatedTime: configuredTime !== null ? parseInt(configuredTime) : getDefaultModelTime(id),
        // 是否启用
        enabled: isModelEnabled(id)
      };
    });
    
    res.json({ success: true, models });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取模型的默认生成时间
function getDefaultModelTime(modelId) {
  const defaultTimes = {
    'deepseek-v3': 360,
    'deepseek-r1': 450,
    'gpt-4o': 400,
    'gpt-4o-mini': 250,
    'gpt-5': 350,
    'gpt-5.1': 350,
    'gpt-5.1-codex': 400,
    'claude-4.5-opus': 450,
    'claude-4.5-sonnet': 400,
    'claude-4.5-haiku': 300,
    'claude-4-sonnet': 350,
    'claude-3.7-sonnet': 350,
    'gemini-3-pro': 300,
    'gemini-2.5-pro': 300,
    'gemini-2.5-flash': 200,
    'gemini-2.0-flash': 200,
    'glm-4.7': 300,
    'glm-4.6': 300,
    'glm-4.5': 300,
    'kimi-k2': 350,
    'qwen3-coder-plus': 320
  };
  return defaultTimes[modelId] || 300;
}

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

// 删除系统配置
function deleteConfig(key) {
  db.prepare('DELETE FROM system_config WHERE key = ?').run(key);
}

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
      if (key) {
        if (value === '' || value === null || value === undefined) {
          // 空值表示删除配置
          deleteConfig(key);
          console.log(`[CONFIG] 删除配置: ${key}`);
        } else {
          setConfig(key, value);
          // API Key 只打印前几位
          if (key.includes('apikey')) {
            console.log(`[CONFIG] 设置配置: ${key} = ${value.substring(0, 8)}...`);
          } else {
            console.log(`[CONFIG] 设置配置: ${key} = ${value}`);
          }
        }
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

// 修复游戏文件（从数据库重新生成）
app.post('/api/admin/games/:id/repair', (req, res) => {
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
    
    if (!game.code) {
      return res.status(400).json({ success: false, error: '游戏代码为空，无法修复' });
    }
    
    // 备份原文件（如果存在）
    const filePath = getGameFilePath(id);
    if (fs.existsSync(filePath)) {
      const backupPath = filePath + '.bak.' + Date.now();
      fs.copyFileSync(filePath, backupPath);
      console.log(`[INFO] 已备份原游戏文件: ${backupPath}`);
    }
    
    // 重新生成游戏文件
    const gameInfo = {
      title: game.title || '未命名游戏',
      authorName: game.author_name || '匿名用户',
      authorToken: game.author_token || '',
      createdAt: game.created_at
    };
    
    const success = saveGameStaticFile(id, game.code, gameInfo);
    
    if (success) {
      // 获取新文件大小
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      res.json({ 
        success: true, 
        message: '游戏文件已修复',
        fileSize: fileSize,
        gameTitle: game.title
      });
    } else {
      res.status(500).json({ success: false, error: '保存游戏文件失败' });
    }
  } catch (error) {
    console.error('[ERROR] 修复游戏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 下载游戏原始源码（AI直接返回的代码）
app.get('/api/admin/games/:id/source', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { id } = req.params;
    
    const game = db.prepare('SELECT id, title, code FROM games WHERE id = ?').get(id);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    if (!game.code) {
      return res.status(400).json({ success: false, error: '游戏源码为空' });
    }
    
    // 生成安全的文件名
    const safeTitle = (game.title || 'game').replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
    const filename = `${safeTitle}_${id.slice(0, 8)}.html`;
    
    // 设置下载响应头
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(game.code);
  } catch (error) {
    console.error('[ERROR] 下载源码失败:', error);
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
    const search = req.query.search?.trim() || '';
    
    let total, users;
    
    if (search) {
      // 搜索模式：按昵称、账号ID或Token搜索
      const searchPattern = `%${search}%`;
      
      total = db.prepare(`
        SELECT COUNT(*) as count 
        FROM user_credits uc
        LEFT JOIN user_accounts ua ON uc.user_token = ua.user_token
        WHERE uc.user_token LIKE ? 
           OR ua.account_id LIKE ? 
           OR ua.nickname LIKE ?
      `).get(searchPattern, searchPattern, searchPattern).count;
      
      users = db.prepare(`
        SELECT uc.user_token, uc.credits, uc.total_earned, uc.total_used, uc.followed_wechat, 
               uc.ad_count_today, uc.created_at, uc.updated_at,
               ua.account_id, ua.nickname
        FROM user_credits uc
        LEFT JOIN user_accounts ua ON uc.user_token = ua.user_token
        WHERE uc.user_token LIKE ? 
           OR ua.account_id LIKE ? 
           OR ua.nickname LIKE ?
        ORDER BY uc.created_at DESC 
        LIMIT ? OFFSET ?
      `).all(searchPattern, searchPattern, searchPattern, limit, offset);
    } else {
      // 正常模式
      total = db.prepare('SELECT COUNT(*) as count FROM user_credits').get().count;
      
      users = db.prepare(`
        SELECT uc.user_token, uc.credits, uc.total_earned, uc.total_used, uc.followed_wechat, 
               uc.ad_count_today, uc.created_at, uc.updated_at,
               ua.account_id, ua.nickname
        FROM user_credits uc
        LEFT JOIN user_accounts ua ON uc.user_token = ua.user_token
        ORDER BY uc.created_at DESC 
        LIMIT ? OFFSET ?
      `).all(limit, offset);
    }
    
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

// ==================== 封禁管理API ====================

// 封禁类型定义
const BAN_TYPES = {
  ACCESS: 'access',   // 禁止访问网站
  COMMENT: 'comment', // 禁止发言/评论
  CREATE: 'create'    // 禁止创作游戏
};

// 封禁账号表
const ensureBanTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS banned_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT UNIQUE NOT NULL,
      reason TEXT DEFAULT '违规',
      duration INTEGER,
      expire_at TEXT,
      hide_works INTEGER DEFAULT 0,
      hide_messages INTEGER DEFAULT 0,
      ban_types TEXT DEFAULT NULL,
      operator TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS banned_ips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT UNIQUE NOT NULL,
      reason TEXT DEFAULT '违规',
      duration INTEGER,
      expire_at TEXT,
      ban_types TEXT DEFAULT NULL,
      operator TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 尝试添加 ban_types 列（如果表已存在）
  try {
    db.exec(`ALTER TABLE banned_accounts ADD COLUMN ban_types TEXT DEFAULT NULL`);
    console.log('[DB] 为 banned_accounts 添加 ban_types 列');
  } catch (e) {
    // 列已存在，忽略
  }
  try {
    db.exec(`ALTER TABLE banned_ips ADD COLUMN ban_types TEXT DEFAULT NULL`);
    console.log('[DB] 为 banned_ips 添加 ban_types 列');
  } catch (e) {
    // 列已存在，忽略
  }
  
  // DevTools 白名单表
  db.exec(`
    CREATE TABLE IF NOT EXISTS devtools_whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 默认将 localhost 和 127.0.0.1 加入白名单
  const defaultIPs = ['127.0.0.1', 'localhost', '::1'];
  for (const ip of defaultIPs) {
    try {
      db.prepare(`INSERT OR IGNORE INTO devtools_whitelist (type, value) VALUES ('ip', ?)`).run(ip);
    } catch (e) {
      // 已存在，忽略
    }
  }
  console.log('[DB] DevTools白名单表已初始化，默认白名单IP: 127.0.0.1, localhost, ::1');
  
  // CORS 白名单表
  db.exec(`
    CREATE TABLE IF NOT EXISTS cors_whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      origin TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 默认CORS白名单
  const defaultOrigins = [
    { origin: '*', description: '允许所有来源（开发环境）' },
    { origin: 'http://127.0.0.1', description: '本地开发' },
    { origin: 'http://127.0.0.1:80', description: '本地开发(80端口)' },
    { origin: 'http://127.0.0.1:3000', description: '本地开发(3000端口)' },
    { origin: 'http://localhost', description: '本地开发' },
    { origin: 'http://localhost:80', description: '本地开发(80端口)' },
    { origin: 'http://localhost:3000', description: '本地开发(3000端口)' }
  ];
  for (const item of defaultOrigins) {
    try {
      db.prepare(`INSERT OR IGNORE INTO cors_whitelist (origin, description) VALUES (?, ?)`).run(item.origin, item.description);
    } catch (e) {
      // 已存在，忽略
    }
  }
  console.log('[DB] CORS白名单表已初始化');
};
ensureBanTables();

// ==================== CORS白名单函数 ====================

// 获取CORS白名单（供安全模块使用）
function getCorsWhitelist() {
  try {
    const origins = db.prepare(`SELECT origin FROM cors_whitelist`).all().map(r => r.origin);
    return origins;
  } catch (error) {
    console.error('[ERROR] 获取CORS白名单失败:', error);
    return ['*']; // 出错时返回允许所有
  }
}

// ==================== 封禁检查函数 ====================

// 标准化IP地址（处理IPv6映射的IPv4地址）
function normalizeIP(ip) {
  if (!ip) return 'unknown';
  // 移除 ::ffff: 前缀（IPv6映射的IPv4地址）
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  // 将IPv6 localhost转换为IPv4 localhost
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip;
}

// 获取客户端真实IP（已标准化）
function getClientIP(req) {
  let ip;
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    ip = forwarded.split(',')[0].trim();
  } else {
    ip = req.headers['x-real-ip'] || req.connection?.remoteAddress || req.ip || 'unknown';
  }
  // 标准化IP地址
  return normalizeIP(ip);
}

// 检查账号是否被封禁
function checkAccountBanned(accountId) {
  if (!accountId) return null;
  
  try {
    const ban = db.prepare(`
      SELECT account_id, reason, expire_at, ban_types
      FROM banned_accounts 
      WHERE account_id = ? AND (expire_at IS NULL OR expire_at > datetime('now'))
    `).get(accountId);
    
    if (ban && ban.ban_types) {
      try {
        ban.banTypes = JSON.parse(ban.ban_types);
      } catch (e) {
        ban.banTypes = null;
      }
    }
    
    return ban || null;
  } catch (e) {
    console.error('[ERROR] 检查账号封禁状态失败:', e);
    return null;
  }
}

// 检查账号是否被封禁某种类型
function checkAccountBannedForType(accountId, banType) {
  const ban = checkAccountBanned(accountId);
  if (!ban) return false;
  
  // 如果没有指定封禁类型，视为全部禁止
  if (!ban.banTypes || ban.banTypes.length === 0) return true;
  
  return ban.banTypes.includes(banType);
}

// 检查IP是否被封禁
function checkIPBanned(ip) {
  if (!ip || ip === 'unknown') return null;
  
  // 标准化IP地址
  const normalizedIP = normalizeIP(ip);
  console.log(`[IP CHECK] 原始IP: ${ip}, 标准化IP: ${normalizedIP}`);
  
  try {
    // 同时检查原始IP和标准化IP
    const ban = db.prepare(`
      SELECT ip, reason, expire_at, ban_types
      FROM banned_ips 
      WHERE (ip = ? OR ip = ?) AND (expire_at IS NULL OR expire_at > datetime('now'))
    `).get(ip, normalizedIP);
    
    // 调试：列出所有封禁的IP
    const allBannedIPs = db.prepare('SELECT ip FROM banned_ips').all();
    console.log(`[IP CHECK] 当前封禁IP列表:`, allBannedIPs.map(b => b.ip));
    
    if (ban && ban.ban_types) {
      try {
        ban.banTypes = JSON.parse(ban.ban_types);
      } catch (e) {
        ban.banTypes = null;
      }
    }
    
    return ban || null;
  } catch (e) {
    console.error('[ERROR] 检查IP封禁状态失败:', e);
    return null;
  }
}

// 检查IP是否被封禁某种类型
function checkIPBannedForType(ip, banType) {
  const ban = checkIPBanned(ip);
  if (!ban) return false;
  
  // 如果没有指定封禁类型，视为全部禁止
  if (!ban.banTypes || ban.banTypes.length === 0) return true;
  
  return ban.banTypes.includes(banType);
}

// 通过用户Token获取账号ID
function getAccountIdByToken(userToken) {
  if (!userToken) return null;
  
  try {
    const user = db.prepare('SELECT account_id FROM user_accounts WHERE user_token = ?').get(userToken);
    return user?.account_id || null;
  } catch (e) {
    console.error('[ERROR] getAccountIdByToken 失败:', e.message);
    return null;
  }
}

// 综合封禁检查（检查账号和IP）
// banTypeToCheck: 可选，指定要检查的封禁类型 (access/comment/create)，不指定则检查任意封禁
function checkBanStatus(req, banTypeToCheck = null) {
  const userToken = req.headers['x-user-token'] || null;
  const accountId = getAccountIdByToken(userToken);
  const clientIP = getClientIP(req);
  
  console.log(`[BAN CHECK] userToken: ${userToken?.substring(0,8)}..., accountId: ${accountId}, IP: ${clientIP}, checkType: ${banTypeToCheck || 'any'}`);
  
  // 检查账号封禁
  if (accountId) {
    const accountBan = checkAccountBanned(accountId);
    console.log(`[BAN CHECK] 账号封禁检查结果:`, accountBan);
    if (accountBan) {
      // 如果指定了检查类型，只检查该类型
      if (banTypeToCheck) {
        const isBannedForType = !accountBan.banTypes || accountBan.banTypes.length === 0 || accountBan.banTypes.includes(banTypeToCheck);
        if (isBannedForType) {
          return {
            banned: true,
            type: 'account',
            banTypes: accountBan.banTypes || [BAN_TYPES.ACCESS, BAN_TYPES.COMMENT, BAN_TYPES.CREATE],
            reason: accountBan.reason || '账号已被封禁',
            expireAt: accountBan.expire_at
          };
        }
      } else {
        // 不指定类型，有封禁就返回
        return {
          banned: true,
          type: 'account',
          banTypes: accountBan.banTypes || [BAN_TYPES.ACCESS, BAN_TYPES.COMMENT, BAN_TYPES.CREATE],
          reason: accountBan.reason || '账号已被封禁',
          expireAt: accountBan.expire_at
        };
      }
    }
  }
  
  // 检查IP封禁
  const ipBan = checkIPBanned(clientIP);
  console.log(`[BAN CHECK] IP封禁检查结果:`, ipBan);
  if (ipBan) {
    // 如果指定了检查类型，只检查该类型
    if (banTypeToCheck) {
      const isBannedForType = !ipBan.banTypes || ipBan.banTypes.length === 0 || ipBan.banTypes.includes(banTypeToCheck);
      if (isBannedForType) {
        return {
          banned: true,
          type: 'ip',
          banTypes: ipBan.banTypes || [BAN_TYPES.ACCESS, BAN_TYPES.COMMENT, BAN_TYPES.CREATE],
          reason: ipBan.reason || 'IP已被封禁',
          expireAt: ipBan.expire_at
        };
      }
    } else {
      return {
        banned: true,
        type: 'ip',
        banTypes: ipBan.banTypes || [BAN_TYPES.ACCESS, BAN_TYPES.COMMENT, BAN_TYPES.CREATE],
        reason: ipBan.reason || 'IP已被封禁',
        expireAt: ipBan.expire_at
      };
    }
  }
  
  return { banned: false };
}

// 前端检查封禁状态API
app.get('/api/check-ban', (req, res) => {
  const banStatus = checkBanStatus(req);
  res.json(banStatus);
});

// 用户状态检查API（用于前端安全检查）
app.get('/api/user/status', (req, res) => {
  try {
    const clientIP = getClientIP(req);
    const userToken = req.headers['x-user-token'] || null;
    
    // 通过 token 获取账号ID
    let accountId = null;
    if (userToken) {
      accountId = getAccountIdByToken(userToken);
    }
    
    let result = {
      success: true,
      ip: clientIP,
      accountId: accountId,
      banned: false,
      banReason: null,
      banExpireAt: null,
      banTypes: null,
      allowDevTools: false
    };
    
    // 检查IP是否被封禁
    const ipBan = checkIPBanned(clientIP);
    if (ipBan) {
      result.banned = true;
      result.banType = 'ip';
      result.banReason = ipBan.reason;
      result.banExpireAt = ipBan.expire_at;
      result.banTypes = ipBan.banTypes || null;
    }
    
    // 检查账号是否被封禁
    if (accountId && !result.banned) {
      const accountBan = checkAccountBanned(accountId);
      if (accountBan) {
        result.banned = true;
        result.banType = 'account';
        result.banReason = accountBan.reason;
        result.banExpireAt = accountBan.expire_at;
        result.banTypes = accountBan.banTypes || null;
      }
    }
    
    // 检查是否在DevTools白名单中
    try {
      const whitelist = db.prepare(`
        SELECT value FROM devtools_whitelist 
        WHERE (type = 'account' AND value = ?) OR (type = 'ip' AND value = ?)
      `).get(accountId || '', clientIP);
      result.allowDevTools = !!whitelist;
    } catch (e) {
      result.allowDevTools = false;
    }
    
    console.log(`[USER STATUS] IP: ${clientIP}, accountId: ${accountId}, token: ${userToken ? userToken.substring(0,8) + '...' : 'none'}, banned: ${result.banned}`);
    res.json(result);
  } catch (error) {
    console.error('[ERROR] 用户状态检查失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取封禁列表
app.get('/api/admin/ban', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const type = req.query.type || 'all';
    let result = {};
    
    if (type === 'all' || type === 'accounts') {
      const accounts = db.prepare(`
        SELECT account_id as accountId, reason, duration, expire_at as expireAt, 
               hide_works as hideWorks, hide_messages as hideMessages, 
               ban_types as banTypesJson,
               operator, created_at as createdAt
        FROM banned_accounts 
        WHERE expire_at IS NULL OR expire_at > datetime('now')
      `).all();
      // 解析 banTypes JSON
      result.bannedAccounts = accounts.map(a => {
        let banTypes = null;
        if (a.banTypesJson) {
          try {
            banTypes = JSON.parse(a.banTypesJson);
          } catch (e) {}
        }
        delete a.banTypesJson;
        return { ...a, banTypes };
      });
    }
    
    if (type === 'all' || type === 'ips') {
      const ips = db.prepare(`
        SELECT ip, reason, duration, expire_at as expireAt, 
               ban_types as banTypesJson,
               operator, created_at as createdAt
        FROM banned_ips 
        WHERE expire_at IS NULL OR expire_at > datetime('now')
      `).all();
      // 解析 banTypes JSON
      result.bannedIPs = ips.map(b => {
        let banTypes = null;
        if (b.banTypesJson) {
          try {
            banTypes = JSON.parse(b.banTypesJson);
          } catch (e) {}
        }
        delete b.banTypesJson;
        return { ...b, banTypes };
      });
    }
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[ERROR] 获取封禁列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加封禁
app.post('/api/admin/ban', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { type, target, reason, duration, hideWorks, hideMessages, banTypes } = req.body;
    
    if (!type || !target) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    const now = new Date();
    const expireAt = duration ? new Date(now.getTime() + duration * 60 * 1000).toISOString() : null;
    // 将 banTypes 数组转换为 JSON 字符串存储
    const banTypesJson = banTypes && banTypes.length > 0 ? JSON.stringify(banTypes) : null;
    
    // 生成封禁类型描述
    const banTypeLabels = {
      'access': '禁止访问',
      'comment': '禁止发言',
      'create': '禁止创作'
    };
    const banTypeDesc = banTypes && banTypes.length > 0 
      ? banTypes.map(t => banTypeLabels[t] || t).join('、')
      : '全部禁止';
    
    if (type === 'account') {
      db.prepare(`
        INSERT OR REPLACE INTO banned_accounts (account_id, reason, duration, expire_at, hide_works, hide_messages, ban_types)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(target, reason || '违规', duration || null, expireAt, hideWorks ? 1 : 0, hideMessages ? 1 : 0, banTypesJson);
      
      res.json({ success: true, message: `账号 ${target} 已被封禁（${banTypeDesc}）` });
    } else if (type === 'ip') {
      db.prepare(`
        INSERT OR REPLACE INTO banned_ips (ip, reason, duration, expire_at, ban_types)
        VALUES (?, ?, ?, ?, ?)
      `).run(target, reason || '违规', duration || null, expireAt, banTypesJson);
      
      res.json({ success: true, message: `IP ${target} 已被封禁（${banTypeDesc}）` });
    } else {
      return res.status(400).json({ success: false, error: '无效的封禁类型' });
    }
  } catch (error) {
    console.error('[ERROR] 封禁操作失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 解除封禁
app.delete('/api/admin/ban', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { type, target } = req.body;
    
    if (!type || !target) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    if (type === 'account') {
      db.prepare('DELETE FROM banned_accounts WHERE account_id = ?').run(target);
      res.json({ success: true, message: `账号 ${target} 已解封` });
    } else if (type === 'ip') {
      db.prepare('DELETE FROM banned_ips WHERE ip = ?').run(target);
      res.json({ success: true, message: `IP ${target} 已解封` });
    } else {
      return res.status(400).json({ success: false, error: '无效的类型' });
    }
  } catch (error) {
    console.error('[ERROR] 解封操作失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 管理员留言管理API ====================

// 获取留言列表（管理员）
app.get('/api/admin/comments', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const keyword = req.query.keyword || '';
    const status = req.query.status || 'all'; // all, active, deleted
    
    // 构建查询条件
    let whereClause = '1=1';
    const params = [];
    
    if (status === 'active') {
      whereClause += ' AND c.is_deleted = 0';
    } else if (status === 'deleted') {
      whereClause += ' AND c.is_deleted = 1';
    }
    
    if (keyword) {
      whereClause += ' AND (c.content LIKE ? OR c.author_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    // 获取总数
    const totalQuery = `SELECT COUNT(*) as count FROM game_comments c WHERE ${whereClause}`;
    const total = db.prepare(totalQuery).get(...params).count;
    
    // 获取留言列表，关联游戏标题
    const commentsQuery = `
      SELECT c.*, g.title as game_title
      FROM game_comments c
      LEFT JOIN games g ON c.game_id = g.id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const comments = db.prepare(commentsQuery).all(...params, limit, offset);
    
    // 获取统计数据
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_deleted = 1 THEN 1 ELSE 0 END) as deleted,
        SUM(CASE WHEN date(created_at) = date('now') AND is_deleted = 0 THEN 1 ELSE 0 END) as today
      FROM game_comments
    `;
    const stats = db.prepare(statsQuery).get();
    
    res.json({
      success: true,
      comments,
      stats: {
        total: stats.total || 0,
        active: stats.active || 0,
        deleted: stats.deleted || 0,
        today: stats.today || 0
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取留言列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除留言（管理员软删除）
app.delete('/api/admin/comments/:commentId', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { commentId } = req.params;
    
    const result = db.prepare(`
      UPDATE game_comments SET is_deleted = 1 WHERE id = ?
    `).run(commentId);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '留言不存在' });
    }
    
    res.json({ success: true, message: '留言已删除' });
  } catch (error) {
    console.error('删除留言失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 恢复留言（管理员）
app.post('/api/admin/comments/:commentId/restore', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { commentId } = req.params;
    
    const result = db.prepare(`
      UPDATE game_comments SET is_deleted = 0 WHERE id = ?
    `).run(commentId);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '留言不存在' });
    }
    
    res.json({ success: true, message: '留言已恢复' });
  } catch (error) {
    console.error('恢复留言失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 彻底删除留言（管理员）
app.delete('/api/admin/comments/:commentId/permanent', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { commentId } = req.params;
    
    const result = db.prepare(`
      DELETE FROM game_comments WHERE id = ?
    `).run(commentId);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '留言不存在' });
    }
    
    res.json({ success: true, message: '留言已彻底删除' });
  } catch (error) {
    console.error('彻底删除留言失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 前端排行榜API ====================

// 获取推荐榜（管理员推荐）
app.get('/api/leaderboard/featured', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const games = db.prepare(`
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
      FROM games g
      WHERE g.is_featured = 1 AND g.is_hidden = 0
      ORDER BY g.updated_at DESC, g.like_count DESC
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
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
      FROM games g
      WHERE g.is_hidden = 0 AND (g.is_public = 1 OR g.is_public IS NULL)
      ORDER BY g.favorite_count DESC, g.like_count DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    res.json({ success: true, games });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取评论榜（按评论数排序）
app.get('/api/leaderboard/comments', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    // 按评论数排序
    const games = db.prepare(`
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
      FROM games g
      WHERE g.is_hidden = 0 AND (g.is_public = 1 OR g.is_public IS NULL)
      ORDER BY comment_count DESC, g.created_at DESC
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
    const orientation = req.query.orientation || 'all';
    const search = req.query.search?.trim() || '';
    
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
    
    // 构建搜索条件
    let searchWhere = '';
    const params = [];
    
    if (search) {
      searchWhere = `AND (g.title LIKE ? OR g.prompt LIKE ? OR g.author_name LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    // 构建分类条件
    let categoryWhere = '';
    
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
    
    // 构建方向筛选条件
    let orientationWhere = '';
    if (orientation && orientation !== 'all') {
      orientationWhere = `AND (orientation = ? OR (orientation IS NULL AND ? = 'portrait'))`;
      params.push(orientation, orientation);
    }
    
    // 获取总数（排除草稿和私密）
    const countSql = `SELECT COUNT(*) as total FROM games g WHERE g.is_hidden = 0 AND (g.is_public = 1 OR g.is_public IS NULL) AND COALESCE(g.status, 'published') = 'published' ${searchWhere} ${categoryWhere} ${orientationWhere}`;
    const totalResult = db.prepare(countSql).get(...params);
    const total = totalResult ? totalResult.total : 0;
    
    // 获取游戏列表（排除草稿和私密）
    const sql = `
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at, g.orientation,
             (g.play_count + g.like_count * 5 + g.favorite_count * 3) as hot_score,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
      FROM games g
      WHERE g.is_hidden = 0 AND (g.is_public = 1 OR g.is_public IS NULL) AND COALESCE(g.status, 'published') = 'published' ${searchWhere} ${categoryWhere.replace(/title/g, 'g.title').replace(/prompt/g, 'g.prompt')} ${orientationWhere.replace(/orientation/g, 'g.orientation')}
      ORDER BY ${orderBy.replace(/play_count/g, 'g.play_count').replace(/like_count/g, 'g.like_count').replace(/favorite_count/g, 'g.favorite_count').replace(/created_at/g, 'g.created_at')}
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
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at,
             (g.play_count + g.like_count * 5 + g.favorite_count * 3) as score,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
      FROM games g
      WHERE g.is_hidden = 0 AND (g.is_public = 1 OR g.is_public IS NULL)
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
      SELECT id, title, author_name, play_count, like_count, favorite_count, created_at 
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
        favoriteCount: game.favorite_count || 0,
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
        (g.play_count + g.like_count * 5 + COALESCE(s.share_count, 0) * 3) as hot_score,
        (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) as comment_count
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

// ==================== DevTools 白名单管理 ====================

// 获取 DevTools 白名单
app.get('/api/admin/devtools', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const accounts = db.prepare(`SELECT value FROM devtools_whitelist WHERE type = 'account'`).all().map(r => r.value);
    const ips = db.prepare(`SELECT value FROM devtools_whitelist WHERE type = 'ip'`).all().map(r => r.value);
    
    res.json({
      success: true,
      whitelist: { accounts, ips }
    });
  } catch (error) {
    console.error('[ERROR] 获取DevTools白名单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加到 DevTools 白名单
app.put('/api/admin/devtools', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { type, value } = req.body;
    
    if (!type || !value) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }
    
    if (type !== 'account' && type !== 'ip') {
      return res.status(400).json({ success: false, error: '无效的类型' });
    }
    
    db.prepare(`INSERT OR IGNORE INTO devtools_whitelist (type, value) VALUES (?, ?)`).run(type, value.trim());
    
    // 返回更新后的白名单
    const accounts = db.prepare(`SELECT value FROM devtools_whitelist WHERE type = 'account'`).all().map(r => r.value);
    const ips = db.prepare(`SELECT value FROM devtools_whitelist WHERE type = 'ip'`).all().map(r => r.value);
    
    res.json({
      success: true,
      message: '已添加到白名单',
      whitelist: { accounts, ips }
    });
  } catch (error) {
    console.error('[ERROR] 添加DevTools白名单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 从 DevTools 白名单移除
app.delete('/api/admin/devtools', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { type, value } = req.body;
    
    if (!type || !value) {
      return res.status(400).json({ success: false, error: '缺少参数' });
    }
    
    db.prepare(`DELETE FROM devtools_whitelist WHERE type = ? AND value = ?`).run(type, value.trim());
    
    // 返回更新后的白名单
    const accounts = db.prepare(`SELECT value FROM devtools_whitelist WHERE type = 'account'`).all().map(r => r.value);
    const ips = db.prepare(`SELECT value FROM devtools_whitelist WHERE type = 'ip'`).all().map(r => r.value);
    
    res.json({
      success: true,
      message: '已从白名单移除',
      whitelist: { accounts, ips }
    });
  } catch (error) {
    console.error('[ERROR] 移除DevTools白名单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CORS 白名单管理 ====================

// 获取 CORS 白名单
app.get('/api/admin/cors', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const origins = db.prepare(`SELECT id, origin, description, created_at FROM cors_whitelist ORDER BY created_at DESC`).all();
    
    res.json({
      success: true,
      origins
    });
  } catch (error) {
    console.error('[ERROR] 获取CORS白名单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加到 CORS 白名单
app.put('/api/admin/cors', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { origin, description } = req.body;
    
    if (!origin) {
      return res.status(400).json({ success: false, error: '缺少origin参数' });
    }
    
    // 验证origin格式（允许*或http/https开头的URL）
    const trimmedOrigin = origin.trim();
    if (trimmedOrigin !== '*' && !trimmedOrigin.match(/^https?:\/\//)) {
      return res.status(400).json({ success: false, error: 'Origin格式无效，应为 * 或以 http:// 或 https:// 开头' });
    }
    
    db.prepare(`INSERT OR IGNORE INTO cors_whitelist (origin, description) VALUES (?, ?)`).run(trimmedOrigin, description || '');
    
    // 返回更新后的白名单
    const origins = db.prepare(`SELECT id, origin, description, created_at FROM cors_whitelist ORDER BY created_at DESC`).all();
    
    res.json({
      success: true,
      message: '已添加到CORS白名单',
      origins
    });
  } catch (error) {
    console.error('[ERROR] 添加CORS白名单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 从 CORS 白名单移除
app.delete('/api/admin/cors', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { origin } = req.body;
    
    if (!origin) {
      return res.status(400).json({ success: false, error: '缺少origin参数' });
    }
    
    db.prepare(`DELETE FROM cors_whitelist WHERE origin = ?`).run(origin.trim());
    
    // 返回更新后的白名单
    const origins = db.prepare(`SELECT id, origin, description, created_at FROM cors_whitelist ORDER BY created_at DESC`).all();
    
    res.json({
      success: true,
      message: '已从CORS白名单移除',
      origins
    });
  } catch (error) {
    console.error('[ERROR] 移除CORS白名单失败:', error);
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
      SELECT id, title, prompt, code, author_name, author_token, created_at 
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
          authorToken: game.author_token,
          created_at: game.created_at
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

// ==================== 安全审计日志 API ====================

// 获取安全审计日志（管理员）
app.get('/api/admin/security-logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = security.getAuditLogs(limit);
    
    res.json({
      success: true,
      logs: logs,
      total: logs.length
    });
  } catch (error) {
    console.error('[ERROR] 获取安全日志失败:', error.message);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取安全状态概览（管理员）
app.get('/api/admin/security-status', (req, res) => {
  try {
    const recentLogs = security.getAuditLogs(1000);
    
    // 统计各类安全事件
    const stats = {
      total: recentLogs.length,
      byType: {},
      last24h: 0,
      blockedRequests: 0
    };
    
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    for (const log of recentLogs) {
      // 按类型统计
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
      
      // 24小时内的事件
      if (new Date(log.timestamp).getTime() > oneDayAgo) {
        stats.last24h++;
      }
      
      // 被阻止的请求
      if (['PATH_TRAVERSAL_BLOCKED', 'ATTACK_PATTERN_DETECTED', 'ADMIN_AUTH_FAILED'].includes(log.type)) {
        stats.blockedRequests++;
      }
    }
    
    res.json({
      success: true,
      stats: stats,
      securityModuleActive: true,
      features: {
        helmet: true,
        rateLimiting: true,
        xssProtection: true,
        inputValidation: true,
        auditLogging: true,
        adminProtection: true,
        bcryptPasswords: true
      }
    });
  } catch (error) {
    console.error('[ERROR] 获取安全状态失败:', error.message);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// ==================== 服务器启动 ====================

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🎮 AI游戏工坊服务器启动成功！`);
  console.log(`========================================`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`🔒 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n✅ 安全模块已激活:`);
  console.log(`   - Helmet 安全头`);
  console.log(`   - API 速率限制`);
  console.log(`   - XSS 防护`);
  console.log(`   - 路径遍历防护`);
  console.log(`   - 攻击模式检测`);
  console.log(`   - 管理员登录保护`);
  console.log(`   - 安全审计日志`);
  console.log(`   - bcrypt 密码哈希`);
  console.log(`========================================\n`);
  
  // 记录启动事件
  security.logSecurityEvent({
    type: 'SERVER_STARTED',
    details: `Port: ${PORT}, Env: ${process.env.NODE_ENV || 'development'}`
  });
  
  // 启动后延迟生成静态文件（避免阻塞启动）
  setTimeout(() => {
    generateAllStaticFiles();
  }, 3000);
});
