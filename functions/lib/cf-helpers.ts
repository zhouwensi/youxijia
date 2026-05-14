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
  const row = await db
    .prepare(
      `SELECT account_id, reason, expire_at, ban_types FROM banned_accounts_v2
       WHERE account_id = ? AND (expire_at IS NULL OR expire_at > datetime('now'))`,
    )
    .bind(accountId)
    .first();
  return row as Record<string, unknown> | null;
}

export function ipForRequest(request: Request): string {
  return clientIp(request) || "unknown";
}
