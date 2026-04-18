-- 小程序每日签到（与 Node server.js 对齐）

CREATE TABLE IF NOT EXISTS user_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  checkin_date TEXT NOT NULL,
  streak_days INTEGER NOT NULL DEFAULT 1,
  reward_credits INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_token, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_user_checkins_user ON user_checkins (user_token);
CREATE INDEX IF NOT EXISTS idx_user_checkins_date ON user_checkins (checkin_date);
