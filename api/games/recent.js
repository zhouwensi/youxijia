// GET /api/games/recent - 获取最近游戏列表
const db = require('../_lib/db');

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
    const limit = parseInt(req.query.limit) || 12;
    const offset = parseInt(req.query.offset) || 0;
    
    const games = await db.getRecentGames(limit, offset);
    
    res.status(200).json({ success: true, games });
  } catch (error) {
    console.error('获取最近游戏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
