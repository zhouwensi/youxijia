// Vercel KV 数据库操作模块
// 使用 Vercel KV (免费 Redis) 存储游戏数据

const { kv } = require('@vercel/kv');

// 游戏数据键名前缀
const GAME_PREFIX = 'game:';
const RECENT_GAMES_KEY = 'games:recent';
const FEATURED_GAMES_KEY = 'games:featured';
const DELETED_GAMES_KEY = 'games:deleted'; // 已删除游戏列表

// 生成游戏ID
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 创建游戏
async function createGame(gameData) {
  const id = generateId();
  const now = new Date().toISOString();
  
  const game = {
    id,
    title: gameData.title || '未命名游戏',
    prompt: gameData.prompt,
    code: gameData.code,
    author_name: gameData.authorName || '匿名',
    author_token: gameData.authorToken,
    play_count: 0,
    like_count: 0,
    is_featured: 0,
    is_hidden: 0,           // 是否隐藏（仅自己可见）
    is_deleted: 0,          // 是否已删除（软删除）
    deleted_at: null,       // 删除时间
    visibility: 'public',   // 可见性: public/private
    created_at: now,
    updated_at: now
  };
  
  // 存储游戏数据
  await kv.set(`${GAME_PREFIX}${id}`, JSON.stringify(game));
  
  // 添加到最近游戏列表（保留最新100个）
  await kv.lpush(RECENT_GAMES_KEY, id);
  await kv.ltrim(RECENT_GAMES_KEY, 0, 99);
  
  return { id, authorToken: game.author_token };
}

