/**
 * 批量重新生成所有游戏的静态HTML文件
 * 用于更新静态页面模板（如添加全屏功能）后，同步更新已有游戏
 * 
 * 使用方法: node scripts/regenerate-static-games.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// 数据库路径
const DB_PATH = path.join(__dirname, '..', 'games.db');
const GAMES_DIR = path.join(__dirname, '..', 'public', 'g');

// 检查数据库是否存在
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ 数据库文件不存在:', DB_PATH);
  process.exit(1);
}

// 连接数据库
const db = new Database(DB_PATH);

// 获取所有游戏
function getAllGames() {
  try {
    const stmt = db.prepare(`
      SELECT id, title, author, author_token, created_at, code 
      FROM games 
      WHERE is_deleted = 0
      ORDER BY created_at DESC
    `);
    return stmt.all();
  } catch (err) {
    console.error('查询游戏失败:', err);
    return [];
  }
}

// 生成静态HTML（复用server.js中的逻辑）
function generateStaticHtml(game) {
  const gameId = game.id;
  const safeTitle = (game.title || '未命名游戏').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeAuthor = (game.author || '匿名').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const authorToken = game.author_token || '';
  const publishTime = game.created_at ? new Date(game.created_at).toLocaleDateString('zh-CN') : '';
  
  // 这里需要引入server.js中的generatePromoBarHtml函数
  // 为简化，我们直接调用服务器API来重新生成
  return null;
}

// 调用服务器API重新生成静态文件
async function regenerateGame(gameId) {
  try {
    // 读取游戏信息
    const stmt = db.prepare('SELECT * FROM games WHERE id = ?');
    const game = stmt.get(gameId);
    
    if (!game) {
      return { success: false, error: '游戏不存在' };
    }
    
    // 获取游戏代码
    const code = game.code;
    if (!code) {
      return { success: false, error: '游戏代码为空' };
    }
    
    // 计算目录
    const prefix = gameId.substring(0, 2);
    const gameDir = path.join(GAMES_DIR, prefix);
    const filePath = path.join(gameDir, `${gameId}.html`);
    
    // 确保目录存在
    if (!fs.existsSync(gameDir)) {
      fs.mkdirSync(gameDir, { recursive: true });
    }
    
    // 这里我们需要服务器运行才能生成完整的HTML
    // 因为generatePromoBarHtml函数在server.js中
    // 所以我们通过HTTP请求来触发重新生成
    
    return { success: true, needsServer: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('  批量重新生成游戏静态文件');
  console.log('========================================\n');
  
  const games = getAllGames();
  console.log(`找到 ${games.length} 个游戏需要处理\n`);
  
  if (games.length === 0) {
    console.log('没有需要处理的游戏');
    db.close();
    return;
  }
  
  console.log('⚠️  注意：此脚本需要服务器运行中才能完成重新生成');
  console.log('请确保服务器已启动（npm start）\n');
  console.log('正在通过API触发重新生成...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const game of games) {
    try {
      // 通过API触发保存操作来重新生成静态文件
      const response = await fetch(`http://localhost:3000/api/games/${game.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        console.log(`✓ ${game.id} - ${game.title}`);
        successCount++;
      } else {
        console.log(`✗ ${game.id} - ${game.title} (API错误)`);
        failCount++;
      }
    } catch (err) {
      console.log(`✗ ${game.id} - ${game.title} (${err.message})`);
      failCount++;
    }
    
    // 稍微延迟，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n========================================');
  console.log(`完成: ${successCount} 成功, ${failCount} 失败`);
  console.log('========================================');
  
  db.close();
}

// 检查是否有 --direct 参数（直接写文件模式）
const isDirect = process.argv.includes('--direct');

if (isDirect) {
  console.log('直接模式暂不支持，请使用服务器API模式');
  console.log('运行: npm start 启动服务器后，再运行此脚本');
} else {
  main().catch(err => {
    console.error('执行失败:', err);
    process.exit(1);
  });
}
