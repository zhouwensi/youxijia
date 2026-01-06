// POST /api/games/[id]/verify - 验证作者权限
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
    const { authorToken } = req.body;
    
    if (!authorToken) {
      return res.status(200).json({ success: true, isAuthor: false });
    }
    
    const isAuthor = await db.verifyAuthor(id, authorToken);
    
    res.status(200).json({ success: true, isAuthor });
  } catch (error) {
    console.error('验证作者失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
