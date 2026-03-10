require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ==================== 安全模块引入 ====================
const security = require('./security');

// ==================== 微信小程序工具模块 ====================
const wechatUtils = require('./api/_lib/wechat');

// ==================== 平台检测工具 ====================
// 判断请求是否来自小程序（小程序请求不消耗积分）
function isMiniProgramRequest(req) {
  const platform = req.headers['x-platform'];
  return platform === 'miniprogram';
}

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

// ==================== 游戏数据字段别名处理 ====================
// 为游戏数据添加兼容性字段别名，同时支持 like_count/likes 等格式
function addGameFieldAliases(game) {
  if (!game) return game;
  return {
    ...game,
    // 添加短名称别名
    likes: game.like_count || 0,
    plays: game.play_count || 0,
    favorites: game.favorite_count || 0,
    comments: game.comment_count || 0,
    views: game.play_count || 0  // 兼容 views 字段
  };
}

// 批量处理游戏数组
function addGamesFieldAliases(games) {
  if (!Array.isArray(games)) return games;
  return games.map(addGameFieldAliases);
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
    
    console.log(`[INFO] saveGameStaticFile 被调用: gameId=${gameId}, gameInfo=`, JSON.stringify({
      title: gameInfo.title,
      authorName: gameInfo.authorName,
      authorToken: gameInfo.authorToken ? '***' : '(empty)',
      prompt: gameInfo.prompt?.substring(0, 50)
    }));
    
    // 生成独立页面HTML
    const standaloneHtml = generateStandaloneGameHtml(gameCode, {
      ...gameInfo,
      gameId
    });
    
    // 检查生成的 HTML 是否包含平台 UI
    const hasPlatformUI = standaloneHtml.includes('tiktok-sidebar') && standaloneHtml.includes('yxj-promo-bar');
    console.log(`[INFO] 生成的 HTML 长度: ${standaloneHtml.length}, 包含平台UI: ${hasPlatformUI}`);
    
    // 写入文件
    const filePath = getGameFilePath(gameId);
    fs.writeFileSync(filePath, standaloneHtml, 'utf-8');
    
    console.log(`[INFO] 游戏静态文件已保存: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] 保存游戏静态文件失败: ${error.message}`);
    console.error(error.stack);
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
  
  // 移除已有的平台 UI 元素（防止编辑保存时重复添加）
  // 使用标记注释来精确匹配和移除
  bodyContent = bodyContent.replace(/<!-- YXJ-PLATFORM-UI-START -->[\s\S]*?<!-- YXJ-PLATFORM-UI-END -->/gi, '');
  // 移除平台 UI 相关的样式
  headContent = headContent.replace(/<!-- YXJ-PLATFORM-STYLE-START -->[\s\S]*?<!-- YXJ-PLATFORM-STYLE-END -->/gi, '');
  // 移除平台 UI 相关的脚本
  bodyContent = bodyContent.replace(/<!-- YXJ-PLATFORM-SCRIPT-START -->[\s\S]*?<!-- YXJ-PLATFORM-SCRIPT-END -->/gi, '');
  
  // 底部推广栏的样式和HTML（会注入到游戏页面底部）
  const promoBarStyle = `
/* ====== 平台组件样式重置 - 防止被游戏源码覆盖 ====== */
/* 重置所有平台按钮的基础样式，确保不受游戏全局button样式影响 */
.yxj-promo-home,
.yxj-promo-close,
.tiktok-follow-btn,
.tiktok-icon,
.tiktok-action,
.comments-close-btn,
.comments-input-area button,
.fullscreen-exit-btn,
.comment-delete-btn,
#promo-modal button,
#share-panel button,
#author-profile-modal button,
#comments-load-more-btn,
#game-comment-submit {
  min-width: auto !important;
  max-width: none !important;
  width: auto !important;
  height: auto !important;
  margin: 0 !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  box-sizing: border-box !important;
  text-transform: none !important;
  letter-spacing: normal !important;
}

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
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: center !important;
  gap: 1px !important;
  min-height: 32px !important;
}
.tiktok-author-name-row {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
.tiktok-author-name {
  color: white !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8) !important;
  cursor: pointer !important;
  transition: opacity 0.2s !important;
  line-height: 1.2 !important;
}
.tiktok-author-name:hover {
  opacity: 0.8 !important;
}
.tiktok-publish-time {
  color: rgba(255, 255, 255, 0.6) !important;
  font-size: 0.6875rem !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8) !important;
  margin-top: 0 !important;
  text-align: left !important;
  display: block !important;
  line-height: 1.2 !important;
  width: auto !important;
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
#stat-edit-btn {
  display: none !important;
}
#stat-edit-btn.visible {
  display: flex !important;
}
#stat-repair-btn {
  display: none !important;
}
#stat-repair-btn.visible {
  display: flex !important;
}
#stat-repair-btn .tiktok-icon {
  background: rgba(16, 185, 129, 0.3) !important;
  border-color: rgba(16, 185, 129, 0.5) !important;
}
#stat-repair-btn:hover .tiktok-icon {
  background: rgba(16, 185, 129, 0.5) !important;
  border-color: rgba(16, 185, 129, 0.8) !important;
}
#stat-repair-btn.repairing .tiktok-icon {
  animation: repairSpin 1s linear infinite !important;
  background: rgba(16, 185, 129, 0.5) !important;
}
@keyframes repairSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
/* ====== 全屏模式样式 ====== */
body.fullscreen-mode {
  padding-bottom: 0 !important;
  overflow: hidden !important;
}
body.fullscreen-mode .tiktok-sidebar {
  display: none !important;
}
body.fullscreen-mode .tiktok-author-info {
  display: none !important;
}
body.fullscreen-mode .yxj-promo-home {
  display: none !important;
}
body.fullscreen-mode .yxj-promo-bar {
  display: none !important;
}
body.fullscreen-mode .game-comments-section {
  display: none !important;
}
body.fullscreen-mode .comments-overlay {
  display: none !important;
}
body.fullscreen-mode #share-panel {
  display: none !important;
}
body.fullscreen-mode #promo-modal {
  display: none !important;
}
body.fullscreen-mode #author-profile-modal {
  display: none !important;
}
/* 全屏退出按钮 */
.fullscreen-exit-btn {
  position: fixed !important;
  top: 10px !important;
  left: 10px !important;
  width: 40px !important;
  height: 40px !important;
  border-radius: 50% !important;
  border: none !important;
  background: rgba(0, 0, 0, 0.5) !important;
  color: #fff !important;
  font-size: 18px !important;
  cursor: pointer !important;
  z-index: 999999 !important;
  display: none !important;
  align-items: center !important;
  justify-content: center !important;
  opacity: 0.4 !important;
  transition: opacity 0.3s ease, background 0.2s ease !important;
}
.fullscreen-exit-btn:hover {
  opacity: 1 !important;
  background: rgba(239, 68, 68, 0.9) !important;
}
body.fullscreen-mode .fullscreen-exit-btn {
  display: flex !important;
}
/* 为推广栏预留底部空间 */
body {
  padding-bottom: 36px !important;
}
/* ====== 留言板样式 - 未来科技风 ====== */
.comments-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: rgba(0, 0, 0, 0.7) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
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
  bottom: 36px !important;
  left: 0 !important;
  right: 0 !important;
  background: linear-gradient(180deg, #0e0e18 0%, #12121e 100%) !important;
  z-index: 999997 !important;
  max-height: 0 !important;
  overflow: hidden !important;
  transition: max-height 0.3s ease !important;
  box-shadow: 0 -4px 30px rgba(0, 240, 255, 0.15), 0 -1px 0 rgba(0, 240, 255, 0.3) !important;
  border-radius: 20px 20px 0 0 !important;
  border-top: 1px solid rgba(0, 240, 255, 0.3) !important;
  display: flex !important;
  flex-direction: column !important;
}
.game-comments-section.expanded {
  max-height: 70vh !important;
}
.comments-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 14px 16px !important;
  border-bottom: 1px solid rgba(0, 240, 255, 0.15) !important;
  background: linear-gradient(180deg, rgba(0, 240, 255, 0.08) 0%, transparent 100%) !important;
  flex-shrink: 0 !important;
}
.comments-title {
  font-size: 16px !important;
  font-weight: 600 !important;
  color: #e0e8ff !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.5) !important;
}
.comments-close-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-radius: 50% !important;
  width: 28px !important;
  height: 28px !important;
  font-size: 16px !important;
  cursor: pointer !important;
  color: #8090b0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s ease !important;
}
.comments-close-btn:hover {
  background: rgba(255, 51, 102, 0.2) !important;
  border-color: rgba(255, 51, 102, 0.5) !important;
  color: #ff3366 !important;
}
.comments-body {
  padding: 12px 16px !important;
}
.comment-item {
  padding: 12px !important;
  margin-bottom: 10px !important;
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  border-radius: 12px !important;
  transition: all 0.2s ease !important;
}
.comment-item:hover {
  background: rgba(0, 240, 255, 0.05) !important;
  border-color: rgba(0, 240, 255, 0.15) !important;
}
.comment-item:last-child {
  margin-bottom: 0 !important;
}
.comment-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  margin-bottom: 8px !important;
}
.comment-author-info {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
.comment-avatar {
  width: 32px !important;
  height: 32px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #00f0ff 0%, #bf00ff 100%) !important;
  color: #fff !important;
  font-size: 13px !important;
  font-weight: 600 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.4) !important;
}
.comment-author-name {
  font-weight: 600 !important;
  color: #00f0ff !important;
  font-size: 14px !important;
}
.comment-time {
  color: #5a6a8a !important;
  font-size: 12px !important;
}
.comment-content {
  color: #e0e8ff !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  word-break: break-word !important;
}
.comment-delete-btn {
  background: none !important;
  border: none !important;
  color: #5a6a8a !important;
  font-size: 12px !important;
  cursor: pointer !important;
  padding: 4px 10px !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}
.comment-delete-btn:hover {
  color: #ff3366 !important;
  background: rgba(255, 51, 102, 0.1) !important;
}
.comment-avatar.comment-clickable,
.comment-author-name.comment-clickable {
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}
.comment-avatar.comment-clickable:hover {
  transform: scale(1.1) !important;
  box-shadow: 0 0 16px rgba(0, 240, 255, 0.6) !important;
}
.comment-author-name.comment-clickable:hover {
  color: #00d4e0 !important;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.5) !important;
}
.comments-input-area {
  display: flex !important;
  gap: 10px !important;
  padding: 12px 16px !important;
  border-top: 1px solid rgba(0, 240, 255, 0.15) !important;
  background: rgba(0, 0, 0, 0.3) !important;
  flex-shrink: 0 !important;
}
.comments-input-area textarea {
  flex: 1 !important;
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(0, 240, 255, 0.2) !important;
  border-radius: 10px !important;
  padding: 10px 14px !important;
  font-size: 14px !important;
  color: #e0e8ff !important;
  resize: none !important;
  height: 42px !important;
  min-height: 42px !important;
  transition: all 0.2s ease !important;
}
.comments-input-area textarea::placeholder {
  color: #5a6a8a !important;
}
.comments-input-area textarea:focus {
  outline: none !important;
  border-color: rgba(0, 240, 255, 0.5) !important;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.2) !important;
}
.comments-input-area button {
  background: linear-gradient(135deg, #00f0ff 0%, #00d4e0 100%) !important;
  color: #080810 !important;
  border: none !important;
  padding: 10px 20px !important;
  border-radius: 10px !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.4) !important;
  transition: all 0.2s ease !important;
}
.comments-input-area button:hover {
  background: linear-gradient(135deg, #00d4e0 0%, #00b8c4 100%) !important;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.6) !important;
  transform: translateY(-1px) !important;
}
.comments-input-area button:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
  box-shadow: none !important;
  transform: none !important;
}
.comments-login-hint {
  text-align: center !important;
  padding: 14px 16px !important;
  color: #8090b0 !important;
  font-size: 14px !important;
  border-top: 1px solid rgba(0, 240, 255, 0.15) !important;
  background: rgba(0, 0, 0, 0.3) !important;
  flex-shrink: 0 !important;
}
/* 评论加载状态提示 */
.comments-scroll-loading {
  text-align: center !important;
  padding: 12px !important;
  color: #5a6a8a !important;
  font-size: 13px !important;
}
/* 评论区滚动容器 */
.comments-body-wrapper {
  flex: 1 !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  display: flex !important;
  flex-direction: column !important;
  scrollbar-width: thin !important;
  scrollbar-color: rgba(0, 240, 255, 0.3) transparent !important;
}
.comments-body-wrapper::-webkit-scrollbar {
  width: 4px !important;
}
.comments-body-wrapper::-webkit-scrollbar-track {
  background: transparent !important;
}
.comments-body-wrapper::-webkit-scrollbar-thumb {
  background: rgba(0, 240, 255, 0.3) !important;
  border-radius: 2px !important;
}
/* 评论区空状态 */
.comments-empty {
  text-align: center !important;
  padding: 40px 20px !important;
  color: #5a6a8a !important;
}
.comments-empty-icon {
  font-size: 48px !important;
  margin-bottom: 12px !important;
  opacity: 0.6 !important;
}
.comments-empty-text {
  font-size: 14px !important;
  color: #8090b0 !important;
}

/* 用户主页弹窗样式覆盖 - 防止被游戏内置样式覆盖 */
#user-profile-modal .modal-content,
#follow-modal-game .modal-content {
  background: var(--bg-secondary, #1a1a2e) !important;
  border-radius: 12px !important;
  max-width: 500px !important;
  width: 90% !important;
  max-height: 85vh !important;
  overflow: hidden !important;
}
#user-profile-modal .modal-header,
#follow-modal-game .modal-header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: 1rem 1.25rem !important;
  border-bottom: 1px solid var(--border-color, #2d2d4a) !important;
  background: var(--bg-secondary, #1a1a2e) !important;
}
#user-profile-modal .modal-header h3,
#follow-modal-game .modal-header h3 {
  font-size: 1rem !important;
  font-weight: 600 !important;
  color: var(--text-primary, #e0e8ff) !important;
  margin: 0 !important;
}
/* 平台弹窗关闭按钮 - 使用 yxj- 前缀完全隔离游戏样式 */
.yxj-modal-close {
  all: unset !important;
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  color: var(--text-secondary, #888) !important;
  font-size: 1.5rem !important;
  cursor: pointer !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: auto !important;
  max-width: 32px !important;
  box-shadow: none !important;
  transition: background 0.2s !important;
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  line-height: 1 !important;
}
.yxj-modal-close:hover {
  background: var(--bg-hover, #2d2d4a) !important;
  color: var(--text-primary, #e0e8ff) !important;
  transform: none !important;
  box-shadow: none !important;
}
.yxj-modal-close:active {
  transform: scale(0.95) !important;
}
/* 平台弹窗按钮 - 使用 yxj- 前缀完全隔离游戏样式 */
.yxj-btn {
  all: unset !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0.5rem 1rem !important;
  font-size: 0.875rem !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  border: none !important;
  min-width: auto !important;
  box-shadow: none !important;
  transition: all 0.2s !important;
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  white-space: nowrap !important;
}
.yxj-btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  color: #fff !important;
}
.yxj-btn-primary:hover {
  opacity: 0.9 !important;
  transform: none !important;
}
.yxj-btn-secondary {
  background: var(--bg-hover, #2d2d4a) !important;
  color: var(--text-secondary, #888) !important;
}
.yxj-btn-secondary:hover {
  background: var(--border-color, #3d3d5a) !important;
}
/* 兼容旧class（逐步迁移） */
#user-profile-modal .btn-close,
#follow-modal-game .btn-close {
  all: unset !important;
  width: 32px !important;
  height: 32px !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  color: var(--text-secondary, #888) !important;
  font-size: 1.5rem !important;
  cursor: pointer !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: auto !important;
  max-width: 32px !important;
  box-shadow: none !important;
  transition: background 0.2s !important;
  box-sizing: border-box !important;
}
#user-profile-modal .btn-close:hover,
#follow-modal-game .btn-close:hover {
  background: var(--bg-hover, #2d2d4a) !important;
  color: var(--text-primary, #e0e8ff) !important;
  transform: none !important;
  box-shadow: none !important;
}
#user-profile-modal .modal-body,
#follow-modal-game .modal-body {
  padding: 1.25rem !important;
  overflow-y: auto !important;
  max-height: calc(85vh - 60px) !important;
}
#user-profile-modal .user-profile-header {
  display: flex !important;
  align-items: center !important;
  gap: 1rem !important;
  padding-bottom: 1.25rem !important;
  border-bottom: 1px solid var(--border-color, #2d2d4a) !important;
  margin-bottom: 1.25rem !important;
}
#user-profile-modal .user-profile-avatar {
  width: 60px !important;
  height: 60px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1.75rem !important;
  flex-shrink: 0 !important;
}
#user-profile-modal .user-profile-info {
  flex: 1 !important;
  min-width: 0 !important;
}
#user-profile-modal .user-profile-name {
  font-size: 1.125rem !important;
  font-weight: 600 !important;
  color: var(--text-primary, #e0e8ff) !important;
  margin-bottom: 0.125rem !important;
}
#user-profile-modal .user-profile-account {
  font-size: 0.75rem !important;
  color: var(--text-muted, #666) !important;
  margin-bottom: 0.375rem !important;
}
#user-profile-modal .user-profile-stats {
  display: flex !important;
  align-items: center !important;
  gap: 0.5rem !important;
  font-size: 0.875rem !important;
  color: var(--text-secondary, #888) !important;
  flex-wrap: wrap !important;
}
#user-profile-modal .user-stat-item {
  cursor: pointer !important;
  transition: color 0.2s !important;
}
#user-profile-modal .user-stat-item:hover {
  color: #6366f1 !important;
}
#user-profile-modal .user-stat-item strong {
  color: var(--text-primary, #e0e8ff) !important;
  font-weight: 600 !important;
}
#user-profile-modal .user-stat-divider {
  color: var(--border-color, #2d2d4a) !important;
}
#user-profile-modal .user-profile-follow-btn {
  flex-shrink: 0 !important;
  padding: 0.5rem 1rem !important;
  font-size: 0.875rem !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  cursor: pointer !important;
  border: none !important;
  min-width: auto !important;
  box-shadow: none !important;
  transition: all 0.2s !important;
}
#user-profile-modal .user-profile-follow-btn.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
  color: #fff !important;
}
#user-profile-modal .user-profile-follow-btn.btn-secondary {
  background: var(--bg-hover, #2d2d4a) !important;
  color: var(--text-secondary, #888) !important;
}
#user-profile-modal .user-profile-follow-btn:hover {
  transform: none !important;
  opacity: 0.9 !important;
}
#user-profile-modal .user-profile-games h4 {
  font-size: 1rem !important;
  font-weight: 600 !important;
  margin-bottom: 1rem !important;
  color: var(--text-primary, #e0e8ff) !important;
}
#user-profile-modal .user-games-scroll-container {
  max-height: 250px !important;
  overflow-y: auto !important;
}
#user-profile-modal .user-games-grid {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 0.75rem !important;
}
#user-profile-modal .user-game-card {
  background: var(--bg-color, #080810) !important;
  border-radius: 8px !important;
  padding: 0.75rem !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  text-align: center !important;
}
#user-profile-modal .user-game-card:hover {
  background: var(--bg-hover, #2d2d4a) !important;
  transform: translateY(-2px) !important;
}
#user-profile-modal .user-game-emoji {
  font-size: 2rem !important;
  margin-bottom: 0.5rem !important;
}
#user-profile-modal .user-game-title {
  font-size: 0.75rem !important;
  color: var(--text-primary, #e0e8ff) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  margin-bottom: 0.25rem !important;
}
#user-profile-modal .user-game-stats {
  display: flex !important;
  justify-content: center !important;
  gap: 0.5rem !important;
  font-size: 0.625rem !important;
  color: var(--text-muted, #666) !important;
}
#user-profile-modal .user-games-empty,
#user-profile-modal .user-games-load-more {
  text-align: center !important;
  color: var(--text-muted, #666) !important;
  font-size: 0.875rem !important;
  padding: 1rem !important;
}
/* 关注列表弹窗样式 - 使用类选择器匹配动态创建的弹窗 */
.follow-modal-instance .follow-tabs {
  display: flex !important;
  border-bottom: 1px solid var(--border-color, #252540) !important;
  margin-bottom: 1rem !important;
}
.follow-modal-instance .follow-tab-btn,
.yxj-tab-btn {
  all: unset !important;
  flex: 1 !important;
  padding: 0.75rem !important;
  background: transparent !important;
  border: none !important;
  color: var(--text-secondary, #888) !important;
  font-size: 0.9375rem !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.2s !important;
  border-bottom: 2px solid transparent !important;
  min-width: auto !important;
  box-shadow: none !important;
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  text-align: center !important;
}
.follow-modal-instance .follow-tab-btn:hover {
  transform: none !important;
  box-shadow: none !important;
  color: var(--text-primary, #e0e8ff) !important;
}
.follow-modal-instance .follow-tab-btn.active {
  color: var(--primary-color, #6366f1) !important;
  border-bottom-color: var(--primary-color, #6366f1) !important;
}
.follow-modal-instance .follow-tab-btn span {
  font-weight: 700 !important;
  margin-left: 0.25rem !important;
}
.follow-modal-instance .follow-list {
  max-height: 400px !important;
  overflow-y: auto !important;
}
.follow-modal-instance .follow-user-item {
  display: flex !important;
  align-items: center !important;
  gap: 0.75rem !important;
  padding: 0.75rem 0 !important;
  border-bottom: 1px solid var(--border-color, #252540) !important;
  transition: background 0.2s !important;
}
.follow-modal-instance .follow-user-item:last-child {
  border-bottom: none !important;
}
.follow-modal-instance .follow-user-avatar {
  width: 44px !important;
  height: 44px !important;
  border-radius: 50% !important;
  background: var(--bg-secondary, #0e0e18) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1.5rem !important;
  cursor: pointer !important;
  flex-shrink: 0 !important;
}
.follow-modal-instance .follow-user-info {
  flex: 1 !important;
  min-width: 0 !important;
  cursor: pointer !important;
}
.follow-modal-instance .follow-user-name {
  font-size: 0.9375rem !important;
  font-weight: 600 !important;
  color: var(--text-primary, #e0e8ff) !important;
}
.follow-modal-instance .follow-user-stats {
  font-size: 0.75rem !important;
  color: var(--text-muted, #666) !important;
  margin-top: 0.125rem !important;
  display: flex !important;
  gap: 0.75rem !important;
}
.follow-modal-instance .follow-action-btn,
.yxj-follow-action-btn {
  all: unset !important;
  padding: 0.375rem 1rem !important;
  font-size: 0.8125rem !important;
  font-weight: 600 !important;
  border-radius: 16px !important;
  cursor: pointer !important;
  border: 1px solid var(--primary-color, #6366f1) !important;
  background: var(--primary-color, #6366f1) !important;
  color: #fff !important;
  min-width: auto !important;
  box-shadow: none !important;
  transition: all 0.2s !important;
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.follow-modal-instance .follow-action-btn:hover {
  transform: none !important;
  background: var(--primary-hover, #4f46e5) !important;
}
.follow-modal-instance .follow-action-btn.following {
  background: transparent !important;
  color: var(--text-secondary, #888) !important;
  border-color: var(--border-color, #252540) !important;
}
.follow-modal-instance .follow-action-btn.following:hover {
  border-color: #ef4444 !important;
  color: #ef4444 !important;
}
.follow-modal-instance .follow-empty {
  text-align: center !important;
  padding: 2rem !important;
  color: var(--text-muted, #666) !important;
}
.follow-modal-instance .follow-empty-icon {
  font-size: 2.5rem !important;
  margin-bottom: 0.5rem !important;
}
.follow-modal-instance .follow-loading {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 0.5rem !important;
  padding: 2rem !important;
  color: var(--text-muted, #666) !important;
}
`;

  // 从gameInfo获取authorToken
  const authorToken = gameInfo.authorToken || '';
  
  const promoBarHtml = `
<!-- 游戏家顶部导航 - 返回按钮 -->
<button class="yxj-promo-home" onclick="window.history.length > 1 ? window.history.back() : window.location.href='/'" title="返回">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
</button>

<!-- 抖音风格左下角作者信息 -->
<div class="tiktok-author-info" id="tiktok-author-info">
  <div class="tiktok-author-row">
    <div class="tiktok-author-avatar" id="author-avatar" onclick="openAuthorProfile()">👤</div>
    <div class="tiktok-author-details" style="display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:center!important;min-height:32px!important;gap:2px!important;">
      <div class="tiktok-author-name-row" style="display:flex!important;flex-direction:row!important;align-items:center!important;gap:10px!important;">
        <span class="tiktok-author-name" id="author-name" onclick="openAuthorProfile()">${safeAuthor}</span>
        <button class="tiktok-follow-btn" id="tiktok-follow-btn" data-token="${authorToken}" onclick="toggleFollow()">
          <span class="follow-icon">+</span> 关注
        </button>
      </div>
      ${publishTime ? `<span class="tiktok-publish-time" style="display:block!important;margin:0!important;padding:0!important;">发布于 ${publishTime}</span>` : ''}
    </div>
  </div>
</div>

<!-- 全屏退出按钮 -->
<button class="fullscreen-exit-btn" id="fullscreen-exit-btn" onclick="toggleFullscreenMode()" title="退出全屏">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
</button>

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
  <div class="tiktok-action" id="stat-edit-btn" onclick="openGameEditorPage()" title="编辑游戏" style="display:none;">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </div>
  </div>
  <div class="tiktok-action" id="stat-repair-btn" onclick="repairGame()" title="AI修复" style="display:none;">
    <div class="tiktok-icon">🔧</div>
  </div>
  <div class="tiktok-action" id="fullscreen-btn" onclick="toggleFullscreenMode()" title="全屏游玩">
    <div class="tiktok-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
    </div>
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
  <div class="comments-body-wrapper">
    <div class="comments-body" id="game-comments-list">
      <div class="comments-loading" style="text-align:center;padding:30px;color:#8090b0;">
        <div class="loading-spinner-small" style="width:24px;height:24px;border:2px solid rgba(0,240,255,0.2);border-top-color:#00f0ff;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 10px;"></div>
        加载中...
      </div>
    </div>
  </div>
  <div class="comments-login-hint" id="comment-login-hint" style="display:none;">
    <span style="display:flex;align-items:center;justify-content:center;gap:8px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      请登录后发表留言
    </span>
  </div>
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
<div id="share-panel" class="modal" style="display:none;z-index:999999;" onclick="closeSharePanel()">
  <div class="modal-content modal-small" onclick="event.stopPropagation()">
    <div class="modal-header">
      <h3>📤 分享游戏</h3>
      <button class="yxj-modal-close" onclick="closeSharePanel()">×</button>
    </div>
    <div class="modal-body" style="padding:1rem 1.25rem;">
      <div style="background:var(--bg-tertiary, #14142a);border-radius:8px;padding:12px;margin-bottom:15px;border:1px solid var(--border-color, #252540);">
        <textarea id="share-text" readonly style="width:100%;border:none;background:transparent;font-size:14px;resize:none;min-height:80px;outline:none;color:var(--text-primary, #e0e8ff);"></textarea>
      </div>
      <button onclick="copyShareText()" style="width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:10px;">📋 复制分享内容</button>
      <button onclick="closeSharePanel()" style="width:100%;padding:12px;background:var(--bg-tertiary, #14142a);color:var(--text-secondary, #888);border:1px solid var(--border-color, #252540);border-radius:8px;font-size:14px;cursor:pointer;">取消</button>
    </div>
  </div>
</div>

<!-- 作者主页弹窗 -->
<div id="author-profile-modal" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:999999;align-items:center;justify-content:center;" onclick="closeAuthorProfile()">
  <div style="background:#1a1a2e;border-radius:16px;padding:24px;width:90%;max-width:400px;text-align:center;position:relative;max-height:85vh;overflow-y:auto;" onclick="event.stopPropagation()">
    <button onclick="closeAuthorProfile()" style="position:absolute;right:12px;top:12px;border:none;background:none;font-size:24px;cursor:pointer;color:#888;line-height:1;">×</button>
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

// 网站配置（禁用写操作检查）
let siteConfig = {
  webWriteDisabled: true,  // 默认禁用，等待API返回
  miniprogram: { name: '一句话游戏', appId: '', defaultPath: '/pages/create/create' }
};

// 加载网站配置
function loadSiteConfig() {
  fetch('/api/site-config')
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        siteConfig = data.config || siteConfig;
        console.log('[配置] 网站配置已加载:', siteConfig);
      }
    })
    .catch(err => console.error('[配置] 加载失败:', err));
}
loadSiteConfig();

// 检查是否禁用写操作
function isWebWriteDisabled() {
  return siteConfig.webWriteDisabled;
}

// ==================== 网站登录检测 ====================

// 检查网站登录状态
// 兼容多种登录凭证：aigame-jwt（密码登录）、aigame-user-token 或 aigame-author-token（设备自动登录）
function isWebLoggedIn() {
  const jwt = localStorage.getItem('aigame-jwt');
  if (jwt && jwt.length > 0) return true;
  
  const userToken = localStorage.getItem('aigame-user-token');
  if (userToken && userToken.length > 0) return true;
  
  const authorToken = localStorage.getItem('aigame-author-token');
  if (authorToken && authorToken.length > 0) return true;
  
  return false;
}

// 获取网站登录用户信息
function getWebUser() {
  if (!isWebLoggedIn()) return null;
  return {
    accountId: localStorage.getItem('aigame-account-id'),
    nickname: localStorage.getItem('aigame-author-name'),
    userToken: localStorage.getItem('aigame-user-token')
  };
}

// 跳转到网站登录页
function goToWebLogin() {
  const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = '/login.html?return=' + returnUrl;
}

// 登录提示 Toast 相关
let loginToastTimer = null;
let loginToastEl = null;

function ensureLoginToast() {
  if (loginToastEl) return loginToastEl;
  loginToastEl = document.getElementById('login-toast');
  if (loginToastEl) return loginToastEl;
  
  // 创建Toast元素和样式
  if (!document.getElementById('login-toast-style')) {
    const style = document.createElement('style');
    style.id = 'login-toast-style';
    style.textContent = '.login-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(100px);background:rgba(20,20,30,0.95);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:12px;z-index:10000;opacity:0;transition:all 0.3s ease;box-shadow:0 10px 40px rgba(0,0,0,0.5);}.login-toast.show{transform:translateX(-50%) translateY(0);opacity:1;}.login-toast-text{color:rgba(255,255,255,0.9);font-size:14px;}.login-toast-btn{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);border:none;color:#fff;padding:6px 14px;border-radius:16px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;}.login-toast-btn:hover{filter:brightness(1.1);}';
    document.head.appendChild(style);
  }
  
  const toast = document.createElement('div');
  toast.id = 'login-toast';
  toast.className = 'login-toast';
  toast.innerHTML = '<span class="login-toast-text" id="login-toast-text">🔐 登录后可进行此操作</span><button class="login-toast-btn" onclick="goToWebLogin()">去登录</button>';
  document.body.appendChild(toast);
  loginToastEl = toast;
  return toast;
}

function showLoginToast(message) {
  const toast = ensureLoginToast();
  const textEl = document.getElementById('login-toast-text');
  if (!toast) return;
  if (textEl) textEl.textContent = message || '🔐 登录后可进行此操作';
  toast.classList.add('show');
  if (loginToastTimer) clearTimeout(loginToastTimer);
  loginToastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function hideLoginToast() {
  if (loginToastEl) loginToastEl.classList.remove('show');
  if (loginToastTimer) clearTimeout(loginToastTimer);
}

// 检查是否需要网站登录才能互动
function isWebInteractDisabled() {
  return siteConfig.webInteractDisabled;
}

// 要求登录的操作包装器
function requireWebLogin(actionName, callback) {
  // 如果全局禁用了网站互动，引导去小程序
  if (isWebInteractDisabled()) {
    showMiniprogramGuide(actionName, '/pages/game-detail/game-detail');
    return false;
  }
  // 检查是否已登录
  if (isWebLoggedIn()) {
    if (callback && typeof callback === 'function') callback();
    return true;
  } else {
    showLoginToast('🔐 登录后可' + actionName);
    return false;
  }
}

// 获取页面最高的 z-index 值
function getMaxZIndex() {
  return Math.max(
    ...Array.from(document.querySelectorAll('body *'))
      .map(el => parseFloat(window.getComputedStyle(el).zIndex))
      .filter(zIndex => !isNaN(zIndex)),
    999999 // 最低保底值
  );
}

// 显示小程序引导弹窗
function showMiniprogramGuide(actionName, targetPath) {
  const mpName = siteConfig.miniprogram?.name || '一句话游戏';
  const appId = siteConfig.miniprogram?.appId || '';
  const path = targetPath || siteConfig.miniprogram?.defaultPath || '/pages/create/create';
  const fullPath = gameId ? path + '?id=' + gameId : path;
  const qrcodeUrl = '/images/miniprogram.png';
  
  // 移除旧的弹窗
  const oldModal = document.getElementById('miniprogram-guide-modal');
  if (oldModal) oldModal.remove();
  
  // 动态计算z-index，确保在最上层
  const maxZIndex = getMaxZIndex();
  const modalZIndex = maxZIndex + 10;
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'miniprogram-guide-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:' + modalZIndex + ';';
  modal.onclick = function(e) { if (e.target === modal) closeMiniprogramGuide(); };
  
  modal.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:380px;width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.3);">' +
    '<div style="padding:1rem 1.5rem;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">' +
      '<h3 style="margin:0;font-size:1.1rem;">📱 请使用小程序</h3>' +
      '<button onclick="closeMiniprogramGuide()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#999;">×</button>' +
    '</div>' +
    '<div style="text-align:center;padding:1.5rem;">' +
      '<div style="font-size:3rem;margin-bottom:1rem;">📱</div>' +
      '<p style="color:#666;margin-bottom:1rem;"><strong>' + actionName + '</strong>功能已迁移到小程序</p>' +
      '<p style="color:#999;font-size:0.8rem;margin-bottom:1.5rem;">请使用微信扫描下方二维码，或在微信中搜索小程序</p>' +
      '<div id="miniprogram-qrcode-container" style="width:180px;height:180px;margin:0 auto 1rem;background:#fff;border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #eee;">' +
        '<img id="miniprogram-qrcode" src="' + qrcodeUrl + '" style="width:100%;height:100%;object-fit:contain;" onerror="showQrcodeError()" alt="小程序二维码">' +
      '</div>' +
      '<p style="color:#07c160;font-weight:600;">' + mpName + ' 小程序</p>' +
      '<p style="color:#999;font-size:0.75rem;margin-top:0.5rem;">微信搜索「' + mpName + '」即可找到</p>' +
    '</div>' +
    '<div style="padding:1rem 1.5rem;text-align:center;border-top:1px solid #eee;">' +
      '<button onclick="closeMiniprogramGuide()" style="background:#07c160;color:#fff;border:none;padding:0.75rem 2rem;border-radius:8px;font-size:1rem;cursor:pointer;">我知道了</button>' +
    '</div>' +
  '</div>';
  
  document.body.appendChild(modal);
}

function showQrcodeError() {
  const mpName = siteConfig.miniprogram?.name || '一句话游戏';
  const container = document.getElementById('miniprogram-qrcode-container');
  if (container) {
    container.innerHTML = '<div style="text-align:center;padding:1rem;color:#666;"><div style="font-size:2rem;margin-bottom:0.5rem;">🔍</div><p style="font-size:0.75rem;">微信搜索</p><p style="font-size:0.875rem;font-weight:600;color:#333;">' + mpName + '</p></div>';
  }
}

function closeMiniprogramGuide() {
  const modal = document.getElementById('miniprogram-guide-modal');
  if (modal) modal.remove();
}

// 显示积分不足弹窗（严格按文档设计，与主站一致）
function showCreditsModal() {
  const mpName = siteConfig.miniprogram?.name || '一句话游戏';
  const qrcodeUrl = '/images/miniprogram.png';
  
  // 移除旧的弹窗
  const oldModal = document.getElementById('credits-modal');
  if (oldModal) oldModal.remove();
  
  // 动态计算z-index
  const maxZIndex = getMaxZIndex();
  const modalZIndex = maxZIndex + 10;
  
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'credits-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:' + modalZIndex + ';';
  modal.onclick = function(e) { if (e.target === modal) closeCreditsModal(); };
  
  modal.innerHTML = '<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;max-width:480px;width:90%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,0.5);color:#fff;">' +
    '<div style="padding:1rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">' +
      '<h3 style="margin:0;font-size:1.1rem;">💎 积分不足</h3>' +
      '<button onclick="closeCreditsModal()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#888;">×</button>' +
    '</div>' +
    '<div style="padding:1rem 1.25rem;overflow-y:auto;flex:1;">' +
      // 顶部：积分状态
      '<div style="text-align:center;margin-bottom:1rem;">' +
        '<div style="font-size:2.5rem;margin-bottom:0.5rem;">😢</div>' +
        '<p style="color:#f87171;font-size:0.9375rem;margin:0;">积分不足，无法执行此操作</p>' +
      '</div>' +
      // 小程序二维码区域
      '<div style="background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.1));border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:1rem;margin-bottom:1rem;">' +
        '<div style="text-align:center;font-size:0.875rem;font-weight:600;color:#e2e8f0;margin-bottom:0.75rem;">📱 扫码打开小程序领取积分</div>' +
        '<div style="display:flex;align-items:center;gap:1rem;">' +
          '<div style="background:#fff;border-radius:8px;padding:8px;flex-shrink:0;">' +
            '<img src="' + qrcodeUrl + '" alt="小程序码" style="width:90px;height:90px;display:block;" onerror="this.parentNode.innerHTML=\\'<div style=text-align:center;padding:1rem;font-size:0.75rem;color:#666>扫码失败<br>请搜索「' + mpName + '」</div>\\'">' +
          '</div>' +
          '<div style="flex:1;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">' +
            '<div style="font-size:0.75rem;color:#94a3b8;">📅 签到 <strong style="color:#10b981;">+1</strong></div>' +
            '<div style="font-size:0.75rem;color:#94a3b8;">🏆 领成就 <strong style="color:#10b981;">+N</strong></div>' +
            '<div style="font-size:0.75rem;color:#94a3b8;">👥 邀请 <strong style="color:#10b981;">+5</strong></div>' +
            '<div style="font-size:0.75rem;color:#94a3b8;">🎬 广告 <span style="color:#64748b;">即将开放</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      // 可领取奖励区域
      '<div style="margin-bottom:1rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">' +
          '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<span style="font-size:1rem;">🎁</span>' +
            '<span style="font-size:0.875rem;font-weight:600;color:#e2e8f0;">可领取奖励</span>' +
            '<span id="credits-modal-total" style="font-size:0.75rem;color:#10b981;"></span>' +
          '</div>' +
          '<a href="javascript:void(0)" onclick="showMpClaimTip()" style="font-size:0.75rem;color:#6366f1;text-decoration:none;">去小程序领取 →</a>' +
        '</div>' +
        '<div id="credits-modal-claimable" style="max-height:200px;overflow-y:auto;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(0,0,0,0.2);">' +
          '<div style="text-align:center;padding:1rem;color:#94a3b8;font-size:0.8125rem;">加载中...</div>' +
        '</div>' +
      '</div>' +
      // 进行中区域
      '<div id="credits-modal-inprogress-section" style="margin-bottom:1rem;display:none;">' +
        '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">' +
          '<span style="font-size:1rem;">📈</span>' +
          '<span style="font-size:0.875rem;font-weight:600;color:#e2e8f0;">进行中</span>' +
          '<span style="font-size:0.75rem;color:#94a3b8;">(继续努力即可领取)</span>' +
        '</div>' +
        '<div id="credits-modal-inprogress" style="max-height:180px;overflow-y:auto;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(0,0,0,0.2);"></div>' +
      '</div>' +
      // 底部智能贴士
      '<div id="credits-modal-tips">' +
        '<div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:0.75rem;text-align:center;">' +
          '<p style="color:#10b981;font-size:0.8125rem;margin:0;">💡 在小程序中点赞、收藏、评论都可以获得积分奖励</p>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="padding:1rem 1.5rem;display:flex;gap:0.75rem;justify-content:center;border-top:1px solid rgba(255,255,255,0.1);flex-shrink:0;">' +
      '<button onclick="closeCreditsModal()" style="padding:0.75rem 1.5rem;background:rgba(255,255,255,0.1);color:#94a3b8;border:none;border-radius:8px;font-size:0.875rem;cursor:pointer;">稍后再说</button>' +
      '<button onclick="copyMpName()" style="padding:0.75rem 1.5rem;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:0.875rem;cursor:pointer;font-weight:600;">📋 复制小程序名</button>' +
    '</div>' +
  '</div>';
  
  document.body.appendChild(modal);
  
  // 异步加载可领取奖励
  loadCreditsModalData();
}

// 点击提示去小程序领取
function showMpClaimTip() {
  const mpName = siteConfig.miniprogram?.name || '一句话游戏';
  showToast('请打开微信搜索「' + mpName + '」小程序领取积分奖励', 'info');
}

// 点击单个条目提示
function onCreditsItemClick(name) {
  const mpName = siteConfig.miniprogram?.name || '一句话游戏';
  showToast('【' + name + '】奖励需在小程序中领取，请搜索「' + mpName + '」', 'info');
}

// 加载弹窗数据
function loadCreditsModalData() {
  const claimableContainer = document.getElementById('credits-modal-claimable');
  const inprogressContainer = document.getElementById('credits-modal-inprogress');
  const inprogressSection = document.getElementById('credits-modal-inprogress-section');
  const totalEl = document.getElementById('credits-modal-total');
  const tipsEl = document.getElementById('credits-modal-tips');
  
  const userToken = getUserToken();
  if (!userToken) {
    claimableContainer.innerHTML = '<div style="text-align:center;padding:1rem;color:#94a3b8;font-size:0.8125rem;">📱 请先登录，然后去小程序获取积分</div>';
    return;
  }
  
  fetch('/api/user/credits-progress', { headers: { 'X-User-Token': userToken } })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.success) {
        claimableContainer.innerHTML = '<div style="text-align:center;padding:1rem;color:#94a3b8;font-size:0.8125rem;">去小程序查看更多成就任务</div>';
        return;
      }
      
      var result = data.data;
      var checkin = result.checkin;
      var actionProgress = result.action_progress;
      var claimableAchievements = result.claimable_achievements;
      var inProgressAchievements = result.in_progress_achievements;
      var summary = result.summary;
      var tips = result.tips;
      
      // 更新总积分
      if (totalEl) {
        totalEl.textContent = '(共 ' + (summary.total_claimable || 0) + ' 积分)';
      }
      
      // 构建可领取区域HTML
      var claimableHtml = '';
      
      // 签到
      var checkinItems = '';
      if (!checkin.checked_in_today) {
        checkinItems += renderCreditsItem('今日签到', '+1', '未签到', 'pending');
      }
      if (checkin.streak_days >= 3 && checkin.streak_days < 7) {
        checkinItems += renderCreditsItem('连续签到3天奖励', '+1', '已达成', 'claimable');
      }
      if (checkin.streak_days >= 7) {
        checkinItems += renderCreditsItem('连续签到7天奖励', '+2', '已达成', 'claimable');
      }
      if (checkinItems) {
        claimableHtml += renderCreditsCategory('📅', '签到', checkinItems);
      }
      
      // 互动积分
      var actionItems = '';
      actionProgress.forEach(function(action) {
        if (action.can_claim_count > 0) {
          for (var i = 0; i < action.can_claim_count; i++) {
            actionItems += renderCreditsItem(action.name + '奖励 (' + action.target + '/' + action.target + ')', '+' + action.reward, '可领取', 'claimable');
          }
        }
      });
      if (actionItems) {
        claimableHtml += renderCreditsCategory('❤️', '互动积分', actionItems);
      }
      
      // 成就分类
      var achievementsByCategory = {
        daily: { icon: '🏆', name: '每日成就', items: [] },
        weekly: { icon: '📅', name: '每周成就', items: [] },
        monthly: { icon: '📆', name: '每月成就', items: [] },
        permanent: { icon: '🎖️', name: '永久成就', items: [] }
      };
      
      claimableAchievements.forEach(function(ach) {
        var cat = achievementsByCategory[ach.category] || achievementsByCategory.permanent;
        cat.items.push(ach);
      });
      
      Object.keys(achievementsByCategory).forEach(function(key) {
        var cat = achievementsByCategory[key];
        if (cat.items.length > 0) {
          var items = '';
          cat.items.forEach(function(ach) {
            var progressText = ach.current !== undefined ? ' (' + ach.current + '/' + ach.target + ')' : '';
            items += renderCreditsItem(escapeHtmlSimple(ach.name) + progressText, '+' + ach.reward, '可领取', 'claimable');
          });
          claimableHtml += renderCreditsCategory(cat.icon, cat.name, items);
        }
      });
      
      if (claimableHtml) {
        claimableContainer.innerHTML = claimableHtml;
      } else {
        claimableContainer.innerHTML = '<div style="text-align:center;padding:1rem;color:#94a3b8;font-size:0.8125rem;">暂无可领取奖励，去小程序签到、互动即可获得</div>';
      }
      
      // 构建进行中区域HTML
      var inprogressHtml = '';
      
      // 视频广告进度（功能启用且当天有剩余次数时显示）
      var adProgress = result.ad_progress;
      if (adProgress && adProgress.enabled && adProgress.remainingToday > 0) {
        var adItem = renderCreditsProgressItem('看广告领积分', adProgress.todayCount, adProgress.dailyLimit, adProgress.progress, adProgress.reward);
        inprogressHtml += renderCreditsCategory('🎬', '今日看广告', adItem);
      }
      
      // 互动进度（显示所有未完成的互动类型）
      var actionProgressItems = '';
      actionProgress.forEach(function(action) {
        if (action.can_claim_count === 0) {
          // 按文档设计格式：点赞 28/30 93% +1
          actionProgressItems += renderCreditsProgressItem(action.name, action.current, action.target, action.progress, action.reward);
        }
      });
      if (actionProgressItems) {
        inprogressHtml += renderCreditsCategory('❤️', '互动进度', actionProgressItems);
      }
      
      // 进行中的成就
      var inProgressByCategory = {
        daily: { icon: '🏆', name: '每日成就', items: [] },
        weekly: { icon: '📅', name: '每周成就', items: [] },
        monthly: { icon: '📆', name: '每月成就', items: [] },
        permanent: { icon: '🎖️', name: '永久成就', items: [] }
      };
      
      inProgressAchievements.forEach(function(ach) {
        if (ach.progress > 0) {
          var cat = inProgressByCategory[ach.category] || inProgressByCategory.permanent;
          cat.items.push(ach);
        }
      });
      
      Object.keys(inProgressByCategory).forEach(function(key) {
        var cat = inProgressByCategory[key];
        if (cat.items.length > 0) {
          var items = '';
          cat.items.forEach(function(ach) {
            items += renderCreditsProgressItem(escapeHtmlSimple(ach.name), ach.current, ach.target, ach.progress, ach.reward);
          });
          inprogressHtml += renderCreditsCategory(cat.icon, cat.name, items);
        }
      });
      
      if (inprogressHtml && inprogressContainer && inprogressSection) {
        inprogressContainer.innerHTML = inprogressHtml;
        inprogressSection.style.display = 'block';
      }
      
      // 更新智能提示
      if (tipsEl && tips && tips.length > 0) {
        tipsEl.innerHTML = '<div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:0.75rem;text-align:center;">' +
          '<p style="color:#10b981;font-size:0.8125rem;margin:0;">💡 ' + tips[0] + '</p>' +
        '</div>';
      }
    })
    .catch(function(err) {
      console.error('加载积分进度失败:', err);
      claimableContainer.innerHTML = '<div style="text-align:center;padding:1rem;color:#94a3b8;font-size:0.8125rem;">📱 去小程序查看更多获取积分的方式</div>';
    });
}

// 渲染分类
function renderCreditsCategory(icon, name, itemsHtml) {
  return '<div style="border-bottom:1px solid rgba(255,255,255,0.1);">' +
    '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:rgba(99,102,241,0.1);">' +
      '<span>' + icon + '</span>' +
      '<span style="font-size:0.8125rem;font-weight:600;color:#e2e8f0;">' + name + '</span>' +
    '</div>' +
    itemsHtml +
  '</div>';
}

// 渲染可领取条目
function renderCreditsItem(name, credits, status, statusType) {
  var statusColors = {
    'pending': { bg: 'rgba(148,163,184,0.2)', text: '#94a3b8' },
    'claimable': { bg: 'rgba(16,185,129,0.2)', text: '#10b981' }
  };
  var colors = statusColors[statusType] || statusColors.claimable;
  
  return '<div onclick="onCreditsItemClick(\\'' + escapeHtmlSimple(name) + '\\')" ' +
    'style="display:flex;align-items:center;padding:0.5rem 0.75rem;cursor:pointer;transition:background 0.2s;" ' +
    'onmouseover="this.style.background=\\'rgba(99,102,241,0.1)\\'" onmouseout="this.style.background=\\'transparent\\'">' +
    '<div style="flex:1;font-size:0.8125rem;color:#e2e8f0;">• ' + name + '</div>' +
    '<div style="font-size:0.8125rem;color:#10b981;margin-right:0.75rem;">' + credits + '</div>' +
    '<div style="font-size:0.6875rem;padding:2px 8px;border-radius:4px;background:' + colors.bg + ';color:' + colors.text + ';">' + status + '</div>' +
  '</div>';
}

// 渲染进度条条目
function renderCreditsProgressItem(name, current, target, progress, reward) {
  return '<div style="padding:0.5rem 0.75rem;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
      '<span style="font-size:0.8125rem;color:#e2e8f0;">• ' + name + '</span>' +
      '<span style="font-size:0.75rem;color:#6366f1;">+' + reward + '</span>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:0.5rem;">' +
      '<div style="flex:1;height:6px;background:rgba(99,102,241,0.15);border-radius:3px;overflow:hidden;">' +
        '<div style="height:100%;width:' + progress + '%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:3px;"></div>' +
      '</div>' +
      '<span style="font-size:0.625rem;color:#94a3b8;">' + progress + '%</span>' +
      '<span style="font-size:0.6875rem;color:#94a3b8;min-width:45px;text-align:right;">' + current + '/' + target + '</span>' +
    '</div>' +
  '</div>';
}

// 简单的HTML转义
function escapeHtmlSimple(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function closeCreditsModal() {
  const modal = document.getElementById('credits-modal');
  if (modal) modal.remove();
}

function copyMpName() {
  const mpName = siteConfig.miniprogram?.name || '一句话游戏';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(mpName).then(function() {
      showToast('已复制「' + mpName + '」，请在微信中搜索', 'success');
    }).catch(function() {
      fallbackCopy(mpName);
    });
  } else {
    fallbackCopy(mpName);
  }
}

function fallbackCopy(text) {
  const input = document.createElement('input');
  input.value = text;
  input.style.cssText = 'position:fixed;left:-9999px;';
  document.body.appendChild(input);
  input.select();
  try {
    document.execCommand('copy');
    showToast('已复制「' + text + '」，请在微信中搜索', 'success');
  } catch (e) {
    showToast('复制失败，请手动搜索「' + text + '」', 'error');
  }
  document.body.removeChild(input);
}

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

// 全屏模式状态
let isFullscreenMode = false;

// 切换全屏模式
function toggleFullscreenMode() {
  isFullscreenMode = !isFullscreenMode;
  
  if (isFullscreenMode) {
    // 进入全屏
    document.body.classList.add('fullscreen-mode');
    
    // 尝试请求浏览器全屏
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } catch (e) {
      console.log('[全屏] 浏览器全屏请求失败:', e);
    }
    
    console.log('[全屏] 进入全屏模式');
  } else {
    // 退出全屏
    document.body.classList.remove('fullscreen-mode');
    
    // 退出浏览器全屏
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } catch (e) {
      console.log('[全屏] 退出浏览器全屏失败:', e);
    }
    
    console.log('[全屏] 退出全屏模式');
  }
}

// 监听浏览器全屏变化（如用户按ESC退出）
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

function handleFullscreenChange() {
  const isFullscreen = document.fullscreenElement || 
                       document.webkitFullscreenElement || 
                       document.mozFullScreenElement || 
                       document.msFullscreenElement;
  
  // 如果浏览器全屏被退出，同步状态
  if (!isFullscreen && isFullscreenMode) {
    isFullscreenMode = false;
    document.body.classList.remove('fullscreen-mode');
  }
}

// 监听ESC键退出全屏
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && isFullscreenMode) {
    toggleFullscreenMode();
  }
});

function getUserToken() {
  return localStorage.getItem('aigame-user-token') || '';
}

// 显示 Toast 提示
function showToast(message, type) {
  // 移除已存在的 toast
  var existingToast = document.getElementById('game-detail-toast');
  if (existingToast) existingToast.remove();
  
  var toast = document.createElement('div');
  toast.id = 'game-detail-toast';
  toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);color:#fff;padding:12px 24px;border-radius:8px;z-index:10000;font-size:14px;max-width:80%;text-align:center;animation:fadeIn 0.3s ease;';
  if (type === 'success') {
    toast.style.background = 'rgba(16,185,129,0.95)';
  }
  toast.innerText = message;
  document.body.appendChild(toast);
  
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
  }, 2500);
}

// ====== 互动积分提示条功能 ======
var interactionTipState = { lastShowTime: 0, showCount: 0, maxShowPerSession: 10 };

// 显示互动积分提示条（引导用户去小程序领取积分）
function showInteractionCreditTip(actionType) {
  console.log('[积分提示条] showInteractionCreditTip 被调用, actionType:', actionType);
  
  // 检查显示限制
  console.log('[积分提示条] 状态检查 - showCount:', interactionTipState.showCount, 'maxShowPerSession:', interactionTipState.maxShowPerSession);
  if (interactionTipState.showCount >= interactionTipState.maxShowPerSession) {
    console.log('[积分提示条] 达到最大显示次数，跳过');
    return;
  }
  var now = Date.now();
  var timeSinceLast = now - interactionTipState.lastShowTime;
  console.log('[积分提示条] 时间检查 - 距上次:', timeSinceLast, 'ms');
  if (timeSinceLast < 5000) {
    console.log('[积分提示条] 时间间隔太短，跳过');
    return;
  }
  
  // 移除已存在的提示条
  var existingTip = document.getElementById('interaction-credit-tip');
  if (existingTip) existingTip.remove();
  
  var userToken = getUserToken();
  console.log('[积分提示条] userToken:', userToken ? userToken.substring(0, 8) + '...' : 'null');
  if (!userToken) {
    console.log('[积分提示条] 未登录，跳过');
    return;
  }
  
  console.log('[积分提示条] 开始获取积分进度...');
  // 获取积分进度数据
  fetch('/api/user/credits-progress', { headers: { 'X-User-Token': userToken } })
    .then(function(res) { return res.json(); })
    .then(function(result) {
      console.log('[积分提示条] API响应:', result.success ? '成功' : '失败');
      if (!result.success) {
        console.log('[积分提示条] API返回失败，跳过');
        return;
      }
      var actionProgress = result.data.action_progress;
      var ap = actionProgress.find(function(a) { return a.type === actionType; });
      
      var actionIcons = { like: '❤️', favorite: '⭐', comment: '💬', follow: '➕', share: '🔗' };
      var actionNames = { like: '点赞', favorite: '收藏', comment: '评论', follow: '关注', share: '分享' };
      var icon = actionIcons[actionType] || '💎';
      var actionName = actionNames[actionType] || '互动';
      
      var tipText;
      if (ap) {
        if (ap.can_claim_count > 0) {
          tipText = '🎉 ' + actionName + '满' + ap.target + '次！去小程序领取' + ap.reward + '积分';
        } else if (ap.remaining <= 3) {
          tipText = icon + ' 再' + actionName + ap.remaining + '次即可领取' + ap.reward + '积分！';
        } else {
          tipText = icon + ' ' + actionName + '成功！累计' + ap.current + '/' + ap.target + '次，完成后去小程序领' + ap.reward + '积分';
        }
      } else {
        tipText = icon + ' ' + actionName + '成功！去小程序签到可领取更多积分~';
      }
      
      // 动态获取当前最高的z-index（优先使用弹窗管理器的层级）
      var tipZIndex = 9999;
      console.log('[积分提示条] modalZIndexManager存在:', typeof modalZIndexManager !== 'undefined');
      if (typeof modalZIndexManager !== 'undefined') {
        console.log('[积分提示条] modalZIndexManager.currentZIndex:', modalZIndexManager.currentZIndex);
        console.log('[积分提示条] modalZIndexManager.modalStack:', JSON.stringify(modalZIndexManager.modalStack));
      }
      if (typeof modalZIndexManager !== 'undefined' && modalZIndexManager.currentZIndex) {
        tipZIndex = modalZIndexManager.currentZIndex + 100;
        console.log('[积分提示条] 使用modalZIndexManager层级, tipZIndex:', tipZIndex);
      } else {
        var maxZ = 9998;
        document.querySelectorAll('*').forEach(function(el) {
          var z = parseInt(window.getComputedStyle(el).zIndex);
          if (!isNaN(z) && z > maxZ && z < 2147483647) maxZ = z;
        });
        tipZIndex = maxZ + 10;
        console.log('[积分提示条] 扫描元素层级, maxZ:', maxZ, 'tipZIndex:', tipZIndex);
      }
      
      // 查找当前打开的弹窗的实际z-index
      var commentsModal = document.querySelector('.comments-modal, [class*="modal"]');
      if (commentsModal) {
        console.log('[积分提示条] 找到弹窗元素:', commentsModal.className, '实际z-index:', window.getComputedStyle(commentsModal).zIndex);
      }
      
      console.log('[积分提示条] 最终使用的tipZIndex:', tipZIndex);
      
      // 创建提示条
      var tipBar = document.createElement('div');
      tipBar.id = 'interaction-credit-tip';
      tipBar.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px 10px 16px;">' +
        '<span style="font-size:0.8125rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + tipText + '</span>' +
        '<button onclick="openMiniprogramQRPanel()" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:white;padding:4px 12px;border-radius:15px;font-size:0.75rem;cursor:pointer;white-space:nowrap;">去领取</button>' +
        '<button onclick="closeInteractionCreditTip()" style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:1.25rem;cursor:pointer;padding:0 4px;line-height:1;">×</button>' +
        '</div>';
      tipBar.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:' + tipZIndex + ';background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:0;border-radius:25px;box-shadow:0 4px 20px rgba(99,102,241,0.4);animation:tipSlideUp 0.3s ease-out;max-width:calc(100% - 32px);width:auto;';
      
      // 添加动画样式
      if (!document.getElementById('tip-anim-style')) {
        var style = document.createElement('style');
        style.id = 'tip-anim-style';
        style.textContent = '@keyframes tipSlideUp{from{opacity:0;transform:translateX(-50%) translateY(20px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}';
        document.head.appendChild(style);
      }
      
      document.body.appendChild(tipBar);
      interactionTipState.lastShowTime = now;
      interactionTipState.showCount++;
      
      // 5秒后自动关闭
      setTimeout(closeInteractionCreditTip, 5000);
    })
    .catch(function(e) { console.log('获取积分进度失败', e); });
}

// 关闭互动提示条
function closeInteractionCreditTip() {
  var tip = document.getElementById('interaction-credit-tip');
  if (tip) {
    tip.style.opacity = '0';
    tip.style.transition = 'opacity 0.3s ease';
    setTimeout(function() { if (tip.parentNode) tip.remove(); }, 300);
  }
}

// 打开小程序码面板（显示引导弹窗，引导用户扫码或搜索小程序）
function openMiniprogramQRPanel() {
  // 显示小程序引导弹窗，引导用户扫码或搜索小程序领取积分
  showMiniprogramGuide('领取积分', '/pages/credits/credits');
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
    
    // 检查是否为作者，显示编辑按钮
    checkIsAuthorAndShowEditBtn();
  }
}

// 检查是否可以编辑游戏（作者或管理员）并显示编辑按钮
function checkIsAuthorAndShowEditBtn() {
  const userToken = getUserToken();
  if (!userToken) return;
  
  // 调用后端API检查编辑权限（包括作者和管理员）
  fetch(API_BASE + '/' + gameId + '/can-edit', {
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.canEdit) {
        const editBtn = document.getElementById('stat-edit-btn');
        const repairBtn = document.getElementById('stat-repair-btn');
        if (editBtn) {
          editBtn.classList.add('visible');
          // 如果是管理员编辑别人的游戏，添加提示
          if (data.isAdmin && !data.isAuthor) {
            editBtn.title = '管理员编辑模式';
          }
        }
        if (repairBtn) {
          repairBtn.classList.add('visible');
        }
      }
    })
    .catch(err => {
      console.error('[编辑权限检查] 失败:', err);
      // 降级处理：只检查是否为作者
      if (userToken === authorToken) {
        const editBtn = document.getElementById('stat-edit-btn');
        const repairBtn = document.getElementById('stat-repair-btn');
        if (editBtn) {
          editBtn.classList.add('visible');
        }
        if (repairBtn) {
          repairBtn.classList.add('visible');
        }
      }
    });
}

// AI修复游戏（异步后台任务）
function repairGame() {
  // 检查是否禁用网站写操作
  if (isWebWriteDisabled()) {
    showMiniprogramGuide('游戏修复', '/pages/game-detail/game-detail');
    return;
  }
  
  const REPAIR_CREDIT_COST = 0.5;
  const userToken = getUserToken();
  
  if (!userToken) {
    showToast('请先登录');
    return;
  }
  
  if (!confirm('AI修复需要消耗 ' + REPAIR_CREDIT_COST + ' 积分\\n\\nAI将在后台自动分析并修复游戏代码中的错误\\n修复完成后请刷新页面查看\\n\\n确定要修复吗？')) {
    return;
  }
  
  const repairBtn = document.getElementById('stat-repair-btn');
  if (repairBtn) {
    repairBtn.classList.add('repairing');
  }
  
  fetch(API_BASE + '/' + gameId + '/repair', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Token': userToken
    },
    body: JSON.stringify({ creditCost: REPAIR_CREDIT_COST })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (data.status === 'already_running') {
          showToast('该游戏已有修复任务正在进行中，请稍后刷新页面', 'info');
        } else {
          showToast('🔧 修复任务已启动！AI正在后台处理，完成后请刷新页面查看', 'success');
        }
      } else {
        // 检查是否是积分不足错误
        if (data.error && data.error.includes('积分不足')) {
          showCreditsModal();
        } else {
          showToast(data.error || '修复失败，请重试', 'error');
        }
      }
    })
    .catch(err => {
      console.error('AI修复失败:', err);
      showToast('网络错误，请稍后重试', 'error');
    })
    .finally(() => {
      if (repairBtn) {
        repairBtn.classList.remove('repairing');
      }
    });
}

// 打开游戏编辑页面
function openGameEditorPage() {
  // 检查是否禁用网站写操作
  if (isWebWriteDisabled()) {
    showMiniprogramGuide('游戏编辑', '/pages/game-edit/game-edit');
    return;
  }
  
  // 跳转到主站的编辑页面
  window.location.href = '/?edit=' + gameId;
}

// 点赞（支持取消）
function likeGame() {
  // 检查登录状态（requireWebLogin 会处理未登录提示和禁用检测）
  if (!requireWebLogin('点赞')) return;
  
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
        // 点赞成功后直接显示积分进度提示条
        if (data.liked) {
          showInteractionCreditTip('like');
        } else {
          showToast('已取消点赞');
        }
      } else {
        // 失败回滚
        btn.classList.toggle('liked', isLiked);
        countEl.innerText = count;
        showToast('操作失败，请重试');
      }
    })
    .catch(err => {
      console.error(err);
      btn.classList.toggle('liked', isLiked);
      countEl.innerText = count;
      showToast('网络错误，请重试');
    });
}

// 收藏
function toggleFavorite() {
  // 检查登录状态（requireWebLogin 会处理未登录提示和禁用检测）
  if (!requireWebLogin('收藏')) return;
  
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
        // 收藏成功后直接显示积分进度提示条
        if (data.favorited) {
          showInteractionCreditTip('favorite');
        } else {
          showToast('已取消收藏');
        }
      } else {
        // 失败回滚
        btn.classList.toggle('favorited', isFav);
        countEl.innerText = count;
        showToast('操作失败，请重试');
      }
    })
    .catch(() => {
      // 失败回滚
      btn.classList.toggle('favorited', isFav);
      countEl.innerText = count;
      showToast('网络错误，请重试');
    });
}

// 打开分享面板
function openSharePanel() {
  // 生成带分享者信息的链接
  const userToken = getUserToken();
  const sharerCode = userToken ? userToken.substring(0, 8) : '';
  let url = window.location.origin + '/game/' + gameId;
  if (sharerCode) {
    url += '?sharer=' + sharerCode + '&from=' + gameId;
  }
  const shareText = '🎮 我发现了一个有趣的AI游戏：「' + gameTitle + '」\\n\\n👆 点击链接立即游玩：\\n' + url + '\\n\\n💡 关注公众号「游戏开发技术教程」，一句话免费生成你的专属游戏！';
  document.getElementById('share-text').value = shareText;
  const panel = document.getElementById('share-panel');
  panel.style.display = '';
  panel.classList.add('active');
  document.body.classList.add('modal-open');
}

// 关闭分享面板
function closeSharePanel() {
  const panel = document.getElementById('share-panel');
  panel.classList.remove('active');
  panel.style.display = 'none';
  // 只有在没有其他弹窗时才移除 modal-open 类
  if (!document.querySelector('.modal.active')) {
    document.body.classList.remove('modal-open');
  }
}

// 复制分享内容
function copyShareText() {
  const text = document.getElementById('share-text').value;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      closeSharePanel();
      // 直接显示积分进度提示条
      showInteractionCreditTip('share');
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
  closeSharePanel();
  // 直接显示积分进度提示条
  showInteractionCreditTip('share');
}

// 用户主页作品分页状态
let userProfileGamesState = { games: [], displayedCount: 6, pageSize: 6 };

// ====== 弹窗层级管理器 ======
// 基础层级（高于所有固定 UI 元素如 tiktok-sidebar 的 999998）
const modalZIndexManager = {
  baseZIndex: 1000000,
  currentZIndex: 1000000,
  modalStack: [], // 弹窗栈，用于追踪打开的弹窗
  
  // 获取下一个层级（打开新弹窗时调用）
  getNextZIndex: function(modalId) {
    this.currentZIndex += 10;
    this.modalStack.push({ id: modalId, zIndex: this.currentZIndex });
    return this.currentZIndex;
  },
  
  // 移除弹窗（关闭弹窗时调用）
  removeModal: function(modalId) {
    const index = this.modalStack.findIndex(m => m.id === modalId);
    if (index > -1) {
      this.modalStack.splice(index, 1);
    }
    // 如果没有弹窗了，重置层级
    if (this.modalStack.length === 0) {
      this.currentZIndex = this.baseZIndex;
    }
  },
  
  // 重置（关闭所有弹窗时调用）
  reset: function() {
    this.currentZIndex = this.baseZIndex;
    this.modalStack = [];
  }
};

// 获取头像emoji
function getAvatarEmoji(token) {
  const emojis = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎪', '🎰', '🎳', '🎸', '🎹', '🎺', '🎻', '🥁', '🎤'];
  if (!token) return '👤';
  const hash = token.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return emojis[hash % emojis.length];
}

// 获取游戏emoji
function getGameEmoji(title) {
  const keywords = {
    '贪吃蛇': '🐍', '蛇': '🐍', 'snake': '🐍',
    '2048': '🔢', '数字': '🔢',
    '飞机': '✈️', '打飞机': '✈️', '射击': '🔫',
    '砖块': '🧱', '打砖块': '🧱', '弹球': '🏓',
    '俄罗斯方块': '🟦', '方块': '🟦', 'tetris': '🟦',
    '跳跃': '🦘', '跑酷': '🏃', '跳': '🦘',
    '消除': '💎', '消消乐': '💎', '三消': '💎',
    '迷宫': '🔲', '棋': '♟️', '象棋': '♟️',
    '扑克': '🃏', '纸牌': '🃏', '斗地主': '🃏'
  };
  const t = (title || '').toLowerCase();
  for (const [k, v] of Object.entries(keywords)) {
    if (t.includes(k.toLowerCase())) return v;
  }
  return '🎮';
}

// 格式化数字
function formatNumber(num) {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num);
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text || '');
  return div.innerHTML;
}

// 打开作者主页 - 使用与主站相同的弹窗样式
function openAuthorProfile() {
  openUserProfile(authorToken);
}

// 打开用户主页弹窗（复用主站样式）
// 用户主页弹窗计数器，用于生成唯一ID
let userProfileModalCounter = 0;

async function openUserProfile(userToken) {
  if (!userToken) {
    showPromoModal();
    return;
  }

  // 生成唯一的弹窗ID（支持多层嵌套）
  userProfileModalCounter++;
  const modalId = 'user-profile-modal-' + userProfileModalCounter;

  // 创建弹窗（使用主站CSS class）
  const modal = document.createElement('div');
  modal.className = 'modal active user-profile-modal-instance';
  modal.id = modalId;
  modal.style.zIndex = modalZIndexManager.getNextZIndex(modalId);
  modal.onclick = (e) => { if (e.target === modal) closeUserProfileModalById(modalId); };

  modal.innerHTML = 
    '<div class="modal-content modal-medium">' +
      '<div class="modal-header">' +
        '<h3>👤 用户主页</h3>' +
        '<button class="yxj-modal-close" onclick="closeUserProfileModalById(\\x27' + modalId + '\\x27)">×</button>' +
      '</div>' +
      '<div class="modal-body user-profile-body">' +
        '<div class="user-profile-loading">' +
          '<div class="loading-spinner"></div>' +
          '<span>加载中...</span>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  document.body.classList.add('modal-open');

  // 加载用户信息
  try {
    const [profileRes, statsRes, gamesRes, followStatusRes] = await Promise.all([
      fetch('/api/users/' + userToken + '/profile', { headers: getAuthHeaders() }),
      fetch('/api/users/' + userToken + '/follow-stats', { headers: getAuthHeaders() }),
      fetch('/api/users/' + userToken + '/games', { headers: getAuthHeaders() }),
      fetch('/api/users/' + userToken + '/follow-status', { headers: getAuthHeaders() })
    ]);

    const profileData = await profileRes.json();
    const statsData = await statsRes.json();
    const gamesData = await gamesRes.json();
    const followStatusData = await followStatusRes.json();

    const isFollowing = followStatusData.success && followStatusData.following;
    const following = statsData.followingCount || statsData.following || 0;
    const followers = statsData.followerCount || statsData.followers || 0;
    const games = gamesData.success ? gamesData.games || [] : [];

    // 保存作品数据用于滚动加载
    userProfileGamesState.games = games;
    userProfileGamesState.displayedCount = 6;

    const nickname = (profileData.success && profileData.profile?.nickname) || authorName || '游戏家用户';
    const accountId = (profileData.success && profileData.profile?.accountId) || ('player_' + userToken.substring(0, 6));
    const gamesCount = profileData.success ? (profileData.profile?.gamesCount || games.length) : games.length;
    const likesCount = profileData.success ? (profileData.profile?.likesCount || 0) : 0;
    const currentUserToken = getUserToken();
    const isSelf = userToken === currentUserToken;

    const modalBody = modal.querySelector('.user-profile-body');
    
    // 构建关注按钮
    let followBtnHtml = '';
    if (!isSelf) {
      followBtnHtml = '<button class="yxj-btn ' + (isFollowing ? 'yxj-btn-secondary' : 'yxj-btn-primary') + ' yxj-follow-btn" id="user-profile-follow-btn" onclick="toggleFollowFromProfile(\\x27' + userToken + '\\x27)">' + (isFollowing ? '已关注' : '+ 关注') + '</button>';
    }
    
    // 构建作品列表
    let gamesHtml = '';
    if (games.length > 0) {
      const gameCards = games.slice(0, 6).map(function(game) {
        const gameUrl = '/g/' + game.id.substring(0,2) + '/' + game.id + '.html';
        return '<div class="user-game-card" onclick="window.location.href=\\x27' + gameUrl + '\\x27">' +
          '<div class="user-game-emoji">' + getGameEmoji(game.title) + '</div>' +
          '<div class="user-game-title">' + escapeHtml(game.title) + '</div>' +
          '<div class="user-game-stats">' +
            '<span>🎮 ' + formatNumber(game.play_count || 0) + '</span>' +
            '<span>❤️ ' + formatNumber(game.like_count || 0) + '</span>' +
            '<span>💬 ' + formatNumber(game.comment_count || 0) + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
      gamesHtml = '<div class="user-games-grid" id="user-games-grid">' + gameCards + '</div>';
      if (games.length > 6) {
        gamesHtml += '<div class="user-games-load-more" id="user-games-load-more">下拉加载更多作品...</div>';
      }
    } else {
      gamesHtml = '<div class="user-games-empty">暂无作品</div>';
    }
    
    modalBody.innerHTML = 
      '<div class="user-profile-header">' +
        '<div class="user-profile-avatar">' + getAvatarEmoji(userToken) + '</div>' +
        '<div class="user-profile-info">' +
          '<div class="user-profile-name">' + escapeHtml(nickname) + '</div>' +
          '<div class="user-profile-account">@' + escapeHtml(accountId) + '</div>' +
          '<div class="user-profile-stats">' +
            '<span class="user-stat-item" onclick="openFollowListFromGame(\\x27' + userToken + '\\x27, \\x27following\\x27)">' +
              '<strong>' + following + '</strong> 关注' +
            '</span>' +
            '<span class="user-stat-divider">|</span>' +
            '<span class="user-stat-item" onclick="openFollowListFromGame(\\x27' + userToken + '\\x27, \\x27followers\\x27)">' +
              '<strong>' + followers + '</strong> 粉丝' +
            '</span>' +
            '<span class="user-stat-divider">|</span>' +
            '<span class="user-stat-item">' +
              '<strong>' + gamesCount + '</strong> 作品' +
            '</span>' +
            '<span class="user-stat-divider">|</span>' +
            '<span class="user-stat-item">' +
              '<strong>' + likesCount + '</strong> 获赞' +
            '</span>' +
          '</div>' +
        '</div>' +
        followBtnHtml +
      '</div>' +
      '<div class="user-profile-games">' +
        '<h4>🎮 作品 (' + games.length + ')</h4>' +
        '<div class="user-games-scroll-container" id="user-games-scroll-container">' +
          gamesHtml +
        '</div>' +
      '</div>';

    // 添加滚动加载更多功能
    if (games.length > 6) {
      const scrollContainer = document.getElementById('user-games-scroll-container');
      if (scrollContainer) {
        scrollContainer.addEventListener('scroll', handleUserGamesScroll);
      }
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
    const modalBody = modal.querySelector('.user-profile-body');
    modalBody.innerHTML = '<div class="user-profile-error"><div class="error-icon">😕</div><div class="error-text">加载失败，请重试</div></div>';
  }
}

// 处理作品列表滚动加载
function handleUserGamesScroll(e) {
  const container = e.target;
  const { scrollTop, scrollHeight, clientHeight } = container;
  if (scrollHeight - scrollTop - clientHeight < 50) {
    loadMoreUserGames();
  }
}

// 加载更多作品
function loadMoreUserGames() {
  const { games, displayedCount, pageSize } = userProfileGamesState;
  if (displayedCount >= games.length) return;

  const grid = document.getElementById('user-games-grid');
  const loadMoreEl = document.getElementById('user-games-load-more');
  if (!grid) return;

  const newCount = Math.min(displayedCount + pageSize, games.length);
  const newGames = games.slice(displayedCount, newCount);

  newGames.forEach(function(game) {
    const card = document.createElement('div');
    card.className = 'user-game-card';
    card.onclick = function() { window.location.href = '/g/' + game.id.substring(0,2) + '/' + game.id + '.html'; };
    card.innerHTML = '<div class="user-game-emoji">' + getGameEmoji(game.title) + '</div>' +
      '<div class="user-game-title">' + escapeHtml(game.title) + '</div>' +
      '<div class="user-game-stats">' +
        '<span>🎮 ' + formatNumber(game.play_count || 0) + '</span>' +
        '<span>❤️ ' + formatNumber(game.like_count || 0) + '</span>' +
        '<span>💬 ' + formatNumber(game.comment_count || 0) + '</span>' +
      '</div>';
    grid.appendChild(card);
  });

  userProfileGamesState.displayedCount = newCount;
  if (newCount >= games.length && loadMoreEl) {
    loadMoreEl.style.display = 'none';
  }
}

// 根据ID关闭指定的用户主页弹窗
function closeUserProfileModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
    modalZIndexManager.removeModal(modalId);
    // 只有在没有其他弹窗时才移除 modal-open 类
    if (modalZIndexManager.modalStack.length === 0) {
      document.body.classList.remove('modal-open');
    }
  }
}

// 关闭最顶层的用户主页弹窗（向后兼容）
function closeUserProfileModal() {
  // 找到最后一个（最顶层的）用户主页弹窗
  const modals = document.querySelectorAll('.user-profile-modal-instance');
  if (modals.length > 0) {
    const lastModal = modals[modals.length - 1];
    closeUserProfileModalById(lastModal.id);
  }
}

// 关闭作者主页（兼容旧版）
function closeAuthorProfile() {
  closeUserProfileModal();
  const oldModal = document.getElementById('author-profile-modal');
  if (oldModal) oldModal.style.display = 'none';
}

// 打开评论者主页（用于点击评论头像）- 复用主站用户主页样式
function openCommentAuthorProfile(commentAuthorToken) {
  openUserProfile(commentAuthorToken);
}

// 关注/取关评论者 - 复用主页弹窗关注功能
function toggleFollowCommentAuthor(targetToken) {
  toggleFollowFromProfile(targetToken);
}

// 兼容旧版API
function toggleFollowCommentAuthorLegacy(targetToken) {
  // 检查是否禁用网站写操作
  if (isWebWriteDisabled()) {
    showMiniprogramGuide('关注用户', '/pages/user/user');
    return;
  }
  
  const userToken = getUserToken();
  if (!userToken) {
    alert('请先登录后再关注');
    return;
  }
  
  const btn = document.getElementById('comment-author-follow-btn');
  const isFollowing = btn && btn.textContent.includes('已关注');
  
  fetch('/api/users/' + targetToken + '/follow', {
    method: isFollowing ? 'DELETE' : 'POST',
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && btn) {
        if (isFollowing) {
          btn.textContent = '+ 关注';
          btn.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6)';
          btn.style.color = '#fff';
        } else {
          btn.textContent = '✓ 已关注';
          btn.style.background = '#333';
          btn.style.color = '#888';
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
        btn.style.background = '#333';
        btn.style.color = '#888';
        btn.innerHTML = '✓ 已关注';
      }
    })
    .catch(() => {});
}

// 当前查看的用户token和标签
let currentViewingUserToken = null;
let currentFollowTab = 'following';
// 关注列表弹窗计数器和当前弹窗ID
let followModalCounter = 0;
let currentFollowModalId = null;

// 打开关注/粉丝列表弹窗
async function openFollowListFromGame(targetToken, tab) {
  currentViewingUserToken = targetToken || authorToken;
  currentFollowTab = tab || 'following';
  
  // 生成唯一的弹窗ID（支持多层嵌套）
  followModalCounter++;
  const modalId = 'follow-modal-game-' + followModalCounter;
  currentFollowModalId = modalId;
  
  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'modal active follow-modal-instance';
  modal.id = modalId;
  modal.style.zIndex = modalZIndexManager.getNextZIndex(modalId);
  modal.onclick = (e) => { if (e.target === modal) closeFollowModalGameById(modalId); };
  
  modal.innerHTML = 
    '<div class="modal-content modal-medium">' +
      '<div class="modal-header">' +
        '<h3 class="follow-modal-title">' + (tab === 'followers' ? '🌟 粉丝列表' : '👥 关注列表') + '</h3>' +
        '<button class="yxj-modal-close" onclick="closeFollowModalGameById(\\x27' + modalId + '\\x27)">×</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="follow-tabs">' +
          '<button class="follow-tab-btn ' + (tab === 'following' ? 'active' : '') + '" data-tab="following" onclick="switchFollowTabGameById(\\x27' + modalId + '\\x27, \\x27following\\x27)">' +
            '关注 <span class="follow-tab-count" data-type="following">0</span>' +
          '</button>' +
          '<button class="follow-tab-btn ' + (tab === 'followers' ? 'active' : '') + '" data-tab="followers" onclick="switchFollowTabGameById(\\x27' + modalId + '\\x27, \\x27followers\\x27)">' +
            '粉丝 <span class="follow-tab-count" data-type="followers">0</span>' +
          '</button>' +
        '</div>' +
        '<div class="follow-list">' +
          '<div class="follow-loading"><div class="loading-spinner"></div><span>加载中...</span></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  
  // 加载统计数据
  try {
    const statsRes = await fetch('/api/users/' + currentViewingUserToken + '/follow-stats', { headers: getAuthHeaders() });
    const statsData = await statsRes.json();
    if (statsData.success) {
      const following = statsData.followingCount || statsData.following || 0;
      const followers = statsData.followerCount || statsData.followers || 0;
      // 使用 modal 内的选择器
      const followingCountEl = modal.querySelector('.follow-tab-count[data-type="following"]');
      const followersCountEl = modal.querySelector('.follow-tab-count[data-type="followers"]');
      if (followingCountEl) followingCountEl.textContent = following;
      if (followersCountEl) followersCountEl.textContent = followers;
    }
  } catch (e) {
    console.error('加载关注统计失败:', e);
  }
  
  // 加载列表
  await loadFollowListGameById(modalId, currentFollowTab);
}

// 根据ID关闭指定的关注列表弹窗
function closeFollowModalGameById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
    modalZIndexManager.removeModal(modalId);
    // 只有在没有其他弹窗时才移除 modal-open 类
    if (modalZIndexManager.modalStack.length === 0) {
      document.body.classList.remove('modal-open');
    }
  }
}

// 关闭最顶层的关注列表弹窗（向后兼容）
function closeFollowModalGame() {
  const modals = document.querySelectorAll('.follow-modal-instance');
  if (modals.length > 0) {
    const lastModal = modals[modals.length - 1];
    closeFollowModalGameById(lastModal.id);
  }
}

// 切换关注/粉丝标签（通过弹窗ID）
async function switchFollowTabGameById(modalId, tab) {
  currentFollowTab = tab;
  
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  const followingBtn = modal.querySelector('.follow-tab-btn[data-tab="following"]');
  const followersBtn = modal.querySelector('.follow-tab-btn[data-tab="followers"]');
  if (followingBtn) followingBtn.classList.toggle('active', tab === 'following');
  if (followersBtn) followersBtn.classList.toggle('active', tab === 'followers');
  
  const modalTitle = modal.querySelector('.follow-modal-title');
  if (modalTitle) {
    modalTitle.textContent = tab === 'following' ? '👥 关注列表' : '🌟 粉丝列表';
  }
  
  await loadFollowListGameById(modalId, tab);
}

// 向后兼容的切换函数
async function switchFollowTabGame(tab) {
  if (currentFollowModalId) {
    await switchFollowTabGameById(currentFollowModalId, tab);
  }
}

// 加载关注/粉丝列表（通过弹窗ID）
async function loadFollowListGameById(modalId, type) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  const listContainer = modal.querySelector('.follow-list');
  if (!listContainer) return;
  
  listContainer.innerHTML = '<div class="follow-loading"><div class="loading-spinner"></div><span>加载中...</span></div>';
  
  try {
    const endpoint = type === 'following' 
      ? '/api/users/' + currentViewingUserToken + '/following'
      : '/api/users/' + currentViewingUserToken + '/followers';
    
    const response = await fetch(endpoint, { headers: getAuthHeaders() });
    const data = await response.json();
    
    if (data.success && data.users && data.users.length > 0) {
      listContainer.innerHTML = data.users.map(function(user) {
        return '<div class="follow-user-item" data-token="' + user.token + '">' +
          '<div class="follow-user-avatar" onclick="openUserProfile(\\x27' + user.token + '\\x27)">' +
            (user.avatar || getAvatarEmoji(user.token)) +
          '</div>' +
          '<div class="follow-user-info" onclick="openUserProfile(\\x27' + user.token + '\\x27)">' +
            '<div class="follow-user-name">' + escapeHtml(user.nickname || '游戏家用户') + '</div>' +
            '<div class="follow-user-stats">' +
              '<span>🎮 ' + (user.games_count || 0) + ' 作品</span>' +
              '<span>👥 ' + (user.followers_count || 0) + ' 粉丝</span>' +
            '</div>' +
          '</div>' +
          '<button class="follow-action-btn ' + (user.is_following ? 'following' : '') + '" onclick="event.stopPropagation(); toggleFollowUserGame(\\x27' + user.token + '\\x27, this)">' +
            (user.is_following ? '已关注' : '关注') +
          '</button>' +
        '</div>';
      }).join('');
    } else {
      listContainer.innerHTML = 
        '<div class="follow-empty">' +
          '<div class="follow-empty-icon">' + (type === 'following' ? '👤' : '🌟') + '</div>' +
          '<div class="follow-empty-text">' + (type === 'following' ? '还没有关注任何人' : '还没有粉丝') + '</div>' +
        '</div>';
    }
  } catch (error) {
    console.error('加载关注列表失败:', error);
    listContainer.innerHTML = '<div class="follow-empty"><div class="follow-empty-icon">😕</div><div class="follow-empty-text">加载失败，请重试</div></div>';
  }
}

// 向后兼容的加载函数
async function loadFollowListGame(type) {
  if (currentFollowModalId) {
    await loadFollowListGameById(currentFollowModalId, type);
  }
}

// 在列表中切换关注状态
async function toggleFollowUserGame(targetToken, btn) {
  // 检查登录状态（requireWebLogin 会处理未登录提示和禁用检测）
  if (!requireWebLogin('关注')) return;
  
  const userToken = getUserToken();
  if (!userToken) {
    alert('请先登录');
    return;
  }
  
  const isFollowing = btn.classList.contains('following');
  
  // 乐观更新
  btn.classList.toggle('following', !isFollowing);
  btn.textContent = isFollowing ? '关注' : '已关注';
  
  try {
    const response = await fetch('/api/users/' + targetToken + '/follow', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    
    if (data.success) {
      btn.classList.toggle('following', data.following);
      btn.textContent = data.following ? '已关注' : '关注';
    } else {
      // 回滚
      btn.classList.toggle('following', isFollowing);
      btn.textContent = isFollowing ? '已关注' : '关注';
    }
  } catch (e) {
    // 回滚
    btn.classList.toggle('following', isFollowing);
    btn.textContent = isFollowing ? '已关注' : '关注';
  }
}

// 切换关注状态
function toggleFollow() {
  // 检查登录状态（requireWebLogin 会处理未登录提示和禁用检测）
  if (!requireWebLogin('关注')) return;
  
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
        // 显示提示
        if (data.creditAwarded && data.creditMessage) {
          showToast('关注成功 ✨ ' + data.creditMessage, 'success');
        } else if (data.following) {
          showToast('关注成功 ✨', 'success');
        } else {
          showToast('已取消关注');
        }
      } else {
        // 回滚
        btn.classList.toggle('following', isFollowing);
        btn.innerHTML = isFollowing ? '✓ 已关注' : '<span class="follow-icon">+</span> 关注';
        showToast('操作失败，请重试');
      }
    })
    .catch(() => {
      btn.classList.toggle('following', isFollowing);
      btn.innerHTML = isFollowing ? '✓ 已关注' : '<span class="follow-icon">+</span> 关注';
      showToast('网络错误，请重试');
    });
}

// 从主页弹窗切换关注
function toggleFollowFromProfile(targetToken) {
  // 检查登录状态（requireWebLogin 会处理未登录提示和禁用检测）
  if (!requireWebLogin('关注')) return;
  
  const targetUser = targetToken || authorToken;
  if (!targetUser) return;
  
  const currentUserToken = getUserToken();
  if (!currentUserToken) {
    alert('请先登录');
    return;
  }
  
  if (targetUser === currentUserToken) {
    alert('不能关注自己哦');
    return;
  }
  
  // 新弹窗的按钮
  const btn = document.getElementById('user-profile-follow-btn') || document.getElementById('profile-follow-btn');
  if (!btn) return;
  
  const isFollowing = btn.classList.contains('yxj-btn-secondary') || btn.classList.contains('btn-secondary') || btn.innerHTML.includes('已关注');
  
  // 乐观更新
  if (isFollowing) {
    btn.className = 'yxj-btn yxj-btn-primary yxj-follow-btn';
    btn.innerHTML = '+ 关注';
  } else {
    btn.className = 'yxj-btn yxj-btn-secondary yxj-follow-btn';
    btn.innerHTML = '已关注';
  }
  
  fetch('/api/users/' + targetUser + '/follow', {
    method: 'POST',
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (data.following) {
          btn.className = 'yxj-btn yxj-btn-secondary yxj-follow-btn';
          btn.innerHTML = '已关注';
        } else {
          btn.className = 'yxj-btn yxj-btn-primary yxj-follow-btn';
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
    .catch(() => {
      // 回滚
      if (isFollowing) {
        btn.className = 'yxj-btn yxj-btn-secondary yxj-follow-btn';
        btn.innerHTML = '已关注';
      } else {
        btn.className = 'yxj-btn yxj-btn-primary yxj-follow-btn';
        btn.innerHTML = '+ 关注';
      }
    });
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
  
  if (!listEl) return;
  
  if (commentsData.comments.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:30px;color:#999;">💬 还没有留言，快来抢沙发！</div>';
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
  
  // 添加滚动加载状态提示
  if (commentsData.hasMore) {
    html += '<div class="comments-scroll-loading" id="comments-scroll-hint">下拉加载更多...</div>';
  }
  
  listEl.innerHTML = html;
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
  // 检查登录状态（requireWebLogin 会处理未登录提示和禁用检测）
  if (!requireWebLogin('评论留言')) return;
  
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
        // 评论成功后直接显示积分进度提示条
        showInteractionCreditTip('comment');
      } else {
        showToast(data.error || '发布失败');
      }
    })
    .catch(err => {
      console.error('发布留言失败:', err);
      showToast('网络错误，请重试');
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = '发布';
    });
}

// 删除留言
function deleteGameComment(commentId) {
  // 检查登录状态
  if (!requireWebLogin('删除留言')) return;
  
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

// 初始化滚动加载
function initCommentsScroll() {
  const wrapper = document.querySelector('.comments-body-wrapper');
  if (!wrapper) return;
  
  wrapper.addEventListener('scroll', function() {
    if (commentsData.isLoading || !commentsData.hasMore) return;
    
    // 距离底部50px时触发加载
    const scrollBottom = wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight;
    if (scrollBottom < 50) {
      loadGameComments(false);
    }
  });
}

// 初始化
window.addEventListener('load', function() {
  loadStats();
  updateCommentInputUI();
  loadGameComments(true);
  initCommentsScroll();
  checkIsAuthorAndShowEditBtn();
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
  <!-- 引用主站CSS样式 -->
  <link rel="stylesheet" href="/css/style.css">
  <!-- YXJ-PLATFORM-STYLE-START -->
  <style>${promoBarStyle}</style>
  <!-- YXJ-PLATFORM-STYLE-END -->
  <!-- 原游戏head内容 -->
  ${headContent}
</head>
<body${bodyAttrs}>
  <!-- 原游戏body内容 -->
  ${bodyContent}
  <!-- YXJ-PLATFORM-UI-START -->
  ${promoBarHtml}
  <!-- YXJ-PLATFORM-UI-END -->
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
  }
  
  // 最终清理：移除代码中残留的任何 markdown 代码块标记
  // 这些可能出现在代码中间（比如 AI 错误地在代码中间插入了 markdown 标记）
  code = code.replace(/```html\s*\n?/gi, '');
  code = code.replace(/```\s*$/gm, '');
  // 只移除独立成行的 ``` （不影响模板字符串中的反引号）
  code = code.replace(/^```\s*$/gm, '');
  
  console.log('[INFO] 代码提取完成');
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
      baseUrl: TRIAL_CONFIG.baseUrl,
      provider: 'deepseek' // 环境变量配置默认使用deepseek
    };
  }
  
  // 其次使用管理后台配置的默认LLM
  const defaultApiKey = getConfig('llm_default_api_key', '');
  const defaultModel = getConfig('llm_default_model', 'deepseek-chat');
  const defaultBaseUrl = getConfig('llm_default_base_url', 'https://api.deepseek.com');
  
  if (defaultApiKey) {
    // 根据模型名称判断 provider（因为此时 AVAILABLE_MODELS 尚未定义）
    let provider = 'deepseek';
    if (defaultModel.startsWith('glm-')) {
      provider = 'zhipu';
    } else if (defaultModel.startsWith('kimi-') || defaultModel.startsWith('moonshot-')) {
      provider = 'moonshot';
    } else if (defaultModel.startsWith('qwen')) {
      provider = 'alibaba';
    } else if (defaultModel.startsWith('gpt-') || defaultModel.startsWith('o1') || defaultModel.startsWith('o3') || defaultModel.startsWith('o4')) {
      provider = 'openai';
    } else if (defaultModel.startsWith('claude-')) {
      provider = 'anthropic';
    } else if (defaultModel.startsWith('gemini-')) {
      provider = 'openrouter';
    }
    
    return {
      apiKey: defaultApiKey,
      model: defaultModel,
      baseUrl: defaultBaseUrl || 'https://api.deepseek.com',
      provider: provider
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

/**
 * 格式化积分值，解决浮点数精度问题
 * 保留最多1位小数，整数不显示小数点
 * @param {number} credits - 积分数值
 * @returns {number} 格式化后的积分数值
 */
function formatCreditsValue(credits) {
  if (typeof credits !== 'number' || isNaN(credits)) {
    return 0;
  }
  return Math.round(credits * 10) / 10;
}

// ==================== 邮件发送服务 ====================

/**
 * 获取 SMTP 配置
 * @returns {Object|null} SMTP 配置对象，未配置时返回 null
 */
function getSmtpConfig() {
  const host = getConfig('smtp_host', '');
  const user = getConfig('smtp_user', '');
  const pass = getConfig('smtp_pass', '');
  
  if (!host || !user || !pass) {
    return null;
  }
  
  return {
    host: host,
    port: parseInt(getConfig('smtp_port', '465')),
    secure: getConfig('smtp_secure', 'true') === 'true',
    auth: {
      user: user,
      pass: pass
    }
  };
}

/**
 * 发送邮件
 * @param {string} to - 收件人邮箱
 * @param {string} subject - 邮件主题
 * @param {string} html - 邮件HTML内容
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendEmail(to, subject, html) {
  const smtpConfig = getSmtpConfig();
  
  if (!smtpConfig) {
    console.error('[EMAIL] SMTP未配置');
    return { success: false, error: '邮件服务未配置，请联系管理员' };
  }
  
  const fromName = getConfig('smtp_from_name', '一句话游戏');
  // 强制使用SMTP认证用户作为发件人邮箱（很多SMTP服务器要求发件人地址必须与认证账号一致）
  const fromEmail = smtpConfig.auth.user;
  
  try {
    const transporter = nodemailer.createTransport(smtpConfig);
    
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: to,
      subject: subject,
      html: html
    });
    
    console.log('[EMAIL] 邮件发送成功:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] 邮件发送失败:', error.message);
    return { success: false, error: '邮件发送失败，请稍后重试' };
  }
}

/**
 * 生成6位数字验证码
 * @returns {string}
 */
function generateEmailCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 生成邮箱验证码邮件HTML
 * @param {string} code - 验证码
 * @param {string} type - 类型：verify（验证邮箱）/ reset（重置密码）
 * @returns {string}
 */
function generateEmailCodeHtml(code, type = 'verify') {
  const siteName = getConfig('site_name', '一句话游戏');
  const expireMinutes = parseInt(getConfig('email_code_expire_minutes', '10'));
  
  const title = type === 'reset' ? '重置密码验证码' : '邮箱验证码';
  const description = type === 'reset' 
    ? '您正在重置账号密码' 
    : '您正在验证邮箱，验证成功后可用于找回密码';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #fff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
        <h1 style="margin: 0; color: #fff; font-size: 24px;">${siteName}</h1>
        <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${title}</p>
      </div>
      
      <!-- Content -->
      <div style="padding: 40px 30px;">
        <p style="margin: 0 0 20px; color: #333; font-size: 16px;">您好！</p>
        <p style="margin: 0 0 30px; color: #666; font-size: 14px; line-height: 1.6;">${description}。请使用以下验证码完成操作：</p>
        
        <!-- Code Box -->
        <div style="background: #f8f9fa; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
          <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px;">${code}</span>
        </div>
        
        <p style="margin: 0 0 10px; color: #999; font-size: 13px;">⏰ 验证码有效期 ${expireMinutes} 分钟，请尽快使用</p>
        <p style="margin: 0; color: #999; font-size: 13px;">⚠️ 如非本人操作，请忽略此邮件</p>
      </div>
      
      <!-- Footer -->
      <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #999; font-size: 12px;">此邮件由系统自动发送，请勿回复</p>
        <p style="margin: 8px 0 0; color: #bbb; font-size: 12px;">© ${new Date().getFullYear()} ${siteName}</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 验证邮箱格式
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

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
  // DeepSeek V3/R1 最大输出 8192 tokens
  'deepseek-v3': { name: 'DeepSeek V3', provider: 'deepseek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com', tier: 'standard', creditCost: 1, speed: 'slow', quality: 'high', maxTokens: 8192, recommended: true },
  'deepseek-r1': { name: 'DeepSeek R1', provider: 'deepseek', model: 'deepseek-reasoner', baseUrl: 'https://api.deepseek.com', tier: 'standard', creditCost: 1, speed: 'slow', quality: 'very-high', maxTokens: 8192 },
  
  // OpenAI 系列 - Turbo加速选项
  // GPT-4o/4o-mini 最大输出 16384 tokens
  'gpt-4o': { name: 'GPT-4o', provider: 'openai', model: 'gpt-4o', baseUrl: 'https://api.openai.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'very-high', maxTokens: 16384 },
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com', tier: 'turbo', creditCost: 1, speed: 'fast', quality: 'medium', maxTokens: 16384, turboRecommended: true },
  // GPT-5 系列（假设更大输出能力）
  'gpt-5': { name: 'GPT 5', provider: 'openai', model: 'gpt-5', baseUrl: 'https://api.openai.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'excellent', maxTokens: 32768 },
  'gpt-5.1': { name: 'GPT 5.1', provider: 'openai', model: 'gpt-5.1', baseUrl: 'https://api.openai.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'excellent', maxTokens: 32768 },
  'gpt-5.1-codex': { name: 'GPT 5.1 Codex', provider: 'openai', model: 'gpt-5.1-codex', baseUrl: 'https://api.openai.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'excellent', maxTokens: 32768 },
  
  // Claude 系列
  // Claude 4.5 Opus 最大输出 16384 tokens，其他 Claude 最大 8192 tokens
  'claude-4.5-opus': { name: 'Claude 4.5 Opus', provider: 'anthropic', model: 'claude-sonnet-4-5-20250514', baseUrl: 'https://api.anthropic.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'excellent', maxTokens: 16384, new: true },
  'claude-4.5-sonnet': { name: 'Claude 4.5 Sonnet', provider: 'anthropic', model: 'claude-4.5-sonnet', baseUrl: 'https://api.anthropic.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'very-high', maxTokens: 16384 },
  'claude-4.5-haiku': { name: 'Claude 4.5 Haiku', provider: 'anthropic', model: 'claude-4.5-haiku', baseUrl: 'https://api.anthropic.com', tier: 'turbo', creditCost: 1, speed: 'fast', quality: 'medium', maxTokens: 8192 },
  'claude-4-sonnet': { name: 'Claude 4 Sonnet', provider: 'anthropic', model: 'claude-4-sonnet', baseUrl: 'https://api.anthropic.com', tier: 'pro', creditCost: 1, speed: 'medium', quality: 'high', maxTokens: 8192 },
  'claude-3.7-sonnet': { name: 'Claude 3.7 Sonnet', provider: 'anthropic', model: 'claude-3-7-sonnet-20250219', baseUrl: 'https://api.anthropic.com', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'high', maxTokens: 8192 },
  
  // Google Gemini 系列 - 通过 OpenRouter 代理访问（国内可用）
  // Gemini 2.5 Pro 最大输出 65536 tokens，Flash 系列 8192 tokens
  'gemini-3-pro': { name: 'Gemini 3 Pro', provider: 'openrouter', model: 'google/gemini-3-pro-preview', baseUrl: 'https://openrouter.ai/api', tier: 'pro', creditCost: 1, speed: 'fast', quality: 'very-high', maxTokens: 65536, new: true },
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', provider: 'openrouter', model: 'google/gemini-2.5-pro', baseUrl: 'https://openrouter.ai/api', tier: 'pro', creditCost: 1, speed: 'fast', quality: 'very-high', maxTokens: 65536 },
  'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', provider: 'openrouter', model: 'google/gemini-2.5-flash', baseUrl: 'https://openrouter.ai/api', tier: 'standard', creditCost: 1, speed: 'very-fast', quality: 'high', maxTokens: 8192 },
  'gemini-2.0-flash': { name: 'Gemini 2.0 Flash', provider: 'openrouter', model: 'google/gemini-2.0-flash-001', baseUrl: 'https://openrouter.ai/api', tier: 'standard', creditCost: 1, speed: 'very-fast', quality: 'high', maxTokens: 8192 },
  
  // 国产模型
  // GLM-4 系列（智谱AI使用 /v4 版本的API）- 根据官方文档 https://docs.bigmodel.cn
  // GLM-4.7: 高智能旗舰，上下文200K，最大输出128K
  'glm-4.7': { name: 'GLM-4.7 (旗舰)', provider: 'zhipu', model: 'glm-4.7', baseUrl: 'https://open.bigmodel.cn/api/paas', tier: 'standard', creditCost: 2, speed: 'medium', quality: 'high', maxTokens: 128000, new: true },
  // GLM-4.7-FlashX: 轻量高速，上下文200K，最大输出128K
  'glm-4.7-flashx': { name: 'GLM-4.7-FlashX (轻量高速)', provider: 'zhipu', model: 'glm-4.7-flashx', baseUrl: 'https://open.bigmodel.cn/api/paas', tier: 'standard', creditCost: 1, speed: 'fast', quality: 'high', maxTokens: 128000 },
  // GLM-4.7-Flash: 免费模型，上下文200K，最大输出128K
  'glm-4.7-flash': { name: 'GLM-4.7-Flash (免费)', provider: 'zhipu', model: 'glm-4.7-flash', baseUrl: 'https://open.bigmodel.cn/api/paas', tier: 'free', creditCost: 0, speed: 'fast', quality: 'medium', maxTokens: 128000 },
  // GLM-4.6: 超强性能，上下文200K，最大输出128K
  'glm-4.6': { name: 'GLM-4.6 (超强性能)', provider: 'zhipu', model: 'glm-4.6', baseUrl: 'https://open.bigmodel.cn/api/paas', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'high', maxTokens: 128000 },
  // GLM-4.5-Air: 高性价比，上下文128K，最大输出96K
  'glm-4.5-air': { name: 'GLM-4.5-Air (高性价比)', provider: 'zhipu', model: 'glm-4.5-air', baseUrl: 'https://open.bigmodel.cn/api/paas', tier: 'standard', creditCost: 1, speed: 'fast', quality: 'medium', maxTokens: 96000 },
  // GLM-4.5-AirX: 高性价比极速版，上下文128K，最大输出96K
  'glm-4.5-airx': { name: 'GLM-4.5-AirX (极速)', provider: 'zhipu', model: 'glm-4.5-airx', baseUrl: 'https://open.bigmodel.cn/api/paas', tier: 'standard', creditCost: 1, speed: 'fast', quality: 'medium', maxTokens: 96000 },
  // GLM-4-Long: 超长输入1M，最大输出4K
  'glm-4-long': { name: 'GLM-4-Long (超长上下文)', provider: 'zhipu', model: 'glm-4-long', baseUrl: 'https://open.bigmodel.cn/api/paas', tier: 'standard', creditCost: 1, speed: 'slow', quality: 'high', maxTokens: 4000 },
  // Kimi K2 系列模型
  // kimi-k2.5: 多模态模型，支持视觉与文本输入，上下文256K，最大输出 262,144 tokens
  'kimi-k2.5': { name: 'Kimi K2.5 (多模态推荐)', provider: 'moonshot', model: 'kimi-k2.5', baseUrl: 'https://api.moonshot.cn', tier: 'premium', creditCost: 2, speed: 'medium', quality: 'excellent', maxTokens: 262144 },
  // kimi-k2-turbo-preview: 推荐的高性能版本，上下文262K，最大输出 262,144 tokens
  'kimi-k2-turbo-preview': { name: 'Kimi K2 Turbo (推荐)', provider: 'moonshot', model: 'kimi-k2-turbo-preview', baseUrl: 'https://api.moonshot.cn', tier: 'standard', creditCost: 1, speed: 'fast', quality: 'high', maxTokens: 262144 },
  // kimi-k2-0905-preview: 最新版本，上下文262K，最大输出 262,144 tokens
  'kimi-k2-0905-preview': { name: 'Kimi K2 0905', provider: 'moonshot', model: 'kimi-k2-0905-preview', baseUrl: 'https://api.moonshot.cn', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'high', maxTokens: 262144 },
  // kimi-k2-0711-preview: 稳定版本，上下文131K，最大输出 131,072 tokens
  'kimi-k2-0711-preview': { name: 'Kimi K2 0711', provider: 'moonshot', model: 'kimi-k2-0711-preview', baseUrl: 'https://api.moonshot.cn', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'high', maxTokens: 131072 },
  // kimi-k2-thinking: 思考模型，支持深度推理，上下文262K，最大输出 262,144 tokens
  'kimi-k2-thinking': { name: 'Kimi K2 Thinking', provider: 'moonshot', model: 'kimi-k2-thinking', baseUrl: 'https://api.moonshot.cn', tier: 'standard', creditCost: 1, speed: 'slow', quality: 'excellent', maxTokens: 262144 },
  // kimi-k2-thinking-turbo: 快速思考模型，上下文262K，最大输出 262,144 tokens
  'kimi-k2-thinking-turbo': { name: 'Kimi K2 Thinking Turbo', provider: 'moonshot', model: 'kimi-k2-thinking-turbo', baseUrl: 'https://api.moonshot.cn', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'excellent', maxTokens: 262144 },
  // Qwen Coder Plus 最大输出 8192 tokens
  'qwen3-coder-plus': { name: 'Qwen3 Coder Plus', provider: 'alibaba', model: 'qwen-coder-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode', tier: 'standard', creditCost: 1, speed: 'medium', quality: 'high', maxTokens: 8192 },
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

// 获取模型的最大Token数（优先使用代码中定义的默认值，数据库配置可覆盖但不能低于默认值）
function getModelMaxTokens(modelId) {
  const model = LLM_MODELS[modelId];
  const codeDefault = model ? (model.maxTokens || 8000) : 8000;
  
  // 尝试从数据库配置读取
  const configKey = `llm_maxtokens_${modelId}`;
  const configValue = getConfig(configKey, null);
  if (configValue !== null) {
    const dbValue = parseInt(configValue, 10) || 8000;
    // 如果数据库配置值比代码默认值小，使用代码默认值（防止旧配置导致截断）
    return Math.max(dbValue, codeDefault);
  }
  
  return codeDefault;
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

// 获取模型的 temperature 参数（某些模型有特殊要求）
function getModelTemperature(modelId, defaultTemp = 0.7) {
  // kimi-k2.5 只允许 temperature=1
  if (modelId === 'kimi-k2.5') {
    return 1;
  }
  // 其他 kimi-k2 thinking 系列模型也可能有限制，暂时使用默认值
  // 如果后续发现其他模型有限制，可以在这里添加
  return defaultTemp;
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
// 获取模型的速度等级（从数据库配置或使用默认值）
function getModelSpeedLevel(modelId) {
  const configKey = `llm_speed_${modelId}`;
  const configuredSpeed = getConfig(configKey, null);
  if (configuredSpeed) {
    return configuredSpeed;
  }
  // 根据模型默认speed字段映射到速度等级
  const model = LLM_MODELS[modelId];
  if (!model) return 'normal';
  const speedMap = {
    'very-fast': 'ultra',
    'fast': 'fast',
    'medium': 'normal',
    'slow': 'slow',
    'very-slow': 'very-slow'
  };
  return speedMap[model.speed] || 'normal';
}

function getTurboModels() {
  return Object.entries(LLM_MODELS)
    .filter(([key, config]) => {
      // 只返回启用的模型
      if (!isModelEnabled(key)) return false;
      
      // 只返回后台已配置API Key的模型（不再支持用户自定义Key）
      const apiKeyKey = `llm_apikey_${key}`;
      const hasBackendKey = getConfig(apiKeyKey, null) !== null && getConfig(apiKeyKey, '').length > 0;
      
      // 也检查默认Key和环境变量
      const defaultApiKey = getConfig('llm_default_api_key', null);
      const hasDefaultKey = defaultApiKey && defaultApiKey.length > 0;
      const hasEnvKey = process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.length > 0;
      
      // 模型必须有可用的Key才显示给用户
      return hasBackendKey || hasDefaultKey || hasEnvKey;
    })
    .map(([key, config]) => {
      const creditCost = getModelCreditCost(key);
      const quality = getModelQuality(key);
      const maxTokens = getModelMaxTokens(key);
      
      // 获取配置的速度等级
      const speedLevel = getModelSpeedLevel(key);
      
      return {
        id: key,
        name: config.name,
        creditCost: creditCost,
        speedLevel: speedLevel,  // 返回速度等级（ultra/fast/normal/slow/very-slow）
        quality: quality,
        maxTokens: maxTokens,  // 最大Token数
        turboRecommended: config.turboRecommended || false,
        hasDefaultKey: true  // 所有返回的模型都已配置Key
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

// 用于追踪活跃的编辑请求，支持取消功能
const activeEdits = new Map(); // sessionId -> { userToken, startTime, cancelled, abortController }

// ============ 异步生成任务系统（解决Cloudflare 524超时问题） ============
// 用于存储异步生成任务的状态和结果
const asyncGenerateTasks = new Map(); // taskId -> { status, progress, progressText, result, error, createdAt, userToken }

// ============ 异步编辑任务系统（解决Cloudflare 524超时问题） ============
// 用于存储异步编辑任务的状态和结果
const asyncEditTasks = new Map(); // taskId -> { status, progress, progressText, result, error, createdAt, userToken, sessionId, gameId }

// 清理过期的异步任务（超过30分钟的）
function cleanupOldAsyncTasks() {
  const now = Date.now();
  const expireTime = 30 * 60 * 1000; // 30分钟
  for (const [taskId, task] of asyncGenerateTasks.entries()) {
    if (now - task.createdAt > expireTime) {
      asyncGenerateTasks.delete(taskId);
      console.log(`[AsyncTask] 清理过期任务: ${taskId}`);
    }
  }
  // 同时清理编辑任务
  for (const [taskId, task] of asyncEditTasks.entries()) {
    if (now - task.createdAt > expireTime) {
      asyncEditTasks.delete(taskId);
      console.log(`[AsyncEditTask] 清理过期任务: ${taskId}`);
    }
  }
}
// 每5分钟清理一次过期任务
setInterval(cleanupOldAsyncTasks, 5 * 60 * 1000);

// 标记编辑请求为已取消
function cancelEditRequest(sessionId) {
  const info = activeEdits.get(sessionId);
  if (info) {
    info.cancelled = true;
    if (info.abortController) {
      try {
        info.abortController.abort();
        console.log(`[编辑取消] 已中断 LLM 请求: ${sessionId}`);
      } catch (e) {
        console.log(`[编辑取消] 中断 LLM 请求失败: ${e.message}`);
      }
    }
    console.log(`[编辑取消] 请求已标记为取消: ${sessionId}`);
    return true;
  }
  return false;
}

// 检查编辑请求是否已被取消
function isEditCancelled(sessionId) {
  const info = activeEdits.get(sessionId);
  return info ? info.cancelled : false;
}

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

// ==================== 数据迁移：修复 status='active' 的游戏 ====================
// 小程序异步生成的游戏之前错误地设置了 status='active'，导致网站无法显示
// 将这些游戏的 status 更新为 'published'，使其能够在网站正常显示
try {
  const result = db.prepare(`
    UPDATE games 
    SET status = 'published', 
        visibility = COALESCE(visibility, 'public'),
        is_public = COALESCE(is_public, 1)
    WHERE status = 'active'
  `).run();
  
  if (result.changes > 0) {
    console.log(`[DB-Migration] 修复了 ${result.changes} 个 status='active' 的游戏，已更新为 'published'`);
  }
} catch (e) {
  console.error('[DB-Migration] 修复游戏状态失败:', e.message);
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

// 添加 email 字段（如果不存在）
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN email TEXT`);
  console.log('[DB] 添加 email 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 email_verified 字段（如果不存在）
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN email_verified INTEGER DEFAULT 0`);
  console.log('[DB] 添加 email_verified 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// ==================== 邮箱验证码表 ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS email_verify_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    user_token TEXT NOT NULL,
    email TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'verify',
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(code, email, type)
  )
`);
console.log('[DB] 邮箱验证码表初始化完成');

// 创建邮箱验证码索引
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_email_verify_codes_email ON email_verify_codes(email)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_email_verify_codes_user ON email_verify_codes(user_token)`);
} catch (e) {
  // 索引已存在，忽略
}

// 添加 is_admin 字段（如果不存在）- 标识管理员用户
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN is_admin INTEGER DEFAULT 0`);
  console.log('[DB] 添加 is_admin 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 wechat_openid 字段（如果不存在）- 微信小程序登录用
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN wechat_openid TEXT`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_user_accounts_wechat_openid ON user_accounts(wechat_openid)`);
  console.log('[DB] 添加 wechat_openid 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加网站激活相关字段（如果不存在）
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN web_activated INTEGER DEFAULT 0`);
  console.log('[DB] 添加 web_activated 字段成功');
} catch (e) {
  // 字段已存在，忽略
}
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN activated_at DATETIME`);
  console.log('[DB] 添加 activated_at 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加订阅通知次数字段（用于小程序订阅消息）
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN subscribe_count INTEGER DEFAULT 0`);
  console.log('[DB] 添加 subscribe_count 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 添加积分字段（用于存储用户积分余额）
try {
  db.exec(`ALTER TABLE user_accounts ADD COLUMN credits REAL DEFAULT 0`);
  console.log('[DB] 添加 credits 字段成功');
} catch (e) {
  // 字段已存在，忽略
}

// 创建账号索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_accounts_account_id ON user_accounts(account_id);
  CREATE INDEX IF NOT EXISTS idx_user_accounts_user_token ON user_accounts(user_token);
  CREATE INDEX IF NOT EXISTS idx_user_accounts_device_fingerprint ON user_accounts(device_fingerprint);
`);

// ==================== 登录日志表 ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    account_id TEXT,
    login_type TEXT DEFAULT 'web',
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    success INTEGER DEFAULT 1,
    fail_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_login_logs_user_token ON login_logs(user_token)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at)`);
console.log('[DB] 登录日志表初始化完成');

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

// 生成唯一游戏ID的函数
function generateGameId() {
  return uuidv4();
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

// 检查用户是否为管理员
function isUserAdmin(userToken) {
  if (!userToken) return false;
  const user = db.prepare('SELECT is_admin FROM user_accounts WHERE user_token = ?').get(userToken);
  return user && user.is_admin === 1;
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
  { key: 'credits_share_game_daily_limit', value: '5', description: '每日分享游戏获取积分上限次数' },
  { key: 'credits_invite_friend', value: '3', description: '邀请好友奖励' },
  { key: 'credits_invite_friend_daily_limit', value: '5', description: '每日邀请好友获取积分上限次数' },
  { key: 'credits_article', value: '1', description: '阅读文章奖励' },
  { key: 'credits_article_daily_limit', value: '3', description: '每日阅读文章获取积分上限次数' },
  // 行为积分配置
  { key: 'credits_action_like', value: '0.1', description: '点赞作品奖励积分' },
  { key: 'credits_action_like_daily_limit', value: '10', description: '每日点赞获取积分上限次数' },
  { key: 'credits_action_favorite', value: '0.2', description: '收藏作品奖励积分' },
  { key: 'credits_action_favorite_daily_limit', value: '5', description: '每日收藏获取积分上限次数' },
  { key: 'credits_action_follow', value: '0.2', description: '关注别人奖励积分' },
  { key: 'credits_action_follow_daily_limit', value: '5', description: '每日关注获取积分上限次数' },
  { key: 'credits_action_comment', value: '0.5', description: '评论作品奖励积分' },
  { key: 'credits_action_comment_daily_limit', value: '2', description: '每日评论获取积分上限次数' },
  { key: 'credits_comment_min_length', value: '10', description: '评论获得积分的最低字数' },
  // ==================== 积分引流系统配置 ====================
  // 基础积分配置
  { key: 'credits_register', value: '1', description: '新用户注册积分' },
  { key: 'credits_daily_login', value: '1', description: '每日登录积分' },
  // 签到配置（小程序端）
  { key: 'credits_checkin_base', value: '1', description: '签到基础积分' },
  { key: 'credits_checkin_streak_3', value: '1', description: '连续签到3天额外加成' },
  { key: 'credits_checkin_streak_7', value: '2', description: '连续签到7天额外加成' },
  { key: 'credits_checkin_streak_14', value: '3', description: '连续签到14天额外加成' },
  { key: 'credits_checkin_streak_30', value: '5', description: '连续签到30天额外加成' },
  // 互动任务积分领取规则（网站做任务，小程序领取）
  { key: 'credits_claim_like_threshold', value: '10', description: '点赞N次可领取积分' },
  { key: 'credits_claim_like_reward', value: '1', description: '点赞任务领取积分' },
  { key: 'credits_claim_like_daily_limit', value: '3', description: '点赞任务每日领取上限' },
  { key: 'credits_claim_favorite_threshold', value: '5', description: '收藏N次可领取积分' },
  { key: 'credits_claim_favorite_reward', value: '1', description: '收藏任务领取积分' },
  { key: 'credits_claim_favorite_daily_limit', value: '3', description: '收藏任务每日领取上限' },
  { key: 'credits_claim_follow_threshold', value: '5', description: '关注N次可领取积分' },
  { key: 'credits_claim_follow_reward', value: '1', description: '关注任务领取积分' },
  { key: 'credits_claim_follow_daily_limit', value: '3', description: '关注任务每日领取上限' },
  { key: 'credits_claim_comment_threshold', value: '2', description: '评论N次可领取积分' },
  { key: 'credits_claim_comment_reward', value: '1', description: '评论任务领取积分' },
  { key: 'credits_claim_comment_daily_limit', value: '3', description: '评论任务每日领取上限' },
  { key: 'credits_claim_share_threshold', value: '2', description: '分享N次可领取积分' },
  { key: 'credits_claim_share_reward', value: '1', description: '分享任务领取积分' },
  { key: 'credits_claim_share_daily_limit', value: '3', description: '分享任务每日领取上限' },
  // 订阅通知配置
  { key: 'credits_subscribe_task', value: '0.5', description: '订阅创作中任务完成通知奖励积分' },
  // 创作激励配置
  { key: 'credits_create_game', value: '2', description: '创作游戏奖励积分' },
  { key: 'credits_create_game_daily_limit', value: '1', description: '创作游戏每日领取上限' },
  { key: 'credits_edit_game_threshold', value: '2', description: '编辑游戏N次可领取' },
  { key: 'credits_edit_game_reward', value: '1', description: '编辑游戏领取积分' },
  { key: 'credits_edit_game_daily_limit', value: '1', description: '编辑游戏每日领取上限' },
  // 激励视频广告配置
  { key: 'credits_ad_reward', value: '3', description: '激励视频广告奖励' },
  { key: 'credits_ad_daily_limit', value: '30', description: '激励广告每日上限' },
  { key: 'credits_ad_enabled', value: 'false', description: '激励广告功能是否启用' },
  { key: 'rewarded_video_ad_unit_id', value: '', description: '激励视频广告单元ID' },
  // 邀请好友配置（小程序端）
  { key: 'credits_mp_invite', value: '5', description: '小程序邀请好友奖励（好友首次创作后双方得）' },
  { key: 'site_name', value: '一句话游戏', description: '网站名称' },
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
  // 网站激活配置
  { key: 'site_url', value: '', description: '网站域名（用于生成激活链接，如 https://youxijia.fun）' },
  { key: 'activate_token_expire_minutes', value: '10', description: '激活Token有效期（分钟）' },
  // 功能开关配置（默认全部开放）
  { key: 'web_create_disabled', value: 'false', description: '禁用网站创作功能' },
  { key: 'web_edit_disabled', value: 'false', description: '禁用网站编辑/修复功能' },
  { key: 'web_interact_disabled', value: 'false', description: '禁用网站互动功能' },
  // ==================== 邮箱功能配置 ====================
  { key: 'smtp_host', value: '', description: 'SMTP服务器地址' },
  { key: 'smtp_port', value: '465', description: 'SMTP端口（465为SSL，587为TLS）' },
  { key: 'smtp_secure', value: 'true', description: 'SMTP是否使用SSL（465端口设为true）' },
  { key: 'smtp_user', value: '', description: 'SMTP用户名（通常是邮箱地址）' },
  { key: 'smtp_pass', value: '', description: 'SMTP密码或授权码' },
  { key: 'smtp_from_name', value: '一句话游戏', description: '发件人名称' },
  { key: 'smtp_from_email', value: '', description: '发件人邮箱地址' },
  { key: 'credits_verify_email', value: '3', description: '验证邮箱奖励积分' },
  { key: 'email_code_expire_minutes', value: '10', description: '邮箱验证码有效期（分钟）' },
  // ==================== 昵称奖励配置 ====================
  { key: 'credits_set_nickname', value: '3', description: '设置昵称奖励积分（首次从默认昵称修改为自定义昵称）' },
];

// 【重要】强制修复功能开关配置：确保网站创作功能默认开放
// 这是为了修复之前默认值错误导致的问题
const fixedConfigs = [
  { key: 'web_create_disabled', value: 'false' },
  { key: 'web_edit_disabled', value: 'false' },
  { key: 'web_interact_disabled', value: 'false' },
];
fixedConfigs.forEach(config => {
  const current = db.prepare('SELECT value FROM system_config WHERE key = ?').get(config.key);
  if (!current) {
    // 配置不存在，插入默认值
    db.prepare('INSERT INTO system_config (key, value) VALUES (?, ?)').run(config.key, config.value);
    console.log(`[CONFIG] 初始化功能开关: ${config.key} = ${config.value}`);
  } else if (current.value === 'true') {
    // 【一次性修复】如果配置为 'true'，强制改为 'false' 以修复错误
    // 用户之后可以在后台管理页面重新设置
    db.prepare('UPDATE system_config SET value = ? WHERE key = ?').run(config.value, config.key);
    console.log(`[CONFIG] 修复功能开关: ${config.key} = 'true' → '${config.value}'`);
  }
});

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

// 添加 email_verified 字段（邮箱验证状态）
try {
  db.exec('ALTER TABLE user_credits ADD COLUMN email_verified INTEGER DEFAULT 0');
} catch (e) {
  // 字段已存在，忽略
}

// 添加 nickname_rewarded 字段（昵称奖励是否已领取）
try {
  db.exec('ALTER TABLE user_credits ADD COLUMN nickname_rewarded INTEGER DEFAULT 0');
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

// 创建文章推广验证码表
db.exec(`
  CREATE TABLE IF NOT EXISTS article_promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    article_id TEXT,
    description TEXT,
    reward INTEGER DEFAULT 1,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建验证码使用记录表
db.exec(`
  CREATE TABLE IF NOT EXISTS promo_code_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    code TEXT NOT NULL,
    article_id TEXT,
    source TEXT DEFAULT 'code',
    ip_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, code)
  )
`);

// 创建每日行为积分记录表
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_action_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_date TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, action_type, action_date)
  )
`);

// 创建评论积分记录表（用于同游戏仅首次获得积分）
db.exec(`
  CREATE TABLE IF NOT EXISTS comment_credit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    game_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, game_id)
  )
`);

// 创建点赞积分记录表（用于同游戏仅首次获得积分，防止取消再点赞重复获取）
db.exec(`
  CREATE TABLE IF NOT EXISTS like_credit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    game_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, game_id)
  )
`);

// 创建收藏积分记录表（用于同游戏仅首次获得积分，防止取消再收藏重复获取）
db.exec(`
  CREATE TABLE IF NOT EXISTS favorite_credit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    game_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, game_id)
  )
`);

// 创建关注积分记录表（用于同用户仅首次获得积分，防止取消再关注重复获取）
db.exec(`
  CREATE TABLE IF NOT EXISTS follow_credit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_token TEXT NOT NULL,
    following_token TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_token, following_token)
  )
`);

// ==================== 小程序积分引流系统 - 数据库表 ====================

// 创建成就定义表
db.exec(`
  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    category TEXT,
    condition_type TEXT,
    condition_value INTEGER,
    reward_credits REAL,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 创建用户成就进度表
db.exec(`
  CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    current_value INTEGER DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    is_claimed INTEGER DEFAULT 0,
    completed_at DATETIME,
    claimed_at DATETIME,
    period_start TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, achievement_id, period_start)
  )
`);
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_token);
  CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
`);

// 创建签到记录表
db.exec(`
  CREATE TABLE IF NOT EXISTS user_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    checkin_date TEXT NOT NULL,
    streak_days INTEGER DEFAULT 1,
    reward_credits REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, checkin_date)
  )
`);
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_checkins_user ON user_checkins(user_token);
  CREATE INDEX IF NOT EXISTS idx_user_checkins_date ON user_checkins(checkin_date);
`);

// 创建用户行为统计表（用于成就系统和互动积分领取）
db.exec(`
  CREATE TABLE IF NOT EXISTS user_action_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    action_type TEXT NOT NULL,
    period_type TEXT NOT NULL,
    period_start TEXT NOT NULL,
    action_count INTEGER DEFAULT 0,
    claimed_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, action_type, period_type, period_start)
  )
`);
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_action_stats_user ON user_action_stats(user_token);
  CREATE INDEX IF NOT EXISTS idx_user_action_stats_period ON user_action_stats(period_type, period_start);
`);

// 创建用户互动记录表（防止同一游戏/用户重复计入积分统计）
db.exec(`
  CREATE TABLE IF NOT EXISTS user_action_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_token, action_type, target_id, period_start)
  )
`);
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_action_records_user ON user_action_records(user_token, action_type, period_start);
`);

// 初始化成就数据
function initAchievementsData() {
  const existingCount = db.prepare('SELECT COUNT(*) as cnt FROM achievements').get().cnt;
  if (existingCount > 0) {
    console.log('[DB] 成就数据已存在，跳过初始化');
    return;
  }
  
  console.log('[DB] 初始化成就数据...');
  
  const achievements = [
    // 每日成就
    { id: 'daily_active', name: '日活跃', description: '登录+任意1次互动', icon: '🌟', category: 'daily', condition_type: 'daily_active', condition_value: 1, reward_credits: 1, sort_order: 1 },
    { id: 'daily_interactive', name: '互动达标', description: '点赞+收藏+关注各完成每日上限', icon: '🎯', category: 'daily', condition_type: 'daily_interactive', condition_value: 1, reward_credits: 3, sort_order: 2 },
    { id: 'daily_comment', name: '社区贡献', description: '发表1条有效评论', icon: '💬', category: 'daily', condition_type: 'comment_count', condition_value: 1, reward_credits: 1, sort_order: 3 },
    
    // 每周成就
    { id: 'weekly_active', name: '周活跃之星', description: '连续登录7天', icon: '⭐', category: 'weekly', condition_type: 'login_days', condition_value: 7, reward_credits: 5, sort_order: 1 },
    { id: 'weekly_like', name: '周点赞达人', description: '本周点赞50次', icon: '❤️', category: 'weekly', condition_type: 'like_count', condition_value: 50, reward_credits: 5, sort_order: 2 },
    { id: 'weekly_favorite', name: '周收藏家', description: '本周收藏20次', icon: '📚', category: 'weekly', condition_type: 'favorite_count', condition_value: 20, reward_credits: 5, sort_order: 3 },
    { id: 'weekly_follow', name: '周社交王', description: '本周关注15人', icon: '👥', category: 'weekly', condition_type: 'follow_count', condition_value: 15, reward_credits: 5, sort_order: 4 },
    { id: 'weekly_comment', name: '周评论家', description: '本周发表7条评论', icon: '✏️', category: 'weekly', condition_type: 'comment_count', condition_value: 7, reward_credits: 5, sort_order: 5 },
    
    // 每月成就
    { id: 'monthly_active', name: '月度活跃', description: '本月登录20天', icon: '🏅', category: 'monthly', condition_type: 'login_days', condition_value: 20, reward_credits: 15, sort_order: 1 },
    { id: 'monthly_interactive', name: '月度互动王', description: '本月互动满300次', icon: '🔥', category: 'monthly', condition_type: 'total_interactive', condition_value: 300, reward_credits: 20, sort_order: 2 },
    { id: 'monthly_creator', name: '月度创作者', description: '本月创作2个游戏', icon: '🎮', category: 'monthly', condition_type: 'game_count', condition_value: 2, reward_credits: 20, sort_order: 3 },
    { id: 'monthly_popular', name: '月度人气', description: '本月作品获100赞', icon: '👑', category: 'monthly', condition_type: 'received_likes', condition_value: 100, reward_credits: 25, sort_order: 4 },
    
    // 永久成就
    { id: 'first_login', name: '初来乍到', description: '首次登录', icon: '👋', category: 'permanent', condition_type: 'first_login', condition_value: 1, reward_credits: 3, sort_order: 1 },
    { id: 'first_game', name: '首次创作', description: '发布首个游戏', icon: '🎲', category: 'permanent', condition_type: 'first_game', condition_value: 1, reward_credits: 5, sort_order: 2 },
    { id: 'hundred_likes', name: '百赞作者', description: '单作品获100赞', icon: '💯', category: 'permanent', condition_type: 'single_game_likes', condition_value: 100, reward_credits: 20, sort_order: 3 },
    { id: 'thousand_likes', name: '千赞大神', description: '单作品获1000赞', icon: '🌟', category: 'permanent', condition_type: 'single_game_likes', condition_value: 1000, reward_credits: 100, sort_order: 4 },
    { id: 'master_creator', name: '创作大师', description: '累计创作50个游戏', icon: '🏆', category: 'permanent', condition_type: 'total_games', condition_value: 50, reward_credits: 50, sort_order: 5 },
    { id: 'veteran_user', name: '社区元老', description: '注册满1年', icon: '🎖️', category: 'permanent', condition_type: 'days_since_register', condition_value: 365, reward_credits: 50, sort_order: 6 }
  ];
  
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO achievements (id, name, description, icon, category, condition_type, condition_value, reward_credits, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const a of achievements) {
    stmt.run(a.id, a.name, a.description, a.icon, a.category, a.condition_type, a.condition_value, a.reward_credits, a.sort_order);
  }
  
  console.log(`[DB] 成就数据初始化完成，共 ${achievements.length} 条`);
}

// 执行成就数据初始化
initAchievementsData();

console.log('[DB] 小程序积分引流系统表初始化完成');

// ==================== 网站账号激活系统 ====================
// 创建激活Token表
db.exec(`
  CREATE TABLE IF NOT EXISTS web_activate_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_token TEXT NOT NULL,
    type TEXT DEFAULT 'activate',
    used INTEGER DEFAULT 0,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_web_activate_tokens_token ON web_activate_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_web_activate_tokens_user ON web_activate_tokens(user_token);
`);
console.log('[DB] 网站激活Token表初始化完成');

// 将积分字段改为支持小数（REAL类型）
try {
  // 检查当前字段类型，如果是INTEGER则需要迁移
  const tableInfo = db.prepare("PRAGMA table_info(user_credits)").all();
  const creditsColumn = tableInfo.find(col => col.name === 'credits');
  if (creditsColumn && creditsColumn.type === 'INTEGER') {
    console.log('[DB] 迁移积分字段为REAL类型...');
    db.exec(`
      ALTER TABLE user_credits RENAME TO user_credits_old;
      CREATE TABLE user_credits (
        user_token TEXT PRIMARY KEY,
        credits REAL DEFAULT 5,
        total_earned REAL DEFAULT 5,
        total_used REAL DEFAULT 0,
        first_gen_used INTEGER DEFAULT 0,
        followed_wechat INTEGER DEFAULT 0,
        last_ad_date TEXT,
        ad_count_today INTEGER DEFAULT 0,
        last_login_date TEXT,
        daily_login_claimed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO user_credits SELECT * FROM user_credits_old;
      DROP TABLE user_credits_old;
    `);
    console.log('[DB] 积分字段迁移完成');
  }
} catch (e) {
  // 忽略错误
}

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

// ==================== 行为积分系统（改造版：网站端只记录，小程序端领取） ====================

/**
 * 记录用户行为（不发放积分，积分改为小程序端领取）
 * 防止刷次数：同一用户对同一目标（游戏/用户）的同类型操作，在同一天内只计算一次
 * @param {string} userToken - 用户Token
 * @param {string} actionType - 行为类型: like/favorite/follow/comment/share
 * @param {object} options - 额外选项
 * @param {string} options.gameId - 游戏ID（点赞、收藏、评论时使用）
 * @param {string} options.targetToken - 目标用户Token（关注时使用）
 * @param {string} options.commentContent - 评论内容
 * @returns {object} { recorded: boolean, message: string, claimableInMiniprogram: boolean }
 */
function tryAwardActionCredits(userToken, actionType, options = {}) {
  console.log(`[行为记录] tryAwardActionCredits 调用: actionType=${actionType}, userToken=${userToken?.substring(0,8)}...`);
  
  if (!userToken) {
    console.log('[行为记录] 用户未登录');
    return { awarded: false, credits: 0, message: '未登录', recorded: false };
  }

  const actionNames = { 
    like: '点赞', 
    favorite: '收藏', 
    follow: '关注', 
    comment: '评论',
    share: '分享',
    generate: '创作游戏',
    edit: '编辑游戏'
  };

  // 确定目标ID（用于防重复检查）
  // 对于点赞、收藏、评论：使用gameId
  // 对于关注：使用targetToken 或 followingToken
  // 对于分享：使用gameId
  // 对于创作/编辑：使用gameId
  let targetId = options.gameId || options.targetToken || options.followingToken || 'general';
  
  // 获取今天日期作为周期开始
  const today = getPeriodStart('daily');
  
  // 检查是否已经记录过同一目标的同类型操作（同一天内）
  const existingRecord = db.prepare(`
    SELECT id FROM user_action_records 
    WHERE user_token = ? AND action_type = ? AND target_id = ? AND period_start = ?
  `).get(userToken, actionType, targetId, today);
  
  if (existingRecord) {
    console.log(`[行为记录] 用户 ${userToken.substring(0, 8)}... 今天已对目标 ${targetId.substring(0, 8)}... 进行过 ${actionNames[actionType] || actionType} 操作，跳过重复计数`);
    return { 
      awarded: false, 
      credits: 0, 
      message: '今天已记录过该操作',
      recorded: false,
      duplicate: true,
      claimableInMiniprogram: true,
      actionType,
      actionName: actionNames[actionType] || actionType
    };
  }
  
  // 记录本次操作（防止重复）
  try {
    db.prepare(`
      INSERT INTO user_action_records (user_token, action_type, target_id, period_start)
      VALUES (?, ?, ?, ?)
    `).run(userToken, actionType, targetId, today);
  } catch (e) {
    // 唯一约束冲突，说明已存在记录
    console.log(`[行为记录] 插入记录失败（可能已存在）: ${e.message}`);
    return { 
      awarded: false, 
      credits: 0, 
      message: '操作已记录',
      recorded: false,
      duplicate: true,
      claimableInMiniprogram: true,
      actionType,
      actionName: actionNames[actionType] || actionType
    };
  }

  // 记录行为统计（用于成就系统和小程序领取）
  recordUserAction(userToken, actionType, 1);
  
  // 如果是作者收到点赞，也记录received_like
  if (actionType === 'like' && options.gameId) {
    const game = db.prepare('SELECT author_token FROM games WHERE id = ?').get(options.gameId);
    if (game && game.author_token && game.author_token !== userToken) {
      recordUserAction(game.author_token, 'received_like', 1);
    }
  }
  
  console.log(`[行为记录] 用户 ${userToken.substring(0, 8)}... ${actionNames[actionType] || actionType} 行为已记录（积分请到小程序领取）`);
  
  // 返回兼容旧接口的格式，但不再发放积分
  return { 
    awarded: false,  // 网站端不再直接发放积分
    credits: 0, 
    message: '行为已记录，去小程序领取积分奖励',
    recorded: true,
    claimableInMiniprogram: true,
    actionType,
    actionName: actionNames[actionType] || actionType
  };
}

/**
 * 计算两个字符串的相似度（简单的Jaccard相似度）
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
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
    
    // 2. 禁用设备指纹自动恢复账号（用户退出后需重新登录）
    // 旧逻辑：if (!account && deviceFingerprint) { 通过设备指纹恢复 }
    // 现在不再自动恢复，用户必须手动登录
    if (!account && deviceFingerprint) {
      // 仅记录日志，不再自动恢复
      const existingByFingerprint = db.prepare('SELECT account_id FROM user_accounts WHERE device_fingerprint = ?').get(deviceFingerprint);
      if (existingByFingerprint) {
        console.log('[DEBUG] 设备指纹关联账号存在，但不自动恢复:', existingByFingerprint.account_id);
      }
    }
    
    // 注意：不再使用IP恢复账号，因为IP会变化导致频繁创建新账号
    // 账号识别优先级：token > 设备指纹
    
    // 3. 如果没有有效账号，返回未登录状态（不再自动创建新账号）
    if (!account) {
      console.log('[DEBUG] 没有有效账号，返回未登录状态');
      return res.json({
        success: false,
        loggedIn: false,
        error: 'not_logged_in',
        message: '请登录',
        // 提供空的账号对象，防止前端报错
        userToken: null,
        account: null
      });
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
        account_id: account.account_id,
        accountId: account.account_id, // 兼容旧版
        nickname: displayNickname,
        rawNickname: account.nickname, // 原始昵称
        hasPassword: !!account.has_password,
        has_password: !!account.has_password, // 兼容下划线命名
        email: account.email,
        createdAt: account.created_at,
        created_at: account.created_at // 兼容下划线命名
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
    
    // 检查昵称是否与其他用户重复
    const existingUser = db.prepare('SELECT user_token FROM user_accounts WHERE nickname = ? AND user_token != ?')
      .get(trimmedNickname, userToken);
    
    if (existingUser) {
      return res.status(400).json({ success: false, error: '该昵称已被其他用户使用' });
    }
    
    // 获取用户当前账号信息（用于判断是否是默认昵称）
    const account = db.prepare('SELECT nickname, account_id FROM user_accounts WHERE user_token = ?').get(userToken);
    const oldNickname = account?.nickname || '';
    const accountId = account?.account_id || '';
    
    // 判断当前昵称是否是默认值
    const isDefaultNickname = !oldNickname ||
      oldNickname === '微信用户' ||
      oldNickname === '游戏玩家' ||
      oldNickname === accountId;
    
    // 判断新昵称是否是自定义昵称（不是默认值）
    const isCustomNickname = trimmedNickname !== '微信用户' &&
      trimmedNickname !== '游戏玩家' &&
      trimmedNickname !== accountId;
    
    // 更新用户账号表中的昵称
    db.prepare('UPDATE user_accounts SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE user_token = ?')
      .run(trimmedNickname, userToken);
    
    // 同步更新该用户所有游戏的作者名（author_name）
    const updateResult = db.prepare('UPDATE games SET author_name = ? WHERE author_token = ?')
      .run(trimmedNickname, userToken);
    
    console.log(`[INFO] 更新昵称成功: ${trimmedNickname}, 同步更新了 ${updateResult.changes} 个游戏的作者名`);
    
    // ==================== 昵称奖励逻辑 ====================
    let creditsEarned = 0;
    let rewardMessage = '';
    
    // 检查是否已领取过昵称奖励
    const userCredits = db.prepare('SELECT nickname_rewarded FROM user_credits WHERE user_token = ?').get(userToken);
    const hasRewarded = userCredits && userCredits.nickname_rewarded === 1;
    
    // 判断是否满足奖励条件：
    // 1. 从默认昵称改为自定义昵称，且未领取过奖励
    // 2. 老用户已经是自定义昵称，但未领取过奖励（补领场景）
    const shouldReward = !hasRewarded && isCustomNickname;
    
    if (shouldReward) {
      // 获取昵称奖励积分配置
      creditsEarned = parseFloat(getConfig('credits_set_nickname', '3'));
      
      // 发放积分奖励
      db.prepare(`
        INSERT INTO user_credits (user_token, credits, total_earned, nickname_rewarded)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_token) DO UPDATE SET
          credits = credits + ?,
          total_earned = total_earned + ?,
          nickname_rewarded = 1,
          updated_at = CURRENT_TIMESTAMP
      `).run(userToken, creditsEarned, creditsEarned, creditsEarned, creditsEarned);
      
      // 记录积分历史
      db.prepare(`
        INSERT INTO credit_history (user_token, change_type, amount, description)
        VALUES (?, 'nickname_reward', ?, '设置昵称奖励')
      `).run(userToken, creditsEarned);
      
      rewardMessage = isDefaultNickname 
        ? `设置昵称成功！获得${creditsEarned}积分奖励` 
        : `昵称奖励已补领！获得${creditsEarned}积分`;
      console.log(`[NICKNAME] 昵称奖励发放: ${trimmedNickname}, 积分: ${creditsEarned}, 补领: ${!isDefaultNickname}`);
    }
    
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
    
    res.json({
      success: true,
      nickname: trimmedNickname,
      updatedGamesCount: updateResult.changes,
      creditsEarned: creditsEarned,
      rewardMessage: rewardMessage
    });
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

// 修改密码（需要验证旧密码）
app.post('/api/account/change-password', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { oldPassword, newPassword } = req.body;
    
    console.log('[DEBUG] 修改密码请求:', { userToken: userToken ? userToken.substring(0, 10) + '...' : 'null' });
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    if (!oldPassword) {
      return res.status(400).json({ success: false, error: '请输入原密码' });
    }
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码至少6位' });
    }
    
    if (oldPassword === newPassword) {
      return res.status(400).json({ success: false, error: '新密码不能与原密码相同' });
    }
    
    const account = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    
    // 必须已经设置了密码才能修改
    if (!account.has_password || !account.password_hash) {
      return res.status(400).json({ success: false, error: '账号未设置密码，请先设置密码' });
    }
    
    // 验证旧密码
    if (hashPassword(oldPassword) !== account.password_hash) {
      return res.status(400).json({ success: false, error: '原密码错误' });
    }
    
    // 设置新密码
    const newPasswordHash = hashPassword(newPassword);
    db.prepare('UPDATE user_accounts SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_token = ?')
      .run(newPasswordHash, userToken);
    
    console.log('[DEBUG] 密码修改成功:', { account_id: account.account_id });
    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('[ERROR] 修改密码失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// ==================== 邮箱绑定与验证 API ====================

// 发送邮箱验证码（绑定邮箱用）
app.post('/api/account/send-email-code', async (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { email, type = 'verify' } = req.body;
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: '请输入有效的邮箱地址' });
    }
    
    // 检查 SMTP 是否配置
    if (!getSmtpConfig()) {
      return res.status(503).json({ success: false, error: '邮件服务暂未开放' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    // 检查是否60秒内已发送过（限流）
    const recentCode = db.prepare(`
      SELECT * FROM email_verify_codes 
      WHERE email = ? AND type = ? AND created_at > datetime('now', '-60 seconds')
      ORDER BY created_at DESC LIMIT 1
    `).get(normalizedEmail, type);
    
    if (recentCode) {
      return res.status(429).json({ success: false, error: '请60秒后再试' });
    }
    
    // 如果是绑定邮箱，检查邮箱是否已被其他账号绑定
    if (type === 'verify') {
      const existingAccount = db.prepare(`
        SELECT * FROM user_accounts 
        WHERE email = ? AND email_verified = 1 AND user_token != ?
      `).get(normalizedEmail, userToken);
      
      if (existingAccount) {
        return res.status(400).json({ success: false, error: '该邮箱已被其他账号绑定' });
      }
      
      // 检查用户是否已验证过邮箱
      const userCredits = db.prepare('SELECT email_verified FROM user_credits WHERE user_token = ?').get(userToken);
      if (userCredits && userCredits.email_verified === 1) {
        return res.status(400).json({ success: false, error: '您已验证过邮箱' });
      }
    }
    
    // 生成验证码
    const code = generateEmailCode();
    const expireMinutes = parseInt(getConfig('email_code_expire_minutes', '10'));
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000).toISOString();
    
    // 保存验证码到数据库
    db.prepare(`
      INSERT INTO email_verify_codes (code, user_token, email, type, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, userToken, normalizedEmail, type, expiresAt);
    
    // 发送邮件
    const siteName = getConfig('site_name', '一句话游戏');
    const subject = type === 'reset' 
      ? `【${siteName}】重置密码验证码`
      : `【${siteName}】邮箱验证码`;
    const html = generateEmailCodeHtml(code, type);
    
    const emailResult = await sendEmail(normalizedEmail, subject, html);
    
    if (!emailResult.success) {
      return res.status(500).json({ success: false, error: emailResult.error || '邮件发送失败' });
    }
    
    console.log('[EMAIL] 验证码已发送:', { email: normalizedEmail, type });
    res.json({ 
      success: true, 
      message: '验证码已发送',
      expireMinutes: expireMinutes
    });
    
  } catch (error) {
    console.error('[ERROR] 发送邮箱验证码失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 验证邮箱验证码并绑定邮箱
app.post('/api/account/verify-email', async (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { email, code } = req.body;
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    if (!email || !code) {
      return res.status(400).json({ success: false, error: '请输入邮箱和验证码' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    
    // 查找有效的验证码
    const verifyCode = db.prepare(`
      SELECT * FROM email_verify_codes 
      WHERE email = ? AND code = ? AND type = 'verify' AND used = 0 
        AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(normalizedEmail, normalizedCode);
    
    if (!verifyCode) {
      return res.status(400).json({ success: false, error: '验证码无效或已过期' });
    }
    
    // 检查验证码是否属于当前用户
    if (verifyCode.user_token !== userToken) {
      return res.status(400).json({ success: false, error: '验证码不匹配' });
    }
    
    // 检查用户是否已验证过邮箱（防止重复领取积分）
    const userCredits = db.prepare('SELECT email_verified FROM user_credits WHERE user_token = ?').get(userToken);
    const isFirstVerify = !userCredits || userCredits.email_verified !== 1;
    
    // 标记验证码已使用
    db.prepare('UPDATE email_verify_codes SET used = 1 WHERE id = ?').run(verifyCode.id);
    
    // 更新账号邮箱信息
    db.prepare(`
      UPDATE user_accounts 
      SET email = ?, email_verified = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(normalizedEmail, userToken);
    
    // 更新积分表的邮箱验证状态
    db.prepare(`
      UPDATE user_credits SET email_verified = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(userToken);
    
    let creditsEarned = 0;
    
    // 首次验证给积分
    if (isFirstVerify) {
      creditsEarned = parseFloat(getConfig('credits_verify_email', '3'));
      
      db.prepare(`
        UPDATE user_credits 
        SET credits = credits + ?, total_earned = total_earned + ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_token = ?
      `).run(creditsEarned, creditsEarned, userToken);
      
      // 记录积分日志
      db.prepare(`
        INSERT INTO credit_logs (user_token, type, amount, description)
        VALUES (?, 'email_verify', ?, '验证邮箱奖励')
      `).run(userToken, creditsEarned);
      
      console.log('[EMAIL] 邮箱验证成功，奖励积分:', { email: normalizedEmail, credits: creditsEarned });
    } else {
      console.log('[EMAIL] 邮箱验证成功（已验证过，不重复奖励）:', { email: normalizedEmail });
    }
    
    // 获取最新积分
    const updatedCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    res.json({ 
      success: true, 
      message: isFirstVerify ? `验证成功，获得${creditsEarned}积分！` : '邮箱验证成功',
      creditsEarned: creditsEarned,
      totalCredits: formatCreditsValue(updatedCredits?.credits || 0)
    });
    
  } catch (error) {
    console.error('[ERROR] 验证邮箱失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 找回密码 - 发送重置验证码
app.post('/api/account/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: '请输入有效的邮箱地址' });
    }
    
    // 检查 SMTP 是否配置
    if (!getSmtpConfig()) {
      return res.status(503).json({ success: false, error: '邮件服务暂未开放' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    // 查找绑定了该邮箱的账号
    const account = db.prepare(`
      SELECT * FROM user_accounts WHERE email = ? AND email_verified = 1
    `).get(normalizedEmail);
    
    if (!account) {
      // 为了安全，不透露邮箱是否存在
      return res.json({ success: true, message: '如果该邮箱已绑定账号，验证码将发送到该邮箱' });
    }
    
    // 检查是否60秒内已发送过（限流）
    const recentCode = db.prepare(`
      SELECT * FROM email_verify_codes 
      WHERE email = ? AND type = 'reset' AND created_at > datetime('now', '-60 seconds')
      ORDER BY created_at DESC LIMIT 1
    `).get(normalizedEmail);
    
    if (recentCode) {
      return res.status(429).json({ success: false, error: '请60秒后再试' });
    }
    
    // 生成验证码
    const code = generateEmailCode();
    const expireMinutes = parseInt(getConfig('email_code_expire_minutes', '10'));
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000).toISOString();
    
    // 保存验证码到数据库
    db.prepare(`
      INSERT INTO email_verify_codes (code, user_token, email, type, expires_at)
      VALUES (?, ?, ?, 'reset', ?)
    `).run(code, account.user_token, normalizedEmail, expiresAt);
    
    // 发送邮件
    const siteName = getConfig('site_name', '一句话游戏');
    const subject = `【${siteName}】重置密码验证码`;
    const html = generateEmailCodeHtml(code, 'reset');
    
    const emailResult = await sendEmail(normalizedEmail, subject, html);
    
    if (!emailResult.success) {
      console.error('[EMAIL] 发送重置密码验证码失败:', emailResult.error);
    }
    
    console.log('[EMAIL] 重置密码验证码已发送:', { email: normalizedEmail });
    res.json({ 
      success: true, 
      message: '验证码已发送到邮箱',
      expireMinutes: expireMinutes
    });
    
  } catch (error) {
    console.error('[ERROR] 发送重置密码验证码失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 通过邮箱验证码重置密码
app.post('/api/account/reset-password-by-email', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: '请填写完整信息' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码至少6位' });
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    
    // 查找有效的重置验证码
    const verifyCode = db.prepare(`
      SELECT * FROM email_verify_codes 
      WHERE email = ? AND code = ? AND type = 'reset' AND used = 0 
        AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(normalizedEmail, normalizedCode);
    
    if (!verifyCode) {
      return res.status(400).json({ success: false, error: '验证码无效或已过期' });
    }
    
    // 查找对应的账号
    const account = db.prepare(`
      SELECT * FROM user_accounts WHERE email = ? AND email_verified = 1
    `).get(normalizedEmail);
    
    if (!account) {
      return res.status(400).json({ success: false, error: '账号不存在' });
    }
    
    // 标记验证码已使用
    db.prepare('UPDATE email_verify_codes SET used = 1 WHERE id = ?').run(verifyCode.id);
    
    // 重置密码
    const newPasswordHash = hashPassword(newPassword);
    db.prepare(`
      UPDATE user_accounts 
      SET password_hash = ?, has_password = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(newPasswordHash, account.user_token);
    
    console.log('[ACCOUNT] 密码重置成功:', { account_id: account.account_id });
    res.json({ success: true, message: '密码重置成功，请使用新密码登录' });
    
  } catch (error) {
    console.error('[ERROR] 重置密码失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取邮箱验证状态
app.get('/api/account/email-status', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    const account = db.prepare(`
      SELECT email, email_verified FROM user_accounts WHERE user_token = ?
    `).get(userToken);
    
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    
    const smtpConfigured = !!getSmtpConfig();
    const verifyEmailCredits = parseFloat(getConfig('credits_verify_email', '3'));
    
    res.json({
      success: true,
      email: account.email || null,
      emailVerified: account.email_verified === 1,
      smtpConfigured: smtpConfigured,
      verifyEmailCredits: verifyEmailCredits
    });
    
  } catch (error) {
    console.error('[ERROR] 获取邮箱状态失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 获取昵称奖励状态
app.get('/api/account/nickname-status', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 获取用户账号信息
    const account = db.prepare(`
      SELECT nickname, account_id FROM user_accounts WHERE user_token = ?
    `).get(userToken);
    
    if (!account) {
      return res.status(404).json({ success: false, error: '账号不存在' });
    }
    
    // 获取用户积分信息（包含昵称奖励状态）
    const userCredits = db.prepare(`
      SELECT nickname_rewarded FROM user_credits WHERE user_token = ?
    `).get(userToken);
    
    const nicknameRewarded = userCredits && userCredits.nickname_rewarded === 1;
    const nicknameCredits = parseFloat(getConfig('credits_set_nickname', '3'));
    
    // 判断当前昵称是否是默认值
    const currentNickname = account.nickname || '';
    const accountId = account.account_id || '';
    const isDefaultNickname = !currentNickname ||
      currentNickname === '微信用户' ||
      currentNickname === '游戏玩家' ||
      currentNickname === accountId;
    
    // 是否可以领取奖励：使用默认昵称且未领取过奖励
    const canClaimReward = isDefaultNickname && !nicknameRewarded;
    
    res.json({
      success: true,
      nickname: currentNickname,
      isDefaultNickname: isDefaultNickname,
      nicknameRewarded: nicknameRewarded,
      canClaimReward: canClaimReward,
      nicknameCredits: nicknameCredits
    });
    
  } catch (error) {
    console.error('[ERROR] 获取昵称状态失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 领取昵称奖励（专门用于小程序老用户补领）
app.post('/api/account/claim-nickname-reward', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 检查是否已领取过昵称奖励
    const userCredits = db.prepare('SELECT nickname_rewarded, credits FROM user_credits WHERE user_token = ?').get(userToken);
    const hasRewarded = userCredits && userCredits.nickname_rewarded === 1;
    
    if (hasRewarded) {
      return res.json({ 
        success: true, 
        creditsEarned: 0, 
        message: '昵称奖励已领取过',
        alreadyClaimed: true
      });
    }
    
    // 获取用户昵称（优先从 user_accounts，其次从其他途径）
    let currentNickname = '';
    const account = db.prepare('SELECT nickname, account_id FROM user_accounts WHERE user_token = ?').get(userToken);
    
    if (account) {
      currentNickname = account.nickname || '';
    }
    
    // 判断是否是自定义昵称
    const accountId = account?.account_id || '';
    const isCustomNickname = currentNickname && 
      currentNickname !== '微信用户' &&
      currentNickname !== '游戏玩家' &&
      currentNickname !== accountId;
    
    if (!isCustomNickname) {
      return res.status(400).json({ 
        success: false, 
        error: '请先设置一个自定义昵称' 
      });
    }
    
    // 发放积分奖励
    const creditsEarned = parseFloat(getConfig('credits_set_nickname', '3'));
    
    db.prepare(`
      INSERT INTO user_credits (user_token, credits, total_earned, nickname_rewarded)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(user_token) DO UPDATE SET
        credits = credits + ?,
        total_earned = total_earned + ?,
        nickname_rewarded = 1,
        updated_at = CURRENT_TIMESTAMP
    `).run(userToken, creditsEarned, creditsEarned, creditsEarned, creditsEarned);
    
    // 记录积分历史
    db.prepare(`
      INSERT INTO credit_history (user_token, change_type, amount, description)
      VALUES (?, 'nickname_reward', ?, '设置昵称奖励')
    `).run(userToken, creditsEarned);
    
    console.log(`[NICKNAME] 昵称奖励补领成功: ${currentNickname}, 积分: ${creditsEarned}`);
    
    // 获取更新后的积分
    const updatedCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    res.json({
      success: true,
      creditsEarned: creditsEarned,
      totalCredits: updatedCredits?.credits || creditsEarned,
      rewardMessage: `昵称奖励已领取！获得${creditsEarned}积分`
    });
    
  } catch (error) {
    console.error('[ERROR] 领取昵称奖励失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 账号登录（用账号ID/昵称 + 密码换取 userToken）
app.post('/api/account/login', async (req, res) => {
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
      return res.status(400).json({ success: false, error: '该账号未设置密码，请先在小程序中绑定网站账号' });
    }
    
    // 使用异步密码验证（支持bcrypt和旧版SHA256格式）
    const passwordMatch = await verifyPasswordAsync(password, account.password_hash);
    console.log('[DEBUG] 密码验证:', { 
      storedHashPrefix: account.password_hash.substring(0, 10) + '...',
      match: passwordMatch
    });
    
    if (!passwordMatch) {
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

// ==================== 微信小程序登录 ====================
// 微信小程序登录接口
app.post('/api/wechat/login', async (req, res) => {
  try {
    const { code } = req.body;
    
    console.log('[WECHAT] 小程序登录请求, code:', code ? code.substring(0, 10) + '...' : '(empty)');
    
    if (!code) {
      return res.status(400).json({ success: false, error: '缺少code参数' });
    }
    
    // 微信小程序配置（统一使用 WX_APPID/WX_APPSECRET，与订阅消息工具保持一致）
    const WX_APPID = process.env.WX_APPID;
    const WX_APPSECRET = process.env.WX_APPSECRET;
    
    // 如果没有配置微信小程序密钥，使用模拟模式（开发测试用）
    if (!WX_APPID || !WX_APPSECRET) {
      console.log('[WECHAT] 未配置小程序密钥，使用模拟模式');
      
      // 模拟模式：用code作为伪openid创建/查找用户
      const mockOpenid = 'mock_' + crypto.createHash('md5').update(code).digest('hex').substring(0, 16);
      
      // 查找或创建用户
      let account = db.prepare('SELECT * FROM user_accounts WHERE wechat_openid = ?').get(mockOpenid);
      
      if (!account) {
        // 创建新用户
        const userToken = uuidv4();
        const accountId = 'WX' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        db.prepare(`
          INSERT INTO user_accounts (user_token, account_id, nickname, wechat_openid, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).run(userToken, accountId, '微信用户', mockOpenid);
        
        account = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(userToken);
        console.log('[WECHAT] 创建新用户:', accountId);
      }
      
      return res.json({
        success: true,
        data: {
          token: account.user_token,
          userInfo: {
            account_id: account.account_id,
            nickname: account.nickname || account.account_id,
            avatar_emoji: '🎮',
            credits: 0
          }
        }
      });
    }
    
    // 正式模式：调用微信API换取openid
    const https = require('https');
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_APPSECRET}&js_code=${code}&grant_type=authorization_code`;
    
    https.get(wxUrl, (wxRes) => {
      let data = '';
      wxRes.on('data', chunk => data += chunk);
      wxRes.on('end', () => {
        try {
          const wxData = JSON.parse(data);
          console.log('[WECHAT] 微信API响应:', wxData.errcode ? `错误${wxData.errcode}` : '成功');
          
          if (wxData.errcode) {
            return res.json({ success: false, error: wxData.errmsg || '微信登录失败' });
          }
          
          const { openid } = wxData;
          
          // 查找或创建用户
          let account = db.prepare('SELECT * FROM user_accounts WHERE wechat_openid = ?').get(openid);
          
          if (!account) {
            // 未找到账户，检查是否有 mock openId 需要升级
            // 通过小程序端传来的 token 查找现有账户
            const existingToken = req.body.token || req.headers['x-user-token'];
            if (existingToken) {
              const existingAccount = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(existingToken);
              if (existingAccount && existingAccount.wechat_openid && existingAccount.wechat_openid.startsWith('mock_')) {
                // 将 mock openId 升级为真实 openId
                db.prepare('UPDATE user_accounts SET wechat_openid = ? WHERE user_token = ?').run(openid, existingToken);
                account = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(existingToken);
                console.log('[WECHAT] 升级 mock openId 为真实 openId:', account.account_id);
              }
            }
            
            // 如果仍然没有账户，创建新用户
            if (!account) {
              const userToken = uuidv4();
              const accountId = 'WX' + Math.random().toString(36).substr(2, 6).toUpperCase();
              
              db.prepare(`
                INSERT INTO user_accounts (user_token, account_id, nickname, wechat_openid, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
              `).run(userToken, accountId, '微信用户', openid);
              
              account = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(userToken);
              console.log('[WECHAT] 创建新用户:', accountId);
            }
          } else {
            // 用户已存在且 openId 匹配
            console.log('[WECHAT] 用户已存在:', account.account_id);
          }
          
          // 获取积分
          const userCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(account.user_token);
          const credits = userCredits?.credits || 0;
          
          res.json({
            success: true,
            data: {
              token: account.user_token,
              userInfo: {
                account_id: account.account_id,
                nickname: account.nickname || account.account_id,
                avatar_emoji: '🎮',
                credits: credits
              }
            }
          });
        } catch (parseError) {
          console.error('[WECHAT] 解析微信响应失败:', parseError);
          res.json({ success: false, error: '微信登录响应解析失败' });
        }
      });
    }).on('error', (err) => {
      console.error('[WECHAT] 请求微信API失败:', err);
      res.json({ success: false, error: '请求微信服务器失败' });
    });
    
  } catch (error) {
    console.error('[WECHAT] 登录失败:', error);
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
app.post('/api/account/secure-recover', async (req, res) => {
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
    
    // 使用异步密码验证（支持bcrypt和旧版SHA256格式）
    let passwordCorrect = false;
    if (hasPassword && password) {
      passwordCorrect = await verifyPasswordAsync(password, account.password_hash);
    }
    
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

// ==================== 网站功能配置 API ====================

// 获取网站公开配置（用于前端判断功能是否禁用）
app.get('/api/site-config', (req, res) => {
  try {
    // 网站功能细粒度权限控制
    // 【已移除旧配置 web_write_disabled 的影响，直接使用新的细粒度配置】
    const webCreateDisabled = getConfig('web_create_disabled', 'false') === 'true';
    const webEditDisabled = getConfig('web_edit_disabled', 'false') === 'true';
    
    // 【调试日志】打印功能开关配置读取结果
    console.log('[SITE-CONFIG] 功能开关配置:');
    console.log('  - web_create_disabled:', getConfig('web_create_disabled', 'false'), '→', webCreateDisabled);
    console.log('  - web_edit_disabled:', getConfig('web_edit_disabled', 'false'), '→', webEditDisabled);
    const webInteractDisabled = getConfig('web_interact_disabled', 'false') === 'true';  // 互动功能禁用（点赞/收藏/评论/关注，默认开放）
    
    // 兼容旧版：只有当创作和编辑都禁用且互动开放时，才算完全禁用写操作
    const webWriteDisabled = webCreateDisabled && webEditDisabled;
    
    // 站点名称和标语
    const siteName = getConfig('site_name', '一句话游戏');
    const siteSlogan = getConfig('site_slogan', '一句话生成游戏');
    
    // 小程序相关配置
    const miniprogramName = getConfig('miniprogram_name', '一句话游戏');
    const miniprogramAppId = getConfig('miniprogram_appid', '');
    const miniprogramPath = getConfig('miniprogram_default_path', '/pages/create/create');
    
    // 小程序功能开关配置（仅影响小程序，不影响网站）
    const miniprogramCommentDisabled = getConfig('miniprogram_comment_disabled', 'false') === 'true';
    const miniprogramLLMDisabled = getConfig('miniprogram_llm_disabled', 'false') === 'true';
    
    // 邀请好友积分配置（小程序使用）
    const inviteReward = parseFloat(getConfig('credits_mp_invite', '3')) || 3;
    
    // 微信订阅消息模板ID（从环境变量读取）
    const wxSubscribeTmplId = process.env.WX_SUBSCRIBE_TMPL_GAME_CREATED || '';
    
    // 激励视频广告单元ID
    const rewardedVideoAdUnitId = getConfig('rewarded_video_ad_unit_id', '');
    
    // 积分配置（供小程序使用）
    const extraConfig = {
      ad: {
        reward: parseFloat(getConfig('credits_ad_reward', '3')),
        dailyLimit: parseInt(getConfig('credits_ad_daily_limit', '30')),
        enabled: getConfig('credits_ad_enabled', 'false') === 'true'
      },
      ads: {
        rewardedVideoAdUnitId: rewardedVideoAdUnitId
      }
    };
    
    res.json({
      success: true,
      // 直接返回字段（供前端页面使用）
      siteName: siteName,
      siteSlogan: siteSlogan,
      miniprogramName: miniprogramName,
      // 细粒度权限控制
      webCreateDisabled: webCreateDisabled,    // 创作游戏禁用
      webEditDisabled: webEditDisabled,        // 编辑/修复游戏禁用
      webInteractDisabled: webInteractDisabled, // 互动功能禁用（点赞/收藏/评论/关注）
      webWriteDisabled: webWriteDisabled,      // 兼容旧版
      // 小程序功能开关（仅小程序使用）
      miniprogramCommentDisabled: miniprogramCommentDisabled,
      miniprogramLLMDisabled: miniprogramLLMDisabled,
      // 邀请好友积分配置
      inviteReward: inviteReward,
      // 微信订阅消息模板ID
      wxSubscribeTmplId: wxSubscribeTmplId,
      // 激励视频广告单元ID
      rewardedVideoAdUnitId: rewardedVideoAdUnitId,
      // 积分配置（供小程序使用）
      extraConfig: extraConfig,
      // 同时返回 config 对象（兼容旧版）
      config: {
        webWriteDisabled: webWriteDisabled,
        webCreateDisabled: webCreateDisabled,
        webEditDisabled: webEditDisabled,
        webInteractDisabled: webInteractDisabled,
        miniprogram: {
          name: miniprogramName,
          appId: miniprogramAppId,
          defaultPath: miniprogramPath,
          commentDisabled: miniprogramCommentDisabled,
          llmDisabled: miniprogramLLMDisabled
        }
      }
    });
  } catch (error) {
    console.error('获取网站配置失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// 取消编辑请求
app.post('/api/cancel-edit', (req, res) => {
  try {
    const { sessionId } = req.body;
    const userToken = req.headers['x-user-token'];
    
    if (!sessionId) {
      return res.status(400).json({ success: false, error: '缺少会话ID' });
    }
    
    // 验证请求属于当前用户
    const info = activeEdits.get(sessionId);
    if (!info) {
      console.log(`[编辑取消] 请求不存在或已完成: ${sessionId}`);
      return res.json({ success: true, message: '请求不存在或已完成' });
    }
    
    if (info.userToken !== userToken) {
      console.log(`[编辑取消] 用户无权取消此请求: ${sessionId}`);
      return res.status(403).json({ success: false, error: '无权取消此请求' });
    }
    
    // 标记请求为已取消
    cancelEditRequest(sessionId);
    
    res.json({ 
      success: true, 
      message: '编辑请求已取消',
      sessionId 
    });
  } catch (error) {
    console.error('[ERROR] 取消编辑请求失败:', error);
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
      // 从配置读取新用户注册积分
      const registerCredits = parseFloat(getConfig('credits_register', '1')) || 1;
      
      db.prepare(`
        INSERT INTO user_credits (user_token, credits, total_earned) 
        VALUES (?, ?, ?)
      `).run(userToken, registerCredits, registerCredits);
      
      // 记录初始积分
      db.prepare(`
        INSERT INTO credit_logs (user_token, amount, type, description)
        VALUES (?, ?, 'register', '新用户注册积分')
      `).run(userToken, registerCredits);
      
      user = db.prepare('SELECT * FROM user_credits WHERE user_token = ?').get(userToken);
    }
    
    // 检查是否需要重置每日广告计数
    const today = new Date().toISOString().split('T')[0];
    if (user.last_ad_date !== today) {
      db.prepare('UPDATE user_credits SET ad_count_today = 0, last_ad_date = ? WHERE user_token = ?')
        .run(today, userToken);
      user.ad_count_today = 0;
    }
    
    // 获取每日分享/邀请/阅读文章的使用次数
    const getDailyCount = (type) => {
      const record = db.prepare(
        'SELECT count FROM daily_action_credits WHERE user_token = ? AND action_type = ? AND action_date = ?'
      ).get(userToken, type, today);
      return record?.count || 0;
    };
    
    const dailyCounts = {
      share: getDailyCount('share_game'),
      invite: getDailyCount('invite_friend'),
      article: getDailyCount('article_read')
    };
    
    // 获取配置（确保返回有效数值）
    const extraConfig = {
      shareGame: {
        credits: parseFloat(getConfig('credits_share_game', '1')) || 1,
        dailyLimit: parseInt(getConfig('credits_share_game_daily_limit', '5')) || 5
      },
      inviteFriend: {
        credits: parseFloat(getConfig('credits_invite_friend', '3')) || 3,
        dailyLimit: parseInt(getConfig('credits_invite_friend_daily_limit', '5')) || 5
      },
      article: {
        credits: parseFloat(getConfig('credits_article', '1')) || 1,
        dailyLimit: parseInt(getConfig('credits_article_daily_limit', '3')) || 3
      }
    };
    
    res.json({
      success: true,
      credits: formatCreditsValue(user.credits),
      totalEarned: formatCreditsValue(user.total_earned),
      totalUsed: formatCreditsValue(user.total_used),
      followedWechat: user.followed_wechat === 1,
      adCountToday: user.ad_count_today,
      dailyCounts,
      extraConfig,
      config: CREDITS_CONFIG
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取积分明细
 * GET /api/credits/logs
 * 支持参数: limit, offset, include_stats
 */
app.get('/api/credits/logs', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 解析请求参数
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const includeStats = req.query.include_stats === '1';
    
    // 获取积分明细（从credit_logs表查询）
    const logs = db.prepare(`
      SELECT id, amount, type, description, created_at
      FROM credit_logs 
      WHERE user_token = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(userToken, limit, offset);
    
    // 格式化日期
    const formattedLogs = logs.map(log => ({
      id: log.id,
      amount: log.amount,
      action: log.type,
      description: log.description,
      created_at: formatCreditLogDate(log.created_at)
    }));
    
    // 返回结果
    const result = {
      success: true,
      data: formattedLogs
    };
    
    // 如果需要统计数据
    if (includeStats) {
      const today = new Date().toISOString().split('T')[0];
      
      // 计算本周一的日期
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(monday.getDate() + mondayOffset);
      const weekStart = monday.toISOString().split('T')[0];
      
      // 计算本月第一天
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      
      // 统计今日获得的积分（只计正数）
      const todayResult = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM credit_logs 
        WHERE user_token = ? AND amount > 0 AND date(created_at) = ?
      `).get(userToken, today);
      
      // 统计本周获得的积分
      const weekResult = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM credit_logs 
        WHERE user_token = ? AND amount > 0 AND date(created_at) >= ?
      `).get(userToken, weekStart);
      
      // 统计本月获得的积分
      const monthResult = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM credit_logs 
        WHERE user_token = ? AND amount > 0 AND date(created_at) >= ?
      `).get(userToken, monthStart);
      
      result.stats = {
        today_earned: todayResult?.total || 0,
        week_earned: weekResult?.total || 0,
        month_earned: monthResult?.total || 0
      };
      
      console.log(`[Credits Logs] 用户 ${userToken.substring(0, 8)}... 统计: 今日=${result.stats.today_earned}, 本周=${result.stats.week_earned}, 本月=${result.stats.month_earned}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('[Credits Logs API] 获取积分明细失败:', error);
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// 格式化积分日志日期
function formatCreditLogDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  
  // 如果是今天，只显示时间
  if (d.toDateString() === now.toDateString()) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 如果是昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 如果是今年，显示月/日 时:分
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // 其他显示完整日期
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// 消耗积分（生成游戏时调用）
app.post('/api/credits/use', (req, res) => {
  try {
    // 小程序请求跳过积分扣除
    if (isMiniProgramRequest(req)) {
      console.log('[Credits] 小程序请求，跳过积分扣除API');
      return res.json({ success: true, credits: 999, skipped: true });
    }
    
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
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    // 从数据库读取广告功能开关
    const adEnabled = getConfig('credits_ad_enabled', 'false') === 'true';
    if (!adEnabled) {
      return res.status(200).json({ success: false, error: '激励视频广告功能暂未启用', featureDisabled: true });
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
    
    // 从数据库读取每日上限和奖励积分
    const dailyLimit = parseInt(getConfig('credits_ad_daily_limit', '30')) || 30;
    const reward = parseFloat(getConfig('credits_ad_reward', '3')) || 3;
    
    if (adCountToday >= dailyLimit) {
      return res.status(200).json({ 
        success: false, 
        error: `今日观看次数已达上限（${dailyLimit}次）`,
        todayCount: adCountToday,
        remainingToday: 0,
        dailyLimit
      });
    }
    
    // 增加积分
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, 
          ad_count_today = ?, last_ad_date = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(reward, reward, adCountToday + 1, today, userToken);
    
    // 记录日志
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'watch_ad', '观看激励视频广告')
    `).run(userToken, reward);
    
    const updated = db.prepare('SELECT credits, ad_count_today FROM user_credits WHERE user_token = ?').get(userToken);
    
    const newTodayCount = updated.ad_count_today;
    const remainingToday = Math.max(0, dailyLimit - newTodayCount);
    
    res.json({ 
      success: true, 
      credits: updated.credits,
      creditsAwarded: reward,
      todayCount: newTodayCount,
      remainingToday: remainingToday,
      dailyLimit: dailyLimit,
      message: `恭喜获得 ${reward} 积分！`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取广告状态（今日观看次数和剩余次数）
app.get('/api/credits/ad-status', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    const user = db.prepare('SELECT ad_count_today, last_ad_date FROM user_credits WHERE user_token = ?').get(userToken);
    
    if (!user) {
      return res.status(400).json({ success: false, error: '用户不存在' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    let todayCount = user.ad_count_today || 0;
    
    // 如果上次观看日期不是今天，重置为0
    if (user.last_ad_date !== today) {
      todayCount = 0;
    }
    
    const dailyLimit = parseInt(getConfig('credits_ad_daily_limit', '30')) || 30;
    const remainingToday = Math.max(0, dailyLimit - todayCount);
    
    res.json({
      success: true,
      todayCount,
      remainingToday,
      dailyLimit
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
    
    // 发放每日登录积分（从配置读取）
    const reward = parseFloat(getConfig('credits_daily_login', '1')) || 1;
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

// ==================== 文章推广验证码系统 ====================

// 文章链接访问领取积分
app.post('/api/credits/article-visit', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { articleId } = req.body;
    const clientIP = getClientIP(req);
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    if (!articleId) {
      return res.status(400).json({ success: false, error: '缺少文章标识' });
    }
    
    // 查找对应的验证码（同时匹配 article_id 和 code 字段）
    const normalizedId = articleId.trim().toUpperCase();
    const promoCode = db.prepare(`
      SELECT * FROM article_promo_codes 
      WHERE (UPPER(article_id) = ? OR UPPER(code) = ?) AND is_active = 1
    `).get(normalizedId, normalizedId);
    
    if (!promoCode) {
      return res.status(400).json({ success: false, error: '无效的文章链接' });
    }
    
    // 检查是否已领取
    const existingLog = db.prepare(`
      SELECT * FROM promo_code_logs 
      WHERE user_token = ? AND code = ?
    `).get(userToken, promoCode.code);
    
    if (existingLog) {
      return res.json({ 
        success: false, 
        error: '已领取过该福利',
        alreadyClaimed: true
      });
    }
    
    // 检查使用次数限制
    if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
      return res.status(400).json({ success: false, error: '该福利已被领完' });
    }
    
    // 检查今日阅读文章是否达上限
    const today = new Date().toISOString().split('T')[0];
    const articleDailyLimit = parseInt(getConfig('credits_article_daily_limit', '3'));
    const articleDailyRecord = db.prepare(
      'SELECT count FROM daily_action_credits WHERE user_token = ? AND action_type = ? AND action_date = ?'
    ).get(userToken, 'article_read', today);
    const articleDailyCount = articleDailyRecord?.count || 0;
    
    if (articleDailyCount >= articleDailyLimit) {
      return res.json({ 
        success: false, 
        error: '今日阅读文章奖励已达上限',
        limitReached: true,
        todayCount: articleDailyCount,
        dailyLimit: articleDailyLimit
      });
    }
    
    // 确保用户积分记录存在
    ensureUserCredits(userToken);
    
    // 发放积分
    const reward = promoCode.reward || parseFloat(getConfig('credits_article', '1'));
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(reward, reward, userToken);
    
    // 记录使用日志
    db.prepare(`
      INSERT INTO promo_code_logs (user_token, code, article_id, source, ip_address)
      VALUES (?, ?, ?, 'link', ?)
    `).run(userToken, promoCode.code, articleId, clientIP);
    
    // 更新验证码使用次数
    db.prepare(`
      UPDATE article_promo_codes SET used_count = used_count + 1 WHERE code = ?
    `).run(promoCode.code);
    
    // 记录积分日志
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'article_visit', ?)
    `).run(userToken, reward, `文章福利: ${promoCode.description || articleId}`);
    
    // 更新每日计数
    db.prepare(`
      INSERT INTO daily_action_credits (user_token, action_type, action_date, count)
      VALUES (?, 'article_read', ?, 1)
      ON CONFLICT(user_token, action_type, action_date) DO UPDATE SET count = count + 1
    `).run(userToken, today);
    
    const updated = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    const newCount = articleDailyCount + 1;
    
    res.json({ 
      success: true, 
      credits: updated.credits, 
      earned: reward,
      message: `🎉 阅读福利已到账！+${reward}积分`,
      todayCount: newCount,
      dailyLimit: articleDailyLimit,
      remaining: articleDailyLimit - newCount
    });
  } catch (error) {
    console.error('文章访问领取积分错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 验证码兑换积分
app.post('/api/credits/redeem-code', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { code } = req.body;
    const clientIP = getClientIP(req);
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户标识' });
    }
    
    if (!code) {
      return res.status(400).json({ success: false, error: '请输入验证码' });
    }
    
    // 验证码统一转大写
    const normalizedCode = code.trim().toUpperCase();
    
    // 查找验证码
    const promoCode = db.prepare(`
      SELECT * FROM article_promo_codes 
      WHERE UPPER(code) = ? AND is_active = 1
    `).get(normalizedCode);
    
    if (!promoCode) {
      return res.status(400).json({ success: false, error: '验证码无效' });
    }
    
    // 检查是否已使用
    const existingLog = db.prepare(`
      SELECT * FROM promo_code_logs 
      WHERE user_token = ? AND UPPER(code) = ?
    `).get(userToken, normalizedCode);
    
    if (existingLog) {
      return res.status(400).json({ 
        success: false, 
        error: '您已使用过该验证码',
        alreadyUsed: true
      });
    }
    
    // 检查使用次数限制
    if (promoCode.max_uses && promoCode.used_count >= promoCode.max_uses) {
      return res.status(400).json({ success: false, error: '该验证码已达使用上限' });
    }
    
    // 检查今日阅读文章是否达上限
    const today = new Date().toISOString().split('T')[0];
    const articleDailyLimit = parseInt(getConfig('credits_article_daily_limit', '3'));
    const articleDailyRecord = db.prepare(
      'SELECT count FROM daily_action_credits WHERE user_token = ? AND action_type = ? AND action_date = ?'
    ).get(userToken, 'article_read', today);
    const articleDailyCount = articleDailyRecord?.count || 0;
    
    if (articleDailyCount >= articleDailyLimit) {
      return res.status(400).json({ 
        success: false, 
        error: '今日阅读文章奖励已达上限',
        limitReached: true,
        todayCount: articleDailyCount,
        dailyLimit: articleDailyLimit
      });
    }
    
    // 确保用户积分记录存在
    ensureUserCredits(userToken);
    
    // 发放积分
    const reward = promoCode.reward || parseFloat(getConfig('credits_article', '1'));
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(reward, reward, userToken);
    
    // 记录使用日志
    db.prepare(`
      INSERT INTO promo_code_logs (user_token, code, article_id, source, ip_address)
      VALUES (?, ?, ?, 'code', ?)
    `).run(userToken, promoCode.code, promoCode.article_id, clientIP);
    
    // 更新验证码使用次数
    db.prepare(`
      UPDATE article_promo_codes SET used_count = used_count + 1 WHERE code = ?
    `).run(promoCode.code);
    
    // 记录积分日志
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'redeem_code', ?)
    `).run(userToken, reward, `兑换验证码: ${promoCode.code}`);
    
    // 更新每日计数
    db.prepare(`
      INSERT INTO daily_action_credits (user_token, action_type, action_date, count)
      VALUES (?, 'article_read', ?, 1)
      ON CONFLICT(user_token, action_type, action_date) DO UPDATE SET count = count + 1
    `).run(userToken, today);
    
    const updated = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    const newCount = articleDailyCount + 1;
    
    res.json({ 
      success: true, 
      credits: updated.credits, 
      earned: reward,
      message: `🎉 兑换成功！+${reward}积分`,
      todayCount: newCount,
      dailyLimit: articleDailyLimit,
      remaining: articleDailyLimit - newCount
    });
  } catch (error) {
    console.error('验证码兑换错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理后台 - 获取验证码列表
app.get('/api/admin/promo-codes', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const codes = db.prepare(`
      SELECT * FROM article_promo_codes ORDER BY created_at DESC
    `).all();
    
    res.json({ success: true, codes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理后台 - 创建验证码
app.post('/api/admin/promo-codes', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { code, articleId, description, reward, maxUses } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, error: '验证码不能为空' });
    }
    
    // 验证码统一转大写
    const normalizedCode = code.trim().toUpperCase();
    
    // 检查是否已存在
    const existing = db.prepare('SELECT * FROM article_promo_codes WHERE UPPER(code) = ?').get(normalizedCode);
    if (existing) {
      return res.status(400).json({ success: false, error: '验证码已存在' });
    }
    
    db.prepare(`
      INSERT INTO article_promo_codes (code, article_id, description, reward, max_uses)
      VALUES (?, ?, ?, ?, ?)
    `).run(normalizedCode, articleId || null, description || null, reward || 1, maxUses || null);
    
    res.json({ success: true, message: '验证码创建成功', code: normalizedCode });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理后台 - 删除验证码
app.delete('/api/admin/promo-codes/:code', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { code } = req.params;
    const normalizedCode = code.trim().toUpperCase();
    
    const result = db.prepare('DELETE FROM article_promo_codes WHERE UPPER(code) = ?').run(normalizedCode);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '验证码不存在' });
    }
    
    res.json({ success: true, message: '验证码已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理后台 - 切换验证码状态
app.put('/api/admin/promo-codes/:code/toggle', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { code } = req.params;
    const normalizedCode = code.trim().toUpperCase();
    
    const promoCode = db.prepare('SELECT * FROM article_promo_codes WHERE UPPER(code) = ?').get(normalizedCode);
    
    if (!promoCode) {
      return res.status(404).json({ success: false, error: '验证码不存在' });
    }
    
    const newStatus = promoCode.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE article_promo_codes SET is_active = ? WHERE UPPER(code) = ?').run(newStatus, normalizedCode);
    
    res.json({ success: true, isActive: newStatus === 1, message: newStatus === 1 ? '验证码已启用' : '验证码已禁用' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 行为积分配置管理 API ====================

// 获取行为积分配置
app.get('/api/admin/action-credits-config', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const config = {
      like: {
        credits: parseFloat(getConfig('credits_action_like', '0.1')),
        dailyLimit: parseInt(getConfig('credits_action_like_daily_limit', '10'))
      },
      favorite: {
        credits: parseFloat(getConfig('credits_action_favorite', '0.2')),
        dailyLimit: parseInt(getConfig('credits_action_favorite_daily_limit', '5'))
      },
      follow: {
        credits: parseFloat(getConfig('credits_action_follow', '0.2')),
        dailyLimit: parseInt(getConfig('credits_action_follow_daily_limit', '5'))
      },
      comment: {
        credits: parseFloat(getConfig('credits_action_comment', '0.5')),
        dailyLimit: parseInt(getConfig('credits_action_comment_daily_limit', '2')),
        minLength: parseInt(getConfig('credits_comment_min_length', '10'))
      }
    };
    
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存行为积分配置
app.put('/api/admin/action-credits-config', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { like, favorite, follow, comment } = req.body;
    
    // 验证并保存配置
    if (like) {
      if (like.credits !== undefined) setConfig('credits_action_like', String(like.credits));
      if (like.dailyLimit !== undefined) setConfig('credits_action_like_daily_limit', String(like.dailyLimit));
    }
    if (favorite) {
      if (favorite.credits !== undefined) setConfig('credits_action_favorite', String(favorite.credits));
      if (favorite.dailyLimit !== undefined) setConfig('credits_action_favorite_daily_limit', String(favorite.dailyLimit));
    }
    if (follow) {
      if (follow.credits !== undefined) setConfig('credits_action_follow', String(follow.credits));
      if (follow.dailyLimit !== undefined) setConfig('credits_action_follow_daily_limit', String(follow.dailyLimit));
    }
    if (comment) {
      if (comment.credits !== undefined) setConfig('credits_action_comment', String(comment.credits));
      if (comment.dailyLimit !== undefined) setConfig('credits_action_comment_daily_limit', String(comment.dailyLimit));
      if (comment.minLength !== undefined) setConfig('credits_comment_min_length', String(comment.minLength));
    }
    
    res.json({ success: true, message: '行为积分配置已保存' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取特殊积分配置（分享/邀请/文章）
app.get('/api/admin/extra-credits-config', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const config = {
      shareGame: {
        credits: parseFloat(getConfig('credits_share_game', '1')),
        dailyLimit: parseInt(getConfig('credits_share_game_daily_limit', '5'))
      },
      inviteFriend: {
        credits: parseFloat(getConfig('credits_invite_friend', '3')),
        dailyLimit: parseInt(getConfig('credits_invite_friend_daily_limit', '5'))
      },
      article: {
        credits: parseFloat(getConfig('credits_article', '1')),
        dailyLimit: parseInt(getConfig('credits_article_daily_limit', '3'))
      }
    };
    
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存特殊积分配置
app.put('/api/admin/extra-credits-config', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { shareGame, inviteFriend, article } = req.body;
    
    // 验证并保存配置
    if (shareGame) {
      if (shareGame.credits !== undefined) setConfig('credits_share_game', String(shareGame.credits));
      if (shareGame.dailyLimit !== undefined) setConfig('credits_share_game_daily_limit', String(shareGame.dailyLimit));
    }
    if (inviteFriend) {
      if (inviteFriend.credits !== undefined) setConfig('credits_invite_friend', String(inviteFriend.credits));
      if (inviteFriend.dailyLimit !== undefined) setConfig('credits_invite_friend_daily_limit', String(inviteFriend.dailyLimit));
    }
    if (article) {
      if (article.credits !== undefined) setConfig('credits_article', String(article.credits));
      if (article.dailyLimit !== undefined) setConfig('credits_article_daily_limit', String(article.dailyLimit));
    }
    
    res.json({ success: true, message: '特殊积分配置已保存' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 积分引流系统配置 API ====================

// 获取所有积分配置（综合）
app.get('/api/admin/credits-all-config', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const config = {
      // 基础积分配置
      basic: {
        register: parseFloat(getConfig('credits_register', '1')),
        dailyLogin: parseFloat(getConfig('credits_daily_login', '1'))
      },
      // 签到配置（小程序端）
      checkin: {
        base: parseFloat(getConfig('credits_checkin_base', '1')),
        streak3: parseFloat(getConfig('credits_checkin_streak_3', '1')),
        streak7: parseFloat(getConfig('credits_checkin_streak_7', '2')),
        streak14: parseFloat(getConfig('credits_checkin_streak_14', '3')),
        streak30: parseFloat(getConfig('credits_checkin_streak_30', '5'))
      },
      // 互动任务积分领取规则
      claim: {
        likeThreshold: parseInt(getConfig('credits_claim_like_threshold', '10')),
        likeReward: parseFloat(getConfig('credits_claim_like_reward', '1')),
        likeDailyLimit: parseInt(getConfig('credits_claim_like_daily_limit', '3')),
        favoriteThreshold: parseInt(getConfig('credits_claim_favorite_threshold', '5')),
        favoriteReward: parseFloat(getConfig('credits_claim_favorite_reward', '1')),
        favoriteDailyLimit: parseInt(getConfig('credits_claim_favorite_daily_limit', '3')),
        followThreshold: parseInt(getConfig('credits_claim_follow_threshold', '5')),
        followReward: parseFloat(getConfig('credits_claim_follow_reward', '1')),
        followDailyLimit: parseInt(getConfig('credits_claim_follow_daily_limit', '3')),
        commentThreshold: parseInt(getConfig('credits_claim_comment_threshold', '2')),
        commentReward: parseFloat(getConfig('credits_claim_comment_reward', '1')),
        commentDailyLimit: parseInt(getConfig('credits_claim_comment_daily_limit', '3')),
        shareThreshold: parseInt(getConfig('credits_claim_share_threshold', '2')),
        shareReward: parseFloat(getConfig('credits_claim_share_reward', '1')),
        shareDailyLimit: parseInt(getConfig('credits_claim_share_daily_limit', '3'))
      },
      // 创作激励配置
      create: {
        gameReward: parseFloat(getConfig('credits_create_game', '2')),
        gameDailyLimit: parseInt(getConfig('credits_create_game_daily_limit', '1')),
        editThreshold: parseInt(getConfig('credits_edit_game_threshold', '2')),
        editReward: parseFloat(getConfig('credits_edit_game_reward', '1')),
        editDailyLimit: parseInt(getConfig('credits_edit_game_daily_limit', '1'))
      },
      // 激励视频广告配置
      ad: {
        reward: parseFloat(getConfig('credits_ad_reward', '3')),
        dailyLimit: parseInt(getConfig('credits_ad_daily_limit', '30')),
        enabled: getConfig('credits_ad_enabled', 'false') === 'true',
        rewardedVideoAdUnitId: getConfig('rewarded_video_ad_unit_id', '')
      },
      // 邀请好友配置（小程序端）
      invite: {
        mpReward: parseFloat(getConfig('credits_mp_invite', '5'))
      },
      // 现有行为积分配置（兼容）
      action: {
        like: {
          credits: parseFloat(getConfig('credits_action_like', '0.1')),
          dailyLimit: parseInt(getConfig('credits_action_like_daily_limit', '10'))
        },
        favorite: {
          credits: parseFloat(getConfig('credits_action_favorite', '0.2')),
          dailyLimit: parseInt(getConfig('credits_action_favorite_daily_limit', '5'))
        },
        follow: {
          credits: parseFloat(getConfig('credits_action_follow', '0.2')),
          dailyLimit: parseInt(getConfig('credits_action_follow_daily_limit', '5'))
        },
        comment: {
          credits: parseFloat(getConfig('credits_action_comment', '0.5')),
          dailyLimit: parseInt(getConfig('credits_action_comment_daily_limit', '2')),
          minLength: parseInt(getConfig('credits_comment_min_length', '10'))
        }
      },
      // 现有特殊积分配置（兼容）
      extra: {
        shareGame: {
          credits: parseFloat(getConfig('credits_share_game', '1')),
          dailyLimit: parseInt(getConfig('credits_share_game_daily_limit', '5'))
        },
        inviteFriend: {
          credits: parseFloat(getConfig('credits_invite_friend', '3')),
          dailyLimit: parseInt(getConfig('credits_invite_friend_daily_limit', '5'))
        },
        article: {
          credits: parseFloat(getConfig('credits_article', '1')),
          dailyLimit: parseInt(getConfig('credits_article_daily_limit', '3'))
        }
      }
    };
    
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存所有积分配置（综合）
app.put('/api/admin/credits-all-config', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { basic, checkin, claim, create, ad, invite, action, extra } = req.body;
    
    // 基础积分配置
    if (basic) {
      if (basic.register !== undefined) setConfig('credits_register', String(basic.register));
      if (basic.dailyLogin !== undefined) setConfig('credits_daily_login', String(basic.dailyLogin));
    }
    
    // 签到配置
    if (checkin) {
      if (checkin.base !== undefined) setConfig('credits_checkin_base', String(checkin.base));
      if (checkin.streak3 !== undefined) setConfig('credits_checkin_streak_3', String(checkin.streak3));
      if (checkin.streak7 !== undefined) setConfig('credits_checkin_streak_7', String(checkin.streak7));
      if (checkin.streak14 !== undefined) setConfig('credits_checkin_streak_14', String(checkin.streak14));
      if (checkin.streak30 !== undefined) setConfig('credits_checkin_streak_30', String(checkin.streak30));
    }
    
    // 互动任务配置
    if (claim) {
      if (claim.likeThreshold !== undefined) setConfig('credits_claim_like_threshold', String(claim.likeThreshold));
      if (claim.likeReward !== undefined) setConfig('credits_claim_like_reward', String(claim.likeReward));
      if (claim.likeDailyLimit !== undefined) setConfig('credits_claim_like_daily_limit', String(claim.likeDailyLimit));
      if (claim.favoriteThreshold !== undefined) setConfig('credits_claim_favorite_threshold', String(claim.favoriteThreshold));
      if (claim.favoriteReward !== undefined) setConfig('credits_claim_favorite_reward', String(claim.favoriteReward));
      if (claim.favoriteDailyLimit !== undefined) setConfig('credits_claim_favorite_daily_limit', String(claim.favoriteDailyLimit));
      if (claim.followThreshold !== undefined) setConfig('credits_claim_follow_threshold', String(claim.followThreshold));
      if (claim.followReward !== undefined) setConfig('credits_claim_follow_reward', String(claim.followReward));
      if (claim.followDailyLimit !== undefined) setConfig('credits_claim_follow_daily_limit', String(claim.followDailyLimit));
      if (claim.commentThreshold !== undefined) setConfig('credits_claim_comment_threshold', String(claim.commentThreshold));
      if (claim.commentReward !== undefined) setConfig('credits_claim_comment_reward', String(claim.commentReward));
      if (claim.commentDailyLimit !== undefined) setConfig('credits_claim_comment_daily_limit', String(claim.commentDailyLimit));
      if (claim.shareThreshold !== undefined) setConfig('credits_claim_share_threshold', String(claim.shareThreshold));
      if (claim.shareReward !== undefined) setConfig('credits_claim_share_reward', String(claim.shareReward));
      if (claim.shareDailyLimit !== undefined) setConfig('credits_claim_share_daily_limit', String(claim.shareDailyLimit));
    }
    
    // 创作激励配置
    if (create) {
      if (create.gameReward !== undefined) setConfig('credits_create_game', String(create.gameReward));
      if (create.gameDailyLimit !== undefined) setConfig('credits_create_game_daily_limit', String(create.gameDailyLimit));
      if (create.editThreshold !== undefined) setConfig('credits_edit_game_threshold', String(create.editThreshold));
      if (create.editReward !== undefined) setConfig('credits_edit_game_reward', String(create.editReward));
      if (create.editDailyLimit !== undefined) setConfig('credits_edit_game_daily_limit', String(create.editDailyLimit));
    }
    
    // 广告配置
    if (ad) {
      if (ad.reward !== undefined) setConfig('credits_ad_reward', String(ad.reward));
      if (ad.dailyLimit !== undefined) setConfig('credits_ad_daily_limit', String(ad.dailyLimit));
      if (ad.enabled !== undefined) setConfig('credits_ad_enabled', String(ad.enabled));
      if (ad.rewardedVideoAdUnitId !== undefined) setConfig('rewarded_video_ad_unit_id', String(ad.rewardedVideoAdUnitId));
    }
    
    // 邀请配置
    if (invite) {
      if (invite.mpReward !== undefined) setConfig('credits_mp_invite', String(invite.mpReward));
    }
    
    // 现有行为积分配置（兼容）
    if (action) {
      if (action.like) {
        if (action.like.credits !== undefined) setConfig('credits_action_like', String(action.like.credits));
        if (action.like.dailyLimit !== undefined) setConfig('credits_action_like_daily_limit', String(action.like.dailyLimit));
      }
      if (action.favorite) {
        if (action.favorite.credits !== undefined) setConfig('credits_action_favorite', String(action.favorite.credits));
        if (action.favorite.dailyLimit !== undefined) setConfig('credits_action_favorite_daily_limit', String(action.favorite.dailyLimit));
      }
      if (action.follow) {
        if (action.follow.credits !== undefined) setConfig('credits_action_follow', String(action.follow.credits));
        if (action.follow.dailyLimit !== undefined) setConfig('credits_action_follow_daily_limit', String(action.follow.dailyLimit));
      }
      if (action.comment) {
        if (action.comment.credits !== undefined) setConfig('credits_action_comment', String(action.comment.credits));
        if (action.comment.dailyLimit !== undefined) setConfig('credits_action_comment_daily_limit', String(action.comment.dailyLimit));
        if (action.comment.minLength !== undefined) setConfig('credits_comment_min_length', String(action.comment.minLength));
      }
    }
    
    // 现有特殊积分配置（兼容）
    if (extra) {
      if (extra.shareGame) {
        if (extra.shareGame.credits !== undefined) setConfig('credits_share_game', String(extra.shareGame.credits));
        if (extra.shareGame.dailyLimit !== undefined) setConfig('credits_share_game_daily_limit', String(extra.shareGame.dailyLimit));
      }
      if (extra.inviteFriend) {
        if (extra.inviteFriend.credits !== undefined) setConfig('credits_invite_friend', String(extra.inviteFriend.credits));
        if (extra.inviteFriend.dailyLimit !== undefined) setConfig('credits_invite_friend_daily_limit', String(extra.inviteFriend.dailyLimit));
      }
      if (extra.article) {
        if (extra.article.credits !== undefined) setConfig('credits_article', String(extra.article.credits));
        if (extra.article.dailyLimit !== undefined) setConfig('credits_article_daily_limit', String(extra.article.dailyLimit));
      }
    }
    
    res.json({ success: true, message: '积分配置已保存' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取成就列表（管理后台）
app.get('/api/admin/achievements', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const achievements = db.prepare(`
      SELECT id, name, description, icon, category, condition_type, condition_value, reward_credits, sort_order, is_active
      FROM achievements
      ORDER BY category, sort_order
    `).all();
    
    res.json({ success: true, achievements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新成就配置（管理后台）
app.put('/api/admin/achievements', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { achievements } = req.body;
    
    if (!achievements || !Array.isArray(achievements)) {
      return res.status(400).json({ success: false, error: '无效的成就数据' });
    }
    
    const updateStmt = db.prepare(`
      UPDATE achievements 
      SET condition_value = ?, reward_credits = ?, is_active = ?, description = ?
      WHERE id = ?
    `);
    
    const updateMany = db.transaction((items) => {
      for (const item of items) {
        if (item.id) {
          updateStmt.run(
            item.condition_value ?? 1,
            item.reward_credits ?? 1,
            item.is_active ?? 1,
            item.description || '',
            item.id
          );
        }
      }
    });
    
    updateMany(achievements);
    
    res.json({ success: true, message: `已更新 ${achievements.length} 个成就配置` });
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

// 获取用户行为积分配置和今日进度（用户端可访问）
app.get('/api/credits/action-ways', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const today = new Date().toISOString().split('T')[0];
    
    // 获取各行为的配置
    const ways = {
      like: {
        name: '点赞作品',
        icon: '❤️',
        desc: '给喜欢的游戏点赞',
        credits: parseFloat(getConfig('credits_action_like', '0.1')),
        dailyLimit: parseInt(getConfig('credits_action_like_daily_limit', '10')),
        todayCount: 0
      },
      favorite: {
        name: '收藏作品',
        icon: '⭐',
        desc: '收藏喜欢的游戏',
        credits: parseFloat(getConfig('credits_action_favorite', '0.2')),
        dailyLimit: parseInt(getConfig('credits_action_favorite_daily_limit', '5')),
        todayCount: 0
      },
      comment: {
        name: '评论作品',
        icon: '💬',
        desc: `发表${getConfig('credits_comment_min_length', '10')}字以上的评论`,
        credits: parseFloat(getConfig('credits_action_comment', '0.5')),
        dailyLimit: parseInt(getConfig('credits_action_comment_daily_limit', '2')),
        todayCount: 0
      },
      follow: {
        name: '关注创作者',
        icon: '👤',
        desc: '关注喜欢的创作者',
        credits: parseFloat(getConfig('credits_action_follow', '0.2')),
        dailyLimit: parseInt(getConfig('credits_action_follow_daily_limit', '5')),
        todayCount: 0
      }
    };
    
    // 如果用户已登录，获取今日各行为已获取次数
    if (userToken) {
      for (const actionType of ['like', 'favorite', 'comment', 'follow']) {
        const record = db.prepare(
          'SELECT count FROM daily_action_credits WHERE user_token = ? AND action_type = ? AND action_date = ?'
        ).get(userToken, actionType, today);
        ways[actionType].todayCount = record?.count || 0;
      }
    }
    
    res.json({ success: true, ways });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
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
      SELECT id, title, prompt, author_name, play_count, like_count, favorite_count, is_featured, created_at,
             (SELECT COUNT(*) FROM game_comments WHERE game_id = games.id AND is_deleted = 0) as comment_count
      FROM games 
      WHERE is_hidden = 0 AND (is_public = 1 OR is_public IS NULL)
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json({ success: true, games: addGamesFieldAliases(games) });
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
    res.json({ success: true, games: addGamesFieldAliases(games) });
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
    
    // 查询作者作品数（排除隐藏的游戏）
    if (game.author_token) {
      const authorStats = db.prepare(`
        SELECT COUNT(*) as games_count FROM games 
        WHERE author_token = ? AND is_hidden = 0
      `).get(game.author_token);
      game.author_games_count = authorStats ? authorStats.games_count : 0;
    } else {
      game.author_games_count = 0;
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

// 检查用户是否可以编辑游戏（作者或管理员）
app.get('/api/games/:id/can-edit', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.json({ success: true, canEdit: false, reason: '未登录' });
    }
    
    const game = db.prepare('SELECT author_token, is_public, visibility FROM games WHERE id = ?').get(req.params.id);
    
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    const isAuthor = game.author_token === userToken;
    const isAdmin = isUserAdmin(userToken);
    const isPublicGame = game.is_public === 1 && game.visibility === 'public';
    
    // 作者可以编辑自己的游戏，管理员可以编辑公开游戏
    const canEdit = isAuthor || (isAdmin && isPublicGame);
    
    res.json({ 
      success: true, 
      canEdit,
      isAuthor,
      isAdmin,
      reason: canEdit ? (isAuthor ? '作者' : '管理员') : '无权限'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 检查当前用户是否为管理员
app.get('/api/user/is-admin', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.json({ success: true, isAdmin: false });
    }
    
    const isAdmin = isUserAdmin(userToken);
    res.json({ success: true, isAdmin });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 小程序积分引流 API ====================

/**
 * 获取周期开始日期
 * @param {string} periodType - 周期类型: daily/weekly/monthly
 * @returns {string} YYYY-MM-DD 格式的周期开始日期
 */
function getPeriodStart(periodType) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  switch (periodType) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly':
      // 获取本周一的日期
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      return monday.toISOString().split('T')[0];
    case 'monthly':
      return `${year}-${month}-01`;
    default:
      return '';
  }
}

/**
 * 记录用户行为统计（供网站端调用）
 * 只记录行为次数，不发放积分
 */
function recordUserAction(userToken, actionType, count = 1) {
  if (!userToken) return;
  
  const today = getPeriodStart('daily');
  const weekStart = getPeriodStart('weekly');
  const monthStart = getPeriodStart('monthly');
  
  // 更新每日统计
  db.prepare(`
    INSERT INTO user_action_stats (user_token, action_type, period_type, period_start, action_count)
    VALUES (?, ?, 'daily', ?, ?)
    ON CONFLICT(user_token, action_type, period_type, period_start)
    DO UPDATE SET action_count = action_count + ?, updated_at = CURRENT_TIMESTAMP
  `).run(userToken, actionType, today, count, count);
  
  // 更新每周统计
  db.prepare(`
    INSERT INTO user_action_stats (user_token, action_type, period_type, period_start, action_count)
    VALUES (?, ?, 'weekly', ?, ?)
    ON CONFLICT(user_token, action_type, period_type, period_start)
    DO UPDATE SET action_count = action_count + ?, updated_at = CURRENT_TIMESTAMP
  `).run(userToken, actionType, weekStart, count, count);
  
  // 更新每月统计
  db.prepare(`
    INSERT INTO user_action_stats (user_token, action_type, period_type, period_start, action_count)
    VALUES (?, ?, 'monthly', ?, ?)
    ON CONFLICT(user_token, action_type, period_type, period_start)
    DO UPDATE SET action_count = action_count + ?, updated_at = CURRENT_TIMESTAMP
  `).run(userToken, actionType, monthStart, count, count);
  
  console.log(`[行为统计] 用户 ${userToken.substring(0, 8)}... ${actionType} +${count}`);
}

/**
 * 获取用户行为统计
 */
function getUserActionStats(userToken, periodType) {
  const periodStart = getPeriodStart(periodType);
  
  const stats = db.prepare(`
    SELECT action_type, action_count, claimed_count
    FROM user_action_stats
    WHERE user_token = ? AND period_type = ? AND period_start = ?
  `).all(userToken, periodType, periodStart);
  
  const result = {};
  for (const stat of stats) {
    result[stat.action_type] = {
      count: stat.action_count,
      claimed: stat.claimed_count
    };
  }
  return result;
}

/**
 * 签到接口（仅小程序可用）
 * POST /api/user/checkin
 * Headers: x-user-token, x-platform: miniprogram
 */
app.post('/api/user/checkin', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const platform = req.headers['x-platform'];
    
    // 验证是否为小程序请求
    if (platform !== 'miniprogram') {
      return res.status(403).json({ 
        success: false, 
        error: '签到功能仅在小程序端可用，请打开小程序进行签到' 
      });
    }
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // 检查今日是否已签到
    const existingCheckin = db.prepare(
      'SELECT * FROM user_checkins WHERE user_token = ? AND checkin_date = ?'
    ).get(userToken, today);
    
    if (existingCheckin) {
      return res.json({
        success: false,
        error: '今日已签到',
        data: {
          already_checked_in: true,
          streak_days: existingCheckin.streak_days,
          checkin_date: existingCheckin.checkin_date
        }
      });
    }
    
    // 查询昨天的签到记录，计算连续签到天数
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const yesterdayCheckin = db.prepare(
      'SELECT streak_days FROM user_checkins WHERE user_token = ? AND checkin_date = ?'
    ).get(userToken, yesterdayStr);
    
    // 计算连续签到天数
    const streakDays = yesterdayCheckin ? yesterdayCheckin.streak_days + 1 : 1;
    
    // 基础签到积分
    let rewardCredits = 1;
    
    // 计算连续签到加成
    let bonusCredits = 0;
    if (streakDays >= 30) {
      bonusCredits = 5;
    } else if (streakDays >= 14) {
      bonusCredits = 3;
    } else if (streakDays >= 7) {
      bonusCredits = 2;
    } else if (streakDays >= 3) {
      bonusCredits = 1;
    }
    
    const totalCredits = rewardCredits + bonusCredits;
    
    // 插入签到记录
    db.prepare(`
      INSERT INTO user_checkins (user_token, checkin_date, streak_days, reward_credits)
      VALUES (?, ?, ?, ?)
    `).run(userToken, today, streakDays, totalCredits);
    
    // 发放积分
    ensureUserCredits(userToken);
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(totalCredits, totalCredits, userToken);
    
    // 记录积分日志
    let description = `每日签到奖励`;
    if (bonusCredits > 0) {
      description += ` + 连续${streakDays}天签到加成`;
    }
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'checkin', ?)
    `).run(userToken, totalCredits, description);
    
    // 记录登录行为（用于成就系统）
    recordUserAction(userToken, 'login', 1);
    
    // 获取用户当前积分
    const userCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    console.log(`[签到] 用户 ${userToken.substring(0, 8)}... 签到成功，连续${streakDays}天，获得${totalCredits}积分`);
    
    res.json({
      success: true,
      data: {
        credits_earned: formatCreditsValue(rewardCredits),
        bonus_credits: formatCreditsValue(bonusCredits),
        total_earned: formatCreditsValue(totalCredits),
        streak_days: streakDays,
        total_credits: formatCreditsValue(userCredits?.credits || 0),
        next_bonus: getNextStreakBonus(streakDays)
      }
    });
  } catch (error) {
    console.error('[签到] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取下一个连续签到加成信息
 */
function getNextStreakBonus(currentStreak) {
  if (currentStreak < 3) {
    return { days: 3, bonus: 1, remaining: 3 - currentStreak };
  } else if (currentStreak < 7) {
    return { days: 7, bonus: 2, remaining: 7 - currentStreak };
  } else if (currentStreak < 14) {
    return { days: 14, bonus: 3, remaining: 14 - currentStreak };
  } else if (currentStreak < 30) {
    return { days: 30, bonus: 5, remaining: 30 - currentStreak };
  } else {
    return { days: 30, bonus: 5, remaining: 0, message: '已达最高连续签到加成！' };
  }
}

/**
 * 获取签到状态
 * GET /api/user/checkin-status
 * Headers: x-user-token
 */
app.get('/api/user/checkin-status', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // 检查今日签到状态
    const todayCheckin = db.prepare(
      'SELECT * FROM user_checkins WHERE user_token = ? AND checkin_date = ?'
    ).get(userToken, today);
    
    // 获取最近签到记录（计算连续天数）
    const latestCheckin = db.prepare(
      'SELECT * FROM user_checkins WHERE user_token = ? ORDER BY checkin_date DESC LIMIT 1'
    ).get(userToken);
    
    // 计算当前连续签到天数
    let currentStreak = 0;
    if (latestCheckin) {
      const lastDate = new Date(latestCheckin.checkin_date);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        // 今天已签到
        currentStreak = latestCheckin.streak_days;
      } else if (diffDays === 1) {
        // 昨天签到了，今天还没签
        currentStreak = latestCheckin.streak_days;
      } else {
        // 中断了
        currentStreak = 0;
      }
    }
    
    // 获取本月签到天数
    const monthStart = getPeriodStart('monthly');
    const monthCheckins = db.prepare(`
      SELECT COUNT(*) as count FROM user_checkins 
      WHERE user_token = ? AND checkin_date >= ?
    `).get(userToken, monthStart);
    
    res.json({
      success: true,
      data: {
        checked_in_today: !!todayCheckin,
        streak_days: currentStreak,
        next_bonus: getNextStreakBonus(currentStreak),
        month_checkins: monthCheckins?.count || 0,
        last_checkin: latestCheckin?.checkin_date || null
      }
    });
  } catch (error) {
    console.error('[签到状态] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 成就系统 API ====================

/**
 * 计算用户成就进度
 */
function calculateAchievementProgress(userToken, achievement) {
  const { id, category, condition_type, condition_value } = achievement;
  let currentValue = 0;
  
  // 根据成就类型确定周期
  let periodType = 'daily';
  if (category === 'weekly') periodType = 'weekly';
  if (category === 'monthly') periodType = 'monthly';
  
  const periodStart = getPeriodStart(periodType);
  
  switch (condition_type) {
    case 'daily_active': {
      // 登录 + 任意1次互动
      const hasLogin = db.prepare(`
        SELECT 1 FROM user_action_stats 
        WHERE user_token = ? AND action_type = 'login' AND period_type = 'daily' AND period_start = ? AND action_count > 0
      `).get(userToken, periodStart);
      
      const hasInteraction = db.prepare(`
        SELECT 1 FROM user_action_stats 
        WHERE user_token = ? AND action_type IN ('like', 'favorite', 'follow', 'comment') 
        AND period_type = 'daily' AND period_start = ? AND action_count > 0
      `).get(userToken, periodStart);
      
      currentValue = (hasLogin && hasInteraction) ? 1 : 0;
      break;
    }
    
    case 'daily_interactive': {
      // 点赞+收藏+关注各完成每日上限
      const likeLimit = parseInt(getConfig('credits_action_like_daily_limit', '10'));
      const favoriteLimit = parseInt(getConfig('credits_action_favorite_daily_limit', '5'));
      const followLimit = parseInt(getConfig('credits_action_follow_daily_limit', '5'));
      
      const likeCount = db.prepare(`
        SELECT action_count FROM user_action_stats 
        WHERE user_token = ? AND action_type = 'like' AND period_type = 'daily' AND period_start = ?
      `).get(userToken, periodStart)?.action_count || 0;
      
      const favoriteCount = db.prepare(`
        SELECT action_count FROM user_action_stats 
        WHERE user_token = ? AND action_type = 'favorite' AND period_type = 'daily' AND period_start = ?
      `).get(userToken, periodStart)?.action_count || 0;
      
      const followCount = db.prepare(`
        SELECT action_count FROM user_action_stats 
        WHERE user_token = ? AND action_type = 'follow' AND period_type = 'daily' AND period_start = ?
      `).get(userToken, periodStart)?.action_count || 0;
      
      const likeComplete = likeCount >= likeLimit ? 1 : 0;
      const favoriteComplete = favoriteCount >= favoriteLimit ? 1 : 0;
      const followComplete = followCount >= followLimit ? 1 : 0;
      
      currentValue = (likeComplete + favoriteComplete + followComplete) >= 3 ? 1 : 0;
      break;
    }
    
    case 'comment_count': {
      const stat = db.prepare(`
        SELECT action_count FROM user_action_stats 
        WHERE user_token = ? AND action_type = 'comment' AND period_type = ? AND period_start = ?
      `).get(userToken, periodType, periodStart);
      currentValue = stat?.action_count || 0;
      break;
    }
    
    case 'login_days': {
      if (category === 'weekly') {
        // 本周连续登录天数
        const weekStart = getPeriodStart('weekly');
        const logins = db.prepare(`
          SELECT COUNT(DISTINCT checkin_date) as count FROM user_checkins 
          WHERE user_token = ? AND checkin_date >= ?
        `).get(userToken, weekStart);
        currentValue = logins?.count || 0;
      } else if (category === 'monthly') {
        // 本月登录天数
        const monthStart = getPeriodStart('monthly');
        const logins = db.prepare(`
          SELECT COUNT(DISTINCT checkin_date) as count FROM user_checkins 
          WHERE user_token = ? AND checkin_date >= ?
        `).get(userToken, monthStart);
        currentValue = logins?.count || 0;
      }
      break;
    }
    
    case 'like_count':
    case 'favorite_count':
    case 'follow_count': {
      const actionType = condition_type.replace('_count', '');
      const stat = db.prepare(`
        SELECT action_count FROM user_action_stats 
        WHERE user_token = ? AND action_type = ? AND period_type = ? AND period_start = ?
      `).get(userToken, actionType, periodType, periodStart);
      currentValue = stat?.action_count || 0;
      break;
    }
    
    case 'total_interactive': {
      // 本月总互动次数
      const monthStart = getPeriodStart('monthly');
      const stats = db.prepare(`
        SELECT SUM(action_count) as total FROM user_action_stats 
        WHERE user_token = ? AND action_type IN ('like', 'favorite', 'follow', 'comment') 
        AND period_type = 'monthly' AND period_start = ?
      `).get(userToken, monthStart);
      currentValue = stats?.total || 0;
      break;
    }
    
    case 'game_count': {
      // 本月创作游戏数
      const monthStart = getPeriodStart('monthly');
      const games = db.prepare(`
        SELECT COUNT(*) as count FROM games 
        WHERE author_token = ? AND date(created_at) >= ?
      `).get(userToken, monthStart);
      currentValue = games?.count || 0;
      break;
    }
    
    case 'received_likes': {
      // 本月作品获得的赞数（需要计算增量）
      // 简化实现：查看本月互动统计中的received_likes
      const monthStart = getPeriodStart('monthly');
      const stat = db.prepare(`
        SELECT action_count FROM user_action_stats 
        WHERE user_token = ? AND action_type = 'received_like' AND period_type = 'monthly' AND period_start = ?
      `).get(userToken, monthStart);
      currentValue = stat?.action_count || 0;
      break;
    }
    
    case 'first_login': {
      // 首次登录（永久成就）
      const account = db.prepare('SELECT 1 FROM user_accounts WHERE user_token = ?').get(userToken);
      currentValue = account ? 1 : 0;
      break;
    }
    
    case 'first_game': {
      // 首个游戏（永久成就）
      const game = db.prepare('SELECT 1 FROM games WHERE author_token = ? LIMIT 1').get(userToken);
      currentValue = game ? 1 : 0;
      break;
    }
    
    case 'single_game_likes': {
      // 单作品最高赞数（永久成就）
      const maxLikes = db.prepare(`
        SELECT MAX(like_count) as max_likes FROM games WHERE author_token = ?
      `).get(userToken);
      currentValue = maxLikes?.max_likes || 0;
      break;
    }
    
    case 'total_games': {
      // 累计创作游戏数（永久成就）
      const games = db.prepare('SELECT COUNT(*) as count FROM games WHERE author_token = ?').get(userToken);
      currentValue = games?.count || 0;
      break;
    }
    
    case 'days_since_register': {
      // 注册天数（永久成就）
      const account = db.prepare('SELECT created_at FROM user_accounts WHERE user_token = ?').get(userToken);
      if (account) {
        const registerDate = new Date(account.created_at);
        const now = new Date();
        currentValue = Math.floor((now - registerDate) / (1000 * 60 * 60 * 24));
      }
      break;
    }
    
    default:
      currentValue = 0;
  }
  
  return {
    current: currentValue,
    target: condition_value,
    is_completed: currentValue >= condition_value,
    progress: Math.min(100, Math.round((currentValue / condition_value) * 100))
  };
}

/**
 * 获取成就列表及用户进度
 * GET /api/achievements
 * Query: category (可选，筛选分类)
 * Headers: x-user-token
 */
app.get('/api/achievements', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { category } = req.query;
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 获取成就列表
    let query = 'SELECT * FROM achievements WHERE is_active = 1';
    const params = [];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    query += ' ORDER BY category, sort_order';
    
    const achievements = db.prepare(query).all(...params);
    
    // 计算每个成就的进度
    const achievementList = achievements.map(achievement => {
      const periodStart = achievement.category === 'permanent' ? '' : getPeriodStart(
        achievement.category === 'daily' ? 'daily' : 
        achievement.category === 'weekly' ? 'weekly' : 'monthly'
      );
      
      // 获取用户成就记录
      const userAchievement = db.prepare(`
        SELECT * FROM user_achievements 
        WHERE user_token = ? AND achievement_id = ? AND (period_start = ? OR period_start IS NULL OR period_start = '')
        ORDER BY created_at DESC LIMIT 1
      `).get(userToken, achievement.id, periodStart);
      
      // 计算当前进度
      const progress = calculateAchievementProgress(userToken, achievement);
      
      return {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        current: progress.current,
        target: progress.target,
        progress: progress.progress,
        is_completed: progress.is_completed,
        is_claimed: userAchievement?.is_claimed === 1,
        reward_credits: achievement.reward_credits,
        can_claim: progress.is_completed && userAchievement?.is_claimed !== 1
      };
    });
    
    // 统计可领取数量和积分
    const claimable = achievementList.filter(a => a.can_claim);
    const claimableCredits = claimable.reduce((sum, a) => sum + a.reward_credits, 0);
    
    // 按分类分组
    const grouped = {
      daily: achievementList.filter(a => a.category === 'daily'),
      weekly: achievementList.filter(a => a.category === 'weekly'),
      monthly: achievementList.filter(a => a.category === 'monthly'),
      permanent: achievementList.filter(a => a.category === 'permanent')
    };
    
    res.json({
      success: true,
      data: {
        achievements: achievementList,
        grouped,
        claimable_count: claimable.length,
        claimable_credits: claimableCredits
      }
    });
  } catch (error) {
    console.error('[成就列表] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 领取成就奖励（仅小程序可用）
 * POST /api/achievements/:id/claim
 * Headers: x-user-token, x-platform: miniprogram
 */
app.post('/api/achievements/:id/claim', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const platform = req.headers['x-platform'];
    const achievementId = req.params.id;
    
    // 验证是否为小程序请求
    if (platform !== 'miniprogram') {
      return res.status(403).json({ 
        success: false, 
        error: '成就奖励仅可在小程序端领取' 
      });
    }
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 获取成就信息
    const achievement = db.prepare('SELECT * FROM achievements WHERE id = ? AND is_active = 1').get(achievementId);
    if (!achievement) {
      return res.status(404).json({ success: false, error: '成就不存在' });
    }
    
    // 确定周期
    const periodStart = achievement.category === 'permanent' ? '' : getPeriodStart(
      achievement.category === 'daily' ? 'daily' : 
      achievement.category === 'weekly' ? 'weekly' : 'monthly'
    );
    
    // 检查是否已领取
    const existingClaim = db.prepare(`
      SELECT * FROM user_achievements 
      WHERE user_token = ? AND achievement_id = ? AND is_claimed = 1
      AND (period_start = ? OR (? = '' AND period_start IS NULL) OR period_start = ?)
    `).get(userToken, achievementId, periodStart, periodStart, periodStart);
    
    if (existingClaim) {
      return res.json({
        success: false,
        error: '该成就奖励已领取'
      });
    }
    
    // 计算进度，确认是否已完成
    const progress = calculateAchievementProgress(userToken, achievement);
    if (!progress.is_completed) {
      return res.json({
        success: false,
        error: '成就尚未完成',
        data: {
          current: progress.current,
          target: progress.target,
          progress: progress.progress
        }
      });
    }
    
    // 记录领取
    db.prepare(`
      INSERT INTO user_achievements (user_token, achievement_id, current_value, is_completed, is_claimed, completed_at, claimed_at, period_start)
      VALUES (?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(user_token, achievement_id, period_start)
      DO UPDATE SET is_claimed = 1, claimed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    `).run(userToken, achievementId, progress.current, periodStart);
    
    // 发放积分
    ensureUserCredits(userToken);
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(achievement.reward_credits, achievement.reward_credits, userToken);
    
    // 记录积分日志
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'achievement', ?)
    `).run(userToken, achievement.reward_credits, `领取成就【${achievement.name}】奖励`);
    
    // 获取用户当前积分
    const userCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    console.log(`[成就] 用户 ${userToken.substring(0, 8)}... 领取【${achievement.name}】奖励 +${achievement.reward_credits}积分`);
    
    res.json({
      success: true,
      data: {
        achievement_name: achievement.name,
        credits_earned: formatCreditsValue(achievement.reward_credits),
        total_credits: formatCreditsValue(userCredits?.credits || 0)
      }
    });
  } catch (error) {
    console.error('[领取成就] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批量领取所有可领取的成就奖励（仅小程序可用）
 * POST /api/achievements/claim-all
 * Headers: x-user-token, x-platform: miniprogram
 */
app.post('/api/achievements/claim-all', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const platform = req.headers['x-platform'];
    
    // 验证是否为小程序请求
    if (platform !== 'miniprogram') {
      return res.status(403).json({ 
        success: false, 
        error: '成就奖励仅可在小程序端领取' 
      });
    }
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 获取所有成就
    const achievements = db.prepare('SELECT * FROM achievements WHERE is_active = 1').all();
    
    let totalCredits = 0;
    const claimedList = [];
    
    for (const achievement of achievements) {
      const periodStart = achievement.category === 'permanent' ? '' : getPeriodStart(
        achievement.category === 'daily' ? 'daily' : 
        achievement.category === 'weekly' ? 'weekly' : 'monthly'
      );
      
      // 检查是否已领取
      const existingClaim = db.prepare(`
        SELECT * FROM user_achievements 
        WHERE user_token = ? AND achievement_id = ? AND is_claimed = 1
        AND (period_start = ? OR (? = '' AND period_start IS NULL) OR period_start = ?)
      `).get(userToken, achievement.id, periodStart, periodStart, periodStart);
      
      if (existingClaim) continue;
      
      // 计算进度
      const progress = calculateAchievementProgress(userToken, achievement);
      if (!progress.is_completed) continue;
      
      // 记录领取
      db.prepare(`
        INSERT INTO user_achievements (user_token, achievement_id, current_value, is_completed, is_claimed, completed_at, claimed_at, period_start)
        VALUES (?, ?, ?, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(user_token, achievement_id, period_start)
        DO UPDATE SET is_claimed = 1, claimed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      `).run(userToken, achievement.id, progress.current, periodStart);
      
      totalCredits += achievement.reward_credits;
      claimedList.push({
        id: achievement.id,
        name: achievement.name,
        credits: achievement.reward_credits
      });
    }
    
    if (totalCredits > 0) {
      // 发放积分
      ensureUserCredits(userToken);
      db.prepare(`
        UPDATE user_credits 
        SET credits = credits + ?, total_earned = total_earned + ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_token = ?
      `).run(totalCredits, totalCredits, userToken);
      
      // 记录积分日志
      db.prepare(`
        INSERT INTO credit_logs (user_token, amount, type, description)
        VALUES (?, ?, 'achievement', ?)
      `).run(userToken, totalCredits, `一键领取${claimedList.length}个成就奖励`);
    }
    
    // 获取用户当前积分
    const userCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    console.log(`[成就] 用户 ${userToken.substring(0, 8)}... 一键领取${claimedList.length}个成就，共${totalCredits}积分`);
    
    res.json({
      success: true,
      data: {
        claimed_count: claimedList.length,
        claimed_list: claimedList,
        total_credits_earned: formatCreditsValue(totalCredits),
        total_credits: formatCreditsValue(userCredits?.credits || 0)
      }
    });
  } catch (error) {
    console.error('[一键领取成就] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取互动积分领取情况（网站做任务，小程序领取）
 * GET /api/user/action-rewards
 * Headers: x-user-token
 */
app.get('/api/user/action-rewards', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    const today = getPeriodStart('daily');
    
    // 获取各类行为的统计和可领取情况（含创作类激励）
    const actionTypes = [
      { type: 'like', name: '点赞', target: 10, reward: 1 },
      { type: 'favorite', name: '收藏', target: 5, reward: 1 },
      { type: 'follow', name: '关注', target: 5, reward: 1 },
      { type: 'comment', name: '评论', target: 2, reward: 1 },
      { type: 'share', name: '分享', target: 2, reward: 1 },
      // 创作类激励（每日重置）
      { type: 'generate', name: '创作游戏', target: 1, reward: 2 },
      { type: 'edit', name: '编辑游戏', target: 2, reward: 1 }
    ];
    
    const rewards = actionTypes.map(action => {
      const stat = db.prepare(`
        SELECT action_count, claimed_count FROM user_action_stats 
        WHERE user_token = ? AND action_type = ? AND period_type = 'daily' AND period_start = ?
      `).get(userToken, action.type, today);
      
      const count = stat?.action_count || 0;
      const claimed = stat?.claimed_count || 0;
      
      // 计算可领取次数（每完成target次可领取一次）
      const completedSets = Math.floor(count / action.target);
      const canClaimCount = completedSets - claimed;
      const currentProgress = count % action.target;
      
      return {
        type: action.type,
        name: action.name,
        count,
        target: action.target,
        current_progress: currentProgress,
        completed_sets: completedSets,
        claimed_sets: claimed,
        can_claim_count: Math.max(0, canClaimCount),
        can_claim_credits: Math.max(0, canClaimCount) * action.reward,
        reward_per_set: action.reward
      };
    });
    
    // 计算总可领取积分
    const totalClaimable = rewards.reduce((sum, r) => sum + r.can_claim_credits, 0);
    
    res.json({
      success: true,
      data: {
        rewards,
        total_claimable: totalClaimable
      }
    });
  } catch (error) {
    console.error('[互动积分] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 领取互动积分（仅小程序可用）
 * POST /api/user/action-rewards/:type/claim
 * Headers: x-user-token, x-platform: miniprogram
 */
app.post('/api/user/action-rewards/:type/claim', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const platform = req.headers['x-platform'];
    const actionType = req.params.type;
    
    // 验证是否为小程序请求
    if (platform !== 'miniprogram') {
      return res.status(403).json({ 
        success: false, 
        error: '互动积分仅可在小程序端领取' 
      });
    }
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    const actionConfig = {
      like: { name: '点赞', target: 10, reward: 1 },
      favorite: { name: '收藏', target: 5, reward: 1 },
      follow: { name: '关注', target: 5, reward: 1 },
      comment: { name: '评论', target: 2, reward: 1 },
      share: { name: '分享', target: 2, reward: 1 }
    };
    
    const config = actionConfig[actionType];
    if (!config) {
      return res.status(400).json({ success: false, error: '无效的行为类型' });
    }
    
    const today = getPeriodStart('daily');
    
    // 获取统计
    const stat = db.prepare(`
      SELECT action_count, claimed_count FROM user_action_stats 
      WHERE user_token = ? AND action_type = ? AND period_type = 'daily' AND period_start = ?
    `).get(userToken, actionType, today);
    
    const count = stat?.action_count || 0;
    const claimed = stat?.claimed_count || 0;
    const completedSets = Math.floor(count / config.target);
    const canClaimCount = completedSets - claimed;
    
    if (canClaimCount <= 0) {
      return res.json({
        success: false,
        error: '暂无可领取的积分',
        data: {
          current: count % config.target,
          target: config.target,
          next_reward: config.target - (count % config.target)
        }
      });
    }
    
    // 领取所有可领取的积分
    const creditsToAdd = canClaimCount * config.reward;
    
    // 更新claimed_count
    db.prepare(`
      UPDATE user_action_stats 
      SET claimed_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_token = ? AND action_type = ? AND period_type = 'daily' AND period_start = ?
    `).run(completedSets, userToken, actionType, today);
    
    // 发放积分
    ensureUserCredits(userToken);
    db.prepare(`
      UPDATE user_credits 
      SET credits = credits + ?, total_earned = total_earned + ?, updated_at = CURRENT_TIMESTAMP 
      WHERE user_token = ?
    `).run(creditsToAdd, creditsToAdd, userToken);
    
    // 记录积分日志
    db.prepare(`
      INSERT INTO credit_logs (user_token, amount, type, description)
      VALUES (?, ?, 'action_reward', ?)
    `).run(userToken, creditsToAdd, `领取${config.name}奖励 x${canClaimCount}`);
    
    // 获取用户当前积分
    const userCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    console.log(`[互动积分] 用户 ${userToken.substring(0, 8)}... 领取${config.name}积分 +${creditsToAdd}`);
    
    res.json({
      success: true,
      data: {
        action_type: actionType,
        action_name: config.name,
        claimed_count: canClaimCount,
        credits_earned: formatCreditsValue(creditsToAdd),
        total_credits: formatCreditsValue(userCredits?.credits || 0)
      }
    });
  } catch (error) {
    console.error('[领取互动积分] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取用户积分进度（供网站积分不足弹窗显示）
 * GET /api/user/credits-progress
 * Headers: x-user-token
 * 
 * 返回：
 * - 用户当前积分
 * - 互动积分进度（点赞/收藏/关注/评论/分享）
 * - 可领取的成就列表
 * - 进行中的成就列表
 * - 签到状态
 * - 智能提示（最接近完成的任务）
 */
app.get('/api/user/credits-progress', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    const today = getPeriodStart('daily');
    const weekStart = getPeriodStart('weekly');
    const monthStart = getPeriodStart('monthly');
    
    // 1. 获取用户当前积分
    const userCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    const credits = userCredits?.credits || 0;
    
    // 2. 获取签到状态
    const todayCheckin = db.prepare(
      'SELECT * FROM user_checkins WHERE user_token = ? AND checkin_date = ?'
    ).get(userToken, today);
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
    const yesterdayCheckin = db.prepare(
      'SELECT streak_days FROM user_checkins WHERE user_token = ? AND checkin_date = ?'
    ).get(userToken, yesterdayStr);
    
    const checkin = {
      checked_in_today: !!todayCheckin,
      streak_days: todayCheckin?.streak_days || (yesterdayCheckin?.streak_days || 0),
      reward: 1,
      can_claim: !todayCheckin
    };
    
    // 3. 获取互动积分进度（含创作类激励）
    const actionTypes = [
      { type: 'like', name: '点赞', icon: '❤️', target: 10, reward: 1 },
      { type: 'favorite', name: '收藏', icon: '⭐', target: 5, reward: 1 },
      { type: 'follow', name: '关注', icon: '👥', target: 5, reward: 1 },
      { type: 'comment', name: '评论', icon: '💬', target: 2, reward: 1 },
      { type: 'share', name: '分享', icon: '🔗', target: 2, reward: 1 },
      // 创作类激励（每日重置）
      { type: 'generate', name: '创作游戏', icon: '🎮', target: 1, reward: 2 },
      { type: 'edit', name: '编辑游戏', icon: '✏️', target: 2, reward: 1 }
    ];
    
    const actionProgress = actionTypes.map(action => {
      const stat = db.prepare(`
        SELECT action_count, claimed_count FROM user_action_stats 
        WHERE user_token = ? AND action_type = ? AND period_type = 'daily' AND period_start = ?
      `).get(userToken, action.type, today);
      
      const count = stat?.action_count || 0;
      const claimed = stat?.claimed_count || 0;
      const completedSets = Math.floor(count / action.target);
      const canClaimCount = Math.max(0, completedSets - claimed);
      const currentProgress = count % action.target;
      const progressPercent = Math.round((currentProgress / action.target) * 100);
      
      return {
        type: action.type,
        name: action.name,
        icon: action.icon,
        current: currentProgress,
        target: action.target,
        total_count: count,
        progress: progressPercent,
        can_claim_count: canClaimCount,
        can_claim_credits: canClaimCount * action.reward,
        reward: action.reward,
        remaining: action.target - currentProgress
      };
    });
    
    // 4. 获取成就列表
    const achievements = db.prepare('SELECT * FROM achievements WHERE is_active = 1 ORDER BY category, sort_order').all();
    
    const claimableAchievements = [];
    const inProgressAchievements = [];
    
    for (const achievement of achievements) {
      const periodStart = achievement.category === 'permanent' ? '' : getPeriodStart(
        achievement.category === 'daily' ? 'daily' : 
        achievement.category === 'weekly' ? 'weekly' : 'monthly'
      );
      
      const progress = calculateAchievementProgress(userToken, achievement);
      
      // 检查是否已领取
      const userAchievement = db.prepare(`
        SELECT is_claimed FROM user_achievements 
        WHERE user_token = ? AND achievement_id = ? 
        AND (period_start = ? OR period_start IS NULL OR period_start = '')
        ORDER BY created_at DESC LIMIT 1
      `).get(userToken, achievement.id, periodStart);
      
      const isClaimed = userAchievement?.is_claimed === 1;
      
      const achievementData = {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        current: progress.current,
        target: progress.target,
        progress: progress.progress,
        reward: achievement.reward_credits,
        is_completed: progress.is_completed,
        is_claimed: isClaimed
      };
      
      if (progress.is_completed && !isClaimed) {
        claimableAchievements.push(achievementData);
      } else if (!progress.is_completed) {
        inProgressAchievements.push(achievementData);
      }
    }
    
    // 5. 获取广告观看进度
    const adEnabled = getConfig('credits_ad_enabled', 'false') === 'true';
    let adProgress = null;
    if (adEnabled) {
      const userAdData = db.prepare('SELECT ad_count_today, last_ad_date FROM user_credits WHERE user_token = ?').get(userToken);
      const todayStr = new Date().toISOString().split('T')[0];
      let adTodayCount = userAdData?.ad_count_today || 0;
      if (userAdData?.last_ad_date !== todayStr) {
        adTodayCount = 0;
      }
      const adDailyLimit = parseInt(getConfig('credits_ad_daily_limit', '30')) || 30;
      const adReward = parseFloat(getConfig('credits_ad_reward', '3')) || 3;
      adProgress = {
        enabled: true,
        todayCount: adTodayCount,
        dailyLimit: adDailyLimit,
        reward: adReward,
        remainingToday: Math.max(0, adDailyLimit - adTodayCount),
        progress: Math.round((adTodayCount / adDailyLimit) * 100)
      };
    }
    
    // 6. 计算可领取总积分
    const actionClaimableCredits = actionProgress.reduce((sum, a) => sum + a.can_claim_credits, 0);
    const achievementClaimableCredits = claimableAchievements.reduce((sum, a) => sum + a.reward, 0);
    const checkinClaimableCredits = checkin.can_claim ? 1 : 0;
    const totalClaimableCredits = actionClaimableCredits + achievementClaimableCredits + checkinClaimableCredits;
    
    // 7. 生成智能提示（找到最接近完成的任务）
    const tips = [];
    
    // 找最接近完成的互动积分
    const closestAction = actionProgress
      .filter(a => a.remaining > 0 && a.remaining <= 5)
      .sort((a, b) => a.remaining - b.remaining)[0];
    
    if (closestAction) {
      tips.push(`再${closestAction.name}${closestAction.remaining}次即可领取${closestAction.reward}积分`);
    }
    
    // 找最接近完成的成就
    const closestAchievement = inProgressAchievements
      .filter(a => a.progress >= 50)
      .sort((a, b) => b.progress - a.progress)[0];
    
    if (closestAchievement) {
      const remaining = closestAchievement.target - closestAchievement.current;
      tips.push(`${closestAchievement.name}还差${remaining}即可领取${closestAchievement.reward}积分`);
    }
    
    // 签到提示
    if (!todayCheckin) {
      tips.push('今日未签到，去小程序签到可得1积分');
    }
    
    res.json({
      success: true,
      data: {
        credits,
        checkin,
        action_progress: actionProgress,
        claimable_achievements: claimableAchievements,
        in_progress_achievements: inProgressAchievements,
        ad_progress: adProgress,
        summary: {
          action_claimable: actionClaimableCredits,
          achievement_claimable: achievementClaimableCredits,
          checkin_claimable: checkinClaimableCredits,
          total_claimable: totalClaimableCredits,
          claimable_count: claimableAchievements.length + actionProgress.filter(a => a.can_claim_count > 0).length + (checkin.can_claim ? 1 : 0)
        },
        tips: tips.slice(0, 3) // 最多返回3条提示
      }
    });
  } catch (error) {
    console.error('[积分进度] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 网站账号激活 API ====================

/**
 * 生成激活Token（小程序调用）
 * POST /api/user/generate-activate-token
 * Headers: x-user-token
 * Body: { type: 'activate' | 'reset' }
 * Response: { success, activateUrl, expiresAt }
 */
app.post('/api/user/generate-activate-token', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    
    // 获取用户信息
    const user = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    const type = req.body.type || 'activate';
    
    // 如果是激活类型，检查是否已经激活
    if (type === 'activate' && user.web_activated === 1) {
      return res.status(400).json({ success: false, error: '账号已激活，如需重置密码请选择密码重置' });
    }
    
    // 生成随机Token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    // 计算过期时间
    const expireMinutes = parseInt(getConfig('activate_token_expire_minutes')) || 10;
    const expiresAt = new Date(Date.now() + expireMinutes * 60 * 1000);
    
    // 删除该用户之前的同类型Token（确保只有一个有效）
    db.prepare('DELETE FROM web_activate_tokens WHERE user_token = ? AND type = ?').run(userToken, type);
    
    // 存储新Token
    db.prepare(`
      INSERT INTO web_activate_tokens (token, user_token, type, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, userToken, type, expiresAt.toISOString());
    
    // 生成完整URL
    const siteUrl = getConfig('site_url') || '';
    
    // 检查是否配置了网站域名
    if (!siteUrl) {
      // 删除刚创建的Token
      db.prepare('DELETE FROM web_activate_tokens WHERE token = ?').run(token);
      return res.status(400).json({ 
        success: false, 
        error: '网站域名未配置，请联系管理员在后台设置 site_url' 
      });
    }
    
    const activateUrl = `${siteUrl}/activate.html?token=${token}`;
    
    res.json({
      success: true,
      activateUrl,
      token,
      type,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: expireMinutes
    });
    
    console.log(`[激活Token] 用户 ${user.account_id} 生成${type === 'reset' ? '重置' : '激活'}Token，${expireMinutes}分钟后过期`);
  } catch (error) {
    console.error('[激活Token] 生成失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 验证激活Token（网站调用）
 * GET /api/user/verify-activate-token?token=xxx
 * Response: { success, user: { accountId, nickname }, type }
 */
app.get('/api/user/verify-activate-token', (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, error: '缺少Token参数' });
    }
    
    // 查找Token
    const tokenRecord = db.prepare(`
      SELECT * FROM web_activate_tokens WHERE token = ? AND used = 0
    `).get(token);
    
    if (!tokenRecord) {
      return res.status(404).json({ success: false, error: '无效的激活链接' });
    }
    
    // 检查是否过期
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: '激活链接已过期，请重新生成' });
    }
    
    // 获取用户信息
    const user = db.prepare('SELECT account_id, nickname FROM user_accounts WHERE user_token = ?').get(tokenRecord.user_token);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    res.json({
      success: true,
      user: {
        accountId: user.account_id,
        nickname: user.nickname
      },
      type: tokenRecord.type
    });
  } catch (error) {
    console.error('[激活Token] 验证失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 设置/重置密码（网站调用）
 * POST /api/user/set-password
 * Body: { token, password }
 * Response: { success, jwt }
 */
app.post('/api/user/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: '密码长度至少6位' });
    }
    
    // 查找并验证Token
    const tokenRecord = db.prepare(`
      SELECT * FROM web_activate_tokens WHERE token = ? AND used = 0
    `).get(token);
    
    if (!tokenRecord) {
      return res.status(404).json({ success: false, error: '无效的激活链接' });
    }
    
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: '激活链接已过期' });
    }
    
    // 加密密码
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);
    
    // 更新用户密码
    db.prepare(`
      UPDATE user_accounts 
      SET password_hash = ?, has_password = 1, web_activated = 1, activated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_token = ?
    `).run(passwordHash, tokenRecord.user_token);
    
    // 标记Token已使用
    db.prepare('UPDATE web_activate_tokens SET used = 1 WHERE id = ?').run(tokenRecord.id);
    
    // 获取用户信息用于生成JWT
    const user = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(tokenRecord.user_token);
    
    // 生成JWT
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'youxijia-web-secret-2026';
    const jwtToken = jwt.sign(
      { 
        userToken: user.user_token, 
        accountId: user.account_id,
        nickname: user.nickname 
      },
      jwtSecret,
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      message: tokenRecord.type === 'reset' ? '密码重置成功' : '账号激活成功',
      jwt: jwtToken,
      user: {
        accountId: user.account_id,
        nickname: user.nickname,
        userToken: user.user_token
      }
    });
    
    console.log(`[激活] 用户 ${user.account_id} ${tokenRecord.type === 'reset' ? '重置密码' : '激活账号'}成功`);
  } catch (error) {
    console.error('[激活] 设置密码失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 网站登录（账号+密码）
 * POST /api/user/web-login
 * Body: { accountId, password }
 * Response: { success, jwt, user }
 */
app.post('/api/user/web-login', async (req, res) => {
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  
  // 记录登录日志的辅助函数
  const logLogin = (userToken, accountId, success, failReason = null) => {
    try {
      db.prepare(`
        INSERT INTO login_logs (user_token, account_id, login_type, ip_address, user_agent, success, fail_reason)
        VALUES (?, ?, 'web', ?, ?, ?, ?)
      `).run(userToken || '', accountId || '', clientIP, userAgent, success ? 1 : 0, failReason);
    } catch (e) {
      console.error('[登录日志] 记录失败:', e);
    }
  };
  
  try {
    const { accountId, account, password } = req.body;
    const loginId = accountId || account; // 兼容两种字段名
    
    if (!loginId || !password) {
      logLogin('', loginId, false, '缺少账号或密码');
      return res.status(400).json({ success: false, error: '请输入账号和密码' });
    }
    
    // 查找用户（支持账号ID或昵称登录）
    const user = db.prepare(`
      SELECT * FROM user_accounts WHERE account_id = ? OR nickname = ?
    `).get(loginId, loginId);
    
    if (!user) {
      logLogin('', loginId, false, '账号不存在');
      return res.status(401).json({ success: false, error: '账号不存在' });
    }
    
    if (!user.has_password || !user.password_hash) {
      logLogin(user.user_token, user.account_id, false, '未设置密码');
      return res.status(401).json({ success: false, error: '该账号未设置密码，请先在小程序中激活' });
    }
    
    // 验证密码
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      logLogin(user.user_token, user.account_id, false, '密码错误');
      return res.status(401).json({ success: false, error: '密码错误' });
    }
    
    // 生成JWT
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'youxijia-web-secret-2026';
    const jwtToken = jwt.sign(
      { 
        userToken: user.user_token, 
        accountId: user.account_id,
        nickname: user.nickname 
      },
      jwtSecret,
      { expiresIn: '30d' }
    );
    
    // 更新最后登录信息
    db.prepare(`
      UPDATE user_accounts SET last_ip = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(clientIP, user.id);
    
    // 记录成功登录日志
    logLogin(user.user_token, user.account_id, true);
    
    res.json({
      success: true,
      jwt: jwtToken,
      user: {
        accountId: user.account_id,
        nickname: user.nickname,
        userToken: user.user_token
      }
    });
    
    console.log(`[登录] 用户 ${user.account_id} 网站登录成功`);
  } catch (error) {
    console.error('[登录] 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 验证JWT（网站调用）
 * GET /api/user/verify-jwt
 * Headers: Authorization: Bearer xxx
 * Response: { success, user }
 */
app.get('/api/user/verify-jwt', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    
    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'youxijia-web-secret-2026';
    
    try {
      const decoded = jwt.verify(token, jwtSecret);
      
      // 获取最新用户信息
      const user = db.prepare('SELECT account_id, nickname, user_token FROM user_accounts WHERE user_token = ?').get(decoded.userToken);
      
      if (!user) {
        return res.status(401).json({ success: false, error: '用户不存在' });
      }
      
      res.json({
        success: true,
        user: {
          accountId: user.account_id,
          nickname: user.nickname,
          userToken: user.user_token
        }
      });
    } catch (jwtError) {
      return res.status(401).json({ success: false, error: 'Token无效或已过期' });
    }
  } catch (error) {
    console.error('[JWT验证] 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取登录统计（管理员用）
 * GET /api/admin/login-stats
 * Response: { success, stats }
 */
app.get('/api/admin/login-stats', (req, res) => {
  try {
    // 验证管理员权限（通过 admin-token 或 JWT 中的 is_admin）
    const adminToken = req.headers['x-admin-token'];
    const configuredAdminToken = process.env.ADMIN_TOKEN || 'your-admin-token';
    
    if (adminToken !== configuredAdminToken) {
      return res.status(403).json({ success: false, error: '无权限' });
    }
    
    // 今日登录次数
    const todayLogins = db.prepare(`
      SELECT COUNT(*) as count FROM login_logs 
      WHERE success = 1 AND date(created_at) = date('now', 'localtime')
    `).get().count;
    
    // 今日独立登录用户数
    const todayUniqueUsers = db.prepare(`
      SELECT COUNT(DISTINCT user_token) as count FROM login_logs 
      WHERE success = 1 AND date(created_at) = date('now', 'localtime') AND user_token != ''
    `).get().count;
    
    // 本周登录次数
    const weekLogins = db.prepare(`
      SELECT COUNT(*) as count FROM login_logs 
      WHERE success = 1 AND created_at >= datetime('now', '-7 days')
    `).get().count;
    
    // 本周独立用户数
    const weekUniqueUsers = db.prepare(`
      SELECT COUNT(DISTINCT user_token) as count FROM login_logs 
      WHERE success = 1 AND created_at >= datetime('now', '-7 days') AND user_token != ''
    `).get().count;
    
    // 总登录次数
    const totalLogins = db.prepare(`
      SELECT COUNT(*) as count FROM login_logs WHERE success = 1
    `).get().count;
    
    // 登录失败次数（最近24小时）
    const failedLogins24h = db.prepare(`
      SELECT COUNT(*) as count FROM login_logs 
      WHERE success = 0 AND created_at >= datetime('now', '-1 day')
    `).get().count;
    
    // 最近10条登录记录
    const recentLogins = db.prepare(`
      SELECT l.*, u.nickname 
      FROM login_logs l
      LEFT JOIN user_accounts u ON l.user_token = u.user_token
      ORDER BY l.created_at DESC
      LIMIT 10
    `).all();
    
    // 每日登录趋势（最近7天）
    const dailyTrend = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as count
      FROM login_logs
      WHERE success = 1 AND created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY date ASC
    `).all();
    
    res.json({
      success: true,
      stats: {
        today: { logins: todayLogins, uniqueUsers: todayUniqueUsers },
        week: { logins: weekLogins, uniqueUsers: weekUniqueUsers },
        total: { logins: totalLogins },
        failed24h: failedLogins24h,
        recentLogins: recentLogins.map(l => ({
          id: l.id,
          accountId: l.account_id,
          nickname: l.nickname,
          loginType: l.login_type,
          ip: l.ip_address,
          success: l.success === 1,
          failReason: l.fail_reason,
          createdAt: l.created_at
        })),
        dailyTrend
      }
    });
  } catch (error) {
    console.error('[登录统计] 获取失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取用户自己的登录历史
 * GET /api/user/login-history
 * Headers: Authorization: Bearer xxx
 * Response: { success, logs }
 */
app.get('/api/user/login-history', (req, res) => {
  try {
    // 验证JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    
    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'youxijia-web-secret-2026';
    
    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Token无效' });
    }
    
    // 获取用户最近20条登录记录
    const logs = db.prepare(`
      SELECT id, login_type, ip_address, success, fail_reason, created_at
      FROM login_logs
      WHERE user_token = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(decoded.userToken);
    
    res.json({
      success: true,
      logs: logs.map(l => ({
        id: l.id,
        loginType: l.login_type,
        ip: l.ip_address,
        success: l.success === 1,
        failReason: l.fail_reason,
        createdAt: l.created_at
      }))
    });
  } catch (error) {
    console.error('[登录历史] 获取失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取用户网站激活状态
 * GET /api/user/web-status
 * Headers: x-user-token
 * Response: { success, activated, activatedAt }
 */
app.get('/api/user/web-status', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    
    const user = db.prepare('SELECT web_activated, activated_at, account_id, nickname FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    res.json({
      success: true,
      activated: user.web_activated === 1,
      activatedAt: user.activated_at,
      accountId: user.account_id,
      nickname: user.nickname
    });
  } catch (error) {
    console.error('[网站状态] 查询失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 订阅通知管理 API ====================

/**
 * 获取用户订阅通知次数
 * GET /api/user/subscribe-count
 * Headers: x-user-token
 */
app.get('/api/user/subscribe-count', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    
    const user = db.prepare('SELECT subscribe_count FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    res.json({
      success: true,
      subscribeCount: user.subscribe_count || 0
    });
  } catch (error) {
    console.error('[订阅次数] 查询失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 订阅创作中任务的完成通知
 * POST /api/task/:taskId/subscribe
 * Headers: x-user-token
 * 
 * 限制：
 * - 只能订阅创作中（pending/processing）的任务
 * - 每个任务只能订阅一次
 * - 订阅成功奖励积分（从后台配置读取 credits_subscribe_task）
 */
app.post('/api/task/:taskId/subscribe', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ success: false, error: '缺少任务ID' });
    }
    
    // 在多个任务队列中查找任务（创建、编辑、修复）
    let task = null;
    let taskType = null;
    
    // 1. 创建任务队列
    task = asyncGenerateTasks.get(taskId);
    if (task) {
      taskType = 'create';
    }
    
    // 2. 编辑任务队列
    if (!task && typeof asyncEditTasks !== 'undefined') {
      task = asyncEditTasks.get(taskId);
      if (task) {
        taskType = 'edit';
      }
    }
    
    // 3. 修复任务队列（修复任务以 gameId 为键，需要遍历查找）
    if (!task && typeof repairTaskQueue !== 'undefined') {
      for (const [gameId, repairTask] of repairTaskQueue.entries()) {
        if (repairTask.taskId === taskId) {
          task = repairTask;
          taskType = 'repair';
          break;
        }
      }
    }
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在或已完成' });
    }
    
    // 验证任务所有者
    if (task.userToken !== userToken) {
      return res.status(403).json({ success: false, error: '无权操作此任务' });
    }
    
    // 检查任务状态（只能订阅进行中的任务）
    const validStatuses = ['pending', 'processing', 'running'];
    if (!validStatuses.includes(task.status)) {
      return res.json({
        success: false,
        error: '任务已完成，无法订阅',
        taskStatus: task.status
      });
    }
    
    // 检查是否已订阅
    if (task.subscribeNotify) {
      return res.json({
        success: false,
        error: '已订阅此任务',
        alreadySubscribed: true
      });
    }
    
    // 获取用户的微信 openId
    const user = db.prepare('SELECT id, wechat_openid FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    if (!user.wechat_openid) {
      return res.json({
        success: false,
        error: '请先在小程序中登录以获取通知权限',
        needWechatLogin: true
      });
    }
    
    // 更新任务的订阅状态
    task.subscribeNotify = true;
    task.wechatOpenId = user.wechat_openid;
    
    // 从后台配置读取订阅奖励积分
    let creditsReward = 0.5; // 默认值
    try {
      const config = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('credits_subscribe_task');
      if (config && config.value) {
        creditsReward = parseFloat(config.value) || 0.5;
      }
    } catch (e) {
      console.log('[任务订阅] 读取积分配置失败，使用默认值:', e.message);
    }
    
    // 奖励积分
    if (creditsReward > 0) {
      db.prepare('UPDATE user_accounts SET credits = COALESCE(credits, 0) + ? WHERE user_token = ?').run(creditsReward, userToken);
      
      // 记录积分日志
      try {
        db.prepare(`
          INSERT INTO credits_logs (user_token, amount, type, description, created_at)
          VALUES (?, ?, 'subscribe_task', '订阅任务完成通知', datetime('now'))
        `).run(userToken, creditsReward);
      } catch (e) {
        // 积分日志表可能不存在，忽略
      }
    }
    
    // 更新订阅次数（用于统计）
    try {
      db.prepare('UPDATE user_accounts SET subscribe_count = COALESCE(subscribe_count, 0) + 1 WHERE user_token = ?').run(userToken);
    } catch (e) {}
    
    console.log(`[任务订阅] 用户 ${userToken.substring(0, 8)}... 订阅任务 ${taskId}，奖励 ${creditsReward} 积分`);
    
    res.json({
      success: true,
      taskId,
      creditsReward,
      message: creditsReward > 0 ? `订阅成功！+${creditsReward}积分` : '订阅成功！'
    });
  } catch (error) {
    console.error('[任务订阅] 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 保留旧接口兼容性（已废弃，返回提示）
 * POST /api/user/subscribe-add
 * @deprecated 请使用 POST /api/task/:taskId/subscribe
 */
app.post('/api/user/subscribe-add', (req, res) => {
  res.json({
    success: false,
    error: '此接口已废弃，请在创作中的任务上点击订阅',
    deprecated: true
  });
});

/**
 * 内部函数：消耗订阅次数（供异步任务调用）
 * @param {string} userToken - 用户token
 * @param {number} count - 消耗数量，默认1
 * @returns {{ success: boolean, message?: string, remainingCount?: number }}
 */
function consumeSubscribeCount(userToken, count = 1) {
  try {
    if (!userToken) {
      return { success: false, message: '用户token无效' };
    }
    
    const user = db.prepare('SELECT id, subscribe_count, wechat_openid FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!user) {
      return { success: false, message: '用户不存在' };
    }
    
    const currentCount = user.subscribe_count || 0;
    
    // 检查次数是否足够
    if (currentCount < count) {
      return { 
        success: false, 
        message: `订阅次数不足（当前${currentCount}次，需要${count}次）`,
        remainingCount: currentCount 
      };
    }
    
    // 扣减次数
    const newCount = currentCount - count;
    db.prepare('UPDATE user_accounts SET subscribe_count = ? WHERE user_token = ?').run(newCount, userToken);
    
    console.log(`[订阅次数-内部] 用户 ${userToken.substring(0, 8)}... 消耗 ${count} 次，剩余 ${newCount} 次`);
    
    return { 
      success: true, 
      remainingCount: newCount,
      openId: user.wechat_openid 
    };
  } catch (error) {
    console.error('[订阅次数-内部] 消耗失败:', error);
    return { success: false, message: error.message };
  }
}

/**
 * 消耗订阅通知次数（发送通知时API调用）
 * POST /api/user/subscribe-consume
 * Headers: x-user-token 或 x-author-token
 * Body: { count: 1 } - 消耗的次数，默认1
 * 
 * 返回是否成功消耗（次数不足返回 false）
 */
app.post('/api/user/subscribe-consume', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'] || req.headers['x-author-token'];
    if (!userToken) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    
    const count = Math.max(1, parseInt(req.body.count) || 1);
    
    const user = db.prepare('SELECT id, subscribe_count, wechat_openid FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    const currentCount = user.subscribe_count || 0;
    
    // 检查次数是否足够
    if (currentCount < count) {
      return res.json({
        success: false,
        error: '订阅次数不足',
        subscribeCount: currentCount,
        hasOpenId: !!user.wechat_openid
      });
    }
    
    // 扣减次数
    const newCount = currentCount - count;
    db.prepare('UPDATE user_accounts SET subscribe_count = ? WHERE user_token = ?').run(newCount, userToken);
    
    console.log(`[订阅次数] 用户 ${userToken.substring(0, 8)}... 消耗 ${count} 次订阅，剩余 ${newCount} 次`);
    
    res.json({
      success: true,
      subscribeCount: newCount,
      consumed: count,
      openId: user.wechat_openid // 返回 openId 供发送通知使用
    });
  } catch (error) {
    console.error('[订阅次数] 消耗失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取用户正在创作中的任务列表
 * GET /api/user/creating-tasks
 * Headers: x-user-token
 * 
 * 返回用户当前正在进行的创建/编辑/修复任务
 */
app.get('/api/user/creating-tasks', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    if (!userToken) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    
    const tasks = [];
    
    // 1. 从异步生成任务队列中查找用户的任务
    for (const [taskId, task] of asyncGenerateTasks.entries()) {
      if (task.userToken === userToken && (task.status === 'pending' || task.status === 'processing')) {
        tasks.push({
          taskId,
          type: 'create',
          typeName: '创建游戏',
          status: task.status,
          progress: task.progress || 0,
          progressText: task.progressText || '处理中...',
          prompt: task.prompt || '',
          createdAt: task.createdAt,
          // 是否已订阅通知
          subscribed: task.subscribeNotify || false,
          // 草稿ID（用于小程序匹配草稿游戏）
          gameId: task.draftId || null
        });
      }
    }
    
    // 2. 从修复任务队列中查找用户的任务
    for (const [gameId, task] of repairTaskQueue.entries()) {
      if (task.userToken === userToken && task.status === 'running') {
        // 获取游戏标题
        let gameTitle = '未知游戏';
        try {
          const game = db.prepare('SELECT title FROM games WHERE id = ?').get(gameId);
          if (game) gameTitle = game.title;
        } catch (e) {}
        
        tasks.push({
          taskId: task.taskId,
          gameId,
          type: 'repair',
          typeName: '修复游戏',
          status: 'processing',
          progress: 50, // 修复任务没有精确进度
          progressText: '正在修复...',
          gameTitle,
          createdAt: task.startTime,
          subscribed: task.subscribeNotify || false
        });
      }
    }
    
    // 3. 从编辑任务队列中查找用户的任务
    if (typeof asyncEditTasks !== 'undefined') {
      for (const [taskId, task] of asyncEditTasks.entries()) {
        if (task.userToken === userToken && (task.status === 'pending' || task.status === 'processing')) {
          let gameTitle = '未知游戏';
          try {
            const game = db.prepare('SELECT title FROM games WHERE id = ?').get(task.gameId);
            if (game) gameTitle = game.title;
          } catch (e) {}
          
          tasks.push({
            taskId: taskId,
            gameId: task.gameId,
            type: 'edit',
            typeName: '编辑游戏',
            status: task.status,
            progress: task.progress || 50,
            progressText: task.progressText || '正在编辑...',
            gameTitle,
            createdAt: task.createdAt,
            subscribed: task.subscribeNotify || false
          });
        }
      }
    }
    
    // 按创建时间倒序排列
    tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    res.json({
      success: true,
      tasks,
      count: tasks.length
    });
  } catch (error) {
    console.error('[创作中任务] 查询失败:', error);
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
    
    // 验证游戏存在（同时获取author_token用于判断是否自己的作品）
    const game = db.prepare('SELECT id, author_token FROM games WHERE id = ?').get(gameId);
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
    
    // 尝试发放积分（不能是自己的作品）
    let creditResult = null;
    if (game.author_token !== userToken) {
      creditResult = tryAwardActionCredits(userToken, 'comment', {
        gameId: gameId,
        commentContent: trimmedContent
      });
    }
    
    res.json({
      success: true,
      comment: {
        id: result.lastInsertRowid,
        author_name: authorName,
        content: trimmedContent,
        created_at: new Date().toISOString(),
        is_mine: true
      },
      creditAwarded: creditResult?.awarded || false,
      creditMessage: creditResult?.message || null
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

// ============ 异步生成游戏 API（解决Cloudflare 524超时问题） ============

// 异步生成游戏 - 立即返回 taskId，后台处理
app.post('/api/generate-async', async (req, res) => {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const userToken = req.headers['x-user-token'] || null;
  
  console.log(`[AsyncTask] 创建异步任务: ${taskId}`);
  
  // 检查创作封禁状态
  const banStatus = checkBanStatus(req, BAN_TYPES.CREATE);
  if (banStatus.banned) {
    console.log('[BLOCKED] 被禁止创作用户尝试异步生成游戏:', banStatus);
    return res.status(403).json({ 
      success: false, 
      error: `您已被禁止创作游戏。原因：${banStatus.reason}`,
      banned: true
    });
  }
  
  const { prompt, subscribeNotify } = req.body;
  if (!prompt || prompt.trim().length === 0) {
    return res.status(400).json({ success: false, error: '请输入游戏描述' });
  }
  
  // 获取用户的微信 openId（用于发送订阅消息通知）
  let wechatOpenId = null;
  if (userToken && subscribeNotify) {
    try {
      const userAccount = db.prepare('SELECT wechat_openid FROM user_accounts WHERE user_token = ?').get(userToken);
      if (userAccount && userAccount.wechat_openid) {
        wechatOpenId = userAccount.wechat_openid;
        console.log(`[AsyncTask] 用户已订阅通知, openId: ${wechatOpenId.substring(0, 8)}...`);
      }
    } catch (err) {
      console.error('[AsyncTask] 获取用户 openId 失败:', err);
    }
  }
  
  // 创建任务记录
  asyncGenerateTasks.set(taskId, {
    status: 'pending', // pending, processing, completed, failed
    progress: 0,
    progressText: '任务已创建，等待处理...',
    result: null,
    error: null,
    createdAt: Date.now(),
    userToken,
    prompt: prompt.trim(), // 保存prompt用于显示任务信息
    // 订阅消息相关
    subscribeNotify: !!subscribeNotify,
    wechatOpenId: wechatOpenId
  });
  
  // 立即返回 taskId
  res.json({ success: true, taskId });
  
  // 后台异步处理生成
  (async () => {
    try {
      // 更新状态为处理中
      const task = asyncGenerateTasks.get(taskId);
      if (!task) return;
      task.status = 'processing';
      task.progress = 10;
      task.progressText = '正在连接AI...';
      
      // 调用现有的生成逻辑（模拟 internal request）
      const generateResult = await handleGenerateInternal(req.body, req.headers, (progress, text) => {
        // 进度回调
        const t = asyncGenerateTasks.get(taskId);
        if (t) {
          t.progress = progress;
          t.progressText = text;
        }
      });
      
      // 更新任务结果
      const finalTask = asyncGenerateTasks.get(taskId);
      if (finalTask) {
        if (generateResult.success) {
          finalTask.status = 'completed';
          finalTask.progress = 100;
          finalTask.progressText = '生成完成！';
          finalTask.result = generateResult;
          
          // ===== 发送订阅消息通知（基于任务订阅状态） =====
          // 只有用户明确订阅了此任务才发送通知
          if (finalTask.subscribeNotify && finalTask.userToken && generateResult.game) {
            try {
              // 获取用户的微信 openId（优先使用任务上保存的，否则从数据库获取）
              let wechatOpenId = finalTask.wechatOpenId;
              if (!wechatOpenId) {
                try {
                  const userAccount = db.prepare('SELECT wechat_openid FROM user_accounts WHERE user_token = ?').get(finalTask.userToken);
                  if (userAccount && userAccount.wechat_openid) {
                    wechatOpenId = userAccount.wechat_openid;
                  }
                } catch (e) {
                  console.log(`[AsyncTask] 获取用户 openId 失败:`, e.message);
                }
              }
              
              if (!wechatOpenId) {
                console.log(`[AsyncTask] 用户没有绑定微信，跳过通知`);
              } else {
                // 直接发送通知（已在订阅时验证过用户授权）
                console.log(`[AsyncTask] 用户已订阅此任务，准备发送通知, openId: ${wechatOpenId.substring(0, 8)}...`);
                await wechatUtils.sendGameCreatedNotification({
                  openId: wechatOpenId,
                  gameName: generateResult.game.title || '您的游戏',
                  gameId: generateResult.game.id,
                  status: '已完成'
                });
                console.log(`[AsyncTask] 订阅消息通知发送成功`);
              }
            } catch (notifyErr) {
              // 通知发送失败不影响任务结果
              console.error(`[AsyncTask] 发送订阅消息通知失败:`, notifyErr.message);
            }
          } else if (!finalTask.subscribeNotify) {
            console.log(`[AsyncTask] 用户未订阅此任务，跳过通知`);
          }
        } else {
          finalTask.status = 'failed';
          finalTask.error = generateResult.error || '生成失败';
        }
      }
      
      console.log(`[AsyncTask] 任务完成: ${taskId}, 状态: ${finalTask?.status}`);
    } catch (error) {
      console.error(`[AsyncTask] 任务失败: ${taskId}`, error);
      const task = asyncGenerateTasks.get(taskId);
      if (task) {
        task.status = 'failed';
        task.error = error.message || '生成失败';
      }
    }
  })();
});

// 查询异步生成任务状态
app.get('/api/generate-status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = asyncGenerateTasks.get(taskId);
  
  if (!task) {
    return res.status(404).json({ 
      success: false, 
      error: '任务不存在或已过期',
      status: 'not_found'
    });
  }
  
  const response = {
    success: true,
    taskId,
    status: task.status,
    progress: task.progress,
    progressText: task.progressText
  };
  
  // 如果任务完成，返回结果
  if (task.status === 'completed' && task.result) {
    response.result = task.result;
    // 任务完成后30秒删除，避免重复查询
    setTimeout(() => {
      asyncGenerateTasks.delete(taskId);
    }, 30000);
  }
  
  // 如果任务失败，返回错误
  if (task.status === 'failed') {
    response.error = task.error;
    // 失败任务30秒后删除
    setTimeout(() => {
      asyncGenerateTasks.delete(taskId);
    }, 30000);
  }
  
  res.json(response);
});

// 内部生成处理函数（供异步任务调用）
// 复用原有的 /api/generate 中的完整逻辑
async function handleGenerateInternal(body, headers, progressCallback) {
  const startTime = Date.now();
  const { prompt, llmConfig, draftId, advancedSettings, turboModel, isTurboSwitch, requestId } = body;
  const userToken = headers['x-user-token'] || null;
  const authorToken = headers['x-author-token'] || null;
  
  console.log('[AsyncGenerate] 开始内部生成:', { prompt: prompt?.substring(0, 50), userToken: userToken?.substring(0, 8) });
  
  progressCallback && progressCallback(15, '正在分析需求...');
  
  try {
    // 检查LLM功能是否启用
    const llmEnabled = getConfig('llm_enabled', 'true') === 'true';
    if (!llmEnabled) {
      return { success: false, error: '游戏生成功能暂时不可用，请稍后再试' };
    }

    progressCallback && progressCallback(20, '正在配置AI模型...');

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
    
    // 不再支持用户自定义API Key，完全使用后台配置
    
    // ========== 模型选择逻辑 ==========
    let finalModel, finalProvider, finalBaseUrl;
    let selectedModelId = null;
    
    // 检查前端传来的 modelId
    const requestedModelId = llmConfig?.provider || null;
    
    // 优先从后端 LLM_MODELS 中获取配置
    if (requestedModelId && LLM_MODELS[requestedModelId]) {
      const modelConfig = LLM_MODELS[requestedModelId];
      finalModel = modelConfig.model;
      finalProvider = modelConfig.provider;
      finalBaseUrl = modelConfig.baseUrl;
      selectedModelId = requestedModelId;
      console.log(`[AsyncGenerate] 使用后端配置的模型: ${modelConfig.name}`);
    } else {
      // 使用后台配置的默认模型
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
          // 回退：使用 deepseek-v3
          const fallbackConfig = LLM_MODELS['deepseek-v3'];
          if (fallbackConfig) {
            finalModel = fallbackConfig.model;
            finalProvider = fallbackConfig.provider;
            finalBaseUrl = fallbackConfig.baseUrl;
            selectedModelId = 'deepseek-v3';
          } else {
            finalModel = 'deepseek-chat';
            finalProvider = 'deepseek';
            finalBaseUrl = 'https://api.deepseek.com';
          }
        }
      }
      console.log(`[AsyncGenerate] 使用默认模型: ${selectedModelId || finalModel}`);
    }

    // ========== API Key 获取逻辑 ==========
    // 获取模型特定的API Key配置
    const getModelApiKey = (modelId) => {
      if (!modelId) return null;
      const apiKeyKey = `llm_apikey_${modelId}`;
      const configuredKey = getConfig(apiKeyKey, null);
      if (configuredKey && configuredKey.length > 0) {
        return configuredKey;
      }
      return null;
    };
    
    // API Key优先级：模型专属Key > 默认Key > 环境变量（不再支持用户Key）
    let finalApiKey = null;
    let keySource = '';
    
    const modelSpecificKey = getModelApiKey(selectedModelId);
    if (modelSpecificKey) {
      finalApiKey = modelSpecificKey;
      keySource = 'model_specific';
      console.log(`[AsyncGenerate] 使用模型 ${selectedModelId} 的专属API Key`);
    } else if (defaultApiKey) {
      finalApiKey = defaultApiKey;
      keySource = 'default';
      console.log('[AsyncGenerate] 使用后台默认API Key');
    } else if (process.env.DEEPSEEK_API_KEY) {
      finalApiKey = process.env.DEEPSEEK_API_KEY;
      keySource = 'env';
      console.log('[AsyncGenerate] 使用环境变量API Key');
    }
    
    // 调试信息
    const keyPreview = finalApiKey ? 
      `${finalApiKey.substring(0, 8)}...${finalApiKey.substring(finalApiKey.length - 4)}` : 
      '未设置';
    console.log('[AsyncGenerate] LLM配置:', { 
      provider: finalProvider, 
      baseUrl: finalBaseUrl, 
      model: finalModel,
      apiKeyPreview: keyPreview,
      keySource: keySource
    });
    
    if (!finalApiKey) {
      return { success: false, error: '该模型暂不可用，请联系管理员配置API Key' };
    }

    progressCallback && progressCallback(30, 'AI正在构思游戏...');

    // 获取系统提示词
    let systemPrompt = getConfig('llm_system_prompt', '');
    if (!systemPrompt) {
      systemPrompt = `你是一个专业的HTML5游戏开发专家。用户会给你一个游戏创意描述，你需要生成一个完整的、可以直接运行的HTML5单文件游戏。

要求：
1. 生成的代码必须是完整的HTML文件，包含所有必需的HTML、CSS和JavaScript
2. 游戏必须可以在现代浏览器中直接运行，不依赖任何外部文件
3. 使用Canvas或DOM进行渲染
4. 添加适当的触摸和键盘控制支持
5. 游戏界面要美观、有良好的用户体验
6. 代码要简洁高效
7. 只输出HTML代码，不要有任何解释或markdown标记`;
    }

    progressCallback && progressCallback(40, '正在编写游戏代码...');

    // 获取模型的 maxTokens 配置（基于后台配置动态获取）
    const modelMaxTokens = selectedModelId ? getModelMaxTokens(selectedModelId) : 8192;
    // 获取模型的 temperature 配置（某些模型有特殊要求）
    const modelTemperature = selectedModelId ? getModelTemperature(selectedModelId, 0.7) : 0.7;
    console.log(`[AsyncGenerate] 使用模型: ${finalModel}, Provider: ${finalProvider}, MaxTokens: ${modelMaxTokens}, Temperature: ${modelTemperature}`);

    // 调用 LLM API
    // 智谱AI使用 /v4/chat/completions 端点
    const apiPath = finalProvider === 'zhipu' ? '/v4/chat/completions' : '/v1/chat/completions';
    const response = await fetch(`${finalBaseUrl}${apiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalApiKey}`
      },
      body: JSON.stringify({
        model: finalModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请根据以下描述生成一个HTML5游戏：\n\n${prompt}` }
        ],
        max_tokens: modelMaxTokens,
        temperature: modelTemperature
      })
    });

    progressCallback && progressCallback(70, '正在优化游戏逻辑...');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AsyncGenerate] LLM API 错误:', response.status, errorText);
      return { success: false, error: `AI服务错误: ${response.status}` };
    }

    const llmResult = await response.json();
    let code = llmResult.choices?.[0]?.message?.content || '';
    
    // 清理代码（移除markdown标记）
    code = code.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
    
    if (!code || code.length < 100) {
      return { success: false, error: 'AI生成的代码无效' };
    }

    progressCallback && progressCallback(85, '正在保存游戏...');

    // 提取标题
    const titleMatch = code.match(/<title>(.*?)<\/title>/i);
    let title = titleMatch ? titleMatch[1] : prompt.substring(0, 20);
    
    const authorName = advancedSettings?.authorName || '游戏家用户';
    
    // 获取可见性设置（从小程序传递的 advancedSettings 中读取）
    const gameVisibility = advancedSettings?.visibility || 'public';
    const gameOrientation = advancedSettings?.orientation || 'portrait';
    const isPublic = gameVisibility === 'public' ? 1 : 0;
    
    let gameId;
    
    // 如果有草稿ID，更新草稿为已发布状态
    if (draftId) {
      try {
        const draftGame = db.prepare('SELECT id, author_token FROM games WHERE id = ? AND status = ?').get(draftId, 'draft');
        if (draftGame) {
          // 验证作者权限
          const draftAuthorToken = draftGame.author_token;
          const currentToken = userToken || authorToken;
          if (draftAuthorToken === currentToken || !draftAuthorToken) {
            // 更新草稿为已发布
            db.prepare(`
              UPDATE games 
              SET title = ?, code = ?, status = 'published', llm_model = ?, visibility = ?, is_public = ?, orientation = ?, updated_at = datetime('now')
              WHERE id = ?
            `).run(title, code, finalModel, gameVisibility, isPublic, gameOrientation, draftId);
            
            gameId = draftId;
            console.log(`[AsyncGenerate] 草稿已发布: ${draftId}`);
          } else {
            console.log(`[AsyncGenerate] 草稿权限不匹配，创建新游戏`);
          }
        } else {
          console.log(`[AsyncGenerate] 草稿不存在或已发布: ${draftId}`);
        }
      } catch (draftError) {
        console.error('[AsyncGenerate] 更新草稿失败:', draftError.message);
      }
    }
    
    // 如果没有成功更新草稿，创建新游戏
    if (!gameId) {
      gameId = generateGameId();
      db.prepare(`
        INSERT INTO games (id, title, prompt, code, author_name, author_token, llm_model, status, visibility, is_public, orientation, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, datetime('now'))
      `).run(gameId, title, prompt, code, authorName, userToken || authorToken, finalModel, gameVisibility, isPublic, gameOrientation);
    }
    
    // 保存静态文件
    saveGameStaticFile(gameId, code, {
      title,
      authorName,
      authorToken: userToken || authorToken,
      prompt
    });
    
    progressCallback && progressCallback(95, '即将完成...');
    
    const totalTime = Date.now() - startTime;
    console.log(`[AsyncGenerate] 生成成功: ${gameId}, 耗时: ${totalTime}ms`);
    
    return {
      success: true,
      game: { id: gameId, title, prompt },
      code,
      title,
      debug: { totalTime, model: finalModel }
    };
    
  } catch (error) {
    console.error('[AsyncGenerate] 生成失败:', error);
    return { success: false, error: error.message || '生成失败' };
  }
}

// 生成游戏（调用LLM）- 原同步方式，保留兼容性
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
    
    // 如果有草稿ID且有用户token，创建一个临时任务到 asyncGenerateTasks
    // 这样小程序端可以通过 /api/user/creating-tasks 获取到这个任务并订阅通知
    const syncTaskId = draftId ? `sync_${draftId}` : null;
    if (syncTaskId && userToken) {
      asyncGenerateTasks.set(syncTaskId, {
        status: 'processing',
        progress: 10,
        progressText: '正在生成...',
        prompt: prompt,
        createdAt: Date.now(),
        userToken: userToken,
        draftId: draftId,
        subscribeNotify: false,
        wechatOpenId: null,
        isSyncTask: true  // 标记为同步任务创建的伪任务
      });
      console.log(`[SYNC] 创建同步任务追踪: ${syncTaskId}`);
    }
    
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
      
      // 小程序请求跳过积分扣除
      if (turboCreditCost > 0 && userToken && !isMiniProgramRequest(req)) {
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
      } else if (isMiniProgramRequest(req)) {
        console.log('[Credits] 小程序请求，跳过加速生成积分扣除');
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

    // 不再支持用户自定义API Key，完全使用后台配置
    
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
    
    // 确定API Key来源（不再支持用户自定义Key）
    let finalApiKey = null;
    let keySource = '';
    
    // API Key优先级（从高到低）：
    // 1. 该模型在后台配置的专属Key（llm_apikey_${modelId}）
    // 2. 后台配置的默认Key（llm_default_api_key）
    // 3. 环境变量中的Key（DEEPSEEK_API_KEY）
    
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
    // 注意：小程序请求跳过积分扣除
    let actualCreditCost = 0;
    const isFromMiniProgram = isMiniProgramRequest(req);
    if (!turboModelConfig && keySource !== 'user' && userToken && selectedModelId && !isFromMiniProgram) {
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
    } else if (isFromMiniProgram) {
      console.log('[INFO] 小程序请求，跳过积分扣除');
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
      
      // 游戏类型（2D/2.5D/3D）
      if (advancedSettings.gameType && advancedSettings.gameType !== 'auto') {
        const gameTypeMap = {
          '2d': '2D游戏: 使用Canvas 2D API或简单的CSS/DOM实现，纯平面视角',
          '2.5d': '2.5D游戏: 使用等距视角(Isometric)或伪3D效果，有纵深感但不是真3D',
          '3d': '3D游戏: 使用Three.js或WebGL实现真正的3D场景和视角'
        };
        hints.push(gameTypeMap[advancedSettings.gameType] || advancedSettings.gameType);
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
2. 开始界面：显示游戏标题、"开始游戏"按钮、简洁的操作说明（直接展示，不需要额外按钮）
3. 游戏进行中：必须隐藏所有遮罩层，只显示Canvas游戏画面。得分、生命值等HUD信息直接用Canvas绑制在画面上，不要用HTML覆盖层
4. 结束界面：游戏结束时才显示结果，可以用半透明遮罩层
5. 点击"开始游戏"后，必须立即隐藏开始界面的遮罩，让玩家看到游戏画面
6. 不要在游戏进行中显示任何全屏或半透明的HTML遮罩层

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
    
    // 获取模型的最大Token配置
    const maxTokens = selectedModelId ? getModelMaxTokens(selectedModelId) : 8000;
    // 获取模型的 temperature 配置（某些模型有特殊要求）
    const temperature = selectedModelId ? getModelTemperature(selectedModelId, 0.7) : 0.7;
    console.log(`[INFO] 使用最大Token数: ${maxTokens} (模型: ${selectedModelId || 'default'}), Temperature: ${temperature}`);
    
    // 智谱AI使用 /v4/chat/completions 端点
    const apiPath = config.provider === 'zhipu' ? '/v4/chat/completions' : '/v1/chat/completions';
    const response = await fetch(`${config.baseUrl}${apiPath}`, {
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
        temperature: temperature,
        max_tokens: maxTokens
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
    
    // 处理同步任务的订阅通知和清理
    // syncTaskId 已在前面定义
    if (syncTaskId && asyncGenerateTasks.has(syncTaskId)) {
      const syncTask = asyncGenerateTasks.get(syncTaskId);
      
      // 如果用户订阅了通知，发送微信消息
      if (syncTask.subscribeNotify && syncTask.wechatOpenId) {
        try {
          console.log(`[SYNC] 同步任务完成，发送订阅通知: ${syncTaskId}`);
          await wechatUtils.sendGameCreatedNotification({
            openId: syncTask.wechatOpenId,
            gameName: title || '您的游戏',
            gameId: draftId,
            status: '已完成'
          });
          console.log(`[SYNC] 订阅通知发送成功`);
        } catch (notifyErr) {
          console.error(`[SYNC] 发送订阅通知失败:`, notifyErr.message);
        }
      }
      
      // 更新任务状态为完成，稍后清理
      syncTask.status = 'completed';
      syncTask.progress = 100;
      syncTask.progressText = '生成完成！';
      
      // 延迟清理（保留5分钟让用户看到完成状态）
      setTimeout(() => {
        asyncGenerateTasks.delete(syncTaskId);
        console.log(`[SYNC] 已清理同步任务: ${syncTaskId}`);
      }, 5 * 60 * 1000);
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
    
    // 清理同步任务（从请求体获取 draftId）
    const failedDraftId = req.body?.draftId;
    const failedSyncTaskId = failedDraftId ? `sync_${failedDraftId}` : null;
    if (failedSyncTaskId && asyncGenerateTasks.has(failedSyncTaskId)) {
      const syncTask = asyncGenerateTasks.get(failedSyncTaskId);
      syncTask.status = 'failed';
      syncTask.error = error.message;
      // 延迟清理
      setTimeout(() => {
        asyncGenerateTasks.delete(failedSyncTaskId);
      }, 5 * 60 * 1000);
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
    
    // 检查游戏是否存在（同时获取author_token用于判断是否自己的作品）
    const game = db.prepare('SELECT id, like_count, author_token FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    let liked = true;
    let newLikeCount = game.like_count;
    let creditResult = null;
    
    if (userToken) {
      // 检查是否已点赞
      const existingLike = db.prepare('SELECT id FROM user_likes WHERE user_token = ? AND game_id = ?').get(userToken, gameId);
      
      if (existingLike) {
        // 取消点赞（不扣积分）
        db.prepare('DELETE FROM user_likes WHERE user_token = ? AND game_id = ?').run(userToken, gameId);
        db.prepare('UPDATE games SET like_count = MAX(0, like_count - 1) WHERE id = ?').run(gameId);
        liked = false;
        newLikeCount = Math.max(0, newLikeCount - 1);
      } else {
        // 添加点赞
        db.prepare('INSERT INTO user_likes (user_token, game_id) VALUES (?, ?)').run(userToken, gameId);
        db.prepare('UPDATE games SET like_count = like_count + 1 WHERE id = ?').run(gameId);
        newLikeCount = newLikeCount + 1;
        
        // 尝试发放积分（不能是自己的作品）
        if (game.author_token !== userToken) {
          creditResult = tryAwardActionCredits(userToken, 'like', { gameId });
          console.log('[积分] 点赞积分结果:', creditResult);
        } else {
          console.log('[积分] 点赞自己的作品，不发放积分');
        }
      }
    } else {
      // 匿名点赞（只增加计数，不记录）
      db.prepare('UPDATE games SET like_count = like_count + 1 WHERE id = ?').run(gameId);
      newLikeCount = newLikeCount + 1;
    }
    
    res.json({ 
      success: true, 
      liked, 
      likeCount: newLikeCount,
      creditAwarded: creditResult?.awarded || false,
      creditMessage: creditResult?.message || null
    });
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
    res.json({ success: true, games: addGamesFieldAliases(games) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 我的游戏管理 ====================

// 获取我的游戏列表（包括草稿）
app.get('/api/my-games', (req, res) => {
  try {
    // 兼容两种token请求头：x-author-token（网页端）和 x-user-token（小程序端）
    const authorToken = req.headers['x-author-token'] || req.headers['x-user-token'];
    if (!authorToken) {
      return res.json({ success: true, games: [], stats: { count: 0, plays: 0, likes: 0 } });
    }

    const games = db.prepare(`
      SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at,
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

    res.json({ success: true, games: addGamesFieldAliases(games), stats });
  } catch (error) {
    console.error('[ERROR] 获取我的游戏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 游戏高级编辑 ====================

// 编辑系统提示词
const EDIT_SYSTEM_PROMPT = `你是一个专业的HTML5游戏优化专家。用户会给你一个已有的HTML游戏代码，然后提出修改需求。

【核心要求】：
1. 理解现有代码的逻辑和结构，在此基础上进行修改
2. 尽量保持原有功能不被破坏
3. 只修改必要的部分，不要重写整个代码
4. 保持代码风格一致

【内容合规要求】：
1. 游戏内容必须健康积极
2. 不得添加违法、暴力、色情、赌博等不良内容
3. 适合全年龄段用户

【技术要求】：
1. 返回完整的HTML文件（包含<!DOCTYPE html>、<html>、<head>、<body>）
2. 所有CSS写在<style>标签内，JS写在<script>标签内
3. 确保游戏在修改后仍能正常运行
4. 保持手机和电脑的兼容性

【输出格式】：
只返回完整的HTML代码，用\`\`\`html和\`\`\`包裹，不要有任何解释文字。`;

// 确保编辑相关表存在
function ensureEditTablesExist() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_edit_sessions (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      user_token TEXT NOT NULL,
      original_code TEXT NOT NULL,
      current_code TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_edit_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      code_snapshot TEXT,
      tokens_used INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      code TEXT NOT NULL,
      change_summary TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// 获取编辑建议
function getEditSuggestions(code) {
  const suggestions = [];
  
  if (!code.includes('audio') && !code.includes('Audio')) {
    suggestions.push('🔊 添加背景音乐和音效');
  }
  if (!code.includes('localStorage')) {
    suggestions.push('💾 添加存档功能');
  }
  if (!code.includes('level') && !code.includes('关卡')) {
    suggestions.push('🎯 添加多个难度等级');
  }
  if (!code.includes('particle') && !code.includes('粒子')) {
    suggestions.push('✨ 添加粒子特效');
  }
  if (!code.includes('pause') && !code.includes('暂停')) {
    suggestions.push('⏸️ 添加暂停功能');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('🎮 优化游戏手感');
    suggestions.push('📱 改善移动端体验');
    suggestions.push('🏆 添加成就系统');
  }
  
  return suggestions.slice(0, 5);
}

// 检测代码变化
function detectCodeChanges(oldCode, newCode) {
  const changes = [];
  
  if (newCode.length > oldCode.length * 1.1) {
    changes.push('增加了新功能');
  }
  if (newCode.includes('audio') && !oldCode.includes('audio')) {
    changes.push('添加了音效');
  }
  if (newCode.includes('particle') && !oldCode.includes('particle')) {
    changes.push('添加了粒子效果');
  }
  
  return changes.length > 0 ? changes : ['代码已更新'];
}

// 游戏编辑 API
app.post('/api/games/:id/edit', async (req, res) => {
  console.log('[编辑API] 收到请求:', { 
    gameId: req.params.id, 
    body: req.body, 
    headers: { 
      'content-type': req.headers['content-type'],
      'x-user-token': req.headers['x-user-token'] ? '***' : 'missing'
    }
  });
  
  const userToken = req.headers['x-user-token'] || req.headers['x-author-token'];
  const gameId = req.params.id;
  
  if (!userToken) {
    return res.status(401).json({ success: false, error: '请先登录' });
  }
  
  try {
    // 验证游戏是否存在
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 检查编辑权限：作者本人或管理员（仅限公开游戏）
    const isAuthor = game.author_token === userToken;
    const isAdmin = isUserAdmin(userToken);
    const isPublicGame = game.is_public === 1 && game.visibility === 'public';
    
    if (!isAuthor && !(isAdmin && isPublicGame)) {
      if (isAdmin && !isPublicGame) {
        return res.status(403).json({ success: false, error: '管理员只能编辑公开可见的游戏' });
      }
      return res.status(403).json({ success: false, error: '只能编辑自己的游戏' });
    }
    
    const { action } = req.body || {};
    
    console.log('[编辑API] action:', action);
    
    if (!action) {
      return res.status(400).json({ success: false, error: '缺少 action 参数' });
    }
    
    // 确保表存在
    ensureEditTablesExist();
    
    switch (action) {
      case 'start': {
        // 开始新的编辑会话
        const sessionId = require('crypto').randomUUID();
        
        db.prepare(`
          INSERT INTO game_edit_sessions (id, game_id, user_token, original_code, current_code)
          VALUES (?, ?, ?, ?, ?)
        `).run(sessionId, game.id, userToken, game.code, game.code);
        
        // 记录初始版本
        const existingVersions = db.prepare('SELECT COUNT(*) as count FROM game_versions WHERE game_id = ?').get(game.id);
        if (existingVersions.count === 0) {
          db.prepare(`
            INSERT INTO game_versions (game_id, version_number, code, change_summary, created_by)
            VALUES (?, 1, ?, '初始版本', ?)
          `).run(game.id, game.code, userToken);
        }
        
        return res.json({
          success: true,
          sessionId,
          game: {
            id: game.id,
            title: game.title,
            prompt: game.prompt,
            code: game.code
          },
          suggestions: getEditSuggestions(game.code)
        });
      }
      
      case 'message': {
        // 处理编辑消息
        const { sessionId, message } = req.body;
        
        if (!sessionId) {
          return res.status(400).json({ success: false, error: '缺少会话ID' });
        }
        
        if (!message || message.trim().length === 0) {
          return res.status(400).json({ success: false, error: '请输入修改要求' });
        }
        
        const session = db.prepare('SELECT * FROM game_edit_sessions WHERE id = ?').get(sessionId);
        if (!session) {
          return res.status(404).json({ success: false, error: '编辑会话不存在或已过期' });
        }
        
        if (session.user_token !== userToken) {
          return res.status(403).json({ success: false, error: '无权访问此会话' });
        }
        
        // 获取历史对话
        const history = db.prepare(`
          SELECT role, content FROM game_edit_messages 
          WHERE session_id = ? 
          ORDER BY created_at ASC
        `).all(sessionId);
        
        // 构建对话上下文
        const messages = [
          { role: 'system', content: EDIT_SYSTEM_PROMPT },
          { role: 'user', content: `这是当前的游戏代码：\n\n\`\`\`html\n${session.current_code}\n\`\`\`` }
        ];
        
        history.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content });
        });
        
        messages.push({ role: 'user', content: `请按照以下要求修改游戏：${message}` });
        
        // 保存用户消息
        db.prepare(`
          INSERT INTO game_edit_messages (session_id, role, content)
          VALUES (?, 'user', ?)
        `).run(sessionId, message);
        
        // ========== 获取 LLM 配置（复用游戏生成的逻辑）==========
        const { llmConfig } = req.body;
        
        // 获取后台配置
        const defaultModel = getConfig('llm_default_model', 'deepseek-v3');
        const defaultApiKey = getConfig('llm_default_api_key', '');
        
        // 获取模型特定的 API Key
        const getModelApiKey = (modelId) => {
          if (!modelId) return null;
          const apiKeyKey = `llm_apikey_${modelId}`;
          const configuredKey = getConfig(apiKeyKey, null);
          if (configuredKey && configuredKey.length > 0) {
            return configuredKey;
          }
          return null;
        };
        
        let finalModel, finalProvider, finalBaseUrl, selectedModelId;
        
        // 检查前端传来的 modelId
        const requestedModelId = llmConfig?.provider || null;
        
        if (requestedModelId && LLM_MODELS[requestedModelId]) {
          // 用户选择了已知模型，使用后端配置
          const modelConfig = LLM_MODELS[requestedModelId];
          finalModel = modelConfig.model;
          finalProvider = modelConfig.provider;
          finalBaseUrl = modelConfig.baseUrl;
          selectedModelId = requestedModelId;
        } else if (requestedModelId === 'custom' && llmConfig?.apiKey) {
          // 用户使用自定义接口
          finalModel = llmConfig?.model || 'deepseek-chat';
          finalProvider = 'custom';
          finalBaseUrl = llmConfig?.baseUrl || 'https://api.deepseek.com';
          selectedModelId = null;
        } else {
          // 使用后台配置的默认模型
          if (defaultModel && LLM_MODELS[defaultModel]) {
            const modelConfig = LLM_MODELS[defaultModel];
            finalModel = modelConfig.model;
            finalProvider = modelConfig.provider;
            finalBaseUrl = modelConfig.baseUrl;
            selectedModelId = defaultModel;
          } else {
            // 回退到 deepseek-v3
            const fallbackConfig = LLM_MODELS['deepseek-v3'];
            finalModel = fallbackConfig.model;
            finalProvider = fallbackConfig.provider;
            finalBaseUrl = fallbackConfig.baseUrl;
            selectedModelId = 'deepseek-v3';
          }
        }
        
        // 确定 API Key（优先级：用户Key > 模型专属Key > 默认Key > 环境变量）
        let finalApiKey = null;
        // 不再支持用户自定义API Key，完全使用后台配置
        const modelSpecificKey = getModelApiKey(selectedModelId);
        if (modelSpecificKey) {
          finalApiKey = modelSpecificKey;
          console.log(`[编辑] 使用模型 ${selectedModelId} 的专属 API Key`);
        } else if (defaultApiKey) {
          finalApiKey = defaultApiKey;
          console.log('[编辑] 使用后台默认 API Key');
        } else if (process.env.DEEPSEEK_API_KEY) {
          finalApiKey = process.env.DEEPSEEK_API_KEY;
          console.log('[编辑] 使用环境变量 API Key');
        }
        
        if (!finalApiKey) {
          return res.status(400).json({ success: false, error: '该模型暂不可用，请联系管理员配置API Key' });
        }
        
        const provider = finalProvider;
        const model = finalModel;
        const baseUrl = finalBaseUrl;
        const apiKey = finalApiKey;
        
        // 获取模型的 maxTokens 配置
        const modelMaxTokens = selectedModelId ? getModelMaxTokens(selectedModelId) : 8192;
        // 获取模型的 temperature 配置（某些模型有特殊要求）
        const modelTemperature = selectedModelId ? getModelTemperature(selectedModelId, 0.7) : 0.7;
        
        console.log(`[编辑] 使用模型: ${model}, Provider: ${provider}, MaxTokens: ${modelMaxTokens}, Temperature: ${modelTemperature}`);
        console.log('[编辑] 开始调用LLM优化游戏...');
        const startTime = Date.now();
        
        // 创建 AbortController 用于取消请求
        const editAbortController = new AbortController();
        
        // 注册到活跃编辑请求列表
        activeEdits.set(sessionId, {
          userToken: userToken,
          startTime: startTime,
          cancelled: false,
          abortController: editAbortController
        });
        
        // 根据 provider 调整 API 调用
        // 智谱AI使用 /v4/chat/completions 端点
        let apiUrl = provider === 'zhipu' ? `${baseUrl}/v4/chat/completions` : `${baseUrl}/v1/chat/completions`;
        let headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };
        
        // Anthropic 需要特殊处理
        if (provider === 'anthropic') {
          apiUrl = `${baseUrl}/v1/messages`;
          headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          };
        }
        
        // OpenRouter 需要添加站点信息
        if (provider === 'openrouter') {
          headers['HTTP-Referer'] = 'https://youxijia.fun';
          headers['X-Title'] = 'GameMaker AI Editor';
        }
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(provider === 'anthropic' ? {
            model: model,
            max_tokens: modelMaxTokens,
            messages: messages.filter(m => m.role !== 'system').map(m => ({
              role: m.role,
              content: m.content
            })),
            system: EDIT_SYSTEM_PROMPT
          } : {
            model: model,
            messages: messages,
            temperature: modelTemperature,
            max_tokens: modelMaxTokens
          }),
          signal: editAbortController.signal
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`LLM API错误: ${response.status} - ${errorData}`);
        }
        
        const data = await response.json();
        const apiTime = Date.now() - startTime;
        console.log(`[编辑] LLM响应时间: ${apiTime}ms`);
        
        // 检查请求是否已被取消
        if (isEditCancelled(sessionId)) {
          console.log(`[编辑取消] LLM已返回，但请求已被用户取消: ${sessionId}`);
          activeEdits.delete(sessionId);
          return res.json({
            success: false,
            cancelled: true,
            error: '请求已被取消'
          });
        }
        
        // 清理活跃编辑请求
        activeEdits.delete(sessionId);
        
        // 根据 provider 提取内容
        let newCode;
        if (provider === 'anthropic') {
          newCode = data.content?.[0]?.text || '';
        } else {
          newCode = data.choices?.[0]?.message?.content || '';
        }
        
        // 使用统一的代码提取函数
        newCode = extractHtmlFromResponse(newCode);
        
        // 额外清理：移除可能残留的 markdown 代码块标记
        newCode = newCode.replace(/^```html\s*\n?/gi, '');
        newCode = newCode.replace(/^```\s*\n?/gi, '');
        newCode = newCode.replace(/\n?```\s*$/gi, '');
        
        // 验证代码结构完整性
        if (!newCode.includes('<html') && !newCode.includes('<!DOCTYPE')) {
          return res.status(400).json({ success: false, error: 'AI返回的代码格式不正确，请重试' });
        }
        
        // 检查HTML结构是否完整
        const hasHtmlEnd = newCode.includes('</html>');
        const hasBodyEnd = newCode.includes('</body>');
        if (!hasHtmlEnd || !hasBodyEnd) {
          console.error('[编辑] AI返回的代码不完整，缺少结束标签');
          return res.status(400).json({ 
            success: false, 
            error: 'AI返回的代码不完整（缺少结束标签），请重试' 
          });
        }
        
        // 保存AI回复
        db.prepare(`
          INSERT INTO game_edit_messages (session_id, role, content, code_snapshot, tokens_used)
          VALUES (?, 'assistant', ?, ?, ?)
        `).run(sessionId, '已完成修改', newCode, data.usage?.total_tokens || 0);
        
        // 更新会话的当前代码
        db.prepare(`
          UPDATE game_edit_sessions SET current_code = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newCode, sessionId);
        
        return res.json({
          success: true,
          code: newCode,
          message: '修改完成！可以预览效果或继续优化',
          changes: detectCodeChanges(session.current_code, newCode),
          tokensUsed: data.usage?.total_tokens || 0,
          apiTime
        });
      }
      
      case 'save': {
        // 保存编辑结果
        const { sessionId, saveAsNew, title } = req.body;
        
        if (!sessionId) {
          return res.status(400).json({ success: false, error: '缺少会话ID' });
        }
        
        const session = db.prepare('SELECT * FROM game_edit_sessions WHERE id = ?').get(sessionId);
        if (!session) {
          return res.status(404).json({ success: false, error: '会话不存在' });
        }
        
        // 验证要保存的代码是否完整
        const codeToSave = session.current_code;
        if (!codeToSave || !codeToSave.includes('</html>') || !codeToSave.includes('</body>')) {
          console.error('[保存] 代码不完整，拒绝保存');
          return res.status(400).json({ 
            success: false, 
            error: '代码不完整，无法保存。请重新编辑后再试。' 
          });
        }
        
        if (saveAsNew) {
          // 另存为新游戏
          const newGameId = require('crypto').randomUUID();
          const newTitle = title || game.title + ' (编辑版)';
          
          db.prepare(`
            INSERT INTO games (id, title, prompt, code, author_name, author_token, llm_model)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(newGameId, newTitle, game.prompt + ' [编辑优化]', session.current_code, game.author_name, userToken, game.llm_model);
          
          // 保存静态文件（使用 saveGameStaticFile 进行加工处理，添加平台 UI）
          saveGameStaticFile(newGameId, session.current_code, {
            title: newTitle,
            authorName: game.author_name,
            authorToken: userToken,
            prompt: game.prompt + ' [编辑优化]',
            created_at: new Date().toISOString()
          });
          
          db.prepare(`UPDATE game_edit_sessions SET status = 'completed' WHERE id = ?`).run(sessionId);
          
          return res.json({
            success: true,
            gameId: newGameId,
            title: newTitle,
            message: '已保存为新游戏'
          });
        } else {
          // 更新原游戏
          const latestVersion = db.prepare(`
            SELECT MAX(version_number) as max_version FROM game_versions WHERE game_id = ?
          `).get(game.id);
          
          const newVersionNumber = (latestVersion?.max_version || 0) + 1;
          
          db.prepare(`
            INSERT INTO game_versions (game_id, version_number, code, change_summary, created_by)
            VALUES (?, ?, ?, ?, ?)
          `).run(game.id, newVersionNumber, session.current_code, '编辑优化', userToken);
          
          db.prepare(`
            UPDATE games SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).run(session.current_code, game.id);
          
          // 更新静态文件（使用 saveGameStaticFile 进行加工处理，添加平台 UI）
          saveGameStaticFile(game.id, session.current_code, {
            title: game.title,
            authorName: game.author_name,
            authorToken: game.author_token,
            prompt: game.prompt,
            created_at: game.created_at
          });
          
          db.prepare(`UPDATE game_edit_sessions SET status = 'completed' WHERE id = ?`).run(sessionId);
          
          return res.json({
            success: true,
            gameId: game.id,
            version: newVersionNumber,
            message: '游戏已更新'
          });
        }
      }
      
      default:
        return res.status(400).json({ success: false, error: '未知的操作类型' });
    }
  } catch (error) {
    // 检查是否是取消导致的错误
    if (error.name === 'AbortError') {
      console.log('[编辑] 请求已被用户取消');
      // 清理活跃编辑请求
      const { sessionId } = req.body || {};
      if (sessionId) {
        activeEdits.delete(sessionId);
      }
      return res.json({ 
        success: false, 
        cancelled: true, 
        error: '请求已被取消' 
      });
    }
    
    console.error('[编辑API错误]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============ 异步编辑游戏 API（解决Cloudflare 524超时问题） ============

// 异步编辑游戏 - 立即返回 taskId，后台处理
app.post('/api/games/:id/edit-async', async (req, res) => {
  const taskId = `edit_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const userToken = req.headers['x-user-token'] || req.headers['x-author-token'];
  const gameId = req.params.id;
  
  console.log(`[AsyncEdit] 创建异步编辑任务: ${taskId}`);
  
  if (!userToken) {
    return res.status(401).json({ success: false, error: '请先登录' });
  }
  
  const { sessionId, message, llmConfig } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ success: false, error: '缺少会话ID' });
  }
  
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: '请输入修改要求' });
  }
  
  try {
    // 验证游戏和会话
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    const session = db.prepare('SELECT * FROM game_edit_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: '编辑会话不存在或已过期' });
    }
    
    if (session.user_token !== userToken) {
      // 检查是否为管理员
      const isAdmin = isUserAdmin(userToken);
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: '无权访问此会话' });
      }
    }
    
    // 创建任务记录
    asyncEditTasks.set(taskId, {
      status: 'pending',
      progress: 0,
      progressText: '任务已创建，等待处理...',
      result: null,
      error: null,
      createdAt: Date.now(),
      userToken,
      sessionId,
      gameId,
      message
    });
    
    // 立即返回 taskId
    res.json({ success: true, taskId });
    
    // 后台异步处理编辑
    (async () => {
      try {
        const task = asyncEditTasks.get(taskId);
        if (!task) return;
        
        task.status = 'processing';
        task.progress = 10;
        task.progressText = '正在准备编辑环境...';
        
        // 确保表存在
        ensureEditTablesExist();
        
        // 获取历史对话
        const history = db.prepare(`
          SELECT role, content FROM game_edit_messages 
          WHERE session_id = ? 
          ORDER BY created_at ASC
        `).all(sessionId);
        
        task.progress = 20;
        task.progressText = '正在构建上下文...';
        
        // 构建对话上下文
        const messages = [
          { role: 'system', content: EDIT_SYSTEM_PROMPT },
          { role: 'user', content: `这是当前的游戏代码：\n\n\`\`\`html\n${session.current_code}\n\`\`\`` }
        ];
        
        history.forEach(msg => {
          messages.push({ role: msg.role, content: msg.content });
        });
        
        messages.push({ role: 'user', content: `请按照以下要求修改游戏：${message}` });
        
        // 保存用户消息
        db.prepare(`
          INSERT INTO game_edit_messages (session_id, role, content)
          VALUES (?, 'user', ?)
        `).run(sessionId, message);
        
        task.progress = 30;
        task.progressText = '正在配置AI模型...';
        
        // ========== 获取 LLM 配置 ==========
        const defaultModel = getConfig('llm_default_model', 'deepseek-v3');
        const defaultApiKey = getConfig('llm_default_api_key', '');
        
        const getModelApiKey = (modelId) => {
          if (!modelId) return null;
          const apiKeyKey = `llm_apikey_${modelId}`;
          const configuredKey = getConfig(apiKeyKey, null);
          return configuredKey && configuredKey.length > 0 ? configuredKey : null;
        };
        
        let finalModel, finalProvider, finalBaseUrl, selectedModelId;
        const requestedModelId = llmConfig?.provider || null;
        
        if (requestedModelId && LLM_MODELS[requestedModelId]) {
          const modelConfig = LLM_MODELS[requestedModelId];
          finalModel = modelConfig.model;
          finalProvider = modelConfig.provider;
          finalBaseUrl = modelConfig.baseUrl;
          selectedModelId = requestedModelId;
        } else if (defaultModel && LLM_MODELS[defaultModel]) {
          const modelConfig = LLM_MODELS[defaultModel];
          finalModel = modelConfig.model;
          finalProvider = modelConfig.provider;
          finalBaseUrl = modelConfig.baseUrl;
          selectedModelId = defaultModel;
        } else {
          const fallbackConfig = LLM_MODELS['deepseek-v3'];
          finalModel = fallbackConfig.model;
          finalProvider = fallbackConfig.provider;
          finalBaseUrl = fallbackConfig.baseUrl;
          selectedModelId = 'deepseek-v3';
        }
        
        let finalApiKey = getModelApiKey(selectedModelId) || defaultApiKey || process.env.DEEPSEEK_API_KEY;
        
        if (!finalApiKey) {
          task.status = 'failed';
          task.error = '该模型暂不可用，请联系管理员配置API Key';
          return;
        }
        
        const modelMaxTokens = selectedModelId ? getModelMaxTokens(selectedModelId) : 8192;
        const modelTemperature = selectedModelId ? getModelTemperature(selectedModelId, 0.7) : 0.7;
        
        console.log(`[AsyncEdit] 使用模型: ${finalModel}, Provider: ${finalProvider}`);
        
        task.progress = 40;
        task.progressText = '正在连接AI服务...';
        
        // 根据 provider 调整 API 调用
        let apiUrl = finalProvider === 'zhipu' ? `${finalBaseUrl}/v4/chat/completions` : `${finalBaseUrl}/v1/chat/completions`;
        let headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalApiKey}`
        };
        
        if (finalProvider === 'anthropic') {
          apiUrl = `${finalBaseUrl}/v1/messages`;
          headers = {
            'Content-Type': 'application/json',
            'x-api-key': finalApiKey,
            'anthropic-version': '2023-06-01'
          };
        }
        
        if (finalProvider === 'openrouter') {
          headers['HTTP-Referer'] = 'https://youxijia.fun';
          headers['X-Title'] = 'GameMaker AI Editor';
        }
        
        task.progress = 50;
        task.progressText = 'AI正在分析并修改代码...';
        
        const startTime = Date.now();
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(finalProvider === 'anthropic' ? {
            model: finalModel,
            max_tokens: modelMaxTokens,
            messages: messages.filter(m => m.role !== 'system').map(m => ({
              role: m.role,
              content: m.content
            })),
            system: EDIT_SYSTEM_PROMPT
          } : {
            model: finalModel,
            messages: messages,
            temperature: modelTemperature,
            max_tokens: modelMaxTokens
          })
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`LLM API错误: ${response.status} - ${errorData}`);
        }
        
        const data = await response.json();
        const apiTime = Date.now() - startTime;
        console.log(`[AsyncEdit] LLM响应时间: ${apiTime}ms`);
        
        task.progress = 80;
        task.progressText = '正在处理AI响应...';
        
        // 根据 provider 提取内容
        let newCode;
        if (finalProvider === 'anthropic') {
          newCode = data.content?.[0]?.text || '';
        } else {
          newCode = data.choices?.[0]?.message?.content || '';
        }
        
        // 使用统一的代码提取函数
        newCode = extractHtmlFromResponse(newCode);
        
        // 额外清理
        newCode = newCode.replace(/^```html\s*\n?/gi, '');
        newCode = newCode.replace(/^```\s*\n?/gi, '');
        newCode = newCode.replace(/\n?```\s*$/gi, '');
        
        task.progress = 90;
        task.progressText = '正在验证代码...';
        
        // 验证代码结构完整性
        if (!newCode.includes('<html') && !newCode.includes('<!DOCTYPE')) {
          throw new Error('AI返回的代码格式不正确，请重试');
        }
        
        const hasHtmlEnd = newCode.includes('</html>');
        const hasBodyEnd = newCode.includes('</body>');
        if (!hasHtmlEnd || !hasBodyEnd) {
          throw new Error('AI返回的代码不完整（缺少结束标签），请重试');
        }
        
        // 保存AI回复
        db.prepare(`
          INSERT INTO game_edit_messages (session_id, role, content, code_snapshot, tokens_used)
          VALUES (?, 'assistant', ?, ?, ?)
        `).run(sessionId, '已完成修改', newCode, data.usage?.total_tokens || 0);
        
        // 更新会话的当前代码
        db.prepare(`
          UPDATE game_edit_sessions SET current_code = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newCode, sessionId);
        
        // 任务完成
        task.status = 'completed';
        task.progress = 100;
        task.progressText = '修改完成！';
        task.result = {
          success: true,
          code: newCode,
          message: '修改完成！可以预览效果或继续优化',
          changes: detectCodeChanges(session.current_code, newCode),
          tokensUsed: data.usage?.total_tokens || 0,
          apiTime
        };
        
        console.log(`[AsyncEdit] 任务完成: ${taskId}`);
        
        // ===== 发送订阅消息通知（编辑完成，基于任务订阅状态） =====
        if (task.subscribeNotify && task.userToken && task.wechatOpenId) {
          try {
            console.log(`[AsyncEdit] 用户已订阅此任务，准备发送通知`);
            await wechatUtils.sendGameCreatedNotification({
              openId: task.wechatOpenId,
              gameName: game.title || '您的游戏',
              gameId: task.gameId,
              status: '编辑完成'
            });
            console.log(`[AsyncEdit] 订阅消息通知发送成功`);
          } catch (notifyErr) {
            console.error(`[AsyncEdit] 发送通知失败:`, notifyErr.message);
          }
        } else if (!task.subscribeNotify) {
          console.log(`[AsyncEdit] 用户未订阅此任务，跳过通知`);
        }
        
      } catch (error) {
        console.error(`[AsyncEdit] 任务失败: ${taskId}`, error);
        const task = asyncEditTasks.get(taskId);
        if (task) {
          task.status = 'failed';
          task.progress = 0;
          task.progressText = '编辑失败';
          task.error = error.message || '编辑失败';
        }
      }
    })();
    
  } catch (error) {
    console.error('[AsyncEdit] 创建任务失败:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 查询异步编辑任务状态
app.get('/api/games/:id/edit-status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = asyncEditTasks.get(taskId);
  
  if (!task) {
    return res.status(404).json({ 
      success: false, 
      error: '任务不存在或已过期',
      status: 'not_found'
    });
  }
  
  const response = {
    success: true,
    taskId,
    status: task.status,
    progress: task.progress,
    progressText: task.progressText
  };
  
  // 如果任务完成，返回结果
  if (task.status === 'completed' && task.result) {
    response.result = task.result;
    // 任务完成后60秒删除
    setTimeout(() => {
      asyncEditTasks.delete(taskId);
    }, 60000);
  }
  
  // 如果任务失败，返回错误
  if (task.status === 'failed') {
    response.error = task.error;
    // 失败任务60秒后删除
    setTimeout(() => {
      asyncEditTasks.delete(taskId);
    }, 60000);
  }
  
  res.json(response);
});

// AI修复游戏代码API
app.post('/api/games/:id/repair', async (req, res) => {
  console.log('[修复API] 收到修复请求:', { gameId: req.params.id });
  
  const userToken = req.headers['x-user-token'];
  const gameId = req.params.id;
  const { creditCost = 0.5 } = req.body;
  
  if (!userToken) {
    return res.status(401).json({ success: false, error: '请先登录' });
  }
  
  try {
    // 验证游戏是否存在
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 检查编辑权限：作者本人或管理员
    const isAuthor = game.author_token === userToken;
    const isAdmin = isUserAdmin(userToken);
    const isPublicGame = game.is_public === 1 && game.visibility === 'public';
    
    if (!isAuthor && !(isAdmin && isPublicGame)) {
      return res.status(403).json({ success: false, error: '只能修复自己的游戏' });
    }
    
    // 检查并扣除积分（小程序请求跳过积分检查）
    const isFromMiniProgram = isMiniProgramRequest(req);
    if (!isFromMiniProgram) {
      const userCredits = ensureUserCredits(userToken);
      if (userCredits.credits < creditCost) {
        return res.status(400).json({ 
          success: false, 
          error: `积分不足，需要 ${creditCost} 积分`,
          creditsNeeded: creditCost,
          creditsHave: userCredits.credits
        });
      }
    } else {
      console.log('[修复API] 小程序请求，跳过积分检查');
    }
    
    // 获取当前游戏代码
    const currentCode = game.code;
    if (!currentCode || currentCode.trim().length === 0) {
      return res.status(400).json({ success: false, error: '游戏代码为空，无法修复' });
    }
    
    // 获取LLM配置（复用生成游戏的逻辑）
    const defaultModel = getConfig('llm_default_model', 'deepseek-v3');
    let finalModel, finalProvider, finalBaseUrl, selectedModelId, finalApiKey;
    
    // 使用默认模型配置
    if (defaultModel && LLM_MODELS[defaultModel]) {
      const modelConfig = LLM_MODELS[defaultModel];
      finalModel = modelConfig.model;
      finalProvider = modelConfig.provider;
      finalBaseUrl = modelConfig.baseUrl;
      selectedModelId = defaultModel;
    } else {
      const fallbackConfig = LLM_MODELS['deepseek-v3'];
      finalModel = fallbackConfig.model;
      finalProvider = fallbackConfig.provider;
      finalBaseUrl = fallbackConfig.baseUrl;
      selectedModelId = 'deepseek-v3';
    }
    
    // 获取API Key
    const getModelApiKey = (modelId) => {
      if (!modelId) return null;
      const apiKeyKey = `llm_apikey_${modelId}`;
      const configuredKey = getConfig(apiKeyKey, null);
      return (configuredKey && configuredKey.length > 0) ? configuredKey : null;
    };
    
    const defaultApiKey = getConfig('llm_default_api_key', '');
    const modelSpecificKey = getModelApiKey(selectedModelId);
    
    if (modelSpecificKey) {
      finalApiKey = modelSpecificKey;
    } else if (defaultApiKey) {
      finalApiKey = defaultApiKey;
    } else if (process.env.DEEPSEEK_API_KEY) {
      finalApiKey = process.env.DEEPSEEK_API_KEY;
    } else {
      return res.status(400).json({ success: false, error: 'API Key 未配置' });
    }
    
    // 获取模型的 temperature 配置（某些模型有特殊要求，如 kimi-k2.5 只支持 temperature=1）
    // 对于修复任务默认使用较低温度 0.3，但如果模型有限制则使用模型要求的值
    const repairTemperature = getModelTemperature(selectedModelId, 0.3);
    console.log(`[修复API] 使用模型: ${finalModel}, Provider: ${finalProvider}, Temperature: ${repairTemperature}`);
    
    // 构建修复提示词
    const repairSystemPrompt = `你是一个专业的HTML5游戏代码修复专家。你的任务是修复用户游戏代码中的错误。

修复原则：
1. 仔细分析代码，找出所有JavaScript错误、语法错误、逻辑错误
2. 修复未定义的变量、函数调用错误、DOM元素访问错误
3. 修复事件监听器问题、动画循环问题
4. 确保游戏可以正常运行
5. 保持原有游戏逻辑和风格不变
6. 只修复错误，不要添加新功能

输出格式要求：
1. 首先用一段简短的中文说明你发现并修复的问题（50字以内）
2. 然后输出完整的修复后的HTML代码
3. 代码必须用 \`\`\`html 和 \`\`\` 包裹

例如：
修复了未定义的score变量和缺失的游戏循环函数。

\`\`\`html
<!DOCTYPE html>
...完整代码...
\`\`\``;

    const repairMessages = [
      { role: 'system', content: repairSystemPrompt },
      { role: 'user', content: `请修复以下游戏代码中的所有错误：\n\n\`\`\`html\n${currentCode}\n\`\`\`` }
    ];
    
    // 调用LLM
    // 智谱AI使用 /v4/chat/completions 端点
    let apiUrl = finalProvider === 'zhipu' ? `${finalBaseUrl}/v4/chat/completions` : `${finalBaseUrl}/v1/chat/completions`;
    let headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${finalApiKey}`
    };
    
    // Anthropic特殊处理
    if (finalProvider === 'anthropic') {
      apiUrl = `${finalBaseUrl}/v1/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': finalApiKey,
        'anthropic-version': '2023-06-01'
      };
    }
    
    const requestBody = finalProvider === 'anthropic' ? {
      model: finalModel,
      max_tokens: 8192,
      system: repairSystemPrompt,
      messages: [{ role: 'user', content: `请修复以下游戏代码中的所有错误：\n\n\`\`\`html\n${currentCode}\n\`\`\`` }]
    } : {
      model: finalModel,
      messages: repairMessages,
      max_tokens: 8192,
      temperature: repairTemperature
    };
    
    console.log('[修复API] 开始调用LLM...');
    const startTime = Date.now();
    
    const llmResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!llmResponse.ok) {
      const errorText = await llmResponse.text();
      console.error('[修复API] LLM调用失败:', errorText);
      return res.status(500).json({ success: false, error: 'AI修复服务暂时不可用，请稍后重试' });
    }
    
    const llmData = await llmResponse.json();
    const llmTime = Date.now() - startTime;
    console.log(`[修复API] LLM响应时间: ${llmTime}ms`);
    
    // 提取响应内容
    let responseContent = '';
    if (finalProvider === 'anthropic') {
      responseContent = llmData.content?.[0]?.text || '';
    } else {
      responseContent = llmData.choices?.[0]?.message?.content || '';
    }
    
    if (!responseContent) {
      return res.status(500).json({ success: false, error: 'AI返回内容为空' });
    }
    
    // 提取修复摘要和代码
    let repairSummary = '';
    let repairedCode = '';
    
    // 尝试提取代码块
    const codeMatch = responseContent.match(/```html\s*([\s\S]*?)```/i);
    if (codeMatch) {
      repairedCode = codeMatch[1].trim();
      // 提取代码块之前的内容作为摘要
      const summaryPart = responseContent.substring(0, responseContent.indexOf('```html')).trim();
      repairSummary = summaryPart || '代码已修复';
    } else {
      // 没有代码块，可能整个响应就是代码
      if (responseContent.includes('<!DOCTYPE') || responseContent.includes('<html')) {
        repairedCode = responseContent;
        repairSummary = '代码已修复';
      } else {
        return res.status(500).json({ success: false, error: 'AI未能生成有效的修复代码' });
      }
    }
    
    // 验证修复后的代码
    if (!repairedCode.includes('<html') && !repairedCode.includes('<!DOCTYPE')) {
      return res.status(500).json({ success: false, error: '修复后的代码格式无效' });
    }
    
    // 扣除积分（小程序请求跳过）
    if (!isFromMiniProgram) {
      db.prepare(`
        UPDATE user_credits 
        SET credits = credits - ?, total_used = total_used + ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_token = ?
      `).run(creditCost, creditCost, userToken);
      
      // 记录积分消耗
      db.prepare(`
        INSERT INTO credit_logs (user_token, amount, type, description) 
        VALUES (?, ?, 'repair_game', ?)
      `).run(userToken, -creditCost, `AI修复游戏：${game.title}`);
    }
    
    // 更新游戏代码
    db.prepare('UPDATE games SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(repairedCode, gameId);
    
    // 保存静态文件
    saveGameStaticFile(gameId, repairedCode, {
      title: game.title,
      authorName: game.author_name,
      authorToken: game.author_token,
      prompt: game.prompt
    });
    
    // 获取更新后的积分
    const updatedCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
    
    console.log(`[修复API] 修复完成，游戏ID: ${gameId}, 耗时: ${llmTime}ms`);
    
    res.json({
      success: true,
      repairedCode,
      repairSummary,
      newCredits: updatedCredits?.credits || 0,
      llmTime
    });
    
  } catch (error) {
    console.error('[修复API] 错误:', error);
    res.status(500).json({ success: false, error: error.message || '服务器错误' });
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
    
    res.json({ success: true, games: addGamesFieldAliases(games), count: games.length });
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
    
    res.json({ success: true, games: addGamesFieldAliases(games), count: games.length });
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
    
    // 检查游戏是否存在（同时获取author_token用于判断是否自己的作品）
    const game = db.prepare('SELECT id, author_token FROM games WHERE id = ?').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 检查是否已收藏
    const existing = db.prepare('SELECT id FROM user_favorites WHERE user_token = ? AND game_id = ?').get(userToken, gameId);
    
    if (existing) {
      // 已收藏，则取消收藏（不扣积分）
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
      
      // 尝试发放积分（不能是自己的作品）
      let creditResult = null;
      if (game.author_token !== userToken) {
        creditResult = tryAwardActionCredits(userToken, 'favorite', { gameId });
      }
      
      res.json({ 
        success: true, 
        favorited: true, 
        favorite_count: updated?.favorite_count || 0,
        creditAwarded: creditResult?.awarded || false,
        creditMessage: creditResult?.message || null
      });
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
      // 已关注，取消关注（不扣积分）
      db.prepare('DELETE FROM user_follows WHERE follower_token = ? AND following_token = ?')
        .run(followerToken, followingToken);
      res.json({ success: true, following: false });
    } else {
      // 未关注，添加关注
      db.prepare('INSERT INTO user_follows (follower_token, following_token) VALUES (?, ?)')
        .run(followerToken, followingToken);
      
      // 尝试发放积分
      const creditResult = tryAwardActionCredits(followerToken, 'follow', { followingToken });
      
      res.json({ 
        success: true, 
        following: true,
        creditAwarded: creditResult?.awarded || false,
        creditMessage: creditResult?.message || null
      });
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

    res.json({ success: true, games: addGamesFieldAliases(games), count: games.length });
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

    // 改进查询：同时从 user_accounts 和 games 表获取用户信息
    const users = db.prepare(`
      SELECT uf.following_token as token, uf.created_at as followed_at,
             COALESCE(
               (SELECT nickname FROM user_accounts WHERE user_token = uf.following_token),
               (SELECT author_name FROM games WHERE author_token = uf.following_token LIMIT 1),
               '游戏家用户'
             ) as nickname,
             (SELECT COUNT(*) FROM games WHERE author_token = uf.following_token AND is_hidden = 0) as games_count,
             (SELECT COUNT(*) FROM user_follows WHERE following_token = uf.following_token) as followers_count
      FROM user_follows uf
      WHERE uf.follower_token = ?
      ORDER BY uf.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userToken, limit, offset);

    console.log('[DEBUG] 关注列表查询结果:', userToken, users);

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

    // 改进查询：同时从 user_accounts 和 games 表获取用户信息
    const users = db.prepare(`
      SELECT uf.follower_token as token, uf.created_at as followed_at,
             COALESCE(
               (SELECT nickname FROM user_accounts WHERE user_token = uf.follower_token),
               (SELECT author_name FROM games WHERE author_token = uf.follower_token LIMIT 1),
               '游戏家用户'
             ) as nickname,
             (SELECT COUNT(*) FROM games WHERE author_token = uf.follower_token AND is_hidden = 0) as games_count,
             (SELECT COUNT(*) FROM user_follows WHERE following_token = uf.follower_token) as followers_count
      FROM user_follows uf
      WHERE uf.following_token = ?
      ORDER BY uf.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userToken, limit, offset);

    console.log('[DEBUG] 粉丝列表查询结果:', userToken, users);

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
    credits: formatCreditsValue(userCredits?.credits || 0),
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

    // 获取试玩模式使用的模型的最大Token配置
    const defaultModel = getConfig('llm_default_model', 'deepseek-v3');
    const trialMaxTokens = getModelMaxTokens(defaultModel);
    // 获取模型的 temperature 配置（某些模型有特殊要求）
    const trialTemperature = getModelTemperature(defaultModel, 0.7);
    console.log(`[TRIAL] 使用最大Token数: ${trialMaxTokens} (模型: ${defaultModel}), Temperature: ${trialTemperature}`);

    // 带重试机制的API请求
    const MAX_RETRIES = 2;
    let response;
    let lastError;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时
      
      try {
        // 智谱AI使用 /v4/chat/completions 端点
        const trialApiPath = apiConfig.provider === 'zhipu' ? '/v4/chat/completions' : '/v1/chat/completions';
        console.log(`[TRIAL] 发送API请求 (尝试${attempt}/${MAX_RETRIES}): ${apiConfig.baseUrl}${trialApiPath}`);
        response = await fetch(`${apiConfig.baseUrl}${trialApiPath}`, {
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
            temperature: trialTemperature,
            max_tokens: trialMaxTokens
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
    
    // 从数据库配置读取邀请奖励积分（支持后台配置）
    const mpInviteReward = parseFloat(getConfig('credits_mp_invite', '3')) || 3;
    
    // 被邀请者获得奖励
    const newUserReward = mpInviteReward;
    db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
      .run(newUserReward, newUserReward, userToken);
    db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
      .run(userToken, newUserReward, 'invite_bonus', '通过邀请链接注册奖励');
    
    // 邀请者获得奖励（与被邀请者相同）
    const inviterReward = mpInviteReward;
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

// 获取邀请好友配置（每日上限和奖励积分）
function getInviteConfig() {
  return {
    dailyLimit: parseInt(getConfig('credits_invite_friend_daily_limit', '5')),
    rewardPoints: parseFloat(getConfig('credits_invite_friend', '3'))
  };
}

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
    const inviteConfig = getInviteConfig();
    const dailyCount = db.prepare('SELECT count FROM daily_referral_counts WHERE inviter_code = ? AND date = ?').get(referral.inviter_code, today);
    
    if (dailyCount && dailyCount.count >= inviteConfig.dailyLimit) {
      // 邀请者今日已达上限，仍标记为已处理但不发放奖励
      db.prepare('UPDATE referrals SET rewarded = 1, rewarded_at = CURRENT_TIMESTAMP WHERE invitee_account_id = ?').run(accountId);
      return res.json({ 
        success: true, 
        rewarded: false, 
        reason: '邀请者今日奖励已达上限',
        dailyLimit: inviteConfig.dailyLimit
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
    
    // 同时记录到 daily_action_credits 表（用于前端显示）
    const inviter = db.prepare('SELECT creator_token FROM invite_codes WHERE code = ?').get(referral.inviter_code);
    if (inviter) {
      db.prepare(`
        INSERT INTO daily_action_credits (user_token, action_type, action_date, count)
        VALUES (?, 'invite_friend', ?, 1)
        ON CONFLICT(user_token, action_type, action_date) DO UPDATE SET count = count + 1
      `).run(inviter.creator_token, today);
    }
    
    // 3. 通过邀请码查找邀请者的账户
    if (inviter) {
      // 给邀请者增加积分
      db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
        .run(inviteConfig.rewardPoints, inviteConfig.rewardPoints, inviter.creator_token);
      db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
        .run(inviter.creator_token, inviteConfig.rewardPoints, 'referral_inviter', '邀请好友成功生成游戏奖励');
    }
    
    // 4. 给被邀请者增加积分（当前用户）
    // 需要查找当前用户的 user_token
    const currentUser = db.prepare('SELECT user_token FROM user_credits WHERE user_token LIKE ?').get(accountId + '%');
    if (currentUser) {
      db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
        .run(inviteConfig.rewardPoints, inviteConfig.rewardPoints, currentUser.user_token);
      db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
        .run(currentUser.user_token, inviteConfig.rewardPoints, 'referral_invitee', '通过邀请链接成功生成游戏奖励');
    } else {
      // 如果找不到，尝试用 accountId 直接操作
      const exists = db.prepare('SELECT 1 FROM user_credits WHERE user_token = ?').get(accountId);
      if (exists) {
        db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
          .run(inviteConfig.rewardPoints, inviteConfig.rewardPoints, accountId);
        db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
          .run(accountId, inviteConfig.rewardPoints, 'referral_invitee', '通过邀请链接成功生成游戏奖励');
      }
    }
    
    console.log(`[REFERRAL] 邀请奖励触发: 邀请者=${referral.inviter_code}, 被邀请者=${accountId}, 双方各得${inviteConfig.rewardPoints}积分`);
    
    return res.json({
      success: true,
      rewarded: true,
      inviter: referral.inviter_code,
      invitee: accountId,
      rewardPoints: inviteConfig.rewardPoints,
      message: `🎉 邀请奖励已发放！你和邀请者各获得 ${inviteConfig.rewardPoints} 积分`
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
    
    res.json({ success: true, games: addGamesFieldAliases(games), type });
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
      const speedKey = `llm_speed_${id}`;
      const creditsKey = `llm_credits_${id}`;
      const qualityKey = `llm_quality_${id}`;
      const apiKeyKey = `llm_apikey_${id}`;
      const maxTokensKey = `llm_maxtokens_${id}`;
      
      // 从数据库获取配置值
      const configuredCredits = getConfig(creditsKey, null);
      const configuredQuality = getConfig(qualityKey, null);
      const configuredApiKey = getConfig(apiKeyKey, null);
      const configuredMaxTokens = getConfig(maxTokensKey, null);
      
      // 实际使用的quality（优先使用配置值）
      const effectiveQuality = configuredQuality || config.quality;
      
      // 获取速度等级
      const speedLevel = getModelSpeedLevel(id);
      
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
        speedLevel: speedLevel,  // 速度等级（ultra/fast/normal/slow/very-slow）
        quality: effectiveQuality,  // 使用实际生效的quality
        defaultQuality: config.quality,  // 保留默认值供参考
        // 默认值
        defaultCredits: config.creditCost,
        defaultMaxTokens: config.maxTokens || 8000,  // 默认最大Token数
        // 配置值（如果有）
        configuredCredits: configuredCredits !== null ? parseInt(configuredCredits) : null,
        configuredQuality: configuredQuality,
        configuredMaxTokens: configuredMaxTokens !== null ? parseInt(configuredMaxTokens) : null,
        hasApiKey: configuredApiKey !== null && configuredApiKey.length > 0,
        maskedApiKey: maskedApiKey,  // 遮蔽后的 API Key
        // 实际使用的值
        creditCost: getModelCreditCost(id),
        maxTokens: getModelMaxTokens(id),  // 实际使用的最大Token数
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
    'kimi-k2.5': 450,
    'kimi-k2-turbo-preview': 380,
    'kimi-k2-0905-preview': 350,
    'kimi-k2-0711-preview': 350,
    'kimi-k2-thinking': 400,
    'kimi-k2-thinking-turbo': 420,
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

// 【临时修复接口】强制重置功能开关配置
app.get('/api/admin/fix-config', (req, res) => {
  try {
    // 强制将功能开关设置为 false（开放创作）
    setConfig('web_create_disabled', 'false');
    setConfig('web_edit_disabled', 'false');
    setConfig('web_interact_disabled', 'false');
    setConfig('web_write_disabled', 'false');
    
    console.log('[CONFIG] 已强制重置功能开关配置为 false');
    
    res.json({ 
      success: true, 
      message: '功能开关已重置',
      configs: {
        web_create_disabled: 'false',
        web_edit_disabled: 'false',
        web_interact_disabled: 'false',
        web_write_disabled: 'false'
      }
    });
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
    console.log('[CONFIG] 收到保存请求:', JSON.stringify(configs));
    
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

// 测试 SMTP 配置 - 发送测试邮件
app.post('/api/admin/test-smtp', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({ success: false, error: '请提供测试邮箱地址' });
    }
    
    // 获取 SMTP 配置
    const smtpConfig = getSmtpConfig();
    if (!smtpConfig) {
      return res.status(400).json({ success: false, error: 'SMTP 未配置，请先填写 SMTP 服务器信息' });
    }
    
    // 生成测试邮件内容
    const testHtml = `
      <div style="max-width: 500px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">📧 SMTP 配置测试</h1>
        </div>
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            ✅ 恭喜！您的 SMTP 邮件服务配置正确。
          </p>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
            如果您收到了这封邮件，说明邮件发送功能已经可以正常使用。
          </p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #374151; font-size: 13px; margin: 0;">
              <strong>SMTP 服务器:</strong> ${smtpConfig.host}:${smtpConfig.port}<br>
              <strong>发件人:</strong> ${smtpConfig.from || smtpConfig.auth.user}<br>
              <strong>发送时间:</strong> ${new Date().toLocaleString('zh-CN')}
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 20px 0 0 0; text-align: center;">
            此邮件由一句话游戏系统自动发送，请勿回复。
          </p>
        </div>
      </div>
    `;
    
    // 发送测试邮件
    await sendEmail(testEmail, '【一句话游戏】SMTP 配置测试成功', testHtml);
    
    console.log(`[SMTP] 测试邮件已发送到: ${testEmail}`);
    res.json({ success: true, message: '测试邮件已发送' });
  } catch (error) {
    console.error('[ERROR] SMTP 测试失败:', error.message);
    res.status(500).json({ success: false, error: '发送失败: ' + error.message });
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

// ==================== 管理员：重新生成单个游戏静态文件 ====================
app.post('/api/admin/games/:id/regenerate', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { id } = req.params;
    
    const game = db.prepare(`
      SELECT id, title, prompt, code, author_name, author_token, created_at 
      FROM games WHERE id = ?
    `).get(id);
    
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 重新生成静态文件
    saveGameStaticFile(game.id, game.code, {
      title: game.title,
      authorName: game.author_name,
      prompt: game.prompt,
      authorToken: game.author_token,
      created_at: game.created_at
    });
    
    console.log(`[ADMIN] 已重新生成游戏静态文件: ${game.id}`);
    
    res.json({ success: true, message: '静态文件已重新生成' });
  } catch (error) {
    console.error('[ERROR] 重新生成静态文件失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AI修复任务队列 ====================
const repairTaskQueue = new Map(); // 存储正在进行的修复任务

// 获取AI修复的API配置
function getRepairApiConfig() {
  // 1. 首先获取默认模型ID
  const defaultModelId = getConfig('llm_default_model', 'deepseek-chat');
  
  // 2. 获取该模型的API key
  const modelApiKey = getConfig(`llm_apikey_${defaultModelId}`, '');
  
  if (modelApiKey) {
    // 从 LLM_MODELS 获取模型配置信息
    const modelConfig = LLM_MODELS[defaultModelId];
    const provider = modelConfig?.provider || 'deepseek';
    const actualModelName = modelConfig?.model || defaultModelId;
    const baseUrl = modelConfig?.baseUrl || 'https://api.deepseek.com';
    
    return {
      apiKey: modelApiKey,
      model: actualModelName,
      baseUrl: baseUrl,
      modelId: defaultModelId,
      provider: provider
    };
  }
  
  // 3. 尝试环境变量
  if (process.env.TRIAL_API_KEY) {
    return {
      apiKey: process.env.TRIAL_API_KEY,
      model: process.env.TRIAL_MODEL || 'deepseek-chat',
      baseUrl: process.env.TRIAL_BASE_URL || 'https://api.deepseek.com',
      modelId: 'env',
      provider: 'deepseek'
    };
  }
  
  return null;
}

// 后台执行AI修复任务（异步，不阻塞请求）
async function executeRepairTask(gameId, game, apiConfig, operator = 'admin') {
  const taskId = `repair_${gameId}_${Date.now()}`;
  
  try {
    // 保存 userToken 用于显示创作中任务和发送通知
    const userToken = (typeof operator === 'string' && operator !== 'admin') ? operator : null;
    repairTaskQueue.set(gameId, { taskId, status: 'running', startTime: Date.now(), userToken });
    console.log(`[AI-REPAIR] 开始后台修复任务: ${taskId}, userToken: ${userToken?.substring(0, 8) || 'admin'}`);
    
    // 构造修复Prompt
    const repairPrompt = `你是一个专业的前端代码修复专家。请分析以下HTML游戏代码，找出并修复其中的错误。

常见需要修复的问题包括：
1. JavaScript语法错误（未闭合的括号、引号、缺少分号等）
2. 未定义的变量或函数
3. DOM元素引用错误
4. 事件绑定问题
5. CSS样式问题
6. 资源加载失败的处理
7. 移动端兼容性问题
8. 性能问题（如内存泄漏）

原始游戏代码：
\`\`\`html
${game.code}
\`\`\`

请：
1. 仔细分析代码中的所有问题
2. 修复所有发现的问题
3. 确保游戏能正常运行

输出格式要求：
1. 首先输出修复摘要（列出修复了哪些问题），用 【修复摘要】 标记
2. 然后输出完整的修复后代码，用 \`\`\`html 包裹

示例：
【修复摘要】
1. 修复了XXX问题
2. 修复了YYY问题

\`\`\`html
<!DOCTYPE html>
...完整代码...
</html>
\`\`\``;

    // 获取模型的 temperature 配置（某些模型有特殊要求，如 kimi-k2.5 只支持 temperature=1）
    const aiRepairTemperature = apiConfig.modelId ? getModelTemperature(apiConfig.modelId, 0.3) : 0.3;
    // 获取模型的 max_tokens 配置（不同模型有不同的最大 token 限制，如 DeepSeek 最大 8192）
    const aiRepairMaxTokens = apiConfig.modelId ? getModelMaxTokens(apiConfig.modelId) : 8192;
    console.log(`[AI-REPAIR] 使用模型: ${apiConfig.model}, Temperature: ${aiRepairTemperature}, MaxTokens: ${aiRepairMaxTokens}`);

    // 调用LLM API
    // 智谱AI使用 /v4/chat/completions 端点
    const repairApiPath = apiConfig.provider === 'zhipu' ? '/v4/chat/completions' : '/v1/chat/completions';
    const response = await fetch(`${apiConfig.baseUrl}${repairApiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model,
        messages: [
          { role: 'system', content: '你是一个专业的游戏代码修复专家，擅长分析和修复HTML/CSS/JavaScript代码中的问题。' },
          { role: 'user', content: repairPrompt }
        ],
        temperature: aiRepairTemperature,
        max_tokens: aiRepairMaxTokens
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI-REPAIR] LLM API错误 (${taskId}):`, errorText);
      const failedTask = repairTaskQueue.get(gameId);
      repairTaskQueue.set(gameId, { ...failedTask, taskId, status: 'failed', error: 'AI服务调用失败', endTime: Date.now() });
      return;
    }
    
    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content || '';
    
    if (!aiResponse) {
      console.error(`[AI-REPAIR] AI未返回有效响应 (${taskId})`);
      const failedTask = repairTaskQueue.get(gameId);
      repairTaskQueue.set(gameId, { ...failedTask, taskId, status: 'failed', error: 'AI未返回有效响应', endTime: Date.now() });
      return;
    }
    
    // 提取修复摘要
    let repairSummary = '';
    const summaryMatch = aiResponse.match(/【修复摘要】([\s\S]*?)```/);
    if (summaryMatch) {
      repairSummary = summaryMatch[1].trim();
    }
    
    // 提取修复后的代码
    const repairedCode = extractHtmlFromResponse(aiResponse);
    
    if (!repairedCode || repairedCode.length < 100) {
      console.error(`[AI-REPAIR] AI未返回有效的修复代码 (${taskId})`);
      const failedTask = repairTaskQueue.get(gameId);
      repairTaskQueue.set(gameId, { ...failedTask, taskId, status: 'failed', error: 'AI未返回有效的修复代码', endTime: Date.now() });
      return;
    }
    
    // 更新数据库中的代码
    db.prepare('UPDATE games SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(repairedCode, gameId);
    
    // 重新生成静态文件
    saveGameStaticFile(game.id, repairedCode, {
      title: game.title,
      authorName: game.author_name,
      prompt: game.prompt,
      authorToken: game.author_token,
      created_at: game.created_at
    });
    
    const existingTask = repairTaskQueue.get(gameId);
    const duration = ((Date.now() - existingTask.startTime) / 1000).toFixed(1);
    console.log(`[AI-REPAIR] ✅ 游戏修复完成 (${taskId}): ${game.title}, 耗时 ${duration}s`);
    if (repairSummary) {
      console.log(`[AI-REPAIR] 修复摘要: ${repairSummary.substring(0, 200)}...`);
    }
    
    // 保留订阅信息，只更新状态
    repairTaskQueue.set(gameId, { 
      ...existingTask,  // 保留原有字段（包括 subscribeNotify, wechatOpenId, userToken）
      taskId, 
      status: 'completed', 
      repairSummary: repairSummary || '已完成代码分析和修复',
      endTime: Date.now(),
      duration: duration
    });
    
    // ===== 发送订阅消息通知（修复完成，基于任务订阅状态） =====
    // 使用更新后的任务信息（保留了订阅状态）
    const currentRepairTask = repairTaskQueue.get(gameId);
    if (currentRepairTask && currentRepairTask.subscribeNotify && currentRepairTask.wechatOpenId) {
      try {
        console.log(`[AI-REPAIR] 用户已订阅此任务，准备发送通知`);
        await wechatUtils.sendGameCreatedNotification({
          openId: currentRepairTask.wechatOpenId,
          gameName: game.title || '您的游戏',
          gameId: gameId,
          status: '修复完成'
        });
        console.log(`[AI-REPAIR] 订阅消息通知发送成功`);
      } catch (notifyErr) {
        console.error(`[AI-REPAIR] 发送通知失败:`, notifyErr.message);
      }
    } else if (currentRepairTask && !currentRepairTask.subscribeNotify) {
      console.log(`[AI-REPAIR] 用户未订阅此任务，跳过通知`);
    }
    
    // 10分钟后清理任务记录
    setTimeout(() => {
      repairTaskQueue.delete(gameId);
    }, 10 * 60 * 1000);
    
  } catch (error) {
    console.error(`[AI-REPAIR] 修复任务异常 (${taskId}):`, error);
    const failedTask = repairTaskQueue.get(gameId) || {};
    repairTaskQueue.set(gameId, { ...failedTask, taskId, status: 'failed', error: error.message, endTime: Date.now() });
  }
}

// ==================== 管理员：AI修复游戏代码（异步后台任务） ====================
app.post('/api/admin/games/:id/ai-repair', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { id } = req.params;
    
    // 检查是否已有修复任务在进行
    const existingTask = repairTaskQueue.get(id);
    if (existingTask && existingTask.status === 'running') {
      return res.json({ 
        success: true, 
        message: '该游戏已有修复任务正在进行中，请稍后查看',
        taskId: existingTask.taskId,
        status: 'already_running'
      });
    }
    
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 获取API配置
    const apiConfig = getRepairApiConfig();
    if (!apiConfig) {
      const defaultModelId = getConfig('llm_default_model', 'deepseek-chat');
      return res.status(500).json({ 
        success: false, 
        error: `未找到默认模型(${defaultModelId})的API Key。请在管理后台"大模型"页面为该模型配置API Key` 
      });
    }
    
    console.log(`[AI-REPAIR] 收到修复请求: ${id} - ${game.title}`);
    console.log(`[AI-REPAIR] 使用模型: ${apiConfig.modelId} -> ${apiConfig.model}`);
    
    // 立即返回响应，后台异步执行修复
    res.json({ 
      success: true, 
      message: '修复任务已启动，将在后台自动完成。完成后游戏代码会自动更新。',
      gameId: id,
      gameTitle: game.title,
      status: 'started'
    });
    
    // 异步执行修复任务（不等待完成）
    executeRepairTask(id, game, apiConfig, 'admin');
    
  } catch (error) {
    console.error('[ERROR] 启动AI修复失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查询修复任务状态
app.get('/api/admin/games/:id/repair-status', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  const { id } = req.params;
  const task = repairTaskQueue.get(id);
  
  if (!task) {
    return res.json({ success: true, status: 'none', message: '没有进行中的修复任务' });
  }
  
  res.json({ success: true, ...task });
});

// ==================== 用户版：AI修复游戏代码（异步后台任务） ====================
app.post('/api/games/:id/repair', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    const { id } = req.params;
    const { creditCost } = req.body;
    
    // 验证用户登录
    if (!userToken) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }
    
    // 验证积分消耗参数
    const REPAIR_CREDIT_COST = creditCost || 0.5;
    
    // 获取游戏信息
    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 验证用户权限（只有作者或管理员可以修复）
    const isAuthor = game.author_token === userToken;
    const isAdmin = isUserAdmin(userToken);
    
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ success: false, error: '只有游戏作者可以修复游戏' });
    }
    
    // 检查是否已有修复任务在进行
    const existingTask = repairTaskQueue.get(id);
    if (existingTask && existingTask.status === 'running') {
      return res.json({ 
        success: true, 
        message: '该游戏已有修复任务正在进行中，请稍后刷新页面查看',
        status: 'already_running'
      });
    }
    
    // 检查用户积分（管理员免费）
    if (!isAdmin) {
      const userCredits = db.prepare('SELECT credits FROM user_credits WHERE user_token = ?').get(userToken);
      if (!userCredits || userCredits.credits < REPAIR_CREDIT_COST) {
        return res.status(400).json({ 
          success: false, 
          error: `积分不足，修复需要 ${REPAIR_CREDIT_COST} 积分` 
        });
      }
      
      // 扣除积分
      db.prepare('UPDATE user_credits SET credits = credits - ?, total_used = total_used + ? WHERE user_token = ?')
        .run(REPAIR_CREDIT_COST, REPAIR_CREDIT_COST, userToken);
      db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
        .run(userToken, -REPAIR_CREDIT_COST, 'repair_game', `AI修复游戏: ${game.title}`);
      
      console.log(`[AI-REPAIR] 用户 ${userToken} 消耗 ${REPAIR_CREDIT_COST} 积分修复游戏`);
    }
    
    // 获取API配置
    const apiConfig = getRepairApiConfig();
    if (!apiConfig) {
      // 如果没有API配置，退还积分
      if (!isAdmin) {
        db.prepare('UPDATE user_credits SET credits = credits + ?, total_used = total_used - ? WHERE user_token = ?')
          .run(REPAIR_CREDIT_COST, REPAIR_CREDIT_COST, userToken);
      }
      return res.status(500).json({ 
        success: false, 
        error: '系统未配置AI服务，请联系管理员' 
      });
    }
    
    console.log(`[AI-REPAIR] 用户修复请求: ${id} - ${game.title}`);
    console.log(`[AI-REPAIR] 使用模型: ${apiConfig.modelId} -> ${apiConfig.model}`);
    
    // 立即返回响应，后台异步执行修复
    res.json({ 
      success: true, 
      message: '修复任务已启动！AI正在后台分析并修复代码，完成后请刷新页面查看。',
      gameId: id,
      status: 'started'
    });
    
    // 异步执行修复任务（不等待完成）
    executeRepairTask(id, game, apiConfig, userToken);
    
  } catch (error) {
    console.error('[ERROR] 启动用户AI修复失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 用户查询修复任务状态
app.get('/api/games/:id/repair-status', (req, res) => {
  const userToken = req.headers['x-user-token'];
  const { id } = req.params;
  
  // 获取游戏信息验证权限
  const game = db.prepare('SELECT author_token FROM games WHERE id = ?').get(id);
  if (!game) {
    return res.status(404).json({ success: false, error: '游戏不存在' });
  }
  
  // 只有作者或管理员可以查询
  const isAuthor = game.author_token === userToken;
  const isAdmin = isUserAdmin(userToken);
  
  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ success: false, error: '无权限查看' });
  }
  
  const task = repairTaskQueue.get(id);
  
  if (!task) {
    return res.json({ success: true, status: 'none', message: '没有进行中的修复任务' });
  }
  
  res.json({ success: true, ...task });
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
      // 搜索模式：按昵称、账号ID、Token或邮箱搜索
      const searchPattern = `%${search}%`;
      
      total = db.prepare(`
        SELECT COUNT(*) as count 
        FROM user_credits uc
        LEFT JOIN user_accounts ua ON uc.user_token = ua.user_token
        WHERE uc.user_token LIKE ? 
           OR ua.account_id LIKE ? 
           OR ua.nickname LIKE ?
           OR ua.email LIKE ?
      `).get(searchPattern, searchPattern, searchPattern, searchPattern).count;
      
      users = db.prepare(`
        SELECT uc.user_token, uc.credits, uc.total_earned, uc.total_used, uc.followed_wechat, 
               uc.ad_count_today, uc.created_at, uc.updated_at,
               ua.account_id, ua.nickname, ua.is_admin, ua.email, ua.email_verified
        FROM user_credits uc
        LEFT JOIN user_accounts ua ON uc.user_token = ua.user_token
        WHERE uc.user_token LIKE ? 
           OR ua.account_id LIKE ? 
           OR ua.nickname LIKE ?
           OR ua.email LIKE ?
        ORDER BY uc.created_at DESC 
        LIMIT ? OFFSET ?
      `).all(searchPattern, searchPattern, searchPattern, searchPattern, limit, offset);
    } else {
      // 正常模式
      total = db.prepare('SELECT COUNT(*) as count FROM user_credits').get().count;
      
      users = db.prepare(`
        SELECT uc.user_token, uc.credits, uc.total_earned, uc.total_used, uc.followed_wechat, 
               uc.ad_count_today, uc.created_at, uc.updated_at,
               ua.account_id, ua.nickname, ua.is_admin, ua.email, ua.email_verified
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

// 设置/取消用户管理员权限（管理员）
app.post('/api/admin/users/:userToken/set-admin', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { userToken } = req.params;
    const { isAdmin } = req.body;
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户Token' });
    }
    
    // 检查用户是否存在
    const user = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    // 更新管理员状态
    const adminValue = isAdmin ? 1 : 0;
    db.prepare('UPDATE user_accounts SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE user_token = ?')
      .run(adminValue, userToken);
    
    console.log(`[管理员设置] 用户 ${user.account_id || userToken} 管理员权限已${isAdmin ? '开启' : '关闭'}`);
    
    res.json({ 
      success: true, 
      message: isAdmin ? '已设置为管理员' : '已取消管理员权限',
      user_token: userToken,
      is_admin: adminValue
    });
  } catch (error) {
    console.error('[管理员设置] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 管理员重置用户密码（不需要原密码）
app.post('/api/admin/users/:userToken/reset-password', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { userToken } = req.params;
    const { newPassword } = req.body;
    
    if (!userToken) {
      return res.status(400).json({ success: false, error: '缺少用户Token' });
    }
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: '新密码至少需要6位' });
    }
    
    // 检查用户是否存在
    const user = db.prepare('SELECT * FROM user_accounts WHERE user_token = ?').get(userToken);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    // 设置新密码
    const passwordHash = hashPassword(newPassword);
    db.prepare('UPDATE user_accounts SET password_hash = ?, has_password = 1, updated_at = CURRENT_TIMESTAMP WHERE user_token = ?')
      .run(passwordHash, userToken);
    
    console.log(`[管理员操作] 已重置用户 ${user.account_id || userToken} 的密码`);
    
    res.json({ 
      success: true, 
      message: '密码重置成功',
      user_token: userToken,
      account_id: user.account_id
    });
  } catch (error) {
    console.error('[管理员重置密码] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量发送邮件给用户（管理员）
app.post('/api/admin/send-batch-email', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const { userTokens, subject, content } = req.body;
    
    // 参数验证
    if (!userTokens || !Array.isArray(userTokens) || userTokens.length === 0) {
      return res.status(400).json({ success: false, error: '请选择至少一个用户' });
    }
    
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, error: '请输入邮件主题' });
    }
    
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: '请输入邮件内容' });
    }
    
    // 限制一次发送的最大数量
    const maxBatch = 50;
    if (userTokens.length > maxBatch) {
      return res.status(400).json({ success: false, error: `单次最多发送 ${maxBatch} 封邮件` });
    }
    
    // 查询用户邮箱（仅已验证的邮箱）
    const placeholders = userTokens.map(() => '?').join(',');
    const users = db.prepare(`
      SELECT user_token, account_id, nickname, email
      FROM user_accounts
      WHERE user_token IN (${placeholders})
        AND email IS NOT NULL AND email != ''
        AND email_verified = 1
    `).all(...userTokens);
    
    if (users.length === 0) {
      return res.status(400).json({ success: false, error: '所选用户中没有已验证邮箱的用户' });
    }
    
    // 生成邮件HTML模板
    const siteName = getConfig('site_name', '一句话游戏');
    const generateEmailHtml = (userContent) => {
      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject.trim()}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #fff; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
        <h1 style="margin: 0; color: #fff; font-size: 24px;">${siteName}</h1>
      </div>
      
      <!-- Content -->
      <div style="padding: 40px 30px;">
        ${userContent}
      </div>
      
      <!-- Footer -->
      <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #999; font-size: 12px;">此邮件由管理员发送</p>
        <p style="margin: 8px 0 0; color: #bbb; font-size: 12px;">© ${new Date().getFullYear()} ${siteName}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
    };
    
    // 批量发送邮件
    const results = {
      total: users.length,
      success: 0,
      failed: 0,
      failures: []
    };
    
    const emailHtml = generateEmailHtml(content.trim());
    
    for (const user of users) {
      try {
        const result = await sendEmail(user.email, subject.trim(), emailHtml);
        if (result.success) {
          results.success++;
          console.log(`[BATCH-EMAIL] 发送成功: ${user.email}`);
        } else {
          results.failed++;
          results.failures.push({
            email: user.email,
            nickname: user.nickname || user.account_id,
            error: result.error
          });
          console.log(`[BATCH-EMAIL] 发送失败: ${user.email} - ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        results.failures.push({
          email: user.email,
          nickname: user.nickname || user.account_id,
          error: error.message
        });
        console.error(`[BATCH-EMAIL] 发送异常: ${user.email} - ${error.message}`);
      }
      
      // 避免发送过快被限制，每封邮件间隔 100ms
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`[BATCH-EMAIL] 批量发送完成: 成功 ${results.success}/${results.total}`);
    
    res.json({
      success: true,
      message: `发送完成：成功 ${results.success} 封，失败 ${results.failed} 封`,
      results
    });
  } catch (error) {
    console.error('[批量发送邮件] 错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取管理员列表（管理员）
app.get('/api/admin/admins', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: '无权限' });
  }
  
  try {
    const admins = db.prepare(`
      SELECT ua.user_token, ua.account_id, ua.nickname, ua.created_at, ua.updated_at
      FROM user_accounts ua
      WHERE ua.is_admin = 1
      ORDER BY ua.updated_at DESC
    `).all();
    
    res.json({ success: true, admins });
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
      // 检查是否有通配符 * 或者具体匹配
      const whitelist = db.prepare(`
        SELECT value FROM devtools_whitelist 
        WHERE (type = 'account' AND (value = ? OR value = '*')) 
           OR (type = 'ip' AND (value = ? OR value = '*'))
      `).get(accountId || '', clientIP);
      result.allowDevTools = !!whitelist;
      console.log(`[DevTools] 检查白名单: accountId=${accountId}, IP=${clientIP}, 结果=${result.allowDevTools}`);
    } catch (e) {
      console.error('[DevTools] 白名单检查失败:', e.message);
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
    res.json({ success: true, games: addGamesFieldAliases(games) });
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
    
    res.json({ success: true, games: addGamesFieldAliases(games) });
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
    
    res.json({ success: true, games: addGamesFieldAliases(games) });
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
      games: addGamesFieldAliases(games),
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
    res.json({ success: true, games: addGamesFieldAliases(games) });
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
    res.json({ success: true, games: addGamesFieldAliases(games) });
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
    
    res.json({ success: true, games: addGamesFieldAliases(games), period });
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
    
    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = parseInt(getConfig('credits_share_game_daily_limit', '5'));
    const reward = parseFloat(getConfig('credits_share_game', '1'));
    
    // 检查今日是否已达上限
    const dailyRecord = db.prepare(
      'SELECT count FROM daily_action_credits WHERE user_token = ? AND action_type = ? AND action_date = ?'
    ).get(userToken, 'share_game', today);
    const currentCount = dailyRecord?.count || 0;
    
    if (currentCount >= dailyLimit) {
      return res.json({ 
        success: true, 
        limitReached: true, 
        message: '今日分享奖励已达上限',
        todayCount: currentCount,
        dailyLimit
      });
    }
    
    // 更新每日计数
    db.prepare(`
      INSERT INTO daily_action_credits (user_token, action_type, action_date, count)
      VALUES (?, 'share_game', ?, 1)
      ON CONFLICT(user_token, action_type, action_date) DO UPDATE SET count = count + 1
    `).run(userToken, today);
    
    // 发放积分
    db.prepare('UPDATE user_credits SET credits = credits + ?, total_earned = total_earned + ? WHERE user_token = ?')
      .run(reward, reward, userToken);
    db.prepare('INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, ?, ?)')
      .run(userToken, reward, 'share', '分享游戏奖励');
    
    const newCount = currentCount + 1;
    const remaining = dailyLimit - newCount;
    
    return res.json({ 
      success: true, 
      earned: reward, 
      message: `分享成功，获得 ${reward} 次生成机会！`,
      todayCount: newCount,
      dailyLimit,
      remaining
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重新生成游戏静态文件（用于批量更新模板后同步）
app.post('/api/games/:id/regenerate', (req, res) => {
  try {
    const gameId = req.params.id;
    
    // 获取游戏信息
    const game = db.prepare('SELECT * FROM games WHERE id = ? AND is_deleted = 0').get(gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    // 重新生成静态文件
    const gameInfo = {
      title: game.title || '未命名游戏',
      author: game.author || '匿名',
      authorToken: game.author_token || '',
      createdAt: game.created_at
    };
    
    const finalCode = generatePromoBarHtml(game.code, gameId, gameInfo);
    
    // 写入静态文件
    const prefix = gameId.substring(0, 2);
    const gameDir = path.join(__dirname, 'public', 'g', prefix);
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }
    
    const filePath = path.join(gameDir, `${gameId}.html`);
    fs.writeFileSync(filePath, finalCode, 'utf8');
    
    console.log(`[重新生成] 游戏静态文件已更新: ${gameId}`);
    res.json({ success: true, gameId });
  } catch (error) {
    console.error('[重新生成] 失败:', error);
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

// ==================== 作者榜单系统 ====================

// 创建榜单排除表
db.exec(`
  CREATE TABLE IF NOT EXISTS leaderboard_excludes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT UNIQUE NOT NULL,
    exclude_types TEXT DEFAULT 'all',
    reason TEXT,
    operator TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 获取作者榜单数据
app.get('/api/author-leaderboard/:type', (req, res) => {
  try {
    const { type } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const period = req.query.period || 'all';
    const userToken = req.headers['x-user-token'];
    
    const validTypes = ['fans', 'works', 'credits', 'popularity', 'newstar'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: '无效的榜单类型' });
    }
    
    let periodCondition = '';
    let periodLabel = '总榜';
    if (period === 'week') {
      periodCondition = "AND ua.created_at >= datetime('now', '-7 days')";
      periodLabel = '周榜';
    } else if (period === 'month') {
      periodCondition = "AND ua.created_at >= datetime('now', '-30 days')";
      periodLabel = '月榜';
    }
    
    // 获取排除名单
    let excludeTokens = [];
    try {
      excludeTokens = db.prepare(`
        SELECT user_token FROM leaderboard_excludes 
        WHERE exclude_types LIKE '%all%' OR exclude_types LIKE ?
      `).all(`%${type}%`).map(r => r.user_token);
    } catch (e) {
      // 表可能不存在，忽略
    }
    
    const excludeCondition = excludeTokens.length > 0 
      ? `AND ua.user_token NOT IN (${excludeTokens.map(() => '?').join(',')})` 
      : '';
    
    let query, countQuery, params, countParams;
    let title, valueLabel;
    
    switch (type) {
      case 'fans':
        title = '🏆 粉丝榜';
        valueLabel = '粉丝';
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname,
            (SELECT COUNT(*) FROM user_follows WHERE following_token = ua.user_token) as value
          FROM user_accounts ua
          WHERE 1=1 ${excludeCondition}
          ORDER BY value DESC
          LIMIT ? OFFSET ?
        `;
        countQuery = `SELECT COUNT(*) as total FROM user_accounts ua WHERE 1=1 ${excludeCondition}`;
        params = [...excludeTokens, limit, offset];
        countParams = [...excludeTokens];
        break;
        
      case 'works':
        title = '📚 作品榜';
        valueLabel = '作品';
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname,
            (SELECT COUNT(*) FROM games WHERE author_token = ua.user_token AND is_hidden = 0) as value
          FROM user_accounts ua
          WHERE 1=1 ${excludeCondition}
          ORDER BY value DESC
          LIMIT ? OFFSET ?
        `;
        countQuery = `SELECT COUNT(*) as total FROM user_accounts ua WHERE 1=1 ${excludeCondition}`;
        params = [...excludeTokens, limit, offset];
        countParams = [...excludeTokens];
        break;
        
      case 'credits':
        title = '💎 积分榜';
        valueLabel = '积分';
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname,
            COALESCE(uc.credits, 0) as value
          FROM user_accounts ua
          LEFT JOIN user_credits uc ON ua.user_token = uc.user_token
          WHERE 1=1 ${excludeCondition}
          ORDER BY value DESC
          LIMIT ? OFFSET ?
        `;
        countQuery = `SELECT COUNT(*) as total FROM user_accounts ua WHERE 1=1 ${excludeCondition}`;
        params = [...excludeTokens, limit, offset];
        countParams = [...excludeTokens];
        break;
        
      case 'popularity':
        title = '🔥 人气榜';
        valueLabel = '人气值';
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname,
            COALESCE(SUM(g.like_count), 0) * 10 + COALESCE(SUM(g.play_count), 0) as value
          FROM user_accounts ua
          LEFT JOIN games g ON g.author_token = ua.user_token AND g.is_hidden = 0
          WHERE 1=1 ${excludeCondition} ${periodCondition}
          GROUP BY ua.user_token
          ORDER BY value DESC
          LIMIT ? OFFSET ?
        `;
        countQuery = `SELECT COUNT(*) as total FROM user_accounts ua WHERE 1=1 ${excludeCondition} ${periodCondition}`;
        params = [...excludeTokens, limit, offset];
        countParams = [...excludeTokens];
        break;
        
      case 'newstar':
        title = '⭐ 新星榜';
        valueLabel = '综合分';
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname, ua.created_at,
            (
              (SELECT COUNT(*) FROM user_follows WHERE following_token = ua.user_token) * 5 +
              (SELECT COUNT(*) FROM games WHERE author_token = ua.user_token AND is_hidden = 0) * 10 +
              COALESCE((SELECT SUM(like_count) FROM games WHERE author_token = ua.user_token AND is_hidden = 0), 0) * 2
            ) as value
          FROM user_accounts ua
          WHERE ua.created_at >= datetime('now', '-30 days') ${excludeCondition}
          ORDER BY value DESC
          LIMIT ? OFFSET ?
        `;
        countQuery = `SELECT COUNT(*) as total FROM user_accounts ua WHERE ua.created_at >= datetime('now', '-30 days') ${excludeCondition}`;
        params = [...excludeTokens, limit, offset];
        countParams = [...excludeTokens];
        break;
    }
    
    const list = db.prepare(query).all(...params);
    const totalResult = db.prepare(countQuery).get(...countParams);
    
    const avatarEmojis = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎸', '🎺', '🎻', '🎹'];
    const rankedList = list.map((item, index) => ({
      rank: offset + index + 1,
      user_token: item.user_token,
      account_id: item.account_id,
      nickname: item.nickname || item.account_id,
      avatar_emoji: avatarEmojis[Math.abs(item.user_token?.charCodeAt(0) || 0) % avatarEmojis.length],
      value: item.value || 0,
      label: valueLabel
    }));
    
    res.json({
      success: true,
      type,
      title: period !== 'all' ? `${title}·${periodLabel}` : title,
      period,
      periodLabel,
      list: rankedList,
      total: totalResult?.total || 0,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ERROR] 获取榜单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 榜单排除管理 - 获取排除名单
app.get('/api/admin/leaderboard/excludes', (req, res) => {
  try {
    const excludes = db.prepare(`
      SELECT le.*, ua.account_id, ua.nickname
      FROM leaderboard_excludes le
      LEFT JOIN user_accounts ua ON le.user_token = ua.user_token
      ORDER BY le.created_at DESC
    `).all();
    res.json({ success: true, excludes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 榜单排除管理 - 添加排除
app.post('/api/admin/leaderboard/exclude', (req, res) => {
  try {
    const { user_token, exclude_types, reason } = req.body;
    if (!user_token) {
      return res.status(400).json({ success: false, error: '缺少用户Token' });
    }
    const typesStr = Array.isArray(exclude_types) ? exclude_types.join(',') : (exclude_types || 'all');
    db.prepare(`
      INSERT INTO leaderboard_excludes (user_token, exclude_types, reason)
      VALUES (?, ?, ?)
      ON CONFLICT(user_token) DO UPDATE SET exclude_types = ?, reason = ?
    `).run(user_token, typesStr, reason || '', typesStr, reason || '');
    res.json({ success: true, message: '已添加到排除名单' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 榜单排除管理 - 移除排除
app.delete('/api/admin/leaderboard/exclude/:user_token', (req, res) => {
  try {
    const { user_token } = req.params;
    const result = db.prepare('DELETE FROM leaderboard_excludes WHERE user_token = ?').run(user_token);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '该用户不在排除名单中' });
    }
    res.json({ success: true, message: '已从排除名单中移除' });
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

// ==================== 管理员：重新生成所有静态文件 ====================

// 管理员API：强制重新生成所有游戏静态文件
app.post('/api/admin/regenerate-static', (req, res) => {
  try {
    const userToken = req.headers['x-user-token'];
    
    // 验证管理员权限
    if (!userToken || !isUserAdmin(userToken)) {
      return res.status(403).json({ success: false, error: '需要管理员权限' });
    }
    
    console.log('[ADMIN] 开始强制重新生成所有静态游戏文件...');
    
    const result = generateAllStaticFiles(true); // true = 强制重新生成
    
    if (result.success) {
      console.log(`[ADMIN] 静态文件重新生成完成: ${result.message}`);
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
    console.error('[ERROR] 重新生成静态文件失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 服务器启动 ====================

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🎮 一句话游戏服务器启动成功！`);
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
