// GET /api/games/search/[keyword] - 搜索游戏
const db = require('../../_lib/db');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ success: false, error: '请输入搜索关键词' });
    }
    
    const games = await db.searchGames(keyword);
    
    res.status(200).json({ success: true, games });
  } catch (error) {
    console.error('搜索游戏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
