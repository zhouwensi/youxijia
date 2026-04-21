-- 小程序权益兑换码、三站核销、通行证绑定、跨站权益 JSON（与 youxijia D1 同库）

CREATE TABLE IF NOT EXISTS privilege_redeem_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  tier TEXT NOT NULL,
  mp_openid TEXT NOT NULL,
  user_token TEXT NOT NULL,
  credits_on_redeem REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_site TEXT,
  used_user_token TEXT
);

CREATE INDEX IF NOT EXISTS idx_priv_codes_user ON privilege_redeem_codes(user_token, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_priv_codes_openid ON privilege_redeem_codes(mp_openid, created_at DESC);

CREATE TABLE IF NOT EXISTS privilege_claim_daily (
  mp_openid TEXT NOT NULL,
  claim_key TEXT NOT NULL,
  claim_count INTEGER NOT NULL DEFAULT 0,
  claim_date TEXT NOT NULL,
  PRIMARY KEY (mp_openid, claim_key, claim_date)
);

CREATE TABLE IF NOT EXISTS privilege_claim_ip_daily (
  ip TEXT NOT NULL,
  claim_key TEXT NOT NULL,
  claim_date TEXT NOT NULL,
  claim_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, claim_key, claim_date)
);

CREATE TABLE IF NOT EXISTS gamer_points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_token TEXT NOT NULL,
  delta REAL NOT NULL,
  balance_after REAL,
  reason TEXT,
  ref_code TEXT,
  site TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gamer_ledger_user ON gamer_points_ledger(user_token, id DESC);

CREATE TABLE IF NOT EXISTS hub_link_tokens (
  link_token TEXT PRIMARY KEY,
  user_token TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_cross_entitlements (
  user_token TEXT NOT NULL,
  site TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_token, site)
);

CREATE TABLE IF NOT EXISTS mp_interstitial_daily (
  mp_openid TEXT NOT NULL,
  ad_date TEXT NOT NULL,
  show_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (mp_openid, ad_date)
);
