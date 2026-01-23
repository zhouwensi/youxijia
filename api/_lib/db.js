// Vercel KV 数据库操作模块
// 使用 Vercel KV (免费 Redis) 存储游戏数据

const { kv } = require('@vercel/kv');

// 游戏数据键名前缀
const GAME_PREFIX = 'game:';
const RECENT_GAMES_KEY = 'games:recent';
const FEATURED_GAMES_KEY = 'games:featured';
const DELETED_GAMES_KEY = 'games:deleted'; // 已删除游戏列表
// 封禁相关键名
const BANNED_ACCOUNTS_KEY = 'banned:accounts';
const BANNED_IPS_KEY = 'banned:ips';
const DEVTOOLS_WHITELIST_KEY = 'config:devtools_whitelist';
// 邀请积分相关
const REFERRAL_PREFIX = 'referral:';
const DAILY_REFERRAL_KEY = 'daily_referral:';

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

// ==================== 封禁功能 ====================

/**
 * 封禁类型常量
 * - access: 禁止访问网站
 * - comment: 禁止发言/评论
 * - create: 禁止创作游戏
 */
const BAN_TYPES = {
  ACCESS: 'access',   // 禁止访问网站
  COMMENT: 'comment', // 禁止发言/评论
  CREATE: 'create'    // 禁止创作游戏
};

// 封禁账号
async function banAccount(accountId, reason, duration = null, hideWorks = false, hideMessages = false, operator = 'admin', banTypes = null) {
  const now = new Date();
  
  // 如果没有指定封禁类型，默认为全部禁止
  const types = banTypes || [BAN_TYPES.ACCESS, BAN_TYPES.COMMENT, BAN_TYPES.CREATE];
  
  const banInfo = {
    accountId,
    reason,
    duration, // null表示永久，否则为分钟数
    expireAt: duration ? new Date(now.getTime() + duration * 60 * 1000).toISOString() : null,
    hideWorks,
    hideMessages,
    operator,
    banTypes: types, // 新增：封禁类型数组
    createdAt: now.toISOString()
  };
  
  await kv.hset(BANNED_ACCOUNTS_KEY, accountId, JSON.stringify(banInfo));
  
  // 如果需要隐藏作品
  if (hideWorks) {
    await hideUserWorks(accountId);
  }
  
  return banInfo;
}

// 解封账号
async function unbanAccount(accountId) {
  await kv.hdel(BANNED_ACCOUNTS_KEY, accountId);
  return true;
}

// 检查账号是否被封禁
async function isAccountBanned(accountId) {
  const data = await kv.hget(BANNED_ACCOUNTS_KEY, accountId);
  if (!data) return null;
  
  const banInfo = typeof data === 'string' ? JSON.parse(data) : data;
  
  // 检查是否已过期
  if (banInfo.expireAt && new Date(banInfo.expireAt) < new Date()) {
    await unbanAccount(accountId);
    return null;
  }
  
  return banInfo;
}

// 封禁IP
async function banIP(ip, reason, duration = null, operator = 'admin', banTypes = null) {
  const now = new Date();
  
  // 如果没有指定封禁类型，默认为全部禁止
  const types = banTypes || [BAN_TYPES.ACCESS, BAN_TYPES.COMMENT, BAN_TYPES.CREATE];
  
  const banInfo = {
    ip,
    reason,
    duration,
    expireAt: duration ? new Date(now.getTime() + duration * 60 * 1000).toISOString() : null,
    operator,
    banTypes: types, // 新增：封禁类型数组
    createdAt: now.toISOString()
  };
  
  await kv.hset(BANNED_IPS_KEY, ip, JSON.stringify(banInfo));
  return banInfo;
}

// 解封IP
async function unbanIP(ip) {
  await kv.hdel(BANNED_IPS_KEY, ip);
  return true;
}

// 检查IP是否被封禁
async function isIPBanned(ip) {
  const data = await kv.hget(BANNED_IPS_KEY, ip);
  if (!data) return null;
  
  const banInfo = typeof data === 'string' ? JSON.parse(data) : data;
  
  // 检查是否已过期
  if (banInfo.expireAt && new Date(banInfo.expireAt) < new Date()) {
    await unbanIP(ip);
    return null;
  }
  
  return banInfo;
}

// 获取所有被封禁的账号
async function getBannedAccounts() {
  const data = await kv.hgetall(BANNED_ACCOUNTS_KEY);
  if (!data) return [];
  
  const accounts = [];
  for (const [accountId, info] of Object.entries(data)) {
    const banInfo = typeof info === 'string' ? JSON.parse(info) : info;
    // 过滤已过期的
    if (!banInfo.expireAt || new Date(banInfo.expireAt) > new Date()) {
      accounts.push(banInfo);
    }
  }
  return accounts;
}

// 获取所有被封禁的IP
async function getBannedIPs() {
  const data = await kv.hgetall(BANNED_IPS_KEY);
  if (!data) return [];
  
  const ips = [];
  for (const [ip, info] of Object.entries(data)) {
    const banInfo = typeof info === 'string' ? JSON.parse(info) : info;
    // 过滤已过期的
    if (!banInfo.expireAt || new Date(banInfo.expireAt) > new Date()) {
      ips.push(banInfo);
    }
  }
  return ips;
}

