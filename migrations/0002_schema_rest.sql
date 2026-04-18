-- 与 server.js 其余表对齐（IF NOT EXISTS，可安全重复执行）

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  creator_token TEXT NOT NULL,
  used_by TEXT,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stats_daily (
  date TEXT PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  total_plays INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_generations INTEGER DEFAULT 0,
  trial_uses INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_extras (
  user_token TEXT PRIMARY KEY,
  invite_code TEXT,
  invited_by TEXT,
  trial_count_today INTEGER DEFAULT 0,
  trial_last_date TEXT,
  share_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  user_token TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (game_id, user_token)
);

CREATE INDEX IF NOT EXISTS idx_game_likes_game ON game_likes (game_id);

CREATE TABLE IF NOT EXISTS share_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  user_token TEXT,
  platform TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS referrals (
  invitee_account_id TEXT PRIMARY KEY,
  inviter_code TEXT NOT NULL,
  rewarded INTEGER DEFAULT 0,
  rewarded_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_referral_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_code TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  UNIQUE (inviter_code, date)
);

CREATE TABLE IF NOT EXISTS article_promo_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  article_id TEXT,
  description TEXT,
  reward INTEGER DEFAULT 1,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS promo_code_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  code TEXT NOT NULL,
  article_id TEXT,
  source TEXT DEFAULT 'code',
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_token, code)
);

CREATE TABLE IF NOT EXISTS comment_credit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  game_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_token, game_id)
);

CREATE TABLE IF NOT EXISTS like_credit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  game_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_token, game_id)
);

CREATE TABLE IF NOT EXISTS favorite_credit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  game_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_token, game_id)
);

CREATE TABLE IF NOT EXISTS follow_credit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  target_token TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_token, target_token)
);

CREATE TABLE IF NOT EXISTS game_edit_sessions (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  user_token TEXT NOT NULL,
  original_code TEXT NOT NULL,
  current_code TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_edit_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  code_snapshot TEXT,
  tokens_used INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  code TEXT NOT NULL,
  change_summary TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leaderboard_excludes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT UNIQUE NOT NULL,
  exclude_types TEXT DEFAULT 'all',
  reason TEXT,
  operator TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devtools_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  value TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cors_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origin TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repair_tasks (
  game_id TEXT PRIMARY KEY,
  status TEXT,
  message TEXT,
  detail_json TEXT,
  user_token TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generation_requests (
  request_id TEXT PRIMARY KEY,
  user_token TEXT,
  cancelled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS share_visit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT,
  visitor_token TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 封禁表：与 Node 版字段对齐（若 0001 已建旧结构，此处用新表名避免破坏已有库）
CREATE TABLE IF NOT EXISTS banned_accounts_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT UNIQUE NOT NULL,
  reason TEXT DEFAULT '违规',
  duration INTEGER,
  expire_at TEXT,
  hide_works INTEGER DEFAULT 0,
  hide_messages INTEGER DEFAULT 0,
  ban_types TEXT,
  operator TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS banned_ips_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT UNIQUE NOT NULL,
  reason TEXT DEFAULT '违规',
  duration INTEGER,
  expire_at TEXT,
  ban_types TEXT,
  operator TEXT DEFAULT 'admin',
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO devtools_whitelist (type, value) VALUES ('ip', '127.0.0.1');
INSERT OR IGNORE INTO devtools_whitelist (type, value) VALUES ('ip', 'localhost');
INSERT OR IGNORE INTO devtools_whitelist (type, value) VALUES ('ip', '::1');
INSERT OR IGNORE INTO cors_whitelist (origin, description) VALUES ('*', 'allow all');
