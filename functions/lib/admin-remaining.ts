/**
 * /api/admin/* 与 X-Admin-Key 对齐（D1 无文件系统：静态生成类接口返回说明）
 */
import { json, type Db } from "./http";
import { getConfig } from "./db";
import { requireAdmin, hashPasswordLegacy } from "./cf-helpers";
import { getTurboModelsPayload } from "./llm-models";
import type { RouteCtx } from "./routes-remaining";

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function tryAdminRemaining(ctx: RouteCtx): Promise<Response | null> {
  const { request, env, db, url, method, segs } = ctx;
  if (segs[0] !== "admin") return null;
  if (!requireAdmin(request, env)) {
    return json({ success: false, error: "无权限" }, 403);
  }

  const rest = segs.slice(1);

  if (method === "POST" && rest[0] === "create-test-account") {
    const body = await readJson(request);
    const nickname = String(body.nickname || "").trim();
    if (!nickname) return json({ success: false, error: "请输入账号昵称" }, 400);
    const existing = await db
      .prepare("SELECT 1 AS x FROM user_accounts WHERE nickname = ?")
      .bind(nickname)
      .first();
    if (existing) return json({ success: false, error: "该昵称已存在" }, 400);
    const accountId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const userToken = crypto.randomUUID();
    const accountPassword =
      body.password && String(body.password).trim() ? String(body.password).trim() : "123456";
    const h = await hashPasswordLegacy(accountPassword);
    await db
      .prepare(
        `INSERT INTO user_accounts (account_id, nickname, user_token, password_hash, has_password)
         VALUES (?, ?, ?, ?, 1)`,
      )
      .bind(accountId, nickname, userToken, h)
      .run();
    await db
      .prepare("INSERT OR IGNORE INTO user_credits (user_token, credits, total_earned) VALUES (?, 100, 100)")
      .bind(userToken)
      .run();
    return json({
      success: true,
      account: { accountId, nickname, password: accountPassword },
      message: `账号"${nickname}"创建成功`,
    });
  }

  if (method === "GET" && rest[0] === "test-accounts") {
    const rows = await db
      .prepare(
        `SELECT account_id, nickname, has_password, created_at FROM user_accounts
         WHERE account_id LIKE 'test_%' OR has_password = 1 ORDER BY created_at DESC LIMIT 200`,
      )
      .all();
    return json({ success: true, accounts: rows.results || [] });
  }

  if (method === "DELETE" && rest[0] === "test-account" && rest.length === 2) {
    const accountId = rest[1];
    if (!accountId.startsWith("test_")) {
      return json({ success: false, error: "只能删除测试账号" }, 400);
    }
    const acc = await db
      .prepare("SELECT user_token FROM user_accounts WHERE account_id = ?")
      .bind(accountId)
      .first<{ user_token: string }>();
    if (!acc) return json({ success: false, error: "账号不存在" }, 404);
    await db.prepare("DELETE FROM user_credits WHERE user_token = ?").bind(acc.user_token).run();
    await db.prepare("DELETE FROM user_accounts WHERE account_id = ?").bind(accountId).run();
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "stats") {
    const games = await db.prepare("SELECT COUNT(*) AS c FROM games").first<{ c: number }>();
    const users = await db.prepare("SELECT COUNT(*) AS c FROM user_accounts").first<{ c: number }>();
    const plays = await db.prepare("SELECT COUNT(*) AS c FROM game_plays").first<{ c: number }>();
    return json({
      success: true,
      stats: {
        totalGames: games?.c ?? 0,
        totalUsers: users?.c ?? 0,
        totalPlays: plays?.c ?? 0,
      },
    });
  }

  if (method === "GET" && rest[0] === "models") {
    const { models, defaultModel } = await getTurboModelsPayload(db, env);
    return json({ success: true, models, defaultModel });
  }

  if (method === "GET" && rest[0] === "config") {
    const rows = await db.prepare("SELECT key, value, description FROM system_config").all();
    return json({ success: true, config: rows.results || [] });
  }

  if (method === "PUT" && rest[0] === "config") {
    const body = await readJson(request);
    const key = String(body.key || "");
    const value = String(body.value ?? "");
    if (!key) return json({ success: false, error: "缺少 key" }, 400);
    await db
      .prepare(
        `INSERT INTO system_config (key, value, description) VALUES (?, ?, '')
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      )
      .bind(key, value)
      .run();
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "credits-config") {
    const keys = [
      "credits_initial",
      "credits_share_game",
      "credits_share_game_daily_limit",
      "credits_invite_friend",
      "credits_invite_friend_daily_limit",
      "credits_article",
      "credits_article_daily_limit",
    ];
    const out: Record<string, string> = {};
    for (const k of keys) out[k] = (await getConfig(db, k, "")) || "";
    return json({ success: true, config: out });
  }

  if (method === "PUT" && rest[0] === "credits-config") {
    const body = await readJson(request);
    const cfg = body.config as Record<string, string> | undefined;
    if (!cfg) return json({ success: false, error: "缺少 config" }, 400);
    for (const [k, v] of Object.entries(cfg)) {
      await db
        .prepare(
          `INSERT INTO system_config (key, value, description) VALUES (?, ?, '')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        )
        .bind(k, String(v))
        .run();
    }
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "action-credits-config") {
    const keys = [
      "credits_action_like",
      "credits_action_favorite",
      "credits_action_follow",
      "credits_action_comment",
    ];
    const out: Record<string, string> = {};
    for (const k of keys) out[k] = (await getConfig(db, k, "")) || "";
    return json({ success: true, config: out });
  }

  if (method === "PUT" && rest[0] === "action-credits-config") {
    const body = await readJson(request);
    const cfg = body.config as Record<string, string> | undefined;
    if (!cfg) return json({ success: false, error: "缺少 config" }, 400);
    for (const [k, v] of Object.entries(cfg)) {
      await db
        .prepare(
          `INSERT INTO system_config (key, value, description) VALUES (?, ?, '')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        )
        .bind(k, String(v))
        .run();
    }
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "extra-credits-config") {
    return json({
      success: true,
      config: {
        shareGame: { credits: await getConfig(db, "credits_share_game", "1") },
        inviteFriend: { credits: await getConfig(db, "credits_invite_friend", "3") },
        article: { credits: await getConfig(db, "credits_article", "1") },
      },
    });
  }

  if (method === "PUT" && rest[0] === "extra-credits-config") {
    return json({ success: true, message: "请使用 credits-config 或 action-credits-config 写入具体键" });
  }

  if (method === "POST" && rest[0] === "add-credits") {
    const body = await readJson(request);
    const userToken = String(body.userToken || "");
    const amount = parseInt(String(body.amount || 0), 10);
    if (!userToken || !amount) return json({ success: false, error: "参数无效" }, 400);
    await db
      .prepare(
        `INSERT INTO user_credits (user_token, credits, total_earned) VALUES (?, ?, ?)
         ON CONFLICT(user_token) DO UPDATE SET credits = credits + ?, total_earned = total_earned + ?, updated_at = datetime('now')`,
      )
      .bind(userToken, amount, amount, amount, amount)
      .run();
    await db
      .prepare(
        "INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, 'admin_add', ?)",
      )
      .bind(userToken, amount, "管理员增加积分")
      .run();
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "users") {
    const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(url.searchParams.get("limit") || "20", 10) || 20;
    const offset = (page - 1) * limit;
    const search = (url.searchParams.get("search") || "").trim();
    let total = 0;
    let users: unknown[] = [];
    if (search) {
      const p = `%${search}%`;
      const t = await db
        .prepare(
          `SELECT COUNT(*) AS c FROM user_credits uc
           LEFT JOIN user_accounts ua ON uc.user_token = ua.user_token
           WHERE uc.user_token LIKE ? OR ua.account_id LIKE ? OR ua.nickname LIKE ?`,
        )
        .bind(p, p, p)
        .first<{ c: number }>();
      total = t?.c ?? 0;
      const r = await db
        .prepare(
          `SELECT uc.*, ua.account_id, ua.nickname, ua.is_admin FROM user_credits uc
           LEFT JOIN user_accounts ua ON uc.user_token = ua.user_token
           WHERE uc.user_token LIKE ? OR ua.account_id LIKE ? OR ua.nickname LIKE ?
           ORDER BY uc.created_at DESC LIMIT ? OFFSET ?`,
        )
        .bind(p, p, p, limit, offset)
        .all();
      users = r.results || [];
    } else {
      const t = await db.prepare("SELECT COUNT(*) AS c FROM user_credits").first<{ c: number }>();
      total = t?.c ?? 0;
      const r = await db
        .prepare(
          `SELECT uc.*, ua.account_id, ua.nickname, ua.is_admin FROM user_credits uc
           LEFT JOIN user_accounts ua ON uc.user_token = ua.user_token
           ORDER BY uc.created_at DESC LIMIT ? OFFSET ?`,
        )
        .bind(limit, offset)
        .all();
      users = r.results || [];
    }
    return json({ success: true, users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  }

  if (method === "POST" && rest[0] === "users" && rest[2] === "set-admin" && rest.length === 3) {
    const body = await readJson(request);
    const v = body.isAdmin === true || body.isAdmin === 1;
    await db
      .prepare("UPDATE user_accounts SET is_admin = ? WHERE user_token = ?")
      .bind(v ? 1 : 0, rest[1])
      .run();
    return json({ success: true });
  }

  if (method === "POST" && rest[0] === "users" && rest[2] === "reset-password" && rest.length === 3) {
    const body = await readJson(request);
    const newPassword = String(body.newPassword || "123456");
    const h = await hashPasswordLegacy(newPassword);
    await db
      .prepare("UPDATE user_accounts SET password_hash = ?, has_password = 1 WHERE user_token = ?")
      .bind(h, rest[1])
      .run();
    return json({ success: true, message: "已重置" });
  }

  if (method === "GET" && rest[0] === "admins") {
    const rows = await db
      .prepare("SELECT user_token, account_id, nickname FROM user_accounts WHERE is_admin = 1")
      .all();
    return json({ success: true, admins: rows.results || [] });
  }

  if (method === "GET" && rest[0] === "games") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
    const games = await db
      .prepare(
        "SELECT id, title, author_name, play_count, like_count, is_hidden, created_at FROM games ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .bind(limit, offset)
      .all();
    return json({ success: true, games: games.results });
  }

  if (method === "PUT" && rest[0] === "games" && rest.length === 2) {
    const id = rest[1];
    const body = await readJson(request);
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const k of ["title", "prompt", "code", "is_hidden", "is_featured", "is_public", "visibility", "status"]) {
      if (body[k] !== undefined) {
        sets.push(`${k} = ?`);
        vals.push(body[k]);
      }
    }
    if (sets.length === 0) return json({ success: false, error: "无字段" }, 400);
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await db.prepare(`UPDATE games SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
    return json({ success: true });
  }

  if (method === "DELETE" && rest[0] === "games" && rest.length === 2) {
    await db.prepare("DELETE FROM games WHERE id = ?").bind(rest[1]).run();
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "ban") {
    const type = url.searchParams.get("type") || "account";
    if (type === "ip") {
      const rows = await db.prepare("SELECT * FROM banned_ips_v2 ORDER BY id DESC LIMIT 200").all();
      return json({ success: true, bans: rows.results });
    }
    const rows = await db.prepare("SELECT * FROM banned_accounts_v2 ORDER BY id DESC LIMIT 200").all();
    return json({ success: true, bans: rows.results });
  }

  if (method === "POST" && rest[0] === "ban") {
    const body = await readJson(request);
    const banType = String(body.type || "account");
    if (banType === "ip") {
      await db
        .prepare(
          `INSERT INTO banned_ips_v2 (ip, reason, expire_at, ban_types) VALUES (?, ?, ?, ?)
           ON CONFLICT(ip) DO UPDATE SET reason = excluded.reason, expire_at = excluded.expire_at, ban_types = excluded.ban_types`,
        )
        .bind(
          String(body.ip || ""),
          String(body.reason || "违规"),
          body.expireAt ? String(body.expireAt) : null,
          body.banTypes ? String(body.banTypes) : null,
        )
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO banned_accounts_v2 (account_id, reason, expire_at, ban_types) VALUES (?, ?, ?, ?)
           ON CONFLICT(account_id) DO UPDATE SET reason = excluded.reason, expire_at = excluded.expire_at, ban_types = excluded.ban_types`,
        )
        .bind(
          String(body.accountId || ""),
          String(body.reason || "违规"),
          body.expireAt ? String(body.expireAt) : null,
          body.banTypes ? String(body.banTypes) : null,
        )
        .run();
    }
    return json({ success: true });
  }

  if (method === "DELETE" && rest[0] === "ban") {
    const body = await readJson(request);
    if (body.type === "ip") {
      await db.prepare("DELETE FROM banned_ips_v2 WHERE ip = ?").bind(String(body.ip || "")).run();
    } else {
      await db
        .prepare("DELETE FROM banned_accounts_v2 WHERE account_id = ?")
        .bind(String(body.accountId || ""))
        .run();
    }
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "comments") {
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
    const rows = await db
      .prepare(
        `SELECT gc.*, g.title AS game_title FROM game_comments gc JOIN games g ON g.id = gc.game_id
         ORDER BY gc.id DESC LIMIT ?`,
      )
      .bind(limit)
      .all();
    return json({ success: true, comments: rows.results });
  }

  if (method === "DELETE" && rest[0] === "comments" && rest.length === 2) {
    await db.prepare("UPDATE game_comments SET is_deleted = 1 WHERE id = ?").bind(rest[1]).run();
    return json({ success: true });
  }

  if (method === "POST" && rest[0] === "comments" && rest[2] === "restore" && rest.length === 3) {
    await db.prepare("UPDATE game_comments SET is_deleted = 0 WHERE id = ?").bind(rest[1]).run();
    return json({ success: true });
  }

  if (method === "DELETE" && rest[0] === "comments" && rest[2] === "permanent" && rest.length === 3) {
    await db.prepare("DELETE FROM game_comments WHERE id = ?").bind(rest[1]).run();
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "promo-codes") {
    const rows = await db.prepare("SELECT * FROM article_promo_codes ORDER BY id DESC").all();
    return json({ success: true, codes: rows.results });
  }

  if (method === "POST" && rest[0] === "promo-codes") {
    const body = await readJson(request);
    await db
      .prepare(
        `INSERT INTO article_promo_codes (code, article_id, description, reward, max_uses, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        String(body.code || ""),
        body.articleId ? String(body.articleId) : null,
        body.description ? String(body.description) : "",
        parseInt(String(body.reward ?? 1), 10) || 1,
        body.maxUses != null ? parseInt(String(body.maxUses), 10) : null,
      )
      .run();
    return json({ success: true });
  }

  if (method === "DELETE" && rest[0] === "promo-codes" && rest.length === 2) {
    await db.prepare("DELETE FROM article_promo_codes WHERE code = ?").bind(rest[1]).run();
    return json({ success: true });
  }

  if (method === "PUT" && rest[0] === "promo-codes" && rest[2] === "toggle" && rest.length === 3) {
    await db
      .prepare(
        "UPDATE article_promo_codes SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE code = ?",
      )
      .bind(rest[1])
      .run();
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "devtools") {
    const rows = await db.prepare("SELECT * FROM devtools_whitelist ORDER BY id DESC").all();
    return json({ success: true, list: rows.results });
  }

  if (method === "PUT" && rest[0] === "devtools") {
    const body = await readJson(request);
    await db
      .prepare("INSERT OR IGNORE INTO devtools_whitelist (type, value) VALUES (?, ?)")
      .bind(String(body.type || "account"), String(body.value || ""))
      .run();
    return json({ success: true });
  }

  if (method === "DELETE" && rest[0] === "devtools") {
    const body = await readJson(request);
    await db
      .prepare("DELETE FROM devtools_whitelist WHERE type = ? AND value = ?")
      .bind(String(body.type || "account"), String(body.value || ""))
      .run();
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "cors") {
    const rows = await db.prepare("SELECT * FROM cors_whitelist ORDER BY id DESC").all();
    return json({ success: true, origins: rows.results });
  }

  if (method === "PUT" && rest[0] === "cors") {
    const body = await readJson(request);
    await db
      .prepare("INSERT OR IGNORE INTO cors_whitelist (origin, description) VALUES (?, ?)")
      .bind(String(body.origin || ""), body.description ? String(body.description) : "")
      .run();
    return json({ success: true });
  }

  if (method === "DELETE" && rest[0] === "cors") {
    const body = await readJson(request);
    await db.prepare("DELETE FROM cors_whitelist WHERE origin = ?").bind(String(body.origin)).run();
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "leaderboard" && rest[1] === "excludes") {
    const rows = await db.prepare("SELECT * FROM leaderboard_excludes ORDER BY id DESC").all();
    return json({ success: true, excludes: rows.results });
  }

  if (method === "POST" && rest[0] === "leaderboard" && rest[1] === "exclude") {
    const body = await readJson(request);
    await db
      .prepare(
        `INSERT INTO leaderboard_excludes (user_token, exclude_types, reason) VALUES (?, ?, ?)
         ON CONFLICT(user_token) DO UPDATE SET exclude_types = excluded.exclude_types, reason = excluded.reason`,
      )
      .bind(
        String(body.user_token || body.userToken || ""),
        String(body.exclude_types || "all"),
        body.reason ? String(body.reason) : "",
      )
      .run();
    return json({ success: true });
  }

  if (method === "DELETE" && rest[0] === "leaderboard" && rest[1] === "exclude" && rest.length === 3) {
    await db.prepare("DELETE FROM leaderboard_excludes WHERE user_token = ?").bind(rest[2]).run();
    return json({ success: true });
  }

  if (method === "GET" && rest[0] === "security-logs") {
    return json({ success: true, logs: [], message: "D1 版暂无 security_logs 表，可后续加表迁移" });
  }

  if (method === "GET" && rest[0] === "security-status") {
    return json({ success: true, enabled: false });
  }

  if (method === "POST" && rest[0] === "tools") {
    return json({
      success: false,
      error: "D1/Pages 环境不支持 vacuum/本地文件清理；请使用控制台导出或自建任务",
    },
    400);
  }

  if (method === "GET" && rest[0] === "tools" && rest[1] === "db-stats") {
    const tables = ["games", "user_accounts", "game_comments", "user_credits"];
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const r = await db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).first<{ c: number }>();
      counts[t] = r?.c ?? 0;
    }
    return json({ success: true, counts });
  }

  if (
    method === "POST" &&
    (rest[0] === "generate-static-files" ||
      rest[0] === "regenerate-static" ||
      (rest[0] === "games" && rest[2] === "regenerate"))
  ) {
    return json({
      success: false,
      error: "静态 HTML 由 Pages 部署产物提供；请在构建流水线生成 public/g/*",
    },
    400);
  }

  if (method === "GET" && rest[0] === "static-files-stats") {
    return json({ success: true, message: "由 CDN/Pages 托管，无服务器本地统计" });
  }

  return null;
}
