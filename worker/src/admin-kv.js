/**
 * Worker 管理后台：ADMIN_KEY + KV 中的游戏与站点配置（无 SQLite / 无本地文件）
 */
import bcrypt from 'bcryptjs';
import {
  getGame,
  readIndex,
  adminListGames,
  adminUpdateGameFlags,
  adminDeleteGame,
} from './games-kv.js';
import { saveUser, getUserByToken } from './accounts-kv.js';

const CONFIG_KEY = 'admin:system_config';
const KV_CREDITS_ALL = 'admin:credits_all_config';
const KV_ACTION_CREDITS = 'admin:action_credits_config';
const KV_EXTRA_CREDITS = 'admin:extra_credits_config';
const KV_ACHIEVEMENTS = 'admin:achievements_config';
const KV_PROMO_CODES = 'admin:promo_codes';

function getAdminKey(request) {
  return (
    request.headers.get('x-admin-key') ||
    request.headers.get('X-Admin-Key') ||
    request.headers.get('x-admin-token') ||
    request.headers.get('X-Admin-Token') ||
    ''
  );
}

function getAdminToken(request) {
  return getAdminKey(request);
}

export function assertAdmin(request, env, url) {
  const configured = env.ADMIN_KEY;
  if (!configured || !String(configured).trim()) {
    return { ok: false, response: null, status: 'no_key' };
  }
  let key = getAdminKey(request);
  if (!key && url && url.pathname.includes('/source')) {
    key = url.searchParams.get('key') || '';
  }
  if (!key || key !== configured) {
    return { ok: false, response: null, status: 'bad_key' };
  }
  return { ok: true };
}

async function loadConfigMap(kv) {
  const raw = await kv.get(CONFIG_KEY);
  if (!raw) return {};
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return {};
    const m = {};
    for (const row of arr) {
      if (row && row.key) m[row.key] = row.value ?? '';
    }
    return m;
  } catch {
    return {};
  }
}

