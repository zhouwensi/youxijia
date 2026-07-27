-- 后台软删除回收站
ALTER TABLE games ADD COLUMN is_deleted INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_games_is_deleted ON games (is_deleted);
