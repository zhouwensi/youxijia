import { runGenerate } from './generate.js';
import {
  createGame,
  updateGame,
  getGameDetail,
  listGames,
  listMyGames,
  getGame,
  listCreatingTasksFromDrafts,
  subscribeDraftTaskKv,
} from './games-kv.js';
import {
  getUserByToken,
  saveUser,
  handleAccountLogin,
  handleSecureRecover,
  handleAccountRegister,
  handleAccountNickname,
  handleAccountChangePassword,
  handleBindEmail,
} from './accounts-kv.js';
import { handleAdminRequest } from './admin-kv.js';
import { handleMpCheckin, handleMpCheckinStatus } from './mp-checkin-kv.js';

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

function pickAllowOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = parseOrigins(env);
  if (!origin) return allowed[0] || '*';
  if (allowed.includes(origin)) return origin;
  if (String(env.ALLOW_GITHUB_IO || '') === 'true' && /^https:\/\/[a-zA-Z0-9.-]+\.github\.io$/i.test(origin)) {
    return origin;
  }
  return allowed[0] || '*';
}

function corsHeaders(request, env) {
  const allow = pickAllowOrigin(request, env);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, X-User-Token, X-Author-Token, x-user-token, x-platform, Authorization, X-Admin-Key, X-Admin-Token',
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

/** 积分领取、兑换类接口仅允许微信小程序调用（依赖客户端头 x-platform，请勿在浏览器控制台伪造依赖） */
function isMiniprogramClient(request) {
  return (request.headers.get('x-platform') || '').toLowerCase() === 'miniprogram';
}

function creditsMutationBlockedResponse(request, env) {
  return json(
    request,
    env,
    {
      success: false,
      error: '积分领取与兑换仅支持在微信小程序内完成，请在小程序「积分」页操作',
      creditsRedeemMiniprogramOnly: true,
    },
    403
  );
}

async function sha256Short(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
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
  } else {
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
        email: user.email || '',
        has_password: !!(user.has_password && user.password_hash),
      },
    },
  });
}

/** Cloudflare 控制台有时不能保存「空值」变量，可用 - / none / off 等表示未使用 */
function adUnitIdOrEmpty(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (["-", "—", "none", "null", "n/a", "na", "unused", "off", "no", "skip", "disabled"].includes(lower)) {
    return "";
  }
  return s;
}

