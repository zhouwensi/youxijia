/**
 * POST /api/user/checkin、GET /api/user/checkin-status（D1，与 server.js 行为对齐）
 */
import { json, type Db } from "./http";
import { getUserTokenFromRequest } from "./cf-helpers";
import { getConfig } from "./db";

export type CheckinRouteCtx = {
  request: Request;
  db: Db;
  method: string;
  segs: string[];
};

function isMiniprogramClient(request: Request): boolean {
  return (request.headers.get("x-platform") || "").toLowerCase() === "miniprogram";
}

function formatCreditsValue(credits: number): number {
  if (typeof credits !== "number" || Number.isNaN(credits)) return 0;
  return Math.round(credits * 10) / 10;
}

function getPeriodStartMonthly(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function getNextStreakBonus(currentStreak: number): Record<string, unknown> {
  if (currentStreak < 3) {
    return { days: 3, bonus: 1, remaining: 3 - currentStreak };
  }
  if (currentStreak < 7) {
    return { days: 7, bonus: 2, remaining: 7 - currentStreak };
  }
  if (currentStreak < 14) {
    return { days: 14, bonus: 3, remaining: 14 - currentStreak };
  }
  if (currentStreak < 30) {
    return { days: 30, bonus: 5, remaining: 30 - currentStreak };
  }
  return { days: 30, bonus: 5, remaining: 0, message: "已达最高连续签到加成！" };
}

async function ensureUserCreditsRow(db: Db, userToken: string): Promise<void> {
  const initial = parseInt((await getConfig(db, "credits_initial", "3")) || "3", 10);
  await db
    .prepare("INSERT OR IGNORE INTO user_credits (user_token, credits, total_earned) VALUES (?, ?, ?)")
    .bind(userToken, initial, initial)
    .run();
}

export async function tryCheckinRoutes(ctx: CheckinRouteCtx): Promise<Response | null> {
  const { request, db, method, segs } = ctx;

  if (method === "GET" && segs[0] === "user" && segs[1] === "checkin-status" && segs.length === 2) {
    const userToken = getUserTokenFromRequest(request);
    if (!userToken) {
      return json({ success: false, error: "请先登录" }, 401);
    }
    const exists = await db
      .prepare("SELECT 1 AS x FROM user_accounts WHERE user_token = ?")
      .bind(userToken)
      .first();
    if (!exists) return json({ success: false, error: "用户不存在" }, 404);

    const today = new Date().toISOString().split("T")[0];
    const todayCheckin = await db
      .prepare("SELECT * FROM user_checkins WHERE user_token = ? AND checkin_date = ?")
      .bind(userToken, today)
      .first<Record<string, unknown>>();

    const latestCheckin = await db
      .prepare(
        "SELECT * FROM user_checkins WHERE user_token = ? ORDER BY checkin_date DESC LIMIT 1",
      )
      .bind(userToken)
      .first<{ checkin_date: string; streak_days: number }>();

    let currentStreak = 0;
    if (latestCheckin) {
      const lastDate = new Date(latestCheckin.checkin_date + "T12:00:00Z");
      const todayDate = new Date(today + "T12:00:00Z");
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        currentStreak = latestCheckin.streak_days;
      } else if (diffDays === 1) {
        currentStreak = latestCheckin.streak_days;
      } else {
        currentStreak = 0;
      }
    }

    const monthStart = getPeriodStartMonthly();
    const monthRow = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM user_checkins WHERE user_token = ? AND checkin_date >= ?",
      )
      .bind(userToken, monthStart)
      .first<{ c: number }>();

    return json({
      success: true,
      data: {
        checked_in_today: !!todayCheckin,
        streak_days: currentStreak,
        next_bonus: getNextStreakBonus(currentStreak),
        month_checkins: monthRow?.c ?? 0,
        last_checkin: latestCheckin?.checkin_date ?? null,
      },
    });
  }

  if (method === "POST" && segs[0] === "user" && segs[1] === "checkin" && segs.length === 2) {
    if (!isMiniprogramClient(request)) {
      return json(
        {
          success: false,
          error: "签到功能仅在小程序端可用，请打开小程序进行签到",
        },
        403,
      );
    }
    const userToken = getUserTokenFromRequest(request);
    if (!userToken) {
      return json({ success: false, error: "请先登录" }, 401);
    }
    const acc = await db
      .prepare("SELECT 1 AS x FROM user_accounts WHERE user_token = ?")
      .bind(userToken)
      .first();
    if (!acc) return json({ success: false, error: "用户不存在" }, 404);

    const today = new Date().toISOString().split("T")[0];

    const existingCheckin = await db
      .prepare("SELECT * FROM user_checkins WHERE user_token = ? AND checkin_date = ?")
      .bind(userToken, today)
      .first<{ streak_days: number; checkin_date: string }>();

    if (existingCheckin) {
      return json({
        success: false,
        error: "今日已签到",
        data: {
          already_checked_in: true,
          streak_days: existingCheckin.streak_days,
          checkin_date: existingCheckin.checkin_date,
        },
      });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const yesterdayCheckin = await db
      .prepare("SELECT streak_days FROM user_checkins WHERE user_token = ? AND checkin_date = ?")
      .bind(userToken, yesterdayStr)
      .first<{ streak_days: number }>();

    const streakDays = yesterdayCheckin ? yesterdayCheckin.streak_days + 1 : 1;
    const rewardCredits = 1;
    let bonusCredits = 0;
    if (streakDays >= 30) bonusCredits = 5;
    else if (streakDays >= 14) bonusCredits = 3;
    else if (streakDays >= 7) bonusCredits = 2;
    else if (streakDays >= 3) bonusCredits = 1;

    const totalCredits = rewardCredits + bonusCredits;
    let description = "每日签到奖励";
    if (bonusCredits > 0) {
      description += ` + 连续${streakDays}天签到加成`;
    }

    await ensureUserCreditsRow(db, userToken);

    await db
      .prepare(
        `INSERT INTO user_checkins (user_token, checkin_date, streak_days, reward_credits)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(userToken, today, streakDays, totalCredits)
      .run();

    await db
      .prepare(
        `UPDATE user_credits
         SET credits = credits + ?, total_earned = total_earned + ?, updated_at = datetime('now')
         WHERE user_token = ?`,
      )
      .bind(totalCredits, totalCredits, userToken)
      .run();

    await db
      .prepare(
        "INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, 'checkin', ?)",
      )
      .bind(userToken, totalCredits, description)
      .run();

    const userCredits = await db
      .prepare("SELECT credits FROM user_credits WHERE user_token = ?")
      .bind(userToken)
      .first<{ credits: number }>();

    const totalCreditsNum = userCredits?.credits ?? 0;

    return json({
      success: true,
      data: {
        credits_earned: formatCreditsValue(rewardCredits),
        bonus_credits: formatCreditsValue(bonusCredits),
        total_earned: formatCreditsValue(totalCredits),
        streak_days: streakDays,
        total_credits: formatCreditsValue(totalCreditsNum),
        next_bonus: getNextStreakBonus(streakDays),
      },
    });
  }

  return null;
}
