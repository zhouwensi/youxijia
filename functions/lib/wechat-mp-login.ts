/**
 * POST /api/wechat/login — 小程序 wx.login() 换 openid，签发本站 user_token
 */
import type { Env } from "../types";
import { json, type Db, clientIp } from "./http";
import { getConfig } from "./db";

function generateAccountId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `player_${s}`;
}

async function uniqueAccountId(db: Db): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const id = generateAccountId();
    const row = await db.prepare("SELECT 1 AS x FROM user_accounts WHERE account_id = ?").bind(id).first();
    if (!row) return id;
  }
  return `player_${Date.now().toString(36)}`;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function handleWechatMiniProgramLogin(
  request: Request,
  env: Env,
  db: Db,
): Promise<Response> {
  const body = await readJson(request);
  const code = String(body.code || "").trim();
  if (!code) return json({ success: false, error: "缺少 code" }, 400);

  const appid = (env.WX_MINI_APPID || "").trim();
  const secret = (env.WX_MINI_SECRET || "").trim();
  if (!appid || !secret) {
    return json(
      {
        success: false,
        error: "服务器未配置微信小程序：请在 Pages 环境变量中设置 WX_MINI_APPID 与 WX_MINI_SECRET（均为 Secret）",
      },
      503,
    );
  }

  const wxUrl =
    "https://api.weixin.qq.com/sns/jscode2session" +
    `?appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}` +
    `&js_code=${encodeURIComponent(code)}` +
    "&grant_type=authorization_code";

  const wxRes = await fetch(wxUrl);
  const wxText = await wxRes.text();
  let wxData: { openid?: string; session_key?: string; errcode?: number; errmsg?: string };
  try {
    wxData = JSON.parse(wxText) as typeof wxData;
  } catch {
    return json({ success: false, error: "微信接口返回异常" }, 502);
  }

  if (wxData.errcode) {
    return json(
      {
        success: false,
        error: wxData.errmsg || `微信错误 (${wxData.errcode})`,
        errcode: wxData.errcode,
      },
      400,
    );
  }

  const openid = wxData.openid;
  if (!openid) return json({ success: false, error: "微信未返回 openid" }, 400);

  const ip = clientIp(request);

  let account = (await db
    .prepare("SELECT * FROM user_accounts WHERE mp_openid = ?")
    .bind(openid)
    .first()) as Record<string, unknown> | null;

  if (!account) {
    const accountId = await uniqueAccountId(db);
    const userToken = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO user_accounts (account_id, nickname, user_token, mp_openid, last_ip)
         VALUES (?, '游戏玩家', ?, ?, ?)`,
      )
      .bind(accountId, userToken, openid, ip || null)
      .run();

    const initial = parseInt((await getConfig(db, "credits_initial", "3")) || "3", 10);
    await db
      .prepare(
        "INSERT OR IGNORE INTO user_credits (user_token, credits, total_earned) VALUES (?, ?, ?)",
      )
      .bind(userToken, initial, initial)
      .run();

    account = (await db
      .prepare("SELECT * FROM user_accounts WHERE user_token = ?")
      .bind(userToken)
      .first()) as Record<string, unknown>;
  } else {
    await db
      .prepare("UPDATE user_accounts SET last_ip = ?, updated_at = datetime('now') WHERE mp_openid = ?")
      .bind(ip || null, openid)
      .run();
  }

  const acc = account!;
  const displayNickname =
    acc.nickname && acc.nickname !== "游戏玩家" ? acc.nickname : acc.account_id;

  return json({
    success: true,
    recovered: false,
    userToken: String(acc.user_token),
    account: {
      accountId: acc.account_id,
      nickname: displayNickname,
      rawNickname: acc.nickname,
      hasPassword: !!acc.has_password,
      createdAt: acc.created_at,
    },
  });
}
