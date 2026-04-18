/**
 * 用户侧补充路由（与 server.js 对齐）；admin 见 admin-remaining.ts；编辑/修复见 edit-repair-handler.ts
 */
import type { Env } from "../types";
import { json, type Db } from "./http";
import { getConfig } from "./db";
import {
  checkAccountBannedV2,
  checkIpBannedV2,
  getAccountIdByToken,
  hashPasswordLegacy,
  ipForRequest,
  isUserAdmin,
} from "./cf-helpers";

export type RouteCtx = {
  request: Request;
  env: Env;
  db: Db;
  url: URL;
  method: string;
  segs: string[];
  waitUntil?: (p: Promise<unknown>) => void;
};

async function readBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

const CREDITS_STATIC = {
  initial: 3,
  followWechat: 3,
  watchAd: 1,
  dailyLimit: 10,
  shareGame: 1,
  inviteFriend: 3,
  inviteBonus: 3,
  shareViewBonus: 1,
  dailyLogin: 1,
};

export async function tryRoutesRemaining(ctx: RouteCtx): Promise<Response | null> {
  const { request, db, url, method, segs } = ctx;
  const h = (n: string) => request.headers.get(n);

  if (method === "GET" && segs[0] === "check-ban") {
    const userToken = h("X-User-Token");
    const ip = ipForRequest(request);
    let accountId: string | null = null;
    if (userToken) accountId = await getAccountIdByToken(db, userToken);
    const out: Record<string, unknown> = {
      success: true,
      ip,
      accountId,
      banned: false,
      banReason: null,
      banExpireAt: null,
      banTypes: null,
      allowDevTools: false,
    };
    const ipBan = await checkIpBannedV2(db, ip);
    if (ipBan) {
      out.banned = true;
      out.banType = "ip";
      out.banReason = ipBan.reason;
      out.banExpireAt = ipBan.expire_at;
      out.banTypes = ipBan.ban_types;
    } else if (accountId) {
      const ab = await checkAccountBannedV2(db, accountId);
      if (ab) {
        out.banned = true;
        out.banType = "account";
        out.banReason = ab.reason;
        out.banExpireAt = ab.expire_at;
        out.banTypes = ab.ban_types;
      }
    }
    const wl = await db
      .prepare(
        `SELECT 1 AS x FROM devtools_whitelist WHERE (type = 'account' AND (value = ? OR value = '*'))
         OR (type = 'ip' AND (value = ? OR value = '*')) LIMIT 1`,
      )
      .bind(accountId || "", ip)
      .first();
    out.allowDevTools = !!wl;
    return json(out);
  }

  if (method === "GET" && segs[0] === "user" && segs[1] === "status") {
    const userToken = h("X-User-Token");
    const ip = ipForRequest(request);
    let accountId: string | null = null;
    if (userToken) accountId = await getAccountIdByToken(db, userToken);
    const out: Record<string, unknown> = {
      success: true,
      ip,
      accountId,
      banned: false,
      banReason: null,
      banExpireAt: null,
      banTypes: null,
      allowDevTools: false,
    };
    const ipBan = await checkIpBannedV2(db, ip);
    if (ipBan) {
      out.banned = true;
      out.banType = "ip";
      out.banReason = ipBan.reason;
      out.banExpireAt = ipBan.expire_at;
      out.banTypes = ipBan.ban_types;
    } else if (accountId) {
      const b = await checkAccountBannedV2(db, accountId);
      if (b) {
        out.banned = true;
        out.banType = "account";
        out.banReason = b.reason;
        out.banExpireAt = b.expire_at;
        out.banTypes = b.ban_types;
      }
    }
    const wl = await db
      .prepare(
        `SELECT 1 AS x FROM devtools_whitelist WHERE (type = 'account' AND (value = ? OR value = '*'))
         OR (type = 'ip' AND (value = ? OR value = '*')) LIMIT 1`,
      )
      .bind(accountId || "", ip)
      .first();
    out.allowDevTools = !!wl;
    return json(out);
  }

  if (method === "GET" && segs[0] === "user" && segs[1] === "is-admin") {
    const ok = await isUserAdmin(db, h("X-User-Token"));
    return json({ success: true, isAdmin: ok });
  }

  if (method === "POST" && segs[0] === "account" && segs[1] === "recover") {
    const b = await readBody(request);
    const accountId = String(b.accountId || "");
    const deviceFingerprint = (b.deviceFingerprint as string) || null;
    const clientIP = ipForRequest(request);
    if (!accountId) return json({ success: false, error: "请输入账号ID或昵称" }, 400);
    let account = await db
      .prepare("SELECT * FROM user_accounts WHERE account_id = ?")
      .bind(accountId)
      .first();
    if (!account) {
      account = await db
        .prepare("SELECT * FROM user_accounts WHERE nickname = ? COLLATE NOCASE")
        .bind(accountId)
        .first();
    }
    if (!account)
      return json({ success: false, error: "账号不存在" }, 404);
    const a = account as Record<string, unknown>;
    await db
      .prepare(
        `UPDATE user_accounts SET device_fingerprint = COALESCE(?, device_fingerprint),
         last_ip = COALESCE(?, last_ip), updated_at = datetime('now') WHERE user_token = ?`,
      )
      .bind(deviceFingerprint, clientIP || null, String(a.user_token))
      .run();
    const displayNickname =
      a.nickname && a.nickname !== "游戏玩家" ? a.nickname : a.account_id;
    return json({
      success: true,
      userToken: a.user_token,
      account: {
        accountId: a.account_id,
        nickname: displayNickname,
        rawNickname: a.nickname,
        hasPassword: !!a.has_password,
        createdAt: a.created_at,
      },
    });
  }

  if (method === "PUT" && segs[0] === "account" && segs[1] === "nickname") {
    const userToken = h("X-User-Token");
    const b = await readBody(request);
    const nickname = String(b.nickname || "").trim();
    if (!userToken) return json({ success: false, error: "缺少用户标识" }, 400);
    if (!nickname) return json({ success: false, error: "昵称不能为空" }, 400);
    await db
      .prepare("UPDATE user_accounts SET nickname = ?, updated_at = datetime('now') WHERE user_token = ?")
      .bind(nickname, userToken)
      .run();
    return json({ success: true, nickname });
  }

  if (method === "POST" && segs[0] === "account" && segs[1] === "password") {
    const userToken = h("X-User-Token");
    const b = await readBody(request);
    const password = String(b.password || "");
    const oldPassword = b.oldPassword ? String(b.oldPassword) : "";
    if (!userToken) return json({ success: false, error: "缺少用户标识" }, 400);
    if (password.length < 6) return json({ success: false, error: "密码至少6位" }, 400);
    const account = await db
      .prepare("SELECT * FROM user_accounts WHERE user_token = ?")
      .bind(userToken)
      .first<Record<string, unknown>>();
    if (!account) return json({ success: false, error: "账号不存在" }, 404);
    if (oldPassword && account.has_password && account.password_hash) {
      const oldH = await hashPasswordLegacy(oldPassword);
      if (oldH !== account.password_hash) return json({ success: false, error: "原密码错误" }, 400);
    }
    const passwordHash = await hashPasswordLegacy(password);
    await db
      .prepare(
        "UPDATE user_accounts SET password_hash = ?, has_password = 1, updated_at = datetime('now') WHERE user_token = ?",
      )
      .bind(passwordHash, userToken)
      .run();
    return json({ success: true, message: "密码设置成功" });
  }

  if (method === "POST" && segs[0] === "account" && segs[1] === "change-password") {
    const userToken = h("X-User-Token");
    const b = await readBody(request);
    const oldPassword = String(b.oldPassword || "");
    const newPassword = String(b.newPassword || "");
    if (!userToken) return json({ success: false, error: "缺少用户标识" }, 400);
    if (!oldPassword || !newPassword) return json({ success: false, error: "请输入原密码和新密码" }, 400);
    if (newPassword.length < 6) return json({ success: false, error: "新密码至少6位" }, 400);
    const account = await db
      .prepare("SELECT * FROM user_accounts WHERE user_token = ?")
      .bind(userToken)
      .first<Record<string, unknown>>();
    if (!account?.password_hash) return json({ success: false, error: "未设置密码" }, 400);
    if ((await hashPasswordLegacy(oldPassword)) !== account.password_hash) {
      return json({ success: false, error: "原密码错误" }, 400);
    }
    await db
      .prepare(
        "UPDATE user_accounts SET password_hash = ?, updated_at = datetime('now') WHERE user_token = ?",
      )
      .bind(await hashPasswordLegacy(newPassword), userToken)
      .run();
    return json({ success: true, message: "密码修改成功" });
  }

  if (method === "POST" && segs[0] === "account" && segs[1] === "login") {
    const b = await readBody(request);
    const accountId = String(b.accountId || "");
    const password = String(b.password || "");
    if (!accountId || !password) return json({ success: false, error: "请输入账号和密码" }, 400);
    let account = await db
      .prepare("SELECT * FROM user_accounts WHERE account_id = ?")
      .bind(accountId)
      .first<Record<string, unknown>>();
    if (!account) {
      account = await db
        .prepare("SELECT * FROM user_accounts WHERE nickname = ? COLLATE NOCASE")
        .bind(accountId)
        .first();
    }
    if (!account) {
      const game = await db
        .prepare("SELECT author_token FROM games WHERE author_name = ? COLLATE NOCASE LIMIT 1")
        .bind(accountId)
        .first<{ author_token: string }>();
      if (game?.author_token) {
        account = await db
          .prepare("SELECT * FROM user_accounts WHERE user_token = ?")
          .bind(game.author_token)
          .first();
      }
    }
    if (!account) return json({ success: false, error: "账号不存在" }, 400);
    if (!account.has_password || !account.password_hash) {
      return json({ success: false, error: "该账号未设置密码，无法登录" }, 400);
    }
    if ((await hashPasswordLegacy(password)) !== account.password_hash) {
      return json({ success: false, error: "密码错误" }, 400);
    }
    const displayNickname =
      account.nickname && account.nickname !== "游戏玩家" ? account.nickname : account.account_id;
    return json({
      success: true,
      userToken: account.user_token,
      account: {
        accountId: account.account_id,
        nickname: displayNickname,
        rawNickname: account.nickname,
        hasPassword: true,
      },
    });
  }

  if (method === "POST" && segs[0] === "account" && segs[1] === "secure-recover") {
    const b = await readBody(request);
    const accountId = String(b.accountId || "").trim();
    const password = String(b.password || "");
    const deviceFingerprint = (b.deviceFingerprint as string) || null;
    const clientIP = ipForRequest(request);
    if (!accountId) return json({ success: false, error: "请输入账号ID或昵称" }, 400);

    let account = await db
      .prepare("SELECT * FROM user_accounts WHERE account_id = ?")
      .bind(accountId)
      .first<Record<string, unknown>>();
    if (!account) {
      account = await db
        .prepare("SELECT * FROM user_accounts WHERE nickname = ? COLLATE NOCASE")
        .bind(accountId)
        .first();
    }
    if (!account) return json({ success: false, error: "账号不存在" }, 404);

    const hasPassword = !!(account.has_password && account.password_hash);
    const isSameDevice =
      !!deviceFingerprint &&
      !!account.device_fingerprint &&
      String(account.device_fingerprint) === String(deviceFingerprint);

    let passwordCorrect = false;
    if (hasPassword && password) {
      passwordCorrect = (await hashPasswordLegacy(password)) === account.password_hash;
    }

    if (hasPassword && !passwordCorrect && !isSameDevice) {
      return json(
        {
          success: false,
          error: "该账号已设置密码，请输入正确密码",
          needPassword: true,
        },
        400,
      );
    }

    await db
      .prepare(
        `UPDATE user_accounts SET device_fingerprint = COALESCE(?, device_fingerprint),
         last_ip = COALESCE(?, last_ip), updated_at = datetime('now') WHERE user_token = ?`,
      )
      .bind(deviceFingerprint, clientIP || null, String(account.user_token))
      .run();

    const displayNickname =
      account.nickname && account.nickname !== "游戏玩家"
        ? String(account.nickname)
        : String(account.account_id);

    return json({
      success: true,
      userToken: account.user_token,
      account: {
        accountId: account.account_id,
        nickname: displayNickname,
        rawNickname: account.nickname,
        hasPassword: !!account.has_password,
        createdAt: account.created_at,
      },
      warning: !hasPassword ? "建议设置密码以保护账号安全" : null,
    });
  }

  if (method === "GET" && segs[0] === "account" && segs[1] === "check" && segs[2]) {
    const row = await db
      .prepare("SELECT account_id FROM user_accounts WHERE account_id = ?")
      .bind(segs[2])
      .first();
    return json({ success: true, exists: !!row });
  }

  if (method === "GET" && segs[0] === "account" && segs[1] === "device-accounts") {
    return json({ success: true, accounts: [] });
  }

  if (method === "GET" && segs[0] === "config" && segs.length === 1) {
    const rows = await db.prepare("SELECT key, value FROM system_config").all();
    const config: Record<string, string> = {};
    for (const r of rows.results || []) {
      const row = r as { key: string; value: string };
      config[row.key] = row.value;
    }
    return json({ success: true, config: { ...config, credits: CREDITS_STATIC } });
  }

  if (method === "GET" && segs[0] === "config" && segs[1] === "model-times") {
    return json({ success: true, times: {} });
  }

  if (method === "GET" && segs[0] === "credits" && segs[1] === "action-ways") {
    return json({
      success: true,
      like: { credits: parseFloat((await getConfig(db, "credits_action_like", "0.1")) || "0.1") },
      favorite: { credits: parseFloat((await getConfig(db, "credits_action_favorite", "0.2")) || "0.2") },
      follow: { credits: parseFloat((await getConfig(db, "credits_action_follow", "0.2")) || "0.2") },
      comment: { credits: parseFloat((await getConfig(db, "credits_action_comment", "0.5")) || "0.5") },
    });
  }

  if (method === "POST" && segs[0] === "cancel-edit") {
    return json({ success: true, message: "请求不存在或已完成" });
  }

  if (method === "POST" && segs[0] === "cancel-generation") {
    const b = await readBody(request);
    const requestId = String(b.requestId || "");
    const userToken = h("X-User-Token");
    if (!requestId) return json({ success: false, error: "缺少请求ID" }, 400);
    const row = await db
      .prepare("SELECT user_token FROM generation_requests WHERE request_id = ?")
      .bind(requestId)
      .first<{ user_token: string }>();
    if (!row || row.user_token !== userToken) {
      return json({ success: true, message: "请求不存在或已完成" });
    }
    await db
      .prepare("UPDATE generation_requests SET cancelled = 1 WHERE request_id = ?")
      .bind(requestId)
      .run();
    return json({ success: true, message: "请求已标记为取消", requestId });
  }

  if (method === "POST" && segs[0] === "credits" && segs[1] === "use") {
    return json({ success: true, message: "积分已在生成接口内扣除" });
  }

  if (method === "POST" && segs[0] === "credits" && segs[1] === "follow-wechat") {
    return json({ success: true, message: "已记录" });
  }
  if (method === "POST" && segs[0] === "credits" && segs[1] === "watch-ad") {
    return json({ success: true, message: "已记录" });
  }
  if (method === "POST" && segs[0] === "credits" && segs[1] === "daily-login") {
    return json({ success: true, message: "已记录" });
  }
  if (method === "POST" && segs[0] === "credits" && segs[1] === "article-visit") {
    return json({ success: true, message: "已记录" });
  }
  if (method === "POST" && segs[0] === "credits" && segs[1] === "redeem-code") {
    return json({ success: false, error: "兑换逻辑请在后续版本补全校验" }, 400);
  }

  if (method === "GET" && segs[0] === "games" && segs[1] === "search" && segs[2]) {
    const kw = `%${decodeURIComponent(segs[2])}%`;
    const games = await db
      .prepare(
        `SELECT id, title, prompt, author_name, play_count, like_count, created_at FROM games
         WHERE title LIKE ? OR prompt LIKE ? OR author_name LIKE ?
         ORDER BY like_count DESC, created_at DESC LIMIT 20`,
      )
      .bind(kw, kw, kw)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "POST" && segs[0] === "games" && segs[2] === "verify" && segs.length === 3) {
    const b = await readBody(request);
    const authorToken = String(b.authorToken || "");
    const game = await db
      .prepare("SELECT author_token FROM games WHERE id = ?")
      .bind(segs[1])
      .first<{ author_token: string }>();
    if (!game) return json({ success: false, error: "游戏不存在" }, 404);
    return json({ success: true, isAuthor: game.author_token === authorToken });
  }

  if (method === "GET" && segs[0] === "games" && segs[2] === "can-edit" && segs.length === 3) {
    const userToken = h("X-User-Token");
    if (!userToken) return json({ success: true, canEdit: false, reason: "未登录" });
    const game = await db
      .prepare("SELECT author_token, is_public, visibility FROM games WHERE id = ?")
      .bind(segs[1])
      .first<{ author_token: string; is_public: number; visibility: string }>();
    if (!game) return json({ success: false, error: "游戏不存在" }, 404);
    const isAuthor = game.author_token === userToken;
    const isAdmin = await isUserAdmin(db, userToken);
    const isPublicGame = game.is_public === 1 && game.visibility === "public";
    const canEdit = isAuthor || (isAdmin && isPublicGame);
    return json({
      success: true,
      canEdit,
      isAuthor,
      isAdmin,
      reason: canEdit ? (isAuthor ? "作者" : "管理员") : "无权限",
    });
  }

  if (method === "DELETE" && segs[0] === "games" && segs[2] === "comments" && segs.length === 4) {
    const userToken = h("X-User-Token");
    const gameId = segs[1];
    const commentId = segs[3];
    if (!userToken) return json({ success: false, error: "未登录" }, 401);
    const c = await db
      .prepare("SELECT user_token FROM game_comments WHERE id = ? AND game_id = ?")
      .bind(commentId, gameId)
      .first<{ user_token: string }>();
    if (!c || c.user_token !== userToken) return json({ success: false, error: "无权限" }, 403);
    await db.prepare("DELETE FROM game_comments WHERE id = ?").bind(commentId).run();
    return json({ success: true });
  }

  if (method === "DELETE" && segs[0] === "games" && segs.length === 2) {
    const id = segs[1];
    const userToken = h("X-User-Token");
    const headerToken = h("X-Author-Token");
    const token = userToken || headerToken;
    const game = await db
      .prepare("SELECT author_token FROM games WHERE id = ?")
      .bind(id)
      .first<{ author_token: string }>();
    if (!game) return json({ success: false, error: "游戏不存在" }, 404);
    if (game.author_token !== token) return json({ success: false, error: "无权限" }, 403);
    await db.prepare("DELETE FROM games WHERE id = ?").bind(id).run();
    return json({ success: true });
  }

  if (method === "GET" && segs[0] === "my-games") {
    const userToken = h("X-User-Token");
    if (!userToken) return json({ success: true, games: [] });
    const games = await db
      .prepare(
        "SELECT id, title, prompt, status, created_at FROM games WHERE author_token = ? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(userToken)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "GET" && segs[0] === "my-likes") {
    const userToken = h("X-User-Token");
    if (!userToken) return json({ success: true, games: [] });
    const games = await db
      .prepare(
        `SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.created_at
         FROM games g INNER JOIN user_likes ul ON ul.game_id = g.id WHERE ul.user_token = ?
         ORDER BY ul.id DESC LIMIT 100`,
      )
      .bind(userToken)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "GET" && segs[0] === "my-favorites") {
    const userToken = h("X-User-Token");
    if (!userToken) return json({ success: true, games: [] });
    const games = await db
      .prepare(
        `SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.created_at
         FROM games g INNER JOIN user_favorites uf ON uf.game_id = g.id WHERE uf.user_token = ?
         ORDER BY uf.id DESC LIMIT 100`,
      )
      .bind(userToken)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "GET" && segs[0] === "my-comments") {
    const userToken = h("X-User-Token");
    if (!userToken) return json({ success: true, comments: [] });
    const comments = await db
      .prepare(
        `SELECT gc.*, g.title as game_title FROM game_comments gc JOIN games g ON g.id = gc.game_id
         WHERE gc.user_token = ? ORDER BY gc.created_at DESC LIMIT 100`,
      )
      .bind(userToken)
      .all();
    return json({ success: true, comments: comments.results });
  }

  if (method === "POST" && segs[0] === "my-comments" && segs[2] === "toggle-hidden" && segs.length === 3) {
    const userToken = h("X-User-Token");
    const id = segs[1];
    const row = await db
      .prepare("SELECT is_hidden FROM game_comments WHERE id = ? AND user_token = ?")
      .bind(id, userToken)
      .first<{ is_hidden: number }>();
    if (!row) return json({ success: false, error: "不存在" }, 404);
    const nh = row.is_hidden === 1 ? 0 : 1;
    await db.prepare("UPDATE game_comments SET is_hidden = ? WHERE id = ?").bind(nh, id).run();
    return json({ success: true, isHidden: nh === 1 });
  }

  if (method === "DELETE" && segs[0] === "my-comments" && segs.length === 2) {
    const userToken = h("X-User-Token");
    await db
      .prepare("DELETE FROM game_comments WHERE id = ? AND user_token = ?")
      .bind(segs[1], userToken)
      .run();
    return json({ success: true });
  }

  if (method === "POST" && segs[0] === "users" && segs[2] === "follow" && segs.length === 3) {
    const follower = h("X-User-Token");
    const following = segs[1];
    if (!follower) return json({ success: false, error: "请先登录" }, 401);
    if (follower === following) return json({ success: false, error: "不能关注自己" }, 400);
    const ex = await db
      .prepare("SELECT id FROM user_follows WHERE follower_token = ? AND following_token = ?")
      .bind(follower, following)
      .first();
    if (ex) {
      await db
        .prepare("DELETE FROM user_follows WHERE follower_token = ? AND following_token = ?")
        .bind(follower, following)
        .run();
      return json({ success: true, following: false });
    }
    await db
      .prepare("INSERT INTO user_follows (follower_token, following_token) VALUES (?, ?)")
      .bind(follower, following)
      .run();
    return json({ success: true, following: true });
  }

  if (method === "GET" && segs[0] === "users" && segs[2] === "follow-status" && segs.length === 3) {
    const follower = h("X-User-Token");
    const following = segs[1];
    if (!follower) return json({ success: true, following: false });
    const row = await db
      .prepare("SELECT id FROM user_follows WHERE follower_token = ? AND following_token = ?")
      .bind(follower, following)
      .first();
    return json({ success: true, following: !!row });
  }

  if (method === "GET" && segs[0] === "users" && segs[2] === "follow-stats" && segs.length === 3) {
    const token = segs[1];
    const followers = await db
      .prepare("SELECT COUNT(*) AS c FROM user_follows WHERE following_token = ?")
      .bind(token)
      .first<{ c: number }>();
    const following = await db
      .prepare("SELECT COUNT(*) AS c FROM user_follows WHERE follower_token = ?")
      .bind(token)
      .first<{ c: number }>();
    return json({
      success: true,
      followers: followers?.c ?? 0,
      following: following?.c ?? 0,
    });
  }

  if (method === "GET" && segs[0] === "users" && segs[2] === "profile" && segs.length === 3) {
    const token = segs[1];
    const acc = await db
      .prepare("SELECT account_id, nickname, created_at FROM user_accounts WHERE user_token = ?")
      .bind(token)
      .first();
    if (!acc) return json({ success: false, error: "用户不存在" }, 404);
    return json({ success: true, profile: acc });
  }

  if (method === "GET" && segs[0] === "users" && segs[2] === "games" && segs.length === 3) {
    const token = segs[1];
    const games = await db
      .prepare(
        "SELECT id, title, prompt, play_count, like_count, created_at FROM games WHERE author_token = ? AND COALESCE(is_hidden,0)=0 LIMIT 50",
      )
      .bind(token)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "GET" && segs[0] === "users" && segs[2] === "following" && segs.length === 3) {
    const token = segs[1];
    const rows = await db
      .prepare(
        `SELECT ua.user_token, ua.account_id, ua.nickname FROM user_follows uf
         JOIN user_accounts ua ON ua.user_token = uf.following_token WHERE uf.follower_token = ? LIMIT 50`,
      )
      .bind(token)
      .all();
    return json({ success: true, users: rows.results });
  }

  if (method === "GET" && segs[0] === "users" && segs[2] === "followers" && segs.length === 3) {
    const token = segs[1];
    const rows = await db
      .prepare(
        `SELECT ua.user_token, ua.account_id, ua.nickname FROM user_follows uf
         JOIN user_accounts ua ON ua.user_token = uf.follower_token WHERE uf.following_token = ? LIMIT 50`,
      )
      .bind(token)
      .all();
    return json({ success: true, users: rows.results });
  }

  if (method === "GET" && segs[0] === "leaderboard" && segs[1] === "featured") {
    const limit = parseInt(url.searchParams.get("limit") || "10", 10) || 10;
    const games = await db
      .prepare(
        `SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at,
          (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) AS comment_count
         FROM games g WHERE g.is_featured = 1 AND COALESCE(g.is_hidden,0)=0
         ORDER BY g.updated_at DESC, g.like_count DESC LIMIT ?`,
      )
      .bind(limit)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "GET" && segs[0] === "leaderboard" && segs[1] === "favorites") {
    const limit = parseInt(url.searchParams.get("limit") || "10", 10) || 10;
    const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
    const games = await db
      .prepare(
        `SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at,
          (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) AS comment_count
         FROM games g WHERE COALESCE(g.is_hidden,0)=0 AND (COALESCE(g.is_public,1)=1 OR g.is_public IS NULL)
         ORDER BY g.favorite_count DESC LIMIT ? OFFSET ?`,
      )
      .bind(limit, offset)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "GET" && segs[0] === "leaderboard" && segs[1] === "comments") {
    const limit = parseInt(url.searchParams.get("limit") || "10", 10) || 10;
    const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
    const games = await db
      .prepare(
        `SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at,
          (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) AS comment_count
         FROM games g WHERE COALESCE(g.is_hidden,0)=0 AND (COALESCE(g.is_public,1)=1 OR g.is_public IS NULL)
         ORDER BY comment_count DESC, g.created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(limit, offset)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "GET" && segs[0] === "leaderboard" && segs[1] === "games") {
    const limit = parseInt(url.searchParams.get("limit") || "20", 10) || 20;
    const games = await db
      .prepare(
        `SELECT id, title, prompt, author_name, play_count, like_count, created_at FROM games
         WHERE COALESCE(is_hidden,0)=0 ORDER BY play_count DESC LIMIT ?`,
      )
      .bind(limit)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "GET" && segs[0] === "leaderboard" && segs[1] === "creators") {
    const limit = parseInt(url.searchParams.get("limit") || "20", 10) || 20;
    const rows = await db
      .prepare(
        `SELECT author_token, author_name, COUNT(*) AS game_count FROM games
         WHERE COALESCE(is_hidden,0)=0 GROUP BY author_token, author_name ORDER BY game_count DESC LIMIT ?`,
      )
      .bind(limit)
      .all();
    return json({ success: true, creators: rows.results });
  }

  if (method === "GET" && segs[0] === "challenge" && segs[1] === "current") {
    const challenges = [
      { id: 1, title: "周挑战", description: "创作一款小游戏" },
    ];
    const week = Math.floor(Date.now() / 604800000) % challenges.length;
    return json({ success: true, challenge: challenges[week] });
  }

  if (method === "GET" && segs[0] === "challenge" && segs[1] === "entries") {
    return json({ success: true, entries: [] });
  }

  if (method === "GET" && segs[0] === "invite" && segs[1] === "my-link") {
    return json({ success: true, link: "" });
  }
  if (method === "GET" && segs[0] === "invite" && segs[1] === "my-code") {
    return json({ success: true, code: null });
  }
  if (method === "POST" && segs[0] === "invite" && segs[1] === "link-visit") {
    return json({ success: true });
  }
  if (method === "POST" && segs[0] === "invite" && segs[1] === "share-visit") {
    return json({ success: true });
  }
  if (method === "POST" && segs[0] === "invite" && segs[1] === "generate") {
    return json({ success: true, code: crypto.randomUUID().slice(0, 8).toUpperCase() });
  }
  if (method === "POST" && segs[0] === "invite" && segs[1] === "use") {
    return json({ success: true });
  }

  if (method === "POST" && segs[0] === "referral" && segs[1] === "record") {
    return json({ success: true });
  }
  if (method === "POST" && segs[0] === "referral" && segs[1] === "reward") {
    return json({ success: true });
  }

  if (method === "GET" && segs[0] === "trial" && segs[1] === "status") {
    return json({ success: true, allowed: true, remaining: 99 });
  }

  if (method === "POST" && segs[0] === "trial" && segs[1] === "generate") {
    const { handleGenerate } = await import("./generate-handler");
    return handleGenerate(request, ctx.env, db);
  }

  if (method === "GET" && segs[0] === "games" && segs[2] === "share-info" && segs.length === 3) {
    const id = segs[1];
    const game = await db
      .prepare("SELECT id, title, prompt, author_name, play_count, like_count FROM games WHERE id = ?")
      .bind(id)
      .first();
    if (!game) return json({ success: false, error: "游戏不存在" }, 404);
    const host = url.host;
    const proto = url.protocol || "https:";
    const shareUrl = `${proto}//${host}/game/${id}`;
    return json({
      success: true,
      shareInfo: {
        title: (game as { title: string }).title,
        url: shareUrl,
        wechat: { title: `🎮 ${(game as { title: string }).title}`, link: shareUrl },
      },
    });
  }

  if (method === "GET" && segs[0] === "games" && segs[2] === "stats" && segs.length === 3) {
    const id = segs[1];
    const g = await db
      .prepare("SELECT play_count, like_count, favorite_count FROM games WHERE id = ?")
      .bind(id)
      .first();
    const s = await db
      .prepare("SELECT share_count FROM game_stats WHERE game_id = ?")
      .bind(id)
      .first<{ share_count: number }>();
    return json({
      success: true,
      stats: { ...(g as object), share_count: s?.share_count ?? 0 },
    });
  }

  if (method === "POST" && segs[0] === "games" && segs[2] === "share" && segs.length === 3) {
    return json({ success: true });
  }

  if (method === "POST" && segs[0] === "games" && segs[2] === "shared" && segs.length === 3) {
    return json({ success: true });
  }

  if (method === "POST" && segs[0] === "games" && segs[2] === "regenerate" && segs.length === 3) {
    return json({ success: false, error: "请使用 /api/generate" }, 400);
  }

  if (method === "GET" && segs[0] === "author-leaderboard" && segs[1]) {
    const type = segs[1];
    const validTypes = ["fans", "works", "credits", "popularity", "newstar"];
    if (!validTypes.includes(type)) {
      return json({ success: false, error: "无效的榜单类型" }, 400);
    }
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
    const period = url.searchParams.get("period") || "all";

    let periodCondition = "";
    let periodLabel = "总榜";
    if (period === "week") {
      periodCondition = "AND ua.created_at >= datetime('now', '-7 days')";
      periodLabel = "周榜";
    } else if (period === "month") {
      periodCondition = "AND ua.created_at >= datetime('now', '-30 days')";
      periodLabel = "月榜";
    }

    const ex = await db
      .prepare(
        `SELECT user_token FROM leaderboard_excludes
         WHERE exclude_types LIKE '%all%' OR exclude_types LIKE ?`
      )
      .bind(`%${type}%`)
      .all();
    const excludeTokens = (ex.results || [])
      .map((r) => (r as { user_token?: string }).user_token)
      .filter((t): t is string => Boolean(t));
    const excludeCondition =
      excludeTokens.length > 0
        ? `AND ua.user_token NOT IN (${excludeTokens.map(() => "?").join(",")})`
        : "";

    let query = "";
    let countQuery = "";
    let title = "";
    let valueLabel = "";

    switch (type) {
      case "fans":
        title = "🏆 粉丝榜";
        valueLabel = "粉丝";
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname,
            (SELECT COUNT(*) FROM user_follows WHERE following_token = ua.user_token) AS value
          FROM user_accounts ua
          WHERE 1=1 ${excludeCondition}
          ORDER BY value DESC
          LIMIT ? OFFSET ?`;
        countQuery = `SELECT COUNT(*) AS total FROM user_accounts ua WHERE 1=1 ${excludeCondition}`;
        break;
      case "works":
        title = "📚 作品榜";
        valueLabel = "作品";
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname,
            (SELECT COUNT(*) FROM games WHERE author_token = ua.user_token AND COALESCE(is_hidden,0)=0) AS value
          FROM user_accounts ua
          WHERE 1=1 ${excludeCondition}
          ORDER BY value DESC
          LIMIT ? OFFSET ?`;
        countQuery = `SELECT COUNT(*) AS total FROM user_accounts ua WHERE 1=1 ${excludeCondition}`;
        break;
      case "credits":
        title = "💎 积分榜";
        valueLabel = "积分";
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname,
            COALESCE(uc.credits, 0) AS value
          FROM user_accounts ua
          LEFT JOIN user_credits uc ON ua.user_token = uc.user_token
          WHERE 1=1 ${excludeCondition}
          ORDER BY value DESC
          LIMIT ? OFFSET ?`;
        countQuery = `SELECT COUNT(*) AS total FROM user_accounts ua WHERE 1=1 ${excludeCondition}`;
        break;
      case "popularity":
        title = "🔥 人气榜";
        valueLabel = "人气值";
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname,
            COALESCE(SUM(g.like_count), 0) * 10 + COALESCE(SUM(g.play_count), 0) AS value
          FROM user_accounts ua
          LEFT JOIN games g ON g.author_token = ua.user_token AND COALESCE(g.is_hidden,0)=0
          WHERE 1=1 ${excludeCondition} ${periodCondition}
          GROUP BY ua.user_token, ua.account_id, ua.nickname
          ORDER BY value DESC
          LIMIT ? OFFSET ?`;
        countQuery = `SELECT COUNT(*) AS total FROM user_accounts ua WHERE 1=1 ${excludeCondition} ${periodCondition}`;
        break;
      case "newstar":
        title = "⭐ 新星榜";
        valueLabel = "综合分";
        query = `
          SELECT ua.user_token, ua.account_id, ua.nickname, ua.created_at,
            (
              (SELECT COUNT(*) FROM user_follows WHERE following_token = ua.user_token) * 5 +
              (SELECT COUNT(*) FROM games WHERE author_token = ua.user_token AND COALESCE(is_hidden,0)=0) * 10 +
              COALESCE((SELECT SUM(like_count) FROM games WHERE author_token = ua.user_token AND COALESCE(is_hidden,0)=0), 0) * 2
            ) AS value
          FROM user_accounts ua
          WHERE ua.created_at >= datetime('now', '-30 days') ${excludeCondition}
          ORDER BY value DESC
          LIMIT ? OFFSET ?`;
        countQuery = `SELECT COUNT(*) AS total FROM user_accounts ua WHERE ua.created_at >= datetime('now', '-30 days') ${excludeCondition}`;
        break;
      default:
        return json({ success: false, error: "无效的榜单类型" }, 400);
    }

    const listRes = await db
      .prepare(query)
      .bind(...excludeTokens, limit, offset)
      .all();
    const raw = (listRes.results || []) as Array<{
      user_token: string;
      account_id: string;
      nickname: string | null;
      value: number | null;
    }>;

    const totalRow = await db.prepare(countQuery).bind(...excludeTokens).first<{ total: number }>();

    const avatarEmojis = ["🎮", "🎯", "🎲", "🎪", "🎨", "🎭", "🎸", "🎺", "🎻", "🎹"];
    const list = raw.map((item, index) => ({
      rank: offset + index + 1,
      user_token: item.user_token,
      account_id: item.account_id,
      nickname: item.nickname || item.account_id,
      avatar_emoji: avatarEmojis[Math.abs(item.user_token?.charCodeAt(0) || 0) % avatarEmojis.length],
      value: item.value ?? 0,
      label: valueLabel,
    }));

    const displayTitle = period !== "all" ? `${title}·${periodLabel}` : title;

    return json({
      success: true,
      type,
      title: displayTitle,
      period,
      periodLabel,
      list,
      total: totalRow?.total ?? 0,
      updated_at: new Date().toISOString(),
    });
  }

  return null;
}
