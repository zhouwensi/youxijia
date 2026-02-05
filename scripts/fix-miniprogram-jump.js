/**
 * 修复静态游戏页面中的小程序跳转逻辑
 * 
 * 问题：openMiniprogramQRPanel 函数使用了无效的 URL Scheme 格式
 * 解决：改为调用 showMiniprogramGuide 显示引导弹窗
 */

const fs = require('fs');
const path = require('path');

const GAME_DIR = path.join(__dirname, '..', 'public', 'g');

// 需要替换的旧代码模式（支持多种可能的格式）
const OLD_CODE_PATTERNS = [
  // 匹配完整的 openMiniprogramQRPanel 函数定义
  /\/\/ 打开小程序码面板\nfunction openMiniprogramQRPanel\(\) \{\n  \/\/ 尝试跳转到小程序\n  var mpPath = '\/pages\/credits\/credits';\n  window\.location\.href = 'weixin:\/\/dl\/business\/\?appid=wxb5b4b4a4a4a4a4a4&path=' \+ encodeURIComponent\(mpPath\);\n  \/\/ 如果无法跳转，显示提示\n  setTimeout\(function\(\) \{\n    alert\('请打开微信扫描小程序码领取积分\\n\\n或搜索小程序「游戏家」'\);\n  \}, 500\);\n\}/g,
  
  // 更宽松的匹配模式
  /\/\/ 打开小程序码面板\s*\nfunction openMiniprogramQRPanel\(\)\s*\{[\s\S]*?window\.location\.href\s*=\s*'weixin:\/\/dl\/business\/\?appid=wxb5b4b4a4a4a4a4a4[\s\S]*?\}\s*\}/g
];

// 新的代码
const NEW_CODE = `// 打开小程序码面板（显示引导弹窗，引导用户扫码或搜索小程序）
function openMiniprogramQRPanel() {
  // 显示小程序引导弹窗，引导用户扫码或搜索小程序领取积分
  showMiniprogramGuide('领取积分', '/pages/credits/credits');
}`;

// 统计信息
let stats = {
  total: 0,
  fixed: 0,
  skipped: 0,
  errors: []
};

/**
 * 递归遍历目录获取所有 HTML 文件
 */
function getAllHtmlFiles(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    console.log(`目录不存在: ${dir}`);
    return files;
  }
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      files.push(...getAllHtmlFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * 修复单个文件
 */
function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // 检查是否包含错误的代码
    if (content.includes("weixin://dl/business/?appid=wxb5b4b4a4a4a4a4a4")) {
      // 尝试各种模式进行替换
      for (const pattern of OLD_CODE_PATTERNS) {
        if (pattern.test(content)) {
          content = content.replace(pattern, NEW_CODE);
          modified = true;
          break;
        }
      }
      
      // 如果上面的模式都没匹配到，使用简单的字符串替换
      if (!modified) {
        const oldFuncStart = "// 打开小程序码面板\nfunction openMiniprogramQRPanel() {";
        const oldFuncEnd = "alert('请打开微信扫描小程序码领取积分\\n\\n或搜索小程序「游戏家」');\n  }, 500);\n}";
        
        if (content.includes(oldFuncStart)) {
          const startIdx = content.indexOf(oldFuncStart);
          const endIdx = content.indexOf(oldFuncEnd, startIdx);
          
          if (endIdx > startIdx) {
            const oldFunc = content.substring(startIdx, endIdx + oldFuncEnd.length);
            content = content.replace(oldFunc, NEW_CODE);
            modified = true;
          }
        }
      }
      
      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        stats.fixed++;
        return true;
      } else {
        // 还是包含错误代码但无法替换，标记为需要手动检查
        stats.errors.push({
          file: filePath,
          reason: '包含错误代码但无法自动替换'
        });
        return false;
      }
    } else {
      stats.skipped++;
      return false;
    }
  } catch (err) {
    stats.errors.push({
      file: filePath,
      reason: err.message
    });
    return false;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('='.repeat(60));
  console.log('修复静态游戏页面中的小程序跳转逻辑');
  console.log('='.repeat(60));
  console.log('');
  
  // 获取所有 HTML 文件
  const htmlFiles = getAllHtmlFiles(GAME_DIR);
  stats.total = htmlFiles.length;
  
  console.log(`找到 ${stats.total} 个 HTML 文件`);
  console.log('');
  
  // 逐个处理
  let progress = 0;
  for (const file of htmlFiles) {
    progress++;
    const relativePath = path.relative(GAME_DIR, file);
    
    if (fixFile(file)) {
      console.log(`[${progress}/${stats.total}] ✓ 已修复: ${relativePath}`);
    }
  }
  
  // 输出统计
  console.log('');
  console.log('='.repeat(60));
  console.log('修复完成');
  console.log('='.repeat(60));
  console.log(`总文件数: ${stats.total}`);
  console.log(`已修复:   ${stats.fixed}`);
  console.log(`跳过:     ${stats.skipped}`);
  console.log(`错误:     ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('');
    console.log('错误详情:');
    for (const err of stats.errors) {
      console.log(`  - ${err.file}: ${err.reason}`);
    }
  }
}

// 运行
main();
