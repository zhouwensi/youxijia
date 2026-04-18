import type { Env } from "../types";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-User-Token, X-Author-Token, x-user-token, x-platform, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    ""
  );
}

export type Db = D1Database;

export function getDb(env: Env): Db {
  return env.YOUXIJIA_DB;
}
