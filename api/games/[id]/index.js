// /api/games/[id] - 游戏CRUD操作
const db = require('../../_lib/db');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
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
      
      // 增加播放次数
      await db.incrementPlayCount(id);
      
      // 返回游戏（不含 author_token）
      const { author_token, ...gameData } = game;
      
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
      const { title, prompt, code, authorName, authorToken } = req.body;
      
      // 验证作者权限
      const isAuthor = await db.verifyAuthor(id, authorToken);
      
      if (!isAuthor) {
        return res.status(403).json({ success: false, error: '无权限编辑此游戏' });
      }
      
      await db.updateGame(id, {
        title,
        prompt,
        code,
        author_name: authorName
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('更新游戏失败:', error);
      res.status(500).json({ success: false, error: error.message });
    }
    return;
  }
  
  res.status(405).json({ success: false, error: 'Method not allowed' });
};
