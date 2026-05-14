import type { Db } from "./http";

export async function getConfig(
  db: Db,
  key: string,
  defaultValue: string | null = "",
): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM system_config WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  if (!row) return defaultValue;
  return row.value;
}

/** 一次 IN 查询读取多枚配置，降低 /api/credits 等接口的 D1 往返次数 */
export async function getConfigMany(db: Db, keys: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const k of keys) out[k] = null;
  const uniq = [...new Set(keys.filter(Boolean))];
  if (!uniq.length) return out;
  const ph = uniq.map(() => "?").join(",");
  const rows = await db
    .prepare(`SELECT key, value FROM system_config WHERE key IN (${ph})`)
    .bind(...uniq)
    .all<{ key: string; value: string }>();
  for (const r of rows.results || []) {
    if (r?.key) out[r.key] = r.value ?? null;
  }
  return out;
}

export async function setConfig(db: Db, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .bind(key, value)
    .run();
}
