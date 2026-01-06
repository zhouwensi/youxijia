// POST /api/games - 创建新游戏
const db = require('../_lib/db');

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
  
  try {
    const { title, prompt, code, authorName, authorToken } = req.body;
    
    if (!code || !prompt) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    
    // 生成作者令牌（如果未提供）
    const token = authorToken || generateUUID();
    
    const result = await db.createGame({
      title: title || prompt.slice(0, 50),
      prompt,
      code,
      authorName: authorName || '匿名',
      authorToken: token
    });
    
    res.status(200).json({ 
      success: true, 
      id: result.id, 
      authorToken: result.authorToken 
    });
  } catch (error) {
    console.error('保存游戏失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