function siteConfig(env) {
  const rewardedVideoAdUnitId = adUnitIdOrEmpty(env.REWARDED_VIDEO_AD_UNIT_ID);
  const miniBannerAdUnitId = adUnitIdOrEmpty(env.MINI_BANNER_AD_UNIT_ID);
  const miniBannerMineAdUnitId = adUnitIdOrEmpty(env.MINI_BANNER_MINE_AD_UNIT_ID);
  const interstitialAdUnitId = adUnitIdOrEmpty(env.INTERSTITIAL_AD_UNIT_ID);
  const splashAdUnitId = adUnitIdOrEmpty(env.SPLASH_AD_UNIT_ID);

  return {
    success: true,
    siteName: env.SITE_NAME || '一句话游戏',
    siteSlogan: env.SITE_SLOGAN || '一句话生成游戏',
    miniprogramName: env.MINIPROGRAM_NAME || 'JustOneWord',
    webCreateDisabled: false,
    webEditDisabled: false,
    webInteractDisabled: false,
    webWriteDisabled: false,
    miniprogramCommentDisabled: false,
    miniprogramLLMDisabled: false,
    creditsEarningHidden: false,
    creditsEarningLimited: true,
    creditsRedeemMiniprogramOnly: true,
    inviteReward: 3,
    wxSubscribeTmplId: env.WX_SUBSCRIBE_TMPL_GAME_CREATED || '',
    rewardedVideoAdUnitId: rewardedVideoAdUnitId,
    miniBannerAdUnitId: miniBannerAdUnitId,
    miniBannerMineAdUnitId: miniBannerMineAdUnitId,
    extraConfig: {
      ad: { reward: 3, dailyLimit: 30, enabled: false },
      ads: {
        rewardedVideoAdUnitId: rewardedVideoAdUnitId,
        miniBannerAdUnitId: miniBannerAdUnitId,
        miniBannerMineAdUnitId: miniBannerMineAdUnitId,
        interstitialAdUnitId: interstitialAdUnitId,
        splashAdUnitId: splashAdUnitId,
      },
    },
    config: {
      webWriteDisabled: false,
      webCreateDisabled: false,
      webEditDisabled: false,
      webInteractDisabled: false,
      miniprogram: {
        name: env.MINIPROGRAM_NAME || 'JustOneWord',
        appId: '',
        defaultPath: '/pages/create/create',
        commentDisabled: false,
        llmDisabled: false,
        creditsEarningHidden: false,
        creditsEarningLimited: true,
        creditsRedeemMiniprogramOnly: true,
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
      maxTokens: 8192,
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

/**
 * 自定义域仍挂在旧 KV Worker、但微信登录 / 小程序特权 / D1 积分等走 Pages Functions 时，将请求转发到 Pages 源站。
 * 优先读环境变量 PAGES_API_ORIGIN（勿尾斜杠）；未配置时用与 Pages 项目名一致的 *.pages.dev，避免忘配导致 501。
 */
const DEFAULT_PAGES_API_ORIGIN = 'https://youxijia.pages.dev';

function pagesAccountForwardBase(env) {
  const raw = (env.PAGES_API_ORIGIN || '').trim().replace(/\/$/, '');
  return raw || DEFAULT_PAGES_API_ORIGIN;
}

function shouldForwardToPages(path, method) {
  if (path === '/api/wechat/login' && method === 'POST') return true;
  if (path === '/api/account' && method === 'GET') return true;
  if (path === '/api/account/nickname' && method === 'PUT') return true;
  // 登录/注册/初始化必须与 GET /api/account 同源（D1），否则 KV token 在 Pages 查账号会 404
  if (path === '/api/account/login' && method === 'POST') return true;
  if (path === '/api/account/register' && method === 'POST') return true;
  if (path === '/api/account/init' && method === 'POST') return true;
  // 积分与签到以 Pages+D1 为准（避免本 Worker 桩数据与真实账户不一致）
  if (path === '/api/credits' && method === 'GET') return true;
  if (path === '/api/user/checkin' && method === 'POST') return true;
  if (path === '/api/user/checkin-status' && method === 'GET') return true;
  // 小程序兑换码/配额/插屏计数仅在 Pages Functions + D1 实现
  if (path.startsWith('/api/mp/privilege/')) return true;
  // 本站 / 通行证：兑换码核销、积分总账、通行证密钥、跨站权益（见 functions/lib/privilege-redeem.ts）
  if (path === '/api/hub/privilege/redeem' && method === 'POST') return true;
  if (path === '/api/hub/points-ledger' && method === 'GET') return true;
  if (path === '/api/hub/link-token/create' && method === 'POST') return true;
  if (path === '/api/hub/cross-entitlements' && method === 'GET') return true;
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      const pagesBase = pagesAccountForwardBase(env);
      if (pagesBase && shouldForwardToPages(path, request.method)) {
        const forwardUrl = `${pagesBase}${path}${url.search}`;
        return fetch(new Request(forwardUrl, request));
      }

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
        if (!token || !String(token).trim()) {
          return json(request, env, { success: true, credits: 100 });
        }
        const user = await getUserByToken(env.USER_KV, token);
        if (!user) {
          return json(request, env, { success: true, credits: 0 });
        }
        return json(request, env, { success: true, credits: user.credits ?? 0 });
      }

      if (path.startsWith('/api/credits/') && request.method === 'POST' && path !== '/api/credits') {
        if (!isMiniprogramClient(request)) {
          return creditsMutationBlockedResponse(request, env);
        }
      }

      if (path === '/api/credits/daily-login' && request.method === 'POST') {
        const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
        if (!token || !String(token).trim()) {
          return json(request, env, { success: false, error: '缺少用户标识' }, 400);
        }
        return json(request, env, {
          success: false,
          error: '今日已领取',
          alreadyClaimed: true,
        });
      }

      const authorLbMatch = path.match(/^\/api\/author-leaderboard\/([^/]+)$/);
      if (authorLbMatch && request.method === 'GET') {
        const lbType = authorLbMatch[1];
        const validLb = ['fans', 'works', 'credits', 'popularity', 'newstar'];
        if (!validLb.includes(lbType)) {
          return json(request, env, { success: false, error: '无效的榜单类型' }, 400);
        }
        const lbTitles = {
          fans: '🏆 粉丝榜',
          works: '📚 作品榜',
          credits: '💎 积分榜',
          popularity: '🔥 人气榜',
          newstar: '⭐ 新星榜',
        };
        const lbLabels = {
          fans: '粉丝',
          works: '作品',
          credits: '积分',
          popularity: '人气值',
          newstar: '综合分',
        };
        const period = url.searchParams.get('period') || 'all';
        const periodLabel = period === 'week' ? '周榜' : period === 'month' ? '月榜' : '总榜';
        const titleBase = lbTitles[lbType];
        return json(request, env, {
          success: true,
          type: lbType,
          title: period !== 'all' ? `${titleBase}·${periodLabel}` : titleBase,
          period,
          periodLabel,
          list: [],
          total: 0,
          updated_at: new Date().toISOString(),
        });
      }

      if (path === '/api/account/login' && request.method === 'POST') {
        return handleAccountLogin(request, env, json);
      }

      if (path === '/api/account/register' && request.method === 'POST') {
        return handleAccountRegister(request, env, json);
      }

      if (path === '/api/account/nickname' && request.method === 'PUT') {
        return handleAccountNickname(request, env, json);
      }

      if (path === '/api/account/change-password' && request.method === 'POST') {
        return handleAccountChangePassword(request, env, json);
      }

      if (path === '/api/account/password' && request.method === 'POST') {
        return handleAccountChangePassword(request, env, json);
      }

      if (path === '/api/account/bind-email' && request.method === 'POST') {
        return handleBindEmail(request, env, json);
      }

      if (path === '/api/account/secure-recover' && request.method === 'POST') {
        return handleSecureRecover(request, env, json);
      }

      if (path === '/api/account/init' && request.method === 'POST') {
        const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
        let body = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }
        const deviceFingerprint = body.deviceFingerprint || '';
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
        if (deviceFingerprint) {
          user.device_fingerprint = deviceFingerprint;
          await saveUser(env.USER_KV, user);
        } else {
          await saveUser(env.USER_KV, user);
        }
        const displayNickname = user.nickname && user.nickname !== '游戏玩家' ? user.nickname : user.account_id;
        const hasPassword = !!(user.has_password && user.password_hash);
        return json(request, env, {
          success: true,
          recovered: false,
          userToken: token,
          account: {
            accountId: user.account_id,
            nickname: displayNickname,
            rawNickname: user.nickname,
            hasPassword,
            createdAt: user.created_at || new Date().toISOString(),
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
        const hasPassword = !!(user.has_password && user.password_hash);
        return json(request, env, {
          success: true,
          account: {
            account_id: user.account_id,
            accountId: user.account_id,
            nickname: displayNickname,
            rawNickname: user.nickname,
            hasPassword,
            has_password: hasPassword,
            email: user.email || null,
            createdAt: user.created_at || new Date().toISOString(),
            created_at: user.created_at || new Date().toISOString(),
          },
        });
      }

      if (path === '/api/user/checkin-status' && request.method === 'GET') {
        return handleMpCheckinStatus(request, env, (data, status = 200) => json(request, env, data, status));
      }

      if (path === '/api/user/checkin' && request.method === 'POST') {
        if (!isMiniprogramClient(request)) {
          return creditsMutationBlockedResponse(request, env);
        }
        return handleMpCheckin(request, env, (data, status = 200) => json(request, env, data, status));
      }

      if (path === '/api/achievements' && request.method === 'GET') {
        return json(request, env, {
          success: true,
          data: { claimable_count: 0, claimable_credits: 0, list: [] },
        });
      }

      const kvGames = env.USER_KV;

      if (path === '/api/games/search' || path.startsWith('/api/games/search/')) {
        if (request.method === 'GET') {
          return json(request, env, { success: true, games: [], pagination: { total: 0, hasMore: false } });
        }
      }

      if (path === '/api/games' && request.method === 'GET') {
        if (!kvGames) {
          return json(request, env, {
            success: true,
            games: [],
            pagination: { hasMore: false, total: 0, offset: 0, limit: 20 },
          });
        }
        const r = await listGames(kvGames, url);
        return json(request, env, r.body);
      }

      if (path === '/api/games' && request.method === 'POST') {
        if (!kvGames) {
          return json(request, env, { success: false, error: 'KV 未配置' }, 503);
        }
        let body = {};
        try {
          body = await request.json();
        } catch {
          return json(request, env, { success: false, error: '无效 JSON' }, 400);
        }
        const r = await createGame(kvGames, body);
        return json(request, env, r.body, r.ok ? 200 : r.status);
      }

      if (path === '/api/games/recent' && request.method === 'GET') {
        if (!kvGames) return json(request, env, { success: true, games: [] });
        const u = new URL(url.href);
        u.pathname = '/api/games';
        if (!u.searchParams.has('limit')) u.searchParams.set('limit', '10');
        const r = await listGames(kvGames, u);
        return json(request, env, { success: true, games: r.body.games || [] });
      }

      if (path === '/api/games/hot' && request.method === 'GET') {
        if (!kvGames) return json(request, env, { success: true, games: [] });
        const u = new URL(url.href);
        u.pathname = '/api/games';
        u.searchParams.set('sort', 'hot');
        if (!u.searchParams.has('limit')) u.searchParams.set('limit', '10');
        const r = await listGames(kvGames, u);
        return json(request, env, { success: true, games: r.body.games || [] });
      }

      if (path === '/api/games/featured' && request.method === 'GET') {
        if (!kvGames) return json(request, env, { success: true, games: [] });
        const u = new URL(url.href);
        u.pathname = '/api/games';
        if (!u.searchParams.has('limit')) u.searchParams.set('limit', '10');
        const r = await listGames(kvGames, u);
        return json(request, env, { success: true, games: r.body.games || [] });
      }

      if (path.startsWith('/api/leaderboard/') && request.method === 'GET') {
        if (!kvGames) return json(request, env, { success: true, games: [] });
        const u = new URL(url.href);
        u.pathname = '/api/games';
        u.searchParams.set('sort', 'hot');
        if (!u.searchParams.has('limit')) u.searchParams.set('limit', '20');
        const r = await listGames(kvGames, u);
        return json(request, env, { success: true, games: r.body.games || [] });
      }

      if (path === '/api/my-games' && request.method === 'GET') {
        if (!kvGames) {
          return json(request, env, {
            success: true,
            games: [],
            stats: { count: 0, plays: 0, likes: 0 },
          });
        }
        const authorToken =
          request.headers.get('x-author-token') ||
          request.headers.get('X-Author-Token') ||
          request.headers.get('x-user-token') ||
          request.headers.get('X-User-Token');
        const r = await listMyGames(kvGames, authorToken);
        return json(request, env, r.body);
      }

      const putGameId = path.match(/^\/api\/games\/([^/]+)$/);
      if (putGameId && request.method === 'PUT') {
        const id = putGameId[1];
        if (!['recent', 'hot', 'featured', 'search'].includes(id)) {
          if (!kvGames) {
            return json(request, env, { success: false, error: 'KV 未配置' }, 503);
          }
          let body = {};
          try {
            body = await request.json();
          } catch {
            body = {};
          }
          const hdr = request.headers.get('x-author-token') || request.headers.get('X-Author-Token');
          const r = await updateGame(kvGames, id, body, hdr);
          return json(request, env, r.body, r.ok ? 200 : r.status);
        }
      }

      const getGameId = path.match(/^\/api\/games\/([^/]+)$/);
      if (getGameId && request.method === 'GET') {
        const id = getGameId[1];
        if (!['recent', 'hot', 'featured', 'search'].includes(id)) {
          if (!kvGames) {
            return json(request, env, { success: false, error: '游戏不存在' }, 404);
          }
          const r = await getGameDetail(kvGames, id);
          return json(request, env, r.body, r.ok ? 200 : r.status);
        }
      }

      const subGame = path.match(/^\/api\/games\/([^/]+)\/(like-status|favorite-status|can-edit|stats)$/);
      if (subGame && request.method === 'GET') {
        const id = subGame[1];
        const kind = subGame[2];
        if (kind === 'like-status' || kind === 'favorite-status') {
          return json(request, env, { success: true, liked: false, favorited: false });
        }
        if (kind === 'stats') {
          return json(request, env, { success: true, plays: 0, likes: 0, favorites: 0, comments: 0 });
        }
        if (kind === 'can-edit') {
          if (!kvGames) {
            return json(request, env, { success: true, canEdit: false, reason: '未登录' });
          }
          const g = await getGame(kvGames, id);
          if (!g) return json(request, env, { success: false, error: '游戏不存在' }, 404);
          const ut = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
          const at = request.headers.get('x-author-token') || request.headers.get('X-Author-Token');
          const isAuthor = g.author_token === ut || g.author_token === at;
          return json(request, env, {
            success: true,
            canEdit: isAuthor,
            isAuthor,
            isAdmin: false,
            reason: isAuthor ? '作者' : '无权限',
          });
        }
      }

      if (path.match(/^\/api\/games\/[^/]+\/like$/) && request.method === 'POST') {
        return json(request, env, { success: true, liked: true, likeCount: 1, creditAwarded: false });
      }

      if (path.match(/^\/api\/games\/[^/]+\/favorite$/) && request.method === 'POST') {
        return json(request, env, { success: true, favorited: true, favoriteCount: 1 });
      }

      if (path.match(/^\/api\/games\/[^/]+\/play$/) && request.method === 'POST') {
        return json(request, env, { success: true });
      }

      if (path.match(/^\/api\/games\/[^/]+\/verify$/) && request.method === 'POST') {
        return json(request, env, { success: true, isAuthor: true });
      }

      if (path.match(/^\/api\/games\/[^/]+\/comments/) && request.method === 'GET') {
        return json(request, env, { success: true, comments: [] });
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
        const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
        if (!token || !String(token).trim()) {
          return json(request, env, { success: false, error: '未登录' }, 401);
        }
        const user = await getUserByToken(env.USER_KV, token);
        if (!user) return json(request, env, { success: false, error: '用户不存在' }, 404);
        const tasks = kvGames ? await listCreatingTasksFromDrafts(kvGames, token) : [];
        return json(request, env, { success: true, tasks, count: tasks.length });
      }

      const taskSub = path.match(/^\/api\/task\/([^/]+)\/subscribe$/);
      if (taskSub && request.method === 'POST') {
        const taskId = taskSub[1];
        const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
        if (!token || !String(token).trim()) {
          return json(request, env, { success: false, error: '未登录' }, 401);
        }
        if (!taskId || !String(taskId).startsWith('sync_')) {
          return json(request, env, { success: false, error: '任务不存在或已完成' }, 404);
        }
        const gameId = taskId.slice('sync_'.length);
        const user = await getUserByToken(env.USER_KV, token);
        if (!user) return json(request, env, { success: false, error: '用户不存在' }, 404);
        if (!kvGames) return json(request, env, { success: false, error: 'KV 未配置' }, 503);
        const r = await subscribeDraftTaskKv(kvGames, gameId, token, user);
        return json(request, env, r.body, r.ok ? 200 : r.status);
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

      if (path.startsWith('/api/admin')) {
        return handleAdminRequest(request, env, url, json);
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
