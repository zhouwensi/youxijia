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

export async function setConfig(db: Db, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .bind(key, value)
    .run();
}
