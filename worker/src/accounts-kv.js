/**
 * KV 用户：token 映射 + 账号 ID / 昵称 / 邮箱 索引，供网站与小程序登录
 */
import bcrypt from 'bcryptjs';

const PASSWORD_SALT = 'aigame_salt_2025';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  const s = (email || '').trim().toLowerCase();
  if (!s || !EMAIL_RE.test(s)) return '';
  return s;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 邮箱注册用户使用稳定内部 ID（非微信 openid） */
export async function openidForEmail(emailNorm) {
  const h = await sha256Hex(`email_uid|${emailNorm}|${PASSWORD_SALT}`);
  return `em_${h}`;
}

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

/** 写入用户并维护 aid:/nick:/email: 索引（默认昵称不写入 nick，避免大量冲突） */
export async function saveUser(kv, user) {
  const openid = user.wechat_openid;
  if (!openid) throw new Error('user.wechat_openid required');
  const rawPrev = await kv.get(`user:${openid}`);
  let prev = null;
  try {
    prev = rawPrev ? JSON.parse(rawPrev) : null;
  } catch {
    prev = null;
  }
  if (prev && prev.email) {
    const pe = normalizeEmail(prev.email);
    const ne = normalizeEmail(user.email);
    if (pe && pe !== ne) {
      await kv.delete(`email:${pe}`);
    }
  }
  await kv.put(`user:${openid}`, JSON.stringify(user));
  await kv.put(`token:${user.user_token}`, openid);
  if (user.account_id) {
    await kv.put(`aid:${user.account_id}`, openid);
  }
  const em = normalizeEmail(user.email);
  if (em) {
    await kv.put(`email:${em}`, openid);
  }
  const nick = (user.nickname || '').trim();
  if (nick && nick !== '游戏玩家') {
    await kv.put(`nick:${nick.toLowerCase()}`, openid);
  }
}

async function resolveOpenIdForLookup(kv, accountIdInput) {
  const raw = (accountIdInput || '').trim();
  if (!raw) return null;
  if (raw.includes('@')) {
    const em = normalizeEmail(raw);
    if (!em) return null;
    const byEmail = await kv.get(`email:${em}`);
    if (byEmail) return byEmail;
  }
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
    return json(request, env, { success: false, error: '该账号未设置密码，请使用邮箱注册或前往小程序完成绑定' }, 400);
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
      email: user.email || null,
    },
  });
}

/**
 * 微信登录用户绑定邮箱+密码，与网站共用同一账号（同一 KV 用户、积分与作品）
 */
