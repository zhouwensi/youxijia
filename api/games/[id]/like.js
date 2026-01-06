// POST /api/games/[id]/like - 点赞游戏
const db = require('../../_lib/db');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ success: false, error: '缺少游戏ID' });
  }
  
  try {
    const likeCount = await db.incrementLikeCount(id);
    
    if (likeCount === null) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    res.status(200).json({ success: true, likeCount });
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