// 获取单个游戏
async function getGame(id) {
  const data = await kv.get(`${GAME_PREFIX}${id}`);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// 更新游戏
async function updateGame(id, updates) {
  const game = await getGame(id);
  if (!game) return null;
  
  const updatedGame = {
    ...game,
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  await kv.set(`${GAME_PREFIX}${id}`, JSON.stringify(updatedGame));
  return updatedGame;
}

// 获取最近游戏列表
async function getRecentGames(limit = 12, offset = 0) {
  const ids = await kv.lrange(RECENT_GAMES_KEY, offset, offset + limit - 1);
  if (!ids || ids.length === 0) return [];
  
  const games = await Promise.all(
    ids.map(async (id) => {
      const game = await getGame(id);
      if (!game) return null;
      // 过滤已删除和设为私密的游戏
      if (game.is_deleted || game.visibility === 'private') return null;
      // 返回不含代码的摘要
      const { code, author_token, ...summary } = game;
      return summary;
    })
  );
  
  return games.filter(g => g !== null);
}

// 获取推荐游戏列表
async function getFeaturedGames(limit = 12) {
  // 获取所有最近游戏，筛选高赞的
  const ids = await kv.lrange(RECENT_GAMES_KEY, 0, 99);
  if (!ids || ids.length === 0) return [];
  
  const games = await Promise.all(
    ids.map(async (id) => {
      const game = await getGame(id);
      if (!game) return null;
      // 过滤已删除和设为私密的游戏
      if (game.is_deleted || game.visibility === 'private') return null;
      const { code, author_token, ...summary } = game;
      return summary;
    })
  );
  
  return games
    .filter(g => g !== null && (g.is_featured || g.like_count >= 5))
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, limit);
}

// 搜索游戏
async function searchGames(keyword, limit = 20) {
  const ids = await kv.lrange(RECENT_GAMES_KEY, 0, 99);
  if (!ids || ids.length === 0) return [];
  
  const lowerKeyword = keyword.toLowerCase();
  const games = await Promise.all(
    ids.map(async (id) => {
      const game = await getGame(id);
      if (!game) return null;
      
      // 过滤已删除和设为私密的游戏
      if (game.is_deleted || game.visibility === 'private') return null;
      
      // 搜索标题、提示词和作者名
      const matchTitle = game.title?.toLowerCase().includes(lowerKeyword);
      const matchPrompt = game.prompt?.toLowerCase().includes(lowerKeyword);
      const matchAuthor = game.author_name?.toLowerCase().includes(lowerKeyword);
      
      if (matchTitle || matchPrompt || matchAuthor) {
        const { code, author_token, ...summary } = game;
        return summary;
      }
      return null;
    })
  );
  
  return games.filter(g => g !== null).slice(0, limit);
}

// 增加播放次数
async function incrementPlayCount(id) {
  const game = await getGame(id);
  if (!game) return null;
  
  game.play_count = (game.play_count || 0) + 1;
  await kv.set(`${GAME_PREFIX}${id}`, JSON.stringify(game));
  return game.play_count;
}

// 增加点赞数
async function incrementLikeCount(id) {
  const game = await getGame(id);
  if (!game) return null;
  
  game.like_count = (game.like_count || 0) + 1;
  await kv.set(`${GAME_PREFIX}${id}`, JSON.stringify(game));
  return game.like_count;
}

// 验证作者
async function verifyAuthor(id, token) {
  const game = await getGame(id);
  if (!game) return false;
  return game.author_token === token;
}

// 软删除游戏（用户删除）
async function softDeleteGame(id) {
  const game = await getGame(id);
  if (!game) return null;
  
  const now = new Date().toISOString();
  game.is_deleted = 1;
  game.deleted_at = now;
  game.updated_at = now;
  
  await kv.set(`${GAME_PREFIX}${id}`, JSON.stringify(game));
  
  // 添加到已删除列表
  await kv.lpush(DELETED_GAMES_KEY, id);
  
  return game;
}

// 恢复已删除的游戏
async function restoreGame(id) {
  const game = await getGame(id);
  if (!game) return null;
  
  game.is_deleted = 0;
  game.deleted_at = null;
  game.updated_at = new Date().toISOString();
  
  await kv.set(`${GAME_PREFIX}${id}`, JSON.stringify(game));
  
  // 从已删除列表移除
  await kv.lrem(DELETED_GAMES_KEY, 1, id);
  
  return game;
}

// 永久删除游戏（管理员操作）
async function permanentDeleteGame(id) {
  // 删除游戏数据
  await kv.del(`${GAME_PREFIX}${id}`);
  
  // 从各个列表中移除
  await kv.lrem(RECENT_GAMES_KEY, 0, id);
  await kv.lrem(DELETED_GAMES_KEY, 0, id);
  
  return true;
}

// 设置游戏可见性
async function setGameVisibility(id, visibility) {
  const game = await getGame(id);
  if (!game) return null;
  
  game.visibility = visibility; // 'public' or 'private'
  game.updated_at = new Date().toISOString();
  
  await kv.set(`${GAME_PREFIX}${id}`, JSON.stringify(game));
  return game;
}

// 获取所有游戏（包括已删除的，管理员用）
async function getAllGames(options = {}) {
  const { includeDeleted = false, limit = 100, offset = 0 } = options;
  
  // 获取所有游戏ID
  const recentIds = await kv.lrange(RECENT_GAMES_KEY, 0, 999) || [];
  const deletedIds = includeDeleted ? (await kv.lrange(DELETED_GAMES_KEY, 0, 999) || []) : [];
  
  // 合并并去重
  const allIds = [...new Set([...recentIds, ...deletedIds])];
  
  const games = await Promise.all(
    allIds.map(async (id) => {
      const game = await getGame(id);
      if (!game) return null;
      // 如果不包含已删除的，则过滤
      if (!includeDeleted && game.is_deleted) return null;
      const { code, ...summary } = game;
      return summary;
    })
  );
  
  const filtered = games.filter(g => g !== null);
  
  // 按创建时间排序（最新在前）
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  return {
    games: filtered.slice(offset, offset + limit),
    total: filtered.length
  };
}

module.exports = {
  createGame,
  getGame,
  updateGame,
  getRecentGames,
  getFeaturedGames,
  searchGames,
  incrementPlayCount,
  incrementLikeCount,
  verifyAuthor,
  softDeleteGame,
  restoreGame,
  permanentDeleteGame,
  setGameVisibility,
  getAllGames
};