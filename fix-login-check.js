/**
 * 批量修复游戏详情页的登录检测函数
 * 将旧的只检查 aigame-jwt 的逻辑替换为同时检查多种登录凭证的新逻辑
 */

const fs = require('fs');
const path = require('path');

const gDir = path.join(__dirname, 'public', 'g');

// 旧的登录检测代码（需要匹配的模式）
const oldPattern = /function isWebLoggedIn\(\) \{\s*const jwt = localStorage\.getItem\('aigame-jwt'\);\s*return jwt && jwt\.length > 0;\s*\}/g;

// 新的登录检测代码
const newCode = `function isWebLoggedIn() {
  const jwt = localStorage.getItem('aigame-jwt');
  if (jwt && jwt.length > 0) return true;
  const userToken = localStorage.getItem('aigame-user-token');
  if (userToken && userToken.length > 0) return true;
  const authorToken = localStorage.getItem('aigame-author-token');
  if (authorToken && authorToken.length > 0) return true;
  return false;
}`;

let totalFiles = 0;
let updatedFiles = 0;
let errorFiles = 0;

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (oldPattern.test(content)) {
      // 重置正则表达式的lastIndex
      oldPattern.lastIndex = 0;
      content = content.replace(oldPattern, newCode);
      fs.writeFileSync(filePath, content, 'utf8');
      updatedFiles++;
      console.log(`✅ 已更新: ${filePath}`);
    }
  } catch (err) {
    errorFiles++;
    console.error(`❌ 处理失败: ${filePath}`, err.message);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.html')) {
      totalFiles++;
      processFile(filePath);
    }
  }
}

console.log('🔧 开始批量修复游戏详情页的登录检测函数...\n');

if (fs.existsSync(gDir)) {
  walkDir(gDir);
  console.log(`\n📊 处理完成！`);
  console.log(`   总文件数: ${totalFiles}`);
  console.log(`   已更新: ${updatedFiles}`);
  console.log(`   失败: ${errorFiles}`);
} else {
  console.log('❌ public/g 目录不存在');
}