async function saveConfigMap(kv, map) {
  const configs = Object.keys(map).map((key) => ({ key, value: map[key] }));
  await kv.put(CONFIG_KEY, JSON.stringify(configs));
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = out[k];
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

async function kvGetJson(kv, key, fallback) {
  if (!kv) return fallback;
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v === null || v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

async function kvPutJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

function defaultCreditsAllConfig() {
  return {
    basic: { register: 1, dailyLogin: 1 },
    checkin: { base: 1, streak3: 1, streak7: 2, streak14: 3, streak30: 5 },
    claim: {
      likeThreshold: 10,
      likeReward: 1,
      likeDailyLimit: 3,
      favoriteThreshold: 5,
      favoriteReward: 1,
      favoriteDailyLimit: 3,
      followThreshold: 5,
      followReward: 1,
      followDailyLimit: 3,
      commentThreshold: 2,
      commentReward: 1,
      commentDailyLimit: 3,
      shareThreshold: 2,
      shareReward: 1,
      shareDailyLimit: 3,
    },
    create: {
      gameReward: 2,
      gameDailyLimit: 1,
      editThreshold: 2,
      editReward: 1,
      editDailyLimit: 1,
    },
    ad: {
      reward: 3,
      dailyLimit: 30,
      enabled: false,
      rewardedVideoAdUnitId: '',
    },
    invite: { mpReward: 5 },
    action: {
      like: { credits: 0.1, dailyLimit: 10 },
      favorite: { credits: 0.2, dailyLimit: 5 },
      follow: { credits: 0.2, dailyLimit: 5 },
      comment: { credits: 0.5, dailyLimit: 2, minLength: 10 },
    },
    extra: {
      shareGame: { credits: 1, dailyLimit: 5 },
      inviteFriend: { credits: 3, dailyLimit: 5 },
      article: { credits: 1, dailyLimit: 3 },
    },
    mpCreditsEarningLimited: true,
  };
}

function defaultActionCreditsConfig() {
  return {
    like: { credits: 0.1, dailyLimit: 10 },
    favorite: { credits: 0.2, dailyLimit: 5 },
    follow: { credits: 0.2, dailyLimit: 5 },
    comment: { credits: 0.5, dailyLimit: 2, minLength: 10 },
  };
}

function defaultExtraCreditsConfig() {
  return {
    shareGame: { credits: 1, dailyLimit: 5 },
    inviteFriend: { credits: 3, dailyLimit: 5 },
    article: { credits: 1, dailyLimit: 3 },
  };
}

function defaultAchievementsList() {
  return [
    {
      id: 'daily_active',
      name: '日活跃',
      description: '登录+任意1次互动',
      icon: '🌟',
      category: 'daily',
      condition_type: 'daily_active',
      condition_value: 1,
      reward_credits: 1,
      sort_order: 1,
      is_active: 1,
    },
    {
      id: 'daily_interactive',
      name: '互动达标',
      description: '点赞+收藏+关注各完成每日上限',
      icon: '🎯',
      category: 'daily',
      condition_type: 'daily_interactive',
      condition_value: 1,
      reward_credits: 3,
      sort_order: 2,
      is_active: 1,
    },
    {
      id: 'daily_comment',
      name: '社区贡献',
      description: '发表1条有效评论',
      icon: '💬',
      category: 'daily',
      condition_type: 'comment_count',
      condition_value: 1,
      reward_credits: 1,
      sort_order: 3,
      is_active: 1,
    },
    {
      id: 'weekly_active',
      name: '周活跃之星',
      description: '连续登录7天',
      icon: '⭐',
      category: 'weekly',
      condition_type: 'login_days',
      condition_value: 7,
      reward_credits: 5,
      sort_order: 1,
      is_active: 1,
    },
    {
      id: 'weekly_like',
      name: '周点赞达人',
      description: '本周点赞50次',
      icon: '❤️',
      category: 'weekly',
      condition_type: 'like_count',
      condition_value: 50,
      reward_credits: 5,
      sort_order: 2,
      is_active: 1,
    },
    {
      id: 'weekly_favorite',
      name: '周收藏家',
      description: '本周收藏20次',
      icon: '📚',
      category: 'weekly',
      condition_type: 'favorite_count',
      condition_value: 20,
      reward_credits: 5,
      sort_order: 3,
      is_active: 1,
    },
    {
      id: 'weekly_follow',
      name: '周社交王',
      description: '本周关注15人',
      icon: '👥',
      category: 'weekly',
      condition_type: 'follow_count',
      condition_value: 15,
      reward_credits: 5,
      sort_order: 4,
      is_active: 1,
    },
    {
      id: 'weekly_comment',
      name: '周评论家',
      description: '本周发表7条评论',
      icon: '✏️',
      category: 'weekly',
      condition_type: 'comment_count',
      condition_value: 7,
      reward_credits: 5,
      sort_order: 5,
      is_active: 1,
    },
    {
      id: 'monthly_active',
      name: '月度活跃',
      description: '本月登录20天',
      icon: '🏅',
      category: 'monthly',
      condition_type: 'login_days',
      condition_value: 20,
      reward_credits: 15,
      sort_order: 1,
      is_active: 1,
    },
    {
      id: 'monthly_interactive',
      name: '月度互动王',
      description: '本月互动满300次',
      icon: '🔥',
      category: 'monthly',
      condition_type: 'total_interactive',
      condition_value: 300,
      reward_credits: 20,
      sort_order: 2,
      is_active: 1,
    },
    {
      id: 'monthly_creator',
      name: '月度创作者',
      description: '本月创作2个游戏',
      icon: '🎮',
      category: 'monthly',
      condition_type: 'game_count',
      condition_value: 2,
      reward_credits: 20,
      sort_order: 3,
      is_active: 1,
    },
    {
      id: 'monthly_popular',
      name: '月度人气',
      description: '本月作品获100赞',
      icon: '👑',
      category: 'monthly',
      condition_type: 'received_likes',
      condition_value: 100,
      reward_credits: 25,
      sort_order: 4,
      is_active: 1,
    },
    {
      id: 'first_login',
      name: '初来乍到',
      description: '首次登录',
      icon: '👋',
      category: 'permanent',
      condition_type: 'first_login',
      condition_value: 1,
      reward_credits: 3,
      sort_order: 1,
      is_active: 1,
    },
    {
      id: 'first_game',
      name: '首次创作',
      description: '发布首个游戏',
      icon: '🎲',
      category: 'permanent',
      condition_type: 'first_game',
      condition_value: 1,
      reward_credits: 5,
      sort_order: 2,
      is_active: 1,
    },
    {
      id: 'hundred_likes',
      name: '百赞作者',
      description: '单作品获100赞',
      icon: '💯',
      category: 'permanent',
      condition_type: 'single_game_likes',
      condition_value: 100,
      reward_credits: 20,
      sort_order: 3,
      is_active: 1,
    },
    {
      id: 'thousand_likes',
      name: '千赞大神',
      description: '单作品获1000赞',
      icon: '🌟',
      category: 'permanent',
      condition_type: 'single_game_likes',
      condition_value: 1000,
      reward_credits: 100,
      sort_order: 4,
      is_active: 1,
    },
    {
      id: 'master_creator',
      name: '创作大师',
      description: '累计创作50个游戏',
      icon: '🏆',
      category: 'permanent',
      condition_type: 'total_games',
      condition_value: 50,
      reward_credits: 50,
      sort_order: 5,
      is_active: 1,
    },
    {
      id: 'veteran_user',
      name: '社区元老',
      description: '注册满1年',
      icon: '🎖️',
      category: 'permanent',
      condition_type: 'days_since_register',
      condition_value: 365,
      reward_credits: 50,
      sort_order: 6,
      is_active: 1,
    },
  ];
}

async function collectUserKeys(kv) {
  const names = [];
  let cursor;
  for (;;) {
    const r = await kv.list({ prefix: 'user:', limit: 1000, cursor });
    for (const k of r.keys) names.push(k.name);
    if (r.list_complete) break;
    cursor = r.cursor;
  }
  return names;
}

function userRowFromKvUser(user) {
  if (!user || !user.user_token) return null;
  return {
    user_token: user.user_token,
    credits: user.credits ?? 0,
    total_earned: user.total_earned ?? 0,
    total_used: user.total_used ?? 0,
    followed_wechat: user.followed_wechat ? 1 : 0,
    ad_count_today: user.ad_count_today ?? 0,
    created_at: user.created_at || '',
    updated_at: user.updated_at || '',
    account_id: user.account_id || '',
    nickname: user.nickname || '',
    is_admin: user.is_admin ? 1 : 0,
    email: user.email || null,
    email_verified: user.email_verified ? 1 : 0,
  };
}

async function loadAllUsersForAdmin(kv) {
  const keys = await collectUserKeys(kv);
  const rows = [];
  for (const name of keys) {
    const raw = await kv.get(name);
    if (!raw) continue;
    let user;
    try {
      user = JSON.parse(raw);
    } catch {
      continue;
    }
    const row = userRowFromKvUser(user);
    if (row) rows.push(row);
  }
  rows.sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });
  return rows;
}

