-- 游戏家 D1 初始结构（与 SQLite 版 server.js 对齐，便于从 games.db 迁移数据）

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  author_name TEXT DEFAULT '匿名',
  author_token TEXT NOT NULL,
  play_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  is_featured INTEGER DEFAULT 0,
  is_hidden INTEGER DEFAULT 0,
  category TEXT DEFAULT '其他',
  llm_model TEXT DEFAULT 'deepseek-v3',
  is_public INTEGER DEFAULT 1,
  status TEXT DEFAULT 'published',
  orientation TEXT DEFAULT 'portrait',
  share_count INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'public',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_games_created_at ON games (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_featured ON games (is_featured DESC, like_count DESC);

CREATE TABLE IF NOT EXISTS user_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT UNIQUE NOT NULL,
  nickname TEXT DEFAULT '游戏玩家',
  password_hash TEXT,
  email TEXT,
  user_token TEXT UNIQUE NOT NULL,
  has_password INTEGER DEFAULT 0,
  device_fingerprint TEXT,
  last_ip TEXT,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_account_id ON user_accounts (account_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_user_token ON user_accounts (user_token);
CREATE INDEX IF NOT EXISTS idx_user_accounts_device ON user_accounts (device_fingerprint);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  user_token TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  is_deleted INTEGER DEFAULT 0,
  is_hidden INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_comments_game ON game_comments (game_id, is_deleted);

CREATE TABLE IF NOT EXISTS user_credits (
  user_token TEXT PRIMARY KEY,
  credits INTEGER DEFAULT 5,
  total_earned INTEGER DEFAULT 5,
  total_used INTEGER DEFAULT 0,
  first_gen_used INTEGER DEFAULT 0,
  followed_wechat INTEGER DEFAULT 0,
  last_ad_date TEXT,
  ad_count_today INTEGER DEFAULT 0,
  last_login_date TEXT,
  daily_login_claimed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_action_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_date TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_token, action_type, action_date)
);

CREATE TABLE IF NOT EXISTS user_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  game_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_token, game_id)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  game_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_token, game_id)
);

CREATE TABLE IF NOT EXISTS user_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_token TEXT NOT NULL,
  following_token TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (follower_token, following_token)
);

CREATE TABLE IF NOT EXISTS game_stats (
  game_id TEXT PRIMARY KEY,
  share_count INTEGER DEFAULT 0,
  share_wechat INTEGER DEFAULT 0,
  share_weibo INTEGER DEFAULT 0,
  share_qq INTEGER DEFAULT 0,
  share_link INTEGER DEFAULT 0,
  unique_players INTEGER DEFAULT 0,
  avg_play_time INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS game_plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  user_token TEXT,
  ip_address TEXT,
  play_duration INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_game_plays_game ON game_plays (game_id);

CREATE TABLE IF NOT EXISTS banned_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  ban_type TEXT NOT NULL,
  reason TEXT,
  banned_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS banned_ips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  banned_at TEXT DEFAULT (datetime('now'))
);

-- 默认配置（与 server.js defaultConfigs 一致要点）
INSERT OR IGNORE INTO system_config (key, value, description) VALUES
('credits_initial', '3', '新用户初始积分'),
('llm_default_model', 'deepseek-v3', '默认LLM模型ID'),
('llm_default_api_key', '', '默认LLM API密钥'),
('llm_default_base_url', '', '默认LLM API地址'),
('llm_enabled', 'true', '是否启用LLM'),
('credits_share_game', '1', '分享游戏奖励'),
('credits_share_game_daily_limit', '5', '每日分享上限'),
('credits_invite_friend', '3', '邀请好友奖励'),
('credits_invite_friend_daily_limit', '5', '每日邀请上限'),
('credits_article', '1', '阅读文章奖励'),
('credits_article_daily_limit', '3', '每日阅读文章上限'),
('share_text_template', '我用一句话做了个游戏《{title}》，快来玩！', '分享文案'),
('wechat_verify_code', '2026', '微信关注验证码');
