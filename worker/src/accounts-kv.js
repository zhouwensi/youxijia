/**
 * KV 用户：token 映射 + 账号 ID / 昵称 索引，供网站登录与安全恢复
 */
import bcrypt from 'bcryptjs';

const PASSWORD_SALT = 'aigame_salt_2025';

export async function getUserByToken(kv, token) {
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

async function sha256HexPassword(password) {
  const enc = new TextEncoder().encode(password + PASSWORD_SALT);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 与 Node security.js 一致：$2 为 bcrypt，否则旧版 SHA256 hex */
export async function verifyPassword(password, hash) {
  if (!hash || typeof hash !== 'string') return false;
  if (hash.startsWith('$2')) {
    return bcrypt.compareSync(password, hash);
  }
  const hex = await sha256HexPassword(password);
  return hex === hash;
}

/** 写入用户并维护 aid:/nick: 索引（默认昵称不写入 nick，避免大量冲突） */
export async function saveUser(kv, user) {
  const openid = user.wechat_openid;
  if (!openid) throw new Error('user.wechat_openid required');
  await kv.put(`user:${openid}`, JSON.stringify(user));
  await kv.put(`token:${user.user_token}`, openid);
  if (user.account_id) {
    await kv.put(`aid:${user.account_id}`, openid);
  }
  const nick = (user.nickname || '').trim();
  if (nick && nick !== '游戏玩家') {
    await kv.put(`nick:${nick.toLowerCase()}`, openid);
  }
}

async function resolveOpenIdForLookup(kv, accountIdInput) {
  const raw = (accountIdInput || '').trim();
  if (!raw) return null;
  let openid = await kv.get(`aid:${raw}`);
  if (openid) return openid;
  openid = await kv.get(`nick:${raw.toLowerCase()}`);
  return openid || null;
}

function displayNickname(user) {
  if (user.nickname && user.nickname !== '游戏玩家') return user.nickname;
  return user.account_id;
}

/**
 * @param {Function} json - (req, env, data, status) => Response
 */
export async function handleAccountLogin(request, env, json) {
  if (!env.USER_KV) {
    return json(request, env, { success: false, error: '未配置 USER_KV' }, 503);
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(request, env, { success: false, error: '无效 JSON' }, 400);
  }
  const accountId = (body.accountId || '').trim();
  const password = body.password;
  if (!accountId || !password) {
    return json(request, env, { success: false, error: '请输入账号和密码' }, 400);
  }

  const kv = env.USER_KV;
  const openid = await resolveOpenIdForLookup(kv, accountId);
  if (!openid) {
    return json(request, env, { success: false, error: '账号不存在，请使用账号ID或已设置的昵称登录' }, 400);
  }
  const raw = await kv.get(`user:${openid}`);
  let user;
  try {
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }
  if (!user) {
    return json(request, env, { success: false, error: '账号不存在，请使用账号ID或已设置的昵称登录' }, 400);
  }

  const hasPassword = !!(user.has_password && user.password_hash);
  if (!hasPassword) {
    return json(request, env, { success: false, error: '该账号未设置密码，请先在小程序中绑定网站账号' }, 400);
  }

  const passwordMatch = await verifyPassword(password, user.password_hash);
  if (!passwordMatch) {
    return json(request, env, { success: false, error: '密码错误' }, 400);
  }

  await saveUser(kv, user);

  return json(request, env, {
    success: true,
    userToken: user.user_token,
    account: {
      accountId: user.account_id,
      nickname: displayNickname(user),
      rawNickname: user.nickname,
      hasPassword: true,
    },
  });
}

/**
 * 与 Node /api/account/secure-recover 对齐：密码正确或同设备指纹可恢复
 */
export async function handleSecureRecover(request, env, json) {
  if (!env.USER_KV) {
    return json(request, env, { success: false, error: '未配置 USER_KV' }, 503);
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(request, env, { success: false, error: '无效 JSON' }, 400);
  }
  const accountId = (body.accountId || '').trim();
  const password = body.password;
  const deviceFingerprint = body.deviceFingerprint || '';
  if (!accountId) {
    return json(request, env, { success: false, error: '请输入账号ID或昵称' }, 400);
  }

  const kv = env.USER_KV;
  const openid = await resolveOpenIdForLookup(kv, accountId);
  if (!openid) {
    return json(request, env, { success: false, error: '账号不存在' }, 404);
  }
  const raw = await kv.get(`user:${openid}`);
  let user;
  try {
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }
  if (!user) {
    return json(request, env, { success: false, error: '账号不存在' }, 404);
  }

  const isSameDevice =
    !!(deviceFingerprint && user.device_fingerprint && user.device_fingerprint === deviceFingerprint);
  const hasPassword = !!(user.has_password && user.password_hash);

  let passwordCorrect = false;
  if (hasPassword && password) {
    passwordCorrect = await verifyPassword(password, user.password_hash);
  }

  if (hasPassword && !passwordCorrect && !isSameDevice) {
    return json(
      request,
      env,
      {
        success: false,
        error: '该账号已设置密码，请输入正确密码',
        needPassword: true,
      },
      400
    );
  }

  if (deviceFingerprint) {
    user.device_fingerprint = deviceFingerprint;
  }
  await saveUser(kv, user);

  return json(request, env, {
    success: true,
    userToken: user.user_token,
    account: {
      accountId: user.account_id,
      nickname: displayNickname(user),
      rawNickname: user.nickname,
      hasPassword: !!user.has_password,
      createdAt: user.created_at || new Date().toISOString(),
    },
    warning: !hasPassword ? '建议设置密码以保护账号安全' : null,
  });
}
