import type { Env } from "../types";
import type { Db } from "./http";
import { clientIp } from "./http";

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 与 server.js hashPassword 一致 */
export async function hashPasswordLegacy(password: string): Promise<string> {
  return sha256Hex(password + "aigame_salt_2025");
}

export function requireAdmin(request: Request, env: Env): boolean {
  const k = request.headers.get("X-Admin-Key");
  return Boolean(env.ADMIN_KEY && k && k === env.ADMIN_KEY);
}

export async function isUserAdmin(db: Db, userToken: string | null): Promise<boolean> {
  if (!userToken) return false;
  const row = await db
    .prepare("SELECT is_admin FROM user_accounts WHERE user_token = ?")
    .bind(userToken)
    .first<{ is_admin: number }>();
  return row?.is_admin === 1;
}

/**
 * 读取本站 user_token：主站发 X-User-Token；部分页面（如「我的作品」）只带 X-Author-Token（本站与 user_token 同源）
 * 部分网关会剥自定义头，可改用 Authorization: Bearer <token>
 */
export function getUserTokenFromRequest(request: Request): string {
  const x =
    request.headers.get("X-User-Token")?.trim() || request.headers.get("x-user-token")?.trim();
  if (x) return x;
  const author =
    request.headers.get("X-Author-Token")?.trim() || request.headers.get("x-author-token")?.trim();
  if (author) return author;
  const auth = request.headers.get("Authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

export async function getAccountIdByToken(db: Db, userToken: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT account_id FROM user_accounts WHERE user_token = ?")
    .bind(userToken)
    .first<{ account_id: string }>();
  return row?.account_id ?? null;
}

export async function checkIpBannedV2(db: Db, ip: string): Promise<Record<string, unknown> | null> {
  if (!ip) return null;
  const row = await db
    .prepare(
      `SELECT ip, reason, expire_at, ban_types FROM banned_ips_v2
       WHERE ip = ? AND (expire_at IS NULL OR expire_at > datetime('now'))`,
    )
    .bind(ip)
    .first();
  return row as Record<string, unknown> | null;
}

export async function checkAccountBannedV2(db: Db, accountId: string): Promise<Record<string, unknown> | null> {
  if (!accountId) return null;
  const row = await db
    .prepare(
      `SELECT account_id, reason, expire_at, ban_types, hide_works, hide_messages FROM banned_accounts_v2
       WHERE account_id = ? AND (expire_at IS NULL OR expire_at > datetime('now'))`,
    )
    .bind(accountId)
    .first();
  if (row) return row as Record<string, unknown>;
  // 兼容误用 user_token 作为 account_id 封禁的记录
  const byToken = await db
    .prepare(
      `SELECT b.account_id, b.reason, b.expire_at, b.ban_types, b.hide_works, b.hide_messages
       FROM banned_accounts_v2 b
       INNER JOIN user_accounts ua ON ua.user_token = b.account_id
       WHERE ua.account_id = ? AND (b.expire_at IS NULL OR b.expire_at > datetime('now'))`,
    )
    .bind(accountId)
    .first();
  return (byToken as Record<string, unknown> | null) ?? null;
}

/** 公开列表排除「封禁且勾选隐藏作品」的作者 */
export const SQL_EXCLUDE_BANNED_HIDE_WORKS = `
  AND NOT EXISTS (
    SELECT 1 FROM banned_accounts_v2 b
    LEFT JOIN user_accounts ua
      ON ua.account_id = b.account_id OR ua.user_token = b.account_id
    WHERE COALESCE(b.hide_works, 0) = 1
      AND (b.expire_at IS NULL OR b.expire_at > datetime('now'))
      AND (g.author_token = ua.user_token OR g.author_token = b.account_id)
  )
`;

export async function resolveBanTarget(
  db: Db,
  target: string,
): Promise<{ accountId: string; userToken: string }> {
  const t = String(target || "").trim();
  if (!t) return { accountId: "", userToken: "" };
  const byAccount = await db
    .prepare("SELECT account_id, user_token FROM user_accounts WHERE account_id = ?")
    .bind(t)
    .first<{ account_id: string; user_token: string }>();
  if (byAccount) return { accountId: byAccount.account_id, userToken: byAccount.user_token };
  const byToken = await db
    .prepare("SELECT account_id, user_token FROM user_accounts WHERE user_token = ?")
    .bind(t)
    .first<{ account_id: string; user_token: string }>();
  if (byToken) return { accountId: byToken.account_id, userToken: byToken.user_token };
  const looksToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
  return looksToken ? { accountId: t, userToken: t } : { accountId: t, userToken: t };
}

export async function hideAuthorWorks(db: Db, userToken: string): Promise<number> {
  if (!userToken) return 0;
  const r = await db
    .prepare(
      `UPDATE games SET is_hidden = 1, updated_at = datetime('now')
       WHERE author_token = ? AND COALESCE(is_hidden, 0) = 0`,
    )
    .bind(userToken)
    .run();
  return r.meta?.changes ?? 0;
}

export async function restoreAuthorWorks(db: Db, userToken: string): Promise<number> {
  if (!userToken) return 0;
  const r = await db
    .prepare(
      `UPDATE games SET is_hidden = 0, updated_at = datetime('now')
       WHERE author_token = ? AND COALESCE(is_hidden, 0) = 1`,
    )
    .bind(userToken)
    .run();
  return r.meta?.changes ?? 0;
}

export async function hideAuthorMessages(db: Db, userToken: string): Promise<number> {
  if (!userToken) return 0;
  const r = await db
    .prepare(
      `UPDATE game_comments SET is_hidden = 1
       WHERE user_token = ? AND COALESCE(is_hidden, 0) = 0 AND COALESCE(is_deleted, 0) = 0`,
    )
    .bind(userToken)
    .run();
  return r.meta?.changes ?? 0;
}

export async function restoreAuthorMessages(db: Db, userToken: string): Promise<number> {
  if (!userToken) return 0;
  const r = await db
    .prepare(
      `UPDATE game_comments SET is_hidden = 0
       WHERE user_token = ? AND COALESCE(is_hidden, 0) = 1`,
    )
    .bind(userToken)
    .run();
  return r.meta?.changes ?? 0;
}

export function ipForRequest(request: Request): string {
  return clientIp(request) || "unknown";
}
