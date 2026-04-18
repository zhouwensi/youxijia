-- 微信小程序登录：与微信 openid 绑定（与 device_fingerprint 账号体系并存）
ALTER TABLE user_accounts ADD COLUMN mp_openid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_accounts_mp_openid ON user_accounts(mp_openid);
