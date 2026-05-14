import type { Env } from "../types";
import { clientIp, json, getDb, type Db } from "./http";
import { getUserTokenFromRequest } from "./cf-helpers";
import { getConfig, getConfigMany } from "./db";
import { getTurboModelsPayload } from "./llm-models";
import { handleGenerate } from "./generate-handler";
import { tryRoutesRemaining } from "./routes-remaining";
import { tryEditRepair } from "./edit-repair-handler";
import { tryAdminRemaining } from "./admin-remaining";
import { handleWechatMiniProgramLogin } from "./wechat-mp-login";

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

const SENSITIVE = ["色情", "赌博", "毒品", "暴力"];

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

function staticGameUrl(gameId: string): string {
  const sub = gameId.substring(0, 2);
  return `/g/${sub}/${gameId}.html`;
}

function orderByClause(sort: string): string {
  const map: Record<string, string> = {
    newest: "g.created_at DESC",
    oldest: "g.created_at ASC",
    hot: "(g.play_count + g.like_count * 5 + g.favorite_count * 3) DESC",
    likes: "g.like_count DESC, g.created_at DESC",
    favorites: "g.favorite_count DESC, g.created_at DESC",
    plays: "g.play_count DESC, g.created_at DESC",
  };
  return map[sort] || "g.created_at DESC";
}

export type DispatchOpts = { waitUntil?: (p: Promise<unknown>) => void };