export async function handleAdminRequest(request, env, url, json) {
  const auth = assertAdmin(request, env, url);
  if (auth.status === 'no_key') {
    return json(
      request,
      env,
      {
        success: false,
        error: 'Worker 未配置 ADMIN_KEY。请执行: npx wrangler secret put ADMIN_KEY',
        workerAdmin: true,
      },
      503
    );
  }
  if (!auth.ok) {
    return json(request, env, { success: false, error: '无权限' }, 403);
  }

  const kv = env.USER_KV;
  const path = url.pathname;
  const method = request.method;

  try {
    if (path === '/api/admin/stats' && method === 'GET') {
      if (!kv) {
        return json(request, env, {
          success: true,
          overview: { totalGames: 0, totalPlays: 0, totalLikes: 0, totalUsers: 0 },
          today: {},
          last7Days: [],
          workerAdmin: true,
        });
      }
      const idx = await readIndex(kv);
      let totalPlays = 0;
      let totalLikes = 0;
      for (const g of idx) {
        totalPlays += g.play_count || 0;
        totalLikes += g.like_count || 0;
      }
      return json(request, env, {
        success: true,
        overview: {
          totalGames: idx.length,
          totalPlays,
          totalLikes,
          totalUsers: 0,
        },
        today: {},
        last7Days: [],
        workerAdmin: true,
        note: '用户总数需 Node 版或后续 KV 统计；此处为列表内游戏聚合。',
      });
    }

    if (path === '/api/admin/login-stats' && method === 'GET') {
      getAdminToken(request);
      return json(request, env, {
        success: true,
        stats: {
          today: { logins: 0, uniqueUsers: 0 },
          week: { logins: 0, uniqueUsers: 0 },
          total: { logins: 0 },
          failed24h: 0,
          recentLogins: [],
          dailyTrend: [],
        },
        workerAdmin: true,
        message: 'Worker 版暂无登录审计表，统计为占位。',
      });
    }

    if (path === '/api/admin/config' && method === 'GET') {
      if (!kv) return json(request, env, { success: true, configs: [], workerAdmin: true });
      const map = await loadConfigMap(kv);
      const configs = Object.keys(map).map((key) => ({ key, value: map[key] }));
      return json(request, env, { success: true, configs, workerAdmin: true });
    }

    if (path === '/api/admin/config' && method === 'PUT') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json(request, env, { success: false, error: '无效 JSON' }, 400);
      }
      const { configs } = body;
      if (!configs || !Array.isArray(configs)) {
        return json(request, env, { success: false, error: '无效的配置数据' }, 400);
      }
      if (!kv) {
        return json(request, env, { success: false, error: '未配置 KV' }, 503);
      }
      const map = await loadConfigMap(kv);
      for (const { key, value } of configs) {
        if (!key) continue;
        if (value === '' || value === null || value === undefined) {
          delete map[key];
        } else {
          map[key] = String(value);
        }
      }
      await saveConfigMap(kv, map);
      return json(request, env, { success: true, message: '配置已更新', workerAdmin: true });
    }

    if (path === '/api/admin/test-smtp' && method === 'POST') {
      return json(request, env, {
        success: false,
        error: 'Worker 无 SMTP 发信能力，请在本地 Node 环境测试或使用邮件 SaaS。',
        workerAdmin: true,
      });
    }

    if (path === '/api/admin/models' && method === 'GET') {
      const hasKey = !!(env.DEEPSEEK_API_KEY && String(env.DEEPSEEK_API_KEY).trim());
      const models = [
        {
          id: 'deepseek-v3',
          name: 'DeepSeek（Worker 默认）',
          provider: 'deepseek',
          model: 'deepseek-chat',
          baseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
          tier: 'standard',
          speedLevel: 'fast',
          quality: 'high',
          defaultQuality: 'high',
          defaultCredits: 1,
          defaultMaxTokens: 8192,
          configuredCredits: null,
          configuredQuality: null,
          configuredMaxTokens: null,
          hasApiKey: hasKey,
          maskedApiKey: hasKey ? '（已配置 Secret DEEPSEEK_API_KEY）' : null,
          creditCost: 1,
          maxTokens: 8192,
          enabled: hasKey,
        },
        {
          id: 'custom',
          name: '用户自带 Key',
          provider: 'custom',
          model: 'custom',
          baseUrl: '',
          tier: 'custom',
          speedLevel: 'normal',
          quality: 'medium',
          defaultQuality: 'medium',
          defaultCredits: 0,
          defaultMaxTokens: 8192,
          configuredCredits: null,
          configuredQuality: null,
          configuredMaxTokens: null,
          hasApiKey: false,
          maskedApiKey: null,
          creditCost: 0,
          maxTokens: 8192,
          enabled: true,
        },
      ];
      return json(request, env, { success: true, models, workerAdmin: true });
    }

    if (path === '/api/admin/games' && method === 'GET') {
      if (!kv) {
        return json(request, env, {
          success: true,
          games: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          workerAdmin: true,
        });
      }
      const data = await adminListGames(kv, url);
      return json(request, env, { ...data, workerAdmin: true });
    }

    const gameIdPut = path.match(/^\/api\/admin\/games\/([^/]+)$/);
    if (gameIdPut && method === 'PUT') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const id = gameIdPut[1];
      const r = await adminUpdateGameFlags(kv, id, body);
      return json(request, env, r.body, r.ok ? 200 : r.status);
    }

    if (gameIdPut && method === 'DELETE') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      const id = gameIdPut[1];
      const r = await adminDeleteGame(kv, id);
      return json(request, env, r.body, r.ok ? 200 : r.status);
    }

    const gameSource = path.match(/^\/api\/admin\/games\/([^/]+)\/source$/);
    if (gameSource && method === 'GET') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      const id = gameSource[1];
      const game = await getGame(kv, id);
      if (!game) {
        return json(request, env, { success: false, error: '游戏不存在' }, 404);
      }
      if (!game.code) {
        return json(request, env, { success: false, error: '游戏源码为空' }, 400);
      }
      const safeTitle = (game.title || 'game').replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
      const filename = `${safeTitle}_${id.slice(0, 8)}.html`;
      return new Response(game.code, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    if (path.match(/^\/api\/admin\/games\/[^/]+\/repair$/) && method === 'POST') {
      return json(request, env, {
        success: false,
        error: 'Worker 无本地静态文件系统，无法「修复」落盘。请用 Pages 构建流程或 Node 版。',
        workerAdmin: true,
      });
    }

    if (path === '/api/admin/security-status' && method === 'GET') {
      return json(request, env, {
        success: true,
        allowDevTools: true,
        banned: false,
        workerAdmin: true,
      });
    }

    if (path === '/api/admin/security-logs' && method === 'GET') {
      return json(request, env, { success: true, logs: [], workerAdmin: true });
    }

    // ---------- 积分 / 成就 / 兑换码（KV 持久化，与 admin.html 对齐） ----------
    if (path === '/api/admin/credits-all-config' && method === 'GET') {
      if (!kv) {
        return json(request, env, { success: true, config: defaultCreditsAllConfig(), workerAdmin: true });
      }
      const stored = await kvGetJson(kv, KV_CREDITS_ALL, null);
      const config = stored && typeof stored === 'object' ? deepMerge(defaultCreditsAllConfig(), stored) : defaultCreditsAllConfig();
      return json(request, env, { success: true, config, workerAdmin: true });
    }

    if (path === '/api/admin/credits-all-config' && method === 'PUT') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json(request, env, { success: false, error: '无效 JSON' }, 400);
      }
      if (!body || typeof body !== 'object') {
        return json(request, env, { success: false, error: '无效的配置数据' }, 400);
      }
      const merged = deepMerge(defaultCreditsAllConfig(), body);
      await kvPutJson(kv, KV_CREDITS_ALL, merged);
      return json(request, env, { success: true, message: '积分配置已保存', workerAdmin: true });
    }

    if (path === '/api/admin/action-credits-config' && method === 'GET') {
      if (!kv) {
        return json(request, env, { success: true, config: defaultActionCreditsConfig(), workerAdmin: true });
      }
      const stored = await kvGetJson(kv, KV_ACTION_CREDITS, null);
      const config =
        stored && typeof stored === 'object' ? deepMerge(defaultActionCreditsConfig(), stored) : defaultActionCreditsConfig();
      return json(request, env, { success: true, config, workerAdmin: true });
    }

    if (path === '/api/admin/action-credits-config' && method === 'PUT') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json(request, env, { success: false, error: '无效 JSON' }, 400);
      }
      const merged = deepMerge(defaultActionCreditsConfig(), body);
      await kvPutJson(kv, KV_ACTION_CREDITS, merged);
      return json(request, env, { success: true, message: '行为积分配置已保存', workerAdmin: true });
    }

    if (path === '/api/admin/extra-credits-config' && method === 'GET') {
      if (!kv) {
        return json(request, env, { success: true, config: defaultExtraCreditsConfig(), workerAdmin: true });
      }
      const stored = await kvGetJson(kv, KV_EXTRA_CREDITS, null);
      const config =
        stored && typeof stored === 'object' ? deepMerge(defaultExtraCreditsConfig(), stored) : defaultExtraCreditsConfig();
      return json(request, env, { success: true, config, workerAdmin: true });
    }

    if (path === '/api/admin/extra-credits-config' && method === 'PUT') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json(request, env, { success: false, error: '无效 JSON' }, 400);
      }
      const merged = deepMerge(defaultExtraCreditsConfig(), body);
      await kvPutJson(kv, KV_EXTRA_CREDITS, merged);
      return json(request, env, { success: true, message: '特殊积分配置已保存', workerAdmin: true });
    }

    if (path === '/api/admin/achievements' && method === 'GET') {
      if (!kv) {
        return json(request, env, { success: true, achievements: defaultAchievementsList(), workerAdmin: true });
      }
      const stored = await kvGetJson(kv, KV_ACHIEVEMENTS, null);
      const achievements = Array.isArray(stored) && stored.length ? stored : defaultAchievementsList();
      return json(request, env, { success: true, achievements, workerAdmin: true });
    }

    if (path === '/api/admin/achievements' && method === 'PUT') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json(request, env, { success: false, error: '无效 JSON' }, 400);
      }
      const patches = body.achievements;
      if (!patches || !Array.isArray(patches)) {
        return json(request, env, { success: false, error: '无效的成就数据' }, 400);
      }
      let current = await kvGetJson(kv, KV_ACHIEVEMENTS, null);
      if (!Array.isArray(current) || !current.length) current = defaultAchievementsList();
      const byId = new Map(current.map((a) => [a.id, { ...a }]));
      for (const p of patches) {
        if (!p || !p.id || !byId.has(p.id)) continue;
        const u = byId.get(p.id);
        if (p.condition_value !== undefined) u.condition_value = p.condition_value;
        if (p.reward_credits !== undefined) u.reward_credits = p.reward_credits;
        if (p.is_active !== undefined) u.is_active = p.is_active;
        if (p.description !== undefined) u.description = p.description;
      }
      const achievements = Array.from(byId.values());
      await kvPutJson(kv, KV_ACHIEVEMENTS, achievements);
      return json(request, env, {
        success: true,
        message: `已更新 ${patches.length} 个成就配置`,
        workerAdmin: true,
      });
    }

    if (path === '/api/admin/promo-codes' && method === 'GET') {
      if (!kv) return json(request, env, { success: true, codes: [], workerAdmin: true });
      const codes = await kvGetJson(kv, KV_PROMO_CODES, []);
      const list = Array.isArray(codes) ? codes : [];
      return json(request, env, { success: true, codes: list, workerAdmin: true });
    }

    if (path === '/api/admin/promo-codes' && method === 'POST') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json(request, env, { success: false, error: '无效 JSON' }, 400);
      }
      const rawCode = (body.code || '').trim();
      if (!rawCode) return json(request, env, { success: false, error: '验证码不能为空' }, 400);
      const normalizedCode = rawCode.toUpperCase();
      const codes = await kvGetJson(kv, KV_PROMO_CODES, []);
      const list = Array.isArray(codes) ? [...codes] : [];
      if (list.some((c) => String(c.code).toUpperCase() === normalizedCode)) {
        return json(request, env, { success: false, error: '验证码已存在' }, 400);
      }
      list.unshift({
        code: normalizedCode,
        article_id: body.articleId || null,
        description: body.description || null,
        reward: body.reward || 1,
        max_uses: body.maxUses ?? null,
        used_count: 0,
        is_active: 1,
        created_at: new Date().toISOString(),
      });
      await kvPutJson(kv, KV_PROMO_CODES, list);
      return json(request, env, { success: true, message: '验证码创建成功', code: normalizedCode, workerAdmin: true });
    }

    const promoToggle = path.match(/^\/api\/admin\/promo-codes\/([^/]+)\/toggle$/);
    if (promoToggle && method === 'PUT') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      const normalizedCode = decodeURIComponent(promoToggle[1]).trim().toUpperCase();
      const codes = await kvGetJson(kv, KV_PROMO_CODES, []);
      const list = Array.isArray(codes) ? codes : [];
      const idx = list.findIndex((c) => String(c.code).toUpperCase() === normalizedCode);
      if (idx < 0) return json(request, env, { success: false, error: '验证码不存在' }, 404);
      const cur = list[idx];
      const newStatus = cur.is_active === 1 || cur.is_active === true ? 0 : 1;
      list[idx] = { ...cur, is_active: newStatus };
      await kvPutJson(kv, KV_PROMO_CODES, list);
      return json(request, env, {
        success: true,
        isActive: newStatus === 1,
        message: newStatus === 1 ? '验证码已启用' : '验证码已禁用',
        workerAdmin: true,
      });
    }

    const promoDelete = path.match(/^\/api\/admin\/promo-codes\/([^/]+)$/);
    if (promoDelete && method === 'DELETE') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      const normalizedCode = decodeURIComponent(promoDelete[1]).trim().toUpperCase();
      const codes = await kvGetJson(kv, KV_PROMO_CODES, []);
      const list = Array.isArray(codes) ? codes : [];
      const next = list.filter((c) => String(c.code).toUpperCase() !== normalizedCode);
      if (next.length === list.length) return json(request, env, { success: false, error: '验证码不存在' }, 404);
      await kvPutJson(kv, KV_PROMO_CODES, next);
      return json(request, env, { success: true, message: '验证码已删除', workerAdmin: true });
    }

    if (path === '/api/admin/users' && method === 'GET') {
      if (!kv) {
        return json(request, env, {
          success: true,
          users: [],
          pagination: { page: 1, limit: 15, total: 0, totalPages: 0 },
          workerAdmin: true,
        });
      }
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '15', 10) || 15));
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      let rows = await loadAllUsersForAdmin(kv);
      if (search) {
        rows = rows.filter((u) => {
          const hay = [
            u.user_token,
            u.account_id,
            u.nickname,
            u.email || '',
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(search);
        });
      }
      const total = rows.length;
      const totalPages = Math.ceil(total / limit) || 0;
      const slice = rows.slice((page - 1) * limit, page * limit);
      return json(request, env, {
        success: true,
        users: slice,
        pagination: { page, limit, total, totalPages },
        workerAdmin: true,
      });
    }

    const setAdminMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/set-admin$/);
    if (setAdminMatch && method === 'POST') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      const userToken = decodeURIComponent(setAdminMatch[1]);
      let body = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const isAdmin = !!body.isAdmin;
      const user = await getUserByToken(kv, userToken);
      if (!user) return json(request, env, { success: false, error: '用户不存在' }, 404);
      user.is_admin = isAdmin ? 1 : 0;
      await saveUser(kv, user);
      return json(request, env, {
        success: true,
        message: isAdmin ? '已设置为管理员' : '已取消管理员权限',
        user_token: userToken,
        is_admin: isAdmin ? 1 : 0,
        workerAdmin: true,
      });
    }

    const resetPwdMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/reset-password$/);
    if (resetPwdMatch && method === 'POST') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      const userToken = decodeURIComponent(resetPwdMatch[1]);
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json(request, env, { success: false, error: '无效 JSON' }, 400);
      }
      const newPassword = body.newPassword;
      if (!newPassword || String(newPassword).length < 6) {
        return json(request, env, { success: false, error: '新密码至少需要6位' }, 400);
      }
      const user = await getUserByToken(kv, userToken);
      if (!user) return json(request, env, { success: false, error: '用户不存在' }, 404);
      user.password_hash = bcrypt.hashSync(String(newPassword), 10);
      user.has_password = true;
      await saveUser(kv, user);
      return json(request, env, {
        success: true,
        message: '密码重置成功',
        user_token: userToken,
        account_id: user.account_id,
        workerAdmin: true,
      });
    }

    if (path === '/api/admin/add-credits' && method === 'POST') {
      if (!kv) return json(request, env, { success: false, error: '未配置 KV' }, 503);
      let body = {};
      try {
        body = await request.json();
      } catch {
        return json(request, env, { success: false, error: '无效 JSON' }, 400);
      }
      const userToken = (body.userToken || '').trim();
      const amount = parseInt(body.amount, 10);
      if (!userToken || Number.isNaN(amount)) {
        return json(request, env, { success: false, error: '缺少参数' }, 400);
      }
      const user = await getUserByToken(kv, userToken);
      if (!user) return json(request, env, { success: false, error: '用户不存在' }, 404);
      const prev = user.credits ?? 0;
      user.credits = prev + amount;
      if (amount > 0) {
        user.total_earned = (user.total_earned ?? 0) + amount;
      }
      await saveUser(kv, user);
      return json(request, env, { success: true, workerAdmin: true });
    }

    return json(request, env, {
      success: false,
      error: '此管理接口仅在 Node + SQLite 版实现，Worker 版未迁移。',
      path,
      workerAdmin: true,
    }, 501);
  } catch (e) {
    return json(request, env, { success: false, error: e.message || 'admin error' }, 500);
  }
}
