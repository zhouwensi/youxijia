// /api/games/[id] - 游戏CRUD操作
const db = require('../../_lib/db');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Author-Token');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ success: false, error: '缺少游戏ID' });
  }
  
  // GET - 获取游戏详情
  if (req.method === 'GET') {
    try {
      const game = await db.getGame(id);
      
      if (!game) {
        return res.status(404).json({ success: false, error: '游戏不存在' });
      }
      
      // 如果游戏已删除，普通用户看不到
      if (game.is_deleted) {
        return res.status(404).json({ success: false, error: '游戏不存在' });
      }
      
      // 如果游戏是私密的，只有作者能看
      const authorToken = req.headers['x-author-token'];
      if (game.visibility === 'private' && game.author_token !== authorToken) {
        return res.status(404).json({ success: false, error: '游戏不存在' });
      }
      
      // 增加播放次数
      await db.incrementPlayCount(id);
      
      // 返回游戏（不含 author_token，但告诉用户是否是作者）
      const { author_token, ...gameData } = game;
      gameData.is_owner = (author_token === authorToken);
      
      res.status(200).json({ success: true, game: gameData });
    } catch (error) {
      console.error('获取游戏失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }
  
  // PUT - 更新游戏
  if (req.method === 'PUT') {
    try {
      const authorToken = req.headers['x-author-token'];
      const { title, prompt, code, authorName, visibility } = req.body;
      
      // 验证作者权限
      const isAuthor = await db.verifyAuthor(id, authorToken);
      
      if (!isAuthor) {
        return res.status(403).json({ success: false, error: '无权限编辑此游戏' });
      }
      
      // 构建更新对象
      const updates = {};
      if (title !== undefined) updates.title = title;
      if (prompt !== undefined) updates.prompt = prompt;
      if (code !== undefined) updates.code = code;
      if (authorName !== undefined) updates.author_name = authorName;
      if (visibility !== undefined) {
        // 验证可见性值
        if (!['public', 'private'].includes(visibility)) {
          return res.status(400).json({ success: false, error: '无效的可见性设置' });
        }
        updates.visibility = visibility;
      }
      
      await db.updateGame(id, updates);
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('更新游戏失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }
  
  // DELETE - 删除游戏（软删除）
  if (req.method === 'DELETE') {
    try {
      const authorToken = req.headers['x-author-token'];
      
      // 验证作者权限
      const isAuthor = await db.verifyAuthor(id, authorToken);
      
      if (!isAuthor) {
        return res.status(403).json({ success: false, error: '无权限删除此游戏' });
      }
      
      // 执行软删除
      await db.softDeleteGame(id);
      
      res.status(200).json({ success: true, message: '游戏已删除' });
    } catch (error) {
      console.error('删除游戏失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }
  
  res.status(405).json({ success: false, error: 'Method not allowed' });
};