// 隐藏用户所有作品
async function hideUserWorks(accountId) {
  const ids = await kv.lrange(RECENT_GAMES_KEY, 0, 999) || [];
  
  for (const id of ids) {
    const game = await getGame(id);
    if (game && game.author_token === accountId) {
      game.is_hidden = 1;
      game.updated_at = new Date().toISOString();
      await kv.set(`${GAME_PREFIX}${id}`, JSON.stringify(game));
    }
  }
  
  return true;
}

// ==================== DevTools白名单 ====================

// 获取DevTools白名单
async function getDevToolsWhitelist() {
  const data = await kv.get(DEVTOOLS_WHITELIST_KEY);
  if (!data) return { accounts: [], ips: [] };
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// 设置DevTools白名单
async function setDevToolsWhitelist(whitelist) {
  await kv.set(DEVTOOLS_WHITELIST_KEY, JSON.stringify(whitelist));
  return true;
}

// 检查是否在DevTools白名单中
async function isInDevToolsWhitelist(accountId, ip) {
  const whitelist = await getDevToolsWhitelist();
  
  // 调试日志
  console.log('[DevTools白名单检查]', { accountId, ip, whitelist });
  
  // 检查账号白名单是否包含 * （允许所有人）
  if (whitelist.accounts && whitelist.accounts.includes('*')) {
    console.log('[DevTools] 账号白名单包含 *，允许所有人');
    return true;
  }
  // 检查IP白名单是否包含 * （允许所有IP）
  if (whitelist.ips && whitelist.ips.includes('*')) {
    console.log('[DevTools] IP白名单包含 *，允许所有IP');
    return true;
  }
  
  if (accountId && whitelist.accounts && whitelist.accounts.includes(accountId)) {
    return true;
  }
  if (ip && whitelist.ips && whitelist.ips.includes(ip)) {
    return true;
  }
  return false;
}

// ==================== 邀请积分功能 ====================

// 记录邀请关系
async function recordReferral(inviterAccountId, inviteeAccountId) {
  const key = `${REFERRAL_PREFIX}${inviteeAccountId}`;
  const referralInfo = {
    inviter: inviterAccountId,
    invitee: inviteeAccountId,
    createdAt: new Date().toISOString(),
    rewarded: false
  };
  
  await kv.set(key, JSON.stringify(referralInfo));
  return referralInfo;
}

// 获取邀请关系
async function getReferral(inviteeAccountId) {
  const key = `${REFERRAL_PREFIX}${inviteeAccountId}`;
  const data = await kv.get(key);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// 标记邀请已奖励
async function markReferralRewarded(inviteeAccountId) {
  const referral = await getReferral(inviteeAccountId);
  if (!referral) return null;
  
  referral.rewarded = true;
  referral.rewardedAt = new Date().toISOString();
  
  const key = `${REFERRAL_PREFIX}${inviteeAccountId}`;
  await kv.set(key, JSON.stringify(referral));
  return referral;
}

// 获取用户今日邀请奖励次数
async function getDailyReferralCount(accountId) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${DAILY_REFERRAL_KEY}${accountId}:${today}`;
  const count = await kv.get(key);
  return parseInt(count) || 0;
}

// 增加用户今日邀请奖励次数
async function incrementDailyReferralCount(accountId) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${DAILY_REFERRAL_KEY}${accountId}:${today}`;
  const count = await kv.incr(key);
  // 设置过期时间为明天（24小时后自动清除）
  await kv.expire(key, 86400);
  return count;
}

// 检查账号是否被特定类型封禁
async function isAccountBannedForType(accountId, banType) {
  const banInfo = await isAccountBanned(accountId);
  if (!banInfo) return false;
  
  // 如果没有 banTypes 字段（旧数据），视为全部封禁
  if (!banInfo.banTypes) return true;
  
  return banInfo.banTypes.includes(banType);
}

// 检查IP是否被特定类型封禁
async function isIPBannedForType(ip, banType) {
  const banInfo = await isIPBanned(ip);
  if (!banInfo) return false;
  
  // 如果没有 banTypes 字段（旧数据），视为全部封禁
  if (!banInfo.banTypes) return true;
  
  return banInfo.banTypes.includes(banType);
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
  getAllGames,
  // 封禁功能
  BAN_TYPES,
  banAccount,
  unbanAccount,
  isAccountBanned,
  isAccountBannedForType,
  banIP,
  unbanIP,
  isIPBanned,
  isIPBannedForType,
  getBannedAccounts,
  getBannedIPs,
  hideUserWorks,
  // DevTools白名单
  getDevToolsWhitelist,
  setDevToolsWhitelist,
  isInDevToolsWhitelist,
  // 邀请积分
  recordReferral,
  getReferral,
  markReferralRewarded,
  getDailyReferralCount,
  incrementDailyReferralCount
};