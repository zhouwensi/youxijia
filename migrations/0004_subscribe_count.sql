-- 与 server.js 一致：订阅消息次数（小程序「我的」页展示）
ALTER TABLE user_accounts ADD COLUMN subscribe_count INTEGER DEFAULT 0;
