// /api/games - 游戏列表（GET）和创建新游戏（POST）
const db = require('../_lib/db');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // GET - 获取游戏列表
  if (req.method === 'GET') {
    return handleGetGames(req, res);
  }
  
  // POST - 创建新游戏
  if (req.method === 'POST') {
    return handleCreateGame(req, res);
  }
  
  return res.status(405).json({ success: false, error: 'Method not allowed' });
};

// 获取游戏列表
async function handleGetGames(req, res) {
  try {
    const { sort = 'newest', category = 'all', orientation = 'all', gameType = 'all', limit = 20, offset = 0 } = req.query;
    
    // 获取所有游戏
    const { games: allGames, total } = await db.getAllGames({
      limit: 200, // 获取更多以便排序筛选
      offset: 0,
      includeDeleted: false
    });
    
    // 过滤隐藏的游戏
    let filtered = allGames.filter(g => !g.is_hidden && !g.is_deleted);
    
    // 分类筛选（如果有分类字段）
    if (category && category !== 'all') {
      filtered = filtered.filter(g => g.category === category);
    }
    
    // 游戏类型筛选
    if (gameType && gameType !== 'all') {
      filtered = filtered.filter(g => g.game_type === gameType || g.type === gameType);
    }
    
    // 横竖屏筛选
    if (orientation && orientation !== 'all') {
      filtered = filtered.filter(g => {
        const gameOrientation = g.orientation || 'auto';
        if (orientation === 'portrait') {
          return gameOrientation === 'portrait' || gameOrientation === 'vertical';
        } else if (orientation === 'landscape') {
          return gameOrientation === 'landscape' || gameOrientation === 'horizontal';
        }
        return true;
      });
    }
    
    // 排序
    switch (sort) {
      case 'hot':
        // 热度 = 播放数 + 点赞*5 + 收藏*3
        filtered.sort((a, b) => {
          const hotA = (a.play_count || 0) + (a.like_count || 0) * 5 + (a.favorite_count || 0) * 3;
          const hotB = (b.play_count || 0) + (b.like_count || 0) * 5 + (b.favorite_count || 0) * 3;
          return hotB - hotA;
        });
        break;
      case 'likes':
        filtered.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        break;
      case 'favorites':
        filtered.sort((a, b) => (b.favorite_count || 0) - (a.favorite_count || 0));
        break;
      case 'plays':
        filtered.sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
        break;
      case 'comments':
        filtered.sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0));
        break;
      case 'newest':
      default:
        // 按创建时间倒序（最新在前）
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
    }
    
    // 分页
    const offsetNum = parseInt(offset) || 0;
    const limitNum = parseInt(limit) || 20;
    const paged = filtered.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      success: true,
      games: paged,
      pagination: {
        total: filtered.length,
        offset: offsetNum,
        limit: limitNum,
        hasMore: offsetNum + limitNum < filtered.length
      }
    });
  } catch (error) {
    console.error('获取游戏列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// 创建新游戏
async function handleCreateGame(req, res) {
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
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}