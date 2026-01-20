/**
 * 批量更新游戏页面中的平台样式
 * 用于修复游戏源码与平台嵌入样式的冲突
 * 
 * 使用方法：node scripts/update-platform-styles.js
 */

const fs = require('fs');
const path = require('path');

// 需要添加的样式重置规则（放在 YXJ-PLATFORM-STYLE-START 之后的最前面）
const styleResetCSS = `
/* ====== 平台组件样式重置 - 防止被游戏源码覆盖 ====== */
/* 使用 all: unset 完全重置按钮样式 */
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
}
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
.yxj-btn-secondary {
  background: var(--bg-hover, #2d2d4a) !important;
  color: var(--text-secondary, #888) !important;
}
/* 重置其他平台按钮 */
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
`;

// 获取所有游戏HTML文件
function getGameFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getGameFiles(fullPath));
    } else if (item.endsWith('.html') && !item.includes('.bak')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 检查文件是否已经包含样式重置
function hasStyleReset(content) {
  return content.includes('平台组件样式重置 - 防止被游戏源码覆盖');
}

// 更新单个文件
function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // 检查是否有平台样式标记
    if (!content.includes('<!-- YXJ-PLATFORM-STYLE-START -->')) {
      console.log(`[跳过] ${filePath} - 没有平台样式标记`);
      return { status: 'skipped', reason: 'no-marker' };
    }
    
    // 检查是否已经包含样式重置
    if (hasStyleReset(content)) {
      console.log(`[跳过] ${filePath} - 已包含样式重置`);
      return { status: 'skipped', reason: 'already-updated' };
    }
    
    // 在 YXJ-PLATFORM-STYLE-START 后的 <style> 标签内注入样式重置
    // 查找模式: <!-- YXJ-PLATFORM-STYLE-START -->\n  <style>
    const pattern = /<!-- YXJ-PLATFORM-STYLE-START -->\s*\n\s*<style>/;
    const match = content.match(pattern);
    
    if (!match) {
      console.log(`[跳过] ${filePath} - 样式标记格式不匹配`);
      return { status: 'skipped', reason: 'format-mismatch' };
    }
    
    // 在 <style> 后注入样式重置
    const newContent = content.replace(pattern, 
      `<!-- YXJ-PLATFORM-STYLE-START -->\n  <style>${styleResetCSS}`
    );
    
    // 写回文件
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`[更新] ${filePath}`);
    return { status: 'updated' };
    
  } catch (error) {
    console.error(`[错误] ${filePath}: ${error.message}`);
    return { status: 'error', error: error.message };
  }
}

// 主函数
function main() {
  const gamesDir = path.join(__dirname, '..', 'public', 'g');
  
  if (!fs.existsSync(gamesDir)) {
    console.error(`游戏目录不存在: ${gamesDir}`);
    process.exit(1);
  }
  
  console.log('开始更新游戏页面的平台样式...\n');
  
  const files = getGameFiles(gamesDir);
  console.log(`找到 ${files.length} 个游戏文件\n`);
  
  const stats = {
    updated: 0,
    skipped: 0,
    errors: 0
  };
  
  for (const file of files) {
    const result = updateFile(file);
    if (result.status === 'updated') {
      stats.updated++;
    } else if (result.status === 'skipped') {
      stats.skipped++;
    } else {
      stats.errors++;
    }
  }
  
  console.log('\n========== 更新完成 ==========');
  console.log(`已更新: ${stats.updated} 个文件`);
  console.log(`已跳过: ${stats.skipped} 个文件`);
  console.log(`错误: ${stats.errors} 个文件`);
}

main();