export async function dispatchApi(
  request: Request,
  env: Env,
  pathname: string,
  opts?: DispatchOpts,
): Promise<Response> {
  const db = getDb(env);
  const url = new URL(request.url);
  const method = request.method;
  const segs = pathname.replace(/^\/api\/?/i, "").split("/").filter(Boolean);

  try {
    if (method === "GET" && segs[0] === "turbo-models") {
      const { models, defaultModel } = await getTurboModelsPayload(db, env);
      return json({ success: true, models, defaultModel });
    }

    if (method === "GET" && segs[0] === "config" && segs[1] === "tips") {
      const tips = await getConfig(db, "site_announcement", "");
      return json({ success: true, tips: tips || "" });
    }

    if (method === "GET" && segs[0] === "config" && segs[1] === "share-text") {
      const tpl = await getConfig(
        db,
        "share_text_template",
        "我用一句话做了个游戏《{title}》，快来玩！",
      );
      return json({ success: true, template: tpl });
    }

    if (method === "GET" && segs[0] === "config" && segs[1] === "model-times") {
      return json({ success: true, times: {} });
    }

    if (method === "POST" && segs[0] === "wechat" && segs[1] === "login") {
      return handleWechatMiniProgramLogin(request, env, db);
    }

    if (method === "POST" && segs[0] === "account" && segs[1] === "init") {
      const userToken = getUserTokenFromRequest(request);
      let body: { deviceFingerprint?: string };
      try {
        body = (await request.json()) as { deviceFingerprint?: string };
      } catch {
        body = {};
      }
      const deviceFingerprint = body.deviceFingerprint || null;
      const ip = clientIp(request);

      let account = null as Record<string, unknown> | null;
      let isRecovered = false;
      let newToken = userToken;

      if (userToken) {
        account = (await db
          .prepare("SELECT * FROM user_accounts WHERE user_token = ?")
          .bind(userToken)
          .first()) as Record<string, unknown> | null;
      }
      if (!account && deviceFingerprint) {
        account = (await db
          .prepare("SELECT * FROM user_accounts WHERE device_fingerprint = ?")
          .bind(deviceFingerprint)
          .first()) as Record<string, unknown> | null;
        if (account) {
          isRecovered = true;
          newToken = String(account.user_token);
        }
      }

      if (!account) {
        const accountId = await uniqueAccountId(db);
        newToken = userToken || crypto.randomUUID();
        await db
          .prepare(
            `INSERT INTO user_accounts (account_id, nickname, user_token, device_fingerprint, last_ip)
             VALUES (?, '游戏玩家', ?, ?, ?)`,
          )
          .bind(accountId, newToken, deviceFingerprint, ip || null)
          .run();
        account = (await db
          .prepare("SELECT * FROM user_accounts WHERE user_token = ?")
          .bind(newToken)
          .first()) as Record<string, unknown>;

        const initial = parseInt(
          (await getConfig(db, "credits_initial", "3")) || "3",
          10,
        );
        await db
          .prepare(
            "INSERT OR IGNORE INTO user_credits (user_token, credits, total_earned) VALUES (?, ?, ?)",
          )
          .bind(newToken, initial, initial)
          .run();
      } else {
        await db
          .prepare(
            `UPDATE user_accounts SET device_fingerprint = COALESCE(?, device_fingerprint),
             last_ip = COALESCE(?, last_ip), updated_at = datetime('now') WHERE user_token = ?`,
          )
          .bind(deviceFingerprint, ip || null, String(account.user_token))
          .run();
      }

      const acc = account!;
      const displayNickname =
        acc.nickname && acc.nickname !== "游戏玩家" ? acc.nickname : acc.account_id;
      return json({
        success: true,
        recovered: isRecovered,
        userToken: newToken,
        account: {
          accountId: acc.account_id,
          nickname: displayNickname,
          rawNickname: acc.nickname,
          hasPassword: !!acc.has_password,
          createdAt: acc.created_at,
        },
      });
    }

    if (method === "GET" && segs[0] === "account" && segs.length === 1) {
      const userToken = getUserTokenFromRequest(request);
      if (!userToken) return json({ success: false, error: "缺少用户标识" }, 400);
      const account = await db
        .prepare(
          `SELECT ua.*,
            (SELECT COUNT(*) FROM games g WHERE g.author_token = ua.user_token AND COALESCE(g.is_hidden,0)=0) AS games_count
           FROM user_accounts ua WHERE ua.user_token = ?`,
        )
        .bind(userToken)
        .first();
      if (!account) return json({ success: false, error: "账号不存在" }, 404);
      const a = account as Record<string, unknown>;
      const displayNickname =
        a.nickname && a.nickname !== "游戏玩家" ? a.nickname : a.account_id;
      return json({
        success: true,
        account: {
          accountId: a.account_id,
          nickname: displayNickname,
          rawNickname: a.nickname,
          hasPassword: !!a.has_password,
          email: a.email,
          createdAt: a.created_at,
          games_count: a.games_count ?? 0,
        },
      });
    }

    if (method === "GET" && segs[0] === "credits" && segs.length === 1) {
      const userToken = getUserTokenFromRequest(request);
      if (!userToken) return json({ success: false, error: "缺少用户标识" }, 400);
      let user = await db
        .prepare("SELECT * FROM user_credits WHERE user_token = ?")
        .bind(userToken)
        .first();
      if (!user) {
        const initial = parseInt(
          (await getConfig(db, "credits_initial", "3")) || "3",
          10,
        );
        await db
          .prepare(
            "INSERT INTO user_credits (user_token, credits, total_earned) VALUES (?, ?, ?)",
          )
          .bind(userToken, initial, initial)
          .run();
        await db
          .prepare(
            "INSERT INTO credit_logs (user_token, amount, type, description) VALUES (?, ?, 'initial', '新用户初始积分')",
          )
          .bind(userToken, initial)
          .run();
        user = await db
          .prepare("SELECT * FROM user_credits WHERE user_token = ?")
          .bind(userToken)
          .first();
      }
      const u = user as Record<string, unknown>;
      const today = new Date().toISOString().split("T")[0];
      if (u.last_ad_date !== today) {
        await db
          .prepare("UPDATE user_credits SET ad_count_today = 0, last_ad_date = ? WHERE user_token = ?")
          .bind(today, userToken)
          .run();
        u.ad_count_today = 0;
      }
      const cfgKeys = [
        "credits_share_game",
        "credits_share_game_daily_limit",
        "credits_invite_friend",
        "credits_invite_friend_daily_limit",
        "credits_article",
        "credits_article_daily_limit",
      ];
      const [dailyRows, cfgMap] = await Promise.all([
        db
          .prepare(
            `SELECT action_type, count FROM daily_action_credits
             WHERE user_token = ? AND action_date = ?
               AND action_type IN ('share_game', 'invite_friend', 'article_read')`,
          )
          .bind(userToken, today)
          .all<{ action_type: string; count: number }>(),
        getConfigMany(db, cfgKeys),
      ]);
      const dcMap = new Map<string, number>();
      for (const row of dailyRows.results || []) {
        if (row?.action_type != null) dcMap.set(row.action_type, row.count ?? 0);
      }
      const dailyCounts = {
        share: dcMap.get("share_game") ?? 0,
        invite: dcMap.get("invite_friend") ?? 0,
        article: dcMap.get("article_read") ?? 0,
      };
      const g = (k: string, d: string) => String(cfgMap[k] ?? d);
      const extraConfig = {
        shareGame: {
          credits: parseFloat(g("credits_share_game", "1")) || 1,
          dailyLimit: parseInt(g("credits_share_game_daily_limit", "5"), 10) || 5,
        },
        inviteFriend: {
          credits: parseFloat(g("credits_invite_friend", "3")) || 3,
          dailyLimit: parseInt(g("credits_invite_friend_daily_limit", "5"), 10) || 5,
        },
        article: {
          credits: parseFloat(g("credits_article", "1")) || 1,
          dailyLimit: parseInt(g("credits_article_daily_limit", "3"), 10) || 3,
        },
      };
      return json({
        success: true,
        credits: u.credits,
        totalEarned: u.total_earned,
        totalUsed: u.total_used,
        followedWechat: u.followed_wechat === 1,
        adCountToday: u.ad_count_today,
        dailyCounts,
        extraConfig,
        config: CREDITS_STATIC,
      });
    }

    if (method === "POST" && segs[0] === "generate") {
      return handleGenerate(request, env, db);
    }

    if (method === "GET" && segs[0] === "games" && segs.length === 1) {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
      const sort = url.searchParams.get("sort") || "newest";
      const category = url.searchParams.get("category") || "all";
      const orientation = url.searchParams.get("orientation") || "all";
      const search = (url.searchParams.get("search") || "").trim();
      const orderBy = orderByClause(sort);
      const params: unknown[] = [];
      let searchWhere = "";
      if (search) {
        searchWhere =
          "AND (g.title LIKE ? OR g.prompt LIKE ? OR g.author_name LIKE ?)";
        const p = `%${search}%`;
        params.push(p, p, p);
      }
      let categoryWhere = "";
      const categoryKeywords: Record<string, string[]> = {
        puzzle: ["2048", "拼图", "消除", "解谜", "益智", "数独", "连连看"],
        action: ["射击", "飞机", "打砖块", "弹球", "跑酷", "格斗", "动作"],
        arcade: ["贪吃蛇", "俄罗斯方块", "方块", "街机", "经典"],
        casual: ["翻牌", "记忆", "休闲", "点击", "小鸟", "flappy"],
        strategy: ["塔防", "策略", "棋", "卡牌"],
      };
      if (category && category !== "all") {
        const keywords = categoryKeywords[category];
        if (keywords?.length) {
          const parts = keywords.map(() => "(g.title LIKE ? OR g.prompt LIKE ?)");
          categoryWhere = `AND (${parts.join(" OR ")})`;
          for (const kw of keywords) {
            params.push(`%${kw}%`, `%${kw}%`);
          }
        }
      }
      let orientationWhere = "";
      if (orientation && orientation !== "all") {
        orientationWhere =
          "AND (g.orientation = ? OR (g.orientation IS NULL AND ? = 'portrait'))";
        params.push(orientation, orientation);
      }
      const countRow = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM games g
           WHERE COALESCE(g.is_hidden,0)=0 AND (COALESCE(g.is_public,1)=1 OR g.is_public IS NULL)
           AND COALESCE(g.status,'published')='published' ${searchWhere} ${categoryWhere} ${orientationWhere}`,
        )
        .bind(...params)
        .first<{ total: number }>();
      const total = countRow?.total ?? 0;
      const games = await db
        .prepare(
          `SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at, g.orientation,
            (g.play_count + g.like_count * 5 + g.favorite_count * 3) AS hot_score,
            (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) AS comment_count
           FROM games g
           WHERE COALESCE(g.is_hidden,0)=0 AND (COALESCE(g.is_public,1)=1 OR g.is_public IS NULL)
           AND COALESCE(g.status,'published')='published' ${searchWhere} ${categoryWhere} ${orientationWhere}
           ORDER BY ${orderBy}
           LIMIT ? OFFSET ?`,
        )
        .bind(...params, limit, offset)
        .all();
      return json({
        success: true,
        games: games.results,
        pagination: { total, limit, offset, hasMore: offset + (games.results?.length || 0) < total },
      });
    }

    if (method === "GET" && segs[0] === "games" && segs[1] === "recent") {
      const limit = parseInt(url.searchParams.get("limit") || "12", 10) || 12;
      const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
      const games = await db
        .prepare(
          `SELECT id, title, prompt, author_name, play_count, like_count, is_featured, created_at FROM games
           WHERE COALESCE(is_hidden,0)=0 AND (COALESCE(is_public,1)=1 OR is_public IS NULL)
           AND COALESCE(status,'published')='published'
           ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        )
        .bind(limit, offset)
        .all();
      return json({ success: true, games: games.results });
    }

    if (method === "GET" && segs[0] === "games" && segs[1] === "featured") {
      const limit = parseInt(url.searchParams.get("limit") || "12", 10) || 12;
      const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
      const games = await db
        .prepare(
          `SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.is_featured, g.created_at,
            (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) AS comment_count
           FROM games g
           WHERE COALESCE(g.is_hidden,0)=0 AND (COALESCE(g.is_public,1)=1 OR g.is_public IS NULL)
           AND COALESCE(g.status,'published')='published'
           ORDER BY g.is_featured DESC, g.like_count DESC, g.play_count DESC, g.created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(limit, offset)
        .all();
      return json({ success: true, games: games.results });
    }

    if (method === "GET" && segs[0] === "games" && segs[1] === "hot") {
      const limit = parseInt(url.searchParams.get("limit") || "10", 10) || 10;
      const period = url.searchParams.get("period") || "all";
      let dateFilter = "";
      if (period === "today") dateFilter = `AND DATE(g.created_at) = DATE('now')`;
      else if (period === "week") dateFilter = `AND g.created_at >= DATE('now', '-7 days')`;
      else if (period === "month") dateFilter = `AND g.created_at >= DATE('now', '-30 days')`;
      const games = await db
        .prepare(
          `SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count,
            COALESCE(s.share_count, 0) AS share_count, g.created_at,
            (g.play_count + g.like_count * 5 + COALESCE(s.share_count, 0) * 3) AS hot_score,
            (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) AS comment_count
           FROM games g
           LEFT JOIN game_stats s ON g.id = s.game_id
           WHERE COALESCE(g.is_hidden,0)=0 AND (COALESCE(g.is_public,1)=1 OR g.is_public IS NULL) ${dateFilter}
           ORDER BY hot_score DESC, g.created_at DESC LIMIT ?`,
        )
        .bind(limit)
        .all();
      return json({ success: true, games: games.results, period });
    }

    if (method === "GET" && segs[0] === "leaderboard" && segs[1] === "likes") {
      const limit = parseInt(url.searchParams.get("limit") || "10", 10) || 10;
      const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
      const games = await db
        .prepare(
          `SELECT id, title, prompt, author_name, play_count, like_count, favorite_count, created_at FROM games
           WHERE COALESCE(is_hidden,0)=0 AND (COALESCE(is_public,1)=1 OR is_public IS NULL)
           ORDER BY like_count DESC, play_count DESC LIMIT ? OFFSET ?`,
        )
        .bind(limit, offset)
        .all();
      return json({ success: true, games: games.results });
    }

    if (method === "GET" && segs[0] === "leaderboard" && segs[1] === "hot") {
      const limit = parseInt(url.searchParams.get("limit") || "10", 10) || 10;
      const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
      const games = await db
        .prepare(
          `SELECT g.id, g.title, g.prompt, g.author_name, g.play_count, g.like_count, g.favorite_count, g.created_at,
            (g.play_count + g.like_count * 5 + g.favorite_count * 3) AS score,
            (SELECT COUNT(*) FROM game_comments WHERE game_id = g.id AND is_deleted = 0) AS comment_count
           FROM games g
           WHERE COALESCE(g.is_hidden,0)=0 AND (COALESCE(g.is_public,1)=1 OR g.is_public IS NULL)
           ORDER BY score DESC LIMIT ? OFFSET ?`,
        )
        .bind(limit, offset)
        .all();
      return json({ success: true, games: games.results });
    }

    if (
      method === "GET" &&
      segs[0] === "games" &&
      segs.length === 2 &&
      segs[1] !== "recent" &&
      segs[1] !== "featured" &&
      segs[1] !== "hot" &&
      segs[1] !== "search"
    ) {
      const id = segs[1];
      const exists = await db.prepare("SELECT id FROM games WHERE id = ?").bind(id).first();
      if (!exists) return json({ success: false, error: "游戏不存在" }, 404);
      await db.prepare("UPDATE games SET play_count = play_count + 1 WHERE id = ?").bind(id).run();
      const game = await db
        .prepare(
          `SELECT id, title, prompt, code, author_name, author_token, llm_model, play_count, like_count, favorite_count, created_at, status FROM games WHERE id = ?`,
        )
        .bind(id)
        .first();
      return json({
        success: true,
        game,
        staticUrl: staticGameUrl(id),
      });
    }

    if (method === "POST" && segs[0] === "games" && segs.length === 3 && segs[2] === "play") {
      const gameId = segs[1];
      const userToken = getUserTokenFromRequest(request);
      let body: { duration?: number } = {};
      try {
        body = (await request.json()) as { duration?: number };
      } catch {
        body = {};
      }
      const ip = clientIp(request);
      const g = await db.prepare("SELECT id FROM games WHERE id = ?").bind(gameId).first();
      if (!g) return json({ success: false, error: "游戏不存在" }, 404);
      const fiveAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const identifier = userToken || ip;
      const recent = await db
        .prepare(
          `SELECT id FROM game_plays WHERE game_id = ? AND (user_token = ? OR ip_address = ?) AND created_at > ?`,
        )
        .bind(gameId, identifier, ip, fiveAgo)
        .first();
      if (!recent) {
        await db
          .prepare(
            "INSERT INTO game_plays (game_id, user_token, ip_address, play_duration) VALUES (?, ?, ?, ?)",
          )
          .bind(gameId, userToken || null, ip || null, body.duration || 0)
          .run();
        await db
          .prepare("UPDATE games SET play_count = play_count + 1 WHERE id = ?")
          .bind(gameId)
          .run();
        await db
          .prepare(
            `INSERT INTO game_stats (game_id, unique_players) VALUES (?, 1)
             ON CONFLICT(game_id) DO UPDATE SET unique_players = unique_players + 1, updated_at = datetime('now')`,
          )
          .bind(gameId)
          .run();
      }
      const updated = await db
        .prepare("SELECT play_count, like_count FROM games WHERE id = ?")
        .bind(gameId)
        .first();
      return json({ success: true, stats: updated });
    }

    if (method === "POST" && segs[0] === "games" && segs.length === 1) {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return json({ success: false, error: "无效 JSON" }, 400);
      }
      const title = body.title as string | undefined;
      const prompt = String(body.prompt || "");
      const code = String(body.code ?? "");
      const authorName = (body.authorName as string) || "匿名";
      let authorToken = (body.authorToken as string) || crypto.randomUUID();
      const status = (body.status as string) || "published";
      const orientation = (body.orientation as string) || "portrait";
      const visibility = (body.visibility as string) || "public";
      const isDraft = status === "draft";
      if (!isDraft && (!code || !prompt)) return json({ success: false, error: "缺少必要参数" }, 400);
      if (isDraft && !prompt) return json({ success: false, error: "草稿需要提供描述" }, 400);
      const id = crypto.randomUUID();
      const gameTitle = title || prompt.slice(0, 50);
      const isPublic = visibility === "public" ? 1 : 0;
      await db
        .prepare(
          `INSERT INTO games (id, title, prompt, code, author_name, author_token, status, orientation, visibility, is_public)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          gameTitle,
          prompt,
          code || "",
          authorName,
          authorToken,
          isDraft ? "draft" : "published",
          orientation,
          visibility,
          isPublic,
        )
        .run();
      return json({
        success: true,
        id,
        authorToken,
        staticUrl: isDraft ? null : staticGameUrl(id),
      });
    }

    if (method === "PUT" && segs[0] === "games" && segs.length === 2) {
      const id = segs[1];
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return json({ success: false, error: "无效 JSON" }, 400);
      }
      const headerToken = request.headers.get("X-Author-Token");
      const effectiveToken = String(body.authorToken || headerToken || "");
      const game = await db
        .prepare("SELECT author_token, status FROM games WHERE id = ?")
        .bind(id)
        .first<{ author_token: string; status: string }>();
      if (!game) return json({ success: false, error: "游戏不存在" }, 404);
      if (game.author_token !== effectiveToken) {
        return json({ success: false, error: "无权限编辑此游戏" }, 403);
      }
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (body.title !== undefined) {
        sets.push("title = ?");
        vals.push(body.title);
      }
      if (body.prompt !== undefined) {
        sets.push("prompt = ?");
        vals.push(body.prompt);
      }
      if (body.code !== undefined) {
        sets.push("code = ?");
        vals.push(body.code);
      }
      if (body.authorName !== undefined) {
        sets.push("author_name = ?");
        vals.push(body.authorName);
      }
      if (body.status !== undefined) {
        sets.push("status = ?");
        vals.push(body.status);
      }
      if (body.visibility !== undefined) {
        sets.push("visibility = ?");
        vals.push(body.visibility);
        sets.push("is_public = ?");
        vals.push(body.visibility === "public" ? 1 : 0);
      }
      sets.push("updated_at = datetime('now')");
      vals.push(id);
      await db
        .prepare(`UPDATE games SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...vals)
        .run();
      const st = (body.status as string) || game.status;
      return json({
        success: true,
        staticUrl: st === "published" ? staticGameUrl(id) : null,
      });
    }

    if (method === "GET" && segs[0] === "games" && segs[2] === "like-status" && segs.length === 3) {
      const gameId = segs[1];
      const userToken = getUserTokenFromRequest(request);
      if (!userToken) return json({ success: true, liked: false });
      const like = await db
        .prepare("SELECT id FROM user_likes WHERE user_token = ? AND game_id = ?")
        .bind(userToken, gameId)
        .first();
      return json({ success: true, liked: !!like });
    }

    if (method === "POST" && segs[0] === "games" && segs.length === 3 && segs[2] === "like") {
      const gameId = segs[1];
      const userToken = getUserTokenFromRequest(request);
      const game = await db
        .prepare("SELECT id, like_count, author_token FROM games WHERE id = ?")
        .bind(gameId)
        .first<{ id: string; like_count: number; author_token: string }>();
      if (!game) return json({ success: false, error: "游戏不存在" }, 404);
      let liked = true;
      let newLikeCount = game.like_count;
      if (userToken) {
        const existing = await db
          .prepare("SELECT id FROM user_likes WHERE user_token = ? AND game_id = ?")
          .bind(userToken, gameId)
          .first();
        if (existing) {
          await db
            .prepare("DELETE FROM user_likes WHERE user_token = ? AND game_id = ?")
            .bind(userToken, gameId)
            .run();
          await db
            .prepare(
              "UPDATE games SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?",
            )
            .bind(gameId)
            .run();
          liked = false;
          newLikeCount = Math.max(0, newLikeCount - 1);
        } else {
          await db
            .prepare("INSERT INTO user_likes (user_token, game_id) VALUES (?, ?)")
            .bind(userToken, gameId)
            .run();
          await db
            .prepare("UPDATE games SET like_count = like_count + 1 WHERE id = ?")
            .bind(gameId)
            .run();
          newLikeCount += 1;
        }
      } else {
        await db
          .prepare("UPDATE games SET like_count = like_count + 1 WHERE id = ?")
          .bind(gameId)
          .run();
        newLikeCount += 1;
      }
      return json({
        success: true,
        liked,
        likeCount: newLikeCount,
        creditAwarded: false,
        creditMessage: null,
      });
    }

    if (method === "GET" && segs[0] === "games" && segs[2] === "favorite-status" && segs.length === 3) {
      const gameId = segs[1];
      const userToken = getUserTokenFromRequest(request);
      if (!userToken) return json({ success: true, favorited: false });
      const f = await db
        .prepare("SELECT id FROM user_favorites WHERE user_token = ? AND game_id = ?")
        .bind(userToken, gameId)
        .first();
      return json({ success: true, favorited: !!f });
    }

    if (method === "POST" && segs[0] === "games" && segs.length === 3 && segs[2] === "favorite") {
      const gameId = segs[1];
      const userToken = getUserTokenFromRequest(request);
      if (!userToken) return json({ success: false, error: "请先登录" }, 401);
      const game = await db
        .prepare("SELECT id, author_token FROM games WHERE id = ?")
        .bind(gameId)
        .first<{ id: string; author_token: string }>();
      if (!game) return json({ success: false, error: "游戏不存在" }, 404);
      const existing = await db
        .prepare("SELECT id FROM user_favorites WHERE user_token = ? AND game_id = ?")
        .bind(userToken, gameId)
        .first();
      if (existing) {
        await db
          .prepare("DELETE FROM user_favorites WHERE user_token = ? AND game_id = ?")
          .bind(userToken, gameId)
          .run();
        await db
          .prepare(
            "UPDATE games SET favorite_count = CASE WHEN favorite_count > 0 THEN favorite_count - 1 ELSE 0 END WHERE id = ?",
          )
          .bind(gameId)
          .run();
        const updated = await db
          .prepare("SELECT favorite_count FROM games WHERE id = ?")
          .bind(gameId)
          .first<{ favorite_count: number }>();
        return json({
          success: true,
          favorited: false,
          favorite_count: updated?.favorite_count ?? 0,
        });
      }
      await db
        .prepare("INSERT INTO user_favorites (user_token, game_id) VALUES (?, ?)")
        .bind(userToken, gameId)
        .run();
      await db
        .prepare("UPDATE games SET favorite_count = favorite_count + 1 WHERE id = ?")
        .bind(gameId)
        .run();
      const updated = await db
        .prepare("SELECT favorite_count FROM games WHERE id = ?")
        .bind(gameId)
        .first<{ favorite_count: number }>();
      return json({
        success: true,
        favorited: true,
        favorite_count: updated?.favorite_count ?? 0,
        creditAwarded: false,
        creditMessage: null,
      });
    }

    if (method === "GET" && segs[0] === "games" && segs[2] === "comments" && segs.length === 3) {
      const gameId = segs[1];
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
      const userToken = getUserTokenFromRequest(request) || "";
      const comments = await db
        .prepare(
          `SELECT id, author_name, content, created_at, user_token, is_hidden FROM game_comments
           WHERE game_id = ? AND is_deleted = 0 AND (is_hidden = 0 OR user_token = ?)
           ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        )
        .bind(gameId, userToken, limit, offset)
        .all();
      const totalRow = await db
        .prepare(
          `SELECT COUNT(*) AS total FROM game_comments WHERE game_id = ? AND is_deleted = 0 AND (is_hidden = 0 OR user_token = ?)`,
        )
        .bind(gameId, userToken)
        .first<{ total: number }>();
      const total = totalRow?.total ?? 0;
      const processed = (comments.results || []).map((c: Record<string, unknown>) => ({
        id: c.id,
        author_name: c.author_name,
        content: c.content,
        created_at: c.created_at,
        user_token: c.user_token,
        is_mine: Boolean(userToken && c.user_token === userToken),
        is_hidden: c.is_hidden === 1,
      }));
      return json({
        success: true,
        comments: processed,
        total,
        hasMore: offset + processed.length < total,
      });
    }

    if (method === "POST" && segs[0] === "games" && segs[2] === "comments" && segs.length === 3) {
      const gameId = segs[1];
      const userToken = getUserTokenFromRequest(request);
      if (!userToken) return json({ success: false, error: "请先登录后再留言" }, 401);
      let body: { content?: string };
      try {
        body = (await request.json()) as { content?: string };
      } catch {
        return json({ success: false, error: "无效 JSON" }, 400);
      }
      const content = (body.content || "").trim();
      if (!content) return json({ success: false, error: "留言内容不能为空" }, 400);
      if (content.length > 500) return json({ success: false, error: "留言内容不能超过500字" }, 400);
      const lower = content.toLowerCase();
      for (const w of SENSITIVE) {
        if (lower.includes(w.toLowerCase())) {
          return json({ success: false, error: "留言内容包含违禁词" }, 400);
        }
      }
      const user = await db
        .prepare("SELECT account_id, nickname FROM user_accounts WHERE user_token = ?")
        .bind(userToken)
        .first<{ account_id: string; nickname: string }>();
      if (!user) return json({ success: false, error: "用户不存在" }, 401);
      const game = await db
        .prepare("SELECT id, author_token FROM games WHERE id = ?")
        .bind(gameId)
        .first<{ id: string; author_token: string }>();
      if (!game) return json({ success: false, error: "游戏不存在" }, 404);
      const authorName =
        user.nickname && user.nickname !== "游戏玩家" ? user.nickname : user.account_id;
      const ins = await db
        .prepare(
          "INSERT INTO game_comments (game_id, user_token, author_name, content) VALUES (?, ?, ?, ?)",
        )
        .bind(gameId, userToken, authorName, content)
        .run();
      const newId = ins.meta?.last_row_id;
      return json({
        success: true,
        comment: {
          id: newId,
          author_name: authorName,
          content,
          created_at: new Date().toISOString(),
          is_mine: true,
        },
        creditAwarded: false,
        creditMessage: null,
      });
    }

    const routeCtx = {
      request,
      env,
      db,
      url,
      method,
      segs,
      waitUntil: opts?.waitUntil,
    };
    const adminRes = await tryAdminRemaining(routeCtx);
    if (adminRes) return adminRes;
    const editRes = await tryEditRepair(routeCtx);
    if (editRes) return editRes;
    const restRes = await tryRoutesRemaining(routeCtx);
    if (restRes) return restRes;

    return json(
      {
        success: false,
        error: "该 API 在 Cloudflare 版尚未实现",
        path: `/${segs.join("/")}`,
        method,
      },
      501,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ success: false, error: msg }, 500);
  }
}
