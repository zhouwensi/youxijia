import { runGenerate } from './generate.js';

const DEFAULT_ORIGINS = [
  'https://www.yijuhuayouxi.com',
  'https://yijuhuayouxi.com',
  'http://localhost:80',
  'http://localhost:3000',
  'http://127.0.0.1:80',
  'http://127.0.0.1:3000',
];

function parseOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || '';
  if (!raw.trim()) return DEFAULT_ORIGINS;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = parseOrigins(env);
  const allow = allowed.includes(origin) ? origin : allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Token, X-Author-Token, x-user-token, x-platform, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function json(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env) },
  });
}

async function sha256Short(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function getUserByToken(kv, token) {
  if (!kv || !token) return null;
  const openid = await kv.get(`token:${token}`);
  if (!openid) return null;
  const raw = await kv.get(`user:${openid}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveUser(kv, user) {
  await kv.put(`user:${user.wechat_openid}`, JSON.stringify(user));
  await kv.put(`token:${user.user_token}`, user.wechat_openid);
}

async function handleWechatLogin(request, env) {
  if (!env.USER_KV) {
    return json(request, env, { success: false, error: '未配置 USER_KV，请在 wrangler.toml 绑定 KV' }, 503);
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(request, env, { success: false, error: '无效 JSON' }, 400);
  }
  const { code } = body;
  if (!code) {
    return json(request, env, { success: false, error: '缺少code参数' }, 400);
  }

  const WX_APPID = env.WX_APPID;
  const WX_APPSECRET = env.WX_APPSECRET;

  let openid;
  if (!WX_APPID || !WX_APPSECRET) {
    openid = `mock_${await sha256Short(code)}`;
  } else {
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(WX_APPID)}&secret=${encodeURIComponent(WX_APPSECRET)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const wxRes = await fetch(wxUrl);
    const wxData = await wxRes.json();
    if (wxData.errcode) {
      return json(request, env, { success: false, error: wxData.errmsg || '微信登录失败' });
    }
    openid = wxData.openid;
  }

  const kv = env.USER_KV;
  let user = null;
  let raw = await kv.get(`user:${openid}`);
  if (raw) {
    try {
      user = JSON.parse(raw);
    } catch {
      user = null;
    }
  }

  if (!user) {
    const user_token = crypto.randomUUID();
    const account_id = 'WX' + Math.random().toString(36).slice(2, 8).toUpperCase();
    user = {
      user_token,
      account_id,
      nickname: '微信用户',
      wechat_openid: openid,
      credits: 100,
    };
    await saveUser(kv, user);
  }

  return json(request, env, {
    success: true,
    data: {
      token: user.user_token,
      userInfo: {
        account_id: user.account_id,
        nickname: user.nickname || user.account_id,
        avatar_emoji: '🎮',
        credits: user.credits ?? 0,
      },
    },
  });
}

function siteConfig(env) {
  return {
    success: true,
    siteName: env.SITE_NAME || '一句话游戏',
    siteSlogan: env.SITE_SLOGAN || '一句话生成游戏',
    miniprogramName: env.MINIPROGRAM_NAME || '一句话游戏',
    webCreateDisabled: false,
    webEditDisabled: false,
    webInteractDisabled: false,
    webWriteDisabled: false,
    miniprogramCommentDisabled: false,
    miniprogramLLMDisabled: false,
    creditsEarningHidden: false,
    creditsEarningLimited: true,
    inviteReward: 3,
    wxSubscribeTmplId: env.WX_SUBSCRIBE_TMPL_GAME_CREATED || '',
    rewardedVideoAdUnitId: '',
    extraConfig: {
      ad: { reward: 3, dailyLimit: 30, enabled: false },
      ads: { rewardedVideoAdUnitId: '' },
    },
    config: {
      webWriteDisabled: false,
      webCreateDisabled: false,
      webEditDisabled: false,
      webInteractDisabled: false,
      miniprogram: {
        name: env.MINIPROGRAM_NAME || '一句话游戏',
        appId: '',
        defaultPath: '/pages/create/create',
        commentDisabled: false,
        llmDisabled: false,
        creditsEarningHidden: false,
        creditsEarningLimited: true,
      },
    },
  };
}

function turboModels(env) {
  const hasKey = !!(env.DEEPSEEK_API_KEY && String(env.DEEPSEEK_API_KEY).length > 0);
  const models = [];
  if (hasKey) {
    models.push({
      id: 'deepseek-v3',
      name: 'DeepSeek',
      creditCost: 1,
      speedLevel: 'fast',
      quality: 'high',
      maxTokens: 16384,
      turboRecommended: true,
      hasDefaultKey: true,
      needsUserKey: false,
    });
  }
  models.push({
    id: 'custom',
    name: '自定义接口',
    creditCost: 0,
    speedLevel: 'normal',
    quality: 'medium',
    maxTokens: 8192,
    turboRecommended: false,
    hasDefaultKey: false,
    needsUserKey: true,
  });
  return { success: true, models, defaultModel: 'deepseek-v3' };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (path === '/health' || path === '/') {
        return json(request, env, { ok: true, service: 'yijuhuayouxi-api' });
      }

      if (path === '/api/site-config' && request.method === 'GET') {
        return json(request, env, siteConfig(env));
      }

      if (path === '/api/turbo-models' && request.method === 'GET') {
        return json(request, env, turboModels(env));
      }

      if (path === '/api/wechat/login' && request.method === 'POST') {
        return handleWechatLogin(request, env);
      }

      if (path === '/api/generate' && request.method === 'POST') {
        let body = {};
        try {
          body = await request.json();
        } catch {
          return json(request, env, { success: false, error: '无效 JSON' }, 400);
        }
        const result = await runGenerate(body, env);
        if (!result.ok) {
          return json(request, env, result.body, result.status);
        }
        return json(request, env, result.body);
      }

      if (path === '/api/user/status' && request.method === 'GET') {
        return json(request, env, {
          success: true,
          allowDevTools: true,
          banned: false,
          banTypes: [],
          banReason: null,
          banExpireAt: null,
        });
      }

      if (path === '/api/credits' && request.method === 'GET') {
        const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
        const user = await getUserByToken(env.USER_KV, token);
        return json(request, env, { success: true, credits: user?.credits ?? 100 });
      }

      if (path === '/api/account/init' && request.method === 'POST') {
        const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
        const user = await getUserByToken(env.USER_KV, token);
        if (!user) {
          return json(request, env, {
            success: false,
            loggedIn: false,
            error: 'not_logged_in',
            message: '请登录',
            userToken: null,
            account: null,
          });
        }
        const displayNickname = user.nickname && user.nickname !== '游戏玩家' ? user.nickname : user.account_id;
        return json(request, env, {
          success: true,
          recovered: false,
          userToken: token,
          account: {
            accountId: user.account_id,
            nickname: displayNickname,
            rawNickname: user.nickname,
            hasPassword: false,
            createdAt: new Date().toISOString(),
          },
        });
      }

      if (path === '/api/account' && request.method === 'GET') {
        const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
        const user = await getUserByToken(env.USER_KV, token);
        if (!user) {
          return json(request, env, { success: false, error: '账号不存在，请刷新页面' }, 404);
        }
        const displayNickname = user.nickname && user.nickname !== '游戏玩家' ? user.nickname : user.account_id;
        return json(request, env, {
          success: true,
          account: {
            account_id: user.account_id,
            accountId: user.account_id,
            nickname: displayNickname,
            rawNickname: user.nickname,
            hasPassword: false,
            has_password: false,
            email: null,
            createdAt: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        });
      }

      if (path === '/api/user/checkin-status' && request.method === 'GET') {
        return json(request, env, {
          success: true,
          data: { checked_in_today: false, streak_days: 0 },
        });
      }

      if (path === '/api/user/checkin' && request.method === 'POST') {
        return json(request, env, {
          success: true,
          data: {
            total_credits: 100,
            total_earned: 5,
            bonus_credits: 0,
            streak_days: 1,
          },
        });
      }

      if (path === '/api/achievements' && request.method === 'GET') {
        return json(request, env, {
          success: true,
          data: { claimable_count: 0, claimable_credits: 0, list: [] },
        });
      }

      if (path === '/api/games' && request.method === 'GET') {
        return json(request, env, {
          success: true,
          games: [],
          data: [],
          pagination: { hasMore: false, total: 0, offset: 0, limit: 20 },
        });
      }

      if (path === '/api/games/recent' && request.method === 'GET') {
        return json(request, env, { success: true, games: [] });
      }

      if (path === '/api/games/hot' && request.method === 'GET') {
        return json(request, env, { success: true, games: [] });
      }

      if (path === '/api/games/featured' && request.method === 'GET') {
        return json(request, env, { success: true, games: [] });
      }

      if (path.startsWith('/api/leaderboard/') && request.method === 'GET') {
        return json(request, env, { success: true, games: [] });
      }

      if (path === '/api/my-games' && request.method === 'GET') {
        return json(request, env, { success: true, games: [] });
      }

      if (path === '/api/my-likes' && request.method === 'GET') {
        return json(request, env, { success: true, games: [] });
      }

      if (path === '/api/my-favorites' && request.method === 'GET') {
        return json(request, env, { success: true, games: [] });
      }

      if (path === '/api/my-comments' && request.method === 'GET') {
        return json(request, env, { success: true, comments: [] });
      }

      if (path === '/api/user/credits-progress' && request.method === 'GET') {
        return json(request, env, { success: true, data: { level: 1, progress: 0 } });
      }

      if (path === '/api/user/subscribe-count' && request.method === 'GET') {
        return json(request, env, { success: true, count: 0 });
      }

      if (path === '/api/user/web-status' && request.method === 'GET') {
        return json(request, env, { success: true, activated: true });
      }

      if (path === '/api/user/creating-tasks' && request.method === 'GET') {
        return json(request, env, { success: true, tasks: [] });
      }

      if (path === '/api/cancel-generation' && request.method === 'POST') {
        return json(request, env, { success: true, message: 'ok' });
      }

      if (path === '/api/cancel-edit' && request.method === 'POST') {
        return json(request, env, { success: true, message: 'ok' });
      }

      if (path === '/api/config/tips' && request.method === 'GET') {
        return json(request, env, { success: true, tips: [] });
      }

      if (path === '/api/config/model-times' && request.method === 'GET') {
        return json(request, env, { success: true, data: {} });
      }

      if (path === '/api/config/share-text' && request.method === 'GET') {
        return json(request, env, { success: true, text: '' });
      }

      if (path === '/api/check-ban' && request.method === 'GET') {
        return json(request, env, { success: true, banned: false });
      }

      if (path === '/api/trial/status' && request.method === 'GET') {
        return json(request, env, { success: true, trialUsed: false });
      }

      if (path === '/api/challenge/current' && request.method === 'GET') {
        return json(request, env, { success: true, challenge: null });
      }

      const userSub = path.match(/^\/api\/users\/([^/]+)\/(profile|follow-stats|games|follow-status)$/);
      if (userSub && request.method === 'GET') {
        const kind = userSub[2];
        if (kind === 'profile') {
          return json(request, env, { success: true, profile: { nickname: '用户', account_id: '—' } });
        }
        if (kind === 'follow-stats') {
          return json(request, env, { success: true, followerCount: 0, followingCount: 0, followers: 0, following: 0 });
        }
        if (kind === 'games') {
          return json(request, env, { success: true, games: [] });
        }
        if (kind === 'follow-status') {
          return json(request, env, { success: true, following: false });
        }
      }

      if (path.match(/^\/api\/users\/[^/]+\/follow$/) && request.method === 'POST') {
        return json(request, env, { success: true, following: true });
      }

      if (path.startsWith('/api/games/') && request.method === 'GET') {
        const parts = path.split('/').filter(Boolean);
        const reserved = new Set(['recent', 'hot', 'featured', 'search']);
        if (parts.length === 3 && !reserved.has(parts[2])) {
          return json(request, env, { success: false, error: '游戏不存在或尚未迁移到云端' }, 404);
        }
      }

      return json(
        request,
        env,
        { success: false, error: '接口尚未在新后端实现', path },
        501
      );
    } catch (e) {
      return json(request, env, { success: false, error: e.message || '服务器错误' }, 500);
    }
  },
};