export async function handleBindEmail(request, env, json) {
  if (!env.USER_KV) {
    return json(request, env, { success: false, error: '未配置 USER_KV' }, 503);
  }
  const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
  const user = await getUserByToken(env.USER_KV, token);
  if (!user) {
    return json(request, env, { success: false, error: '当前节点无此账号，请使用 Pages API 或配置 PAGES_API_ORIGIN' }, 404);
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(request, env, { success: false, error: '无效 JSON' }, 400);
  }
  const emailNorm = normalizeEmail(body.email);
  const password = body.password;
  if (!emailNorm) {
    return json(request, env, { success: false, error: '请输入有效邮箱' }, 400);
  }
  if (!password || String(password).length < 8) {
    return json(request, env, { success: false, error: '密码至少 8 位' }, 400);
  }

  const oid = String(user.wechat_openid || '');
  if (oid.startsWith('em_')) {
    return json(request, env, { success: false, error: '当前已是邮箱注册账号，请直接使用邮箱登录网站' }, 400);
  }
  if (normalizeEmail(user.email || '') === emailNorm && user.password_hash) {
    return json(request, env, { success: false, error: '该邮箱已绑定本账号' }, 400);
  }

  const kv = env.USER_KV;
  const taken = await kv.get(`email:${emailNorm}`);
  if (taken && taken !== user.wechat_openid) {
    return json(request, env, {
      success: false,
      error:
        '该邮箱已在网站或其他入口注册。请在小程序选择「邮箱登录」使用原账号，勿使用「微信一键登录」另开新号。',
    }, 400);
  }

  user.email = emailNorm;
  user.password_hash = bcrypt.hashSync(password, 10);
  user.has_password = true;
  user.auth_provider = user.auth_provider === 'email' ? 'email' : 'wechat+email';
  await saveUser(kv, user);

  return json(request, env, {
    success: true,
    message: '绑定成功，可在网站用该邮箱与密码登录，数据与积分与本小程序一致',
    userToken: user.user_token,
    account: {
      accountId: user.account_id,
      nickname: displayNickname(user),
      email: user.email,
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

/**
 * 邮箱 + 密码注册（网站 / 小程序通用）
 */
export async function handleAccountRegister(request, env, json) {
  if (!env.USER_KV) {
    return json(request, env, { success: false, error: '未配置 USER_KV' }, 503);
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(request, env, { success: false, error: '无效 JSON' }, 400);
  }
  const emailNorm = normalizeEmail(body.email);
  const password = body.password;
  const nicknameRaw = (body.nickname || '').trim();

  if (!emailNorm) {
    return json(request, env, { success: false, error: '请输入有效邮箱地址' }, 400);
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return json(request, env, { success: false, error: '密码至少 8 位' }, 400);
  }
  if (nicknameRaw.length > 20) {
    return json(request, env, { success: false, error: '昵称最长 20 个字符' }, 400);
  }

  const kv = env.USER_KV;
  const openid = await openidForEmail(emailNorm);
  const existing = await kv.get(`user:${openid}`);
  if (existing) {
    return json(request, env, { success: false, error: '该邮箱已注册，请直接登录' }, 400);
  }
  const dupEmail = await kv.get(`email:${emailNorm}`);
  if (dupEmail && dupEmail !== openid) {
    return json(request, env, { success: false, error: '该邮箱已被使用' }, 400);
  }

  const user_token = crypto.randomUUID();
  const account_id = 'U' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const password_hash = bcrypt.hashSync(password, 10);
  const user = {
    user_token,
    account_id,
    nickname: nicknameRaw || '游戏玩家',
    wechat_openid: openid,
    email: emailNorm,
    password_hash,
    has_password: true,
    credits: 0,
    created_at: new Date().toISOString(),
    auth_provider: 'email',
  };
  await saveUser(kv, user);

  return json(request, env, {
    success: true,
    userToken: user.user_token,
    account: {
      accountId: user.account_id,
      nickname: displayNickname(user),
      rawNickname: user.nickname,
      hasPassword: true,
      email: user.email || null,
    },
  });
}

/**
 * 已登录用户修改昵称
 */
export async function handleAccountNickname(request, env, json) {
  if (!env.USER_KV) {
    return json(request, env, { success: false, error: '未配置 USER_KV' }, 503);
  }
  const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
  const user = await getUserByToken(env.USER_KV, token);
  if (!user) {
    // 勿用 401：小程序会把任意 401 当作「登录过期」清空本地 token。KV 无此 token 多为已迁 D1（Pages），应改域名或配置 PAGES_API_ORIGIN 转发。
    return json(
      request,
      env,
      {
        success: false,
        error: '当前 API 节点无此账号（可能已使用 Pages+D1 登录）。请将 api 指向 Pages 或在 Worker 配置 PAGES_API_ORIGIN',
      },
      404,
    );
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(request, env, { success: false, error: '无效 JSON' }, 400);
  }
  const nickname = (body.nickname || '').trim();
  if (!nickname || nickname.length > 20) {
    return json(request, env, { success: false, error: '昵称长度 1–20 个字符' }, 400);
  }

  const kv = env.USER_KV;
  const oldNick = (user.nickname || '').trim();
  if (oldNick && oldNick !== '游戏玩家') {
    await kv.delete(`nick:${oldNick.toLowerCase()}`);
  }
  user.nickname = nickname;
  await saveUser(kv, user);

  return json(request, env, {
    success: true,
    account: {
      account_id: user.account_id,
      accountId: user.account_id,
      nickname: displayNickname(user),
      rawNickname: user.nickname,
    },
  });
}

/**
 * 已登录用户修改密码
 */
export async function handleAccountChangePassword(request, env, json) {
  if (!env.USER_KV) {
    return json(request, env, { success: false, error: '未配置 USER_KV' }, 503);
  }
  const token = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
  const user = await getUserByToken(env.USER_KV, token);
  if (!user) {
    return json(request, env, { success: false, error: '当前节点无此账号，请使用 Pages API 或配置 PAGES_API_ORIGIN' }, 404);
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json(request, env, { success: false, error: '无效 JSON' }, 400);
  }
  const oldPassword = body.oldPassword;
  const newPassword = body.newPassword || body.password;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return json(request, env, { success: false, error: '新密码至少 8 位' }, 400);
  }
  const hasPassword = !!(user.has_password && user.password_hash);
  if (hasPassword) {
    if (!oldPassword || !(await verifyPassword(oldPassword, user.password_hash))) {
      return json(request, env, { success: false, error: '当前密码错误' }, 400);
    }
  }
  user.password_hash = bcrypt.hashSync(newPassword, 10);
  user.has_password = true;
  await saveUser(env.USER_KV, user);
  return json(request, env, { success: true, message: '密码已更新' });
}
