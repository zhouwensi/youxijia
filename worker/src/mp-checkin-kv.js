/**
 * 无 PAGES_API_ORIGIN 转发时：基于 USER_KV 的小程序签到（与 server.js 规则一致）
 * @param {(data: unknown, status?: number) => Response} respond  — 使用 index.js 的 json() 以统一 CORS
 */
import { getUserByToken, saveUser } from './accounts-kv.js';

function formatCreditsValue(credits) {
  if (typeof credits !== 'number' || Number.isNaN(credits)) return 0;
  return Math.round(credits * 10) / 10;
}

function getNextStreakBonus(currentStreak) {
  if (currentStreak < 3) return { days: 3, bonus: 1, remaining: 3 - currentStreak };
  if (currentStreak < 7) return { days: 7, bonus: 2, remaining: 7 - currentStreak };
  if (currentStreak < 14) return { days: 14, bonus: 3, remaining: 14 - currentStreak };
  if (currentStreak < 30) return { days: 30, bonus: 5, remaining: 30 - currentStreak };
  return { days: 30, bonus: 5, remaining: 0, message: '已达最高连续签到加成！' };
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr() {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return y.toISOString().split('T')[0];
}

function dayKey(token, date) {
  return `mp_checkin_day:v1:${token}:${date}`;
}

function metaKey(token) {
  return `mp_checkin_meta:v1:${token}`;
}

export async function handleMpCheckinStatus(request, env, respond) {
  const kv = env.USER_KV;
  const userToken = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
  if (!userToken) {
    return respond({ success: false, error: '请先登录' }, 401);
  }
  if (!kv) {
    return respond({ success: false, error: '服务未配置 USER_KV' }, 503);
  }
  const user = await getUserByToken(kv, userToken);
  if (!user) {
    return respond({ success: false, error: '用户不存在' }, 404);
  }

  const today = todayStr();
  const signedToday = await kv.get(dayKey(userToken, today));
  const metaRaw = await kv.get(metaKey(userToken));
  let meta = null;
  try {
    meta = metaRaw ? JSON.parse(metaRaw) : null;
  } catch {
    meta = null;
  }

  let currentStreak = 0;
  if (meta && meta.lastCheckinDate) {
    const lastDate = new Date(meta.lastCheckinDate + 'T12:00:00Z');
    const todayDate = new Date(today + 'T12:00:00Z');
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) currentStreak = meta.streakDays || 0;
    else if (diffDays === 1) currentStreak = meta.streakDays || 0;
    else currentStreak = 0;
  }

  return respond({
    success: true,
    data: {
      checked_in_today: !!signedToday,
      streak_days: currentStreak,
      next_bonus: getNextStreakBonus(currentStreak),
      month_checkins: 0,
      last_checkin: meta?.lastCheckinDate || null,
    },
  });
}

export async function handleMpCheckin(request, env, respond) {
  const kv = env.USER_KV;
  const userToken = request.headers.get('x-user-token') || request.headers.get('X-User-Token');
  if (!userToken) {
    return respond({ success: false, error: '请先登录' }, 401);
  }
  if (!kv) {
    return respond({ success: false, error: '服务未配置 USER_KV' }, 503);
  }

  const user = await getUserByToken(kv, userToken);
  if (!user) {
    return respond({ success: false, error: '用户不存在' }, 404);
  }

  const today = todayStr();
  const dk = dayKey(userToken, today);
  if (await kv.get(dk)) {
    const metaRaw = await kv.get(metaKey(userToken));
    let meta = null;
    try {
      meta = metaRaw ? JSON.parse(metaRaw) : null;
    } catch {
      meta = null;
    }
    return respond({
      success: false,
      error: '今日已签到',
      data: {
        already_checked_in: true,
        streak_days: meta?.streakDays ?? 1,
        checkin_date: today,
      },
    });
  }

  const ystr = yesterdayStr();
  const metaRaw = await kv.get(metaKey(userToken));
  let prevMeta = null;
  try {
    prevMeta = metaRaw ? JSON.parse(metaRaw) : null;
  } catch {
    prevMeta = null;
  }

  let streakDays = 1;
  if (prevMeta && prevMeta.lastCheckinDate === ystr && typeof prevMeta.streakDays === 'number') {
    streakDays = prevMeta.streakDays + 1;
  }

  let bonusCredits = 0;
  if (streakDays >= 30) bonusCredits = 5;
  else if (streakDays >= 14) bonusCredits = 3;
  else if (streakDays >= 7) bonusCredits = 2;
  else if (streakDays >= 3) bonusCredits = 1;

  const rewardCredits = 1;
  const totalReward = rewardCredits + bonusCredits;
  const prevCredits = typeof user.credits === 'number' && !Number.isNaN(user.credits) ? user.credits : 0;
  user.credits = prevCredits + totalReward;
  await saveUser(kv, user);
  await kv.put(dk, '1');
  await kv.put(metaKey(userToken), JSON.stringify({ lastCheckinDate: today, streakDays }));

  return respond({
    success: true,
    data: {
      credits_earned: formatCreditsValue(rewardCredits),
      bonus_credits: formatCreditsValue(bonusCredits),
      total_earned: formatCreditsValue(totalReward),
      streak_days: streakDays,
      total_credits: formatCreditsValue(user.credits),
      next_bonus: getNextStreakBonus(streakDays),
    },
  });
}
