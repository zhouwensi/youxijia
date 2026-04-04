/**
 * Worker 管理后台：ADMIN_KEY + KV 中的游戏与站点配置（无 SQLite / 无本地文件）
 */
import {
  getGame,
  readIndex,
  adminListGames,
  adminUpdateGameFlags,
  adminDeleteGame,
} from './games-kv.js';

const CONFIG_KEY = 'admin:system_config';

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
          defaultMaxTokens: 16384,
          configuredCredits: null,
          configuredQuality: null,
          configuredMaxTokens: null,
          hasApiKey: hasKey,
          maskedApiKey: hasKey ? '（已配置 Secret DEEPSEEK_API_KEY）' : null,
          creditCost: 1,
          maxTokens: 16384,
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
