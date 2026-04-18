-- 小程序：草稿「创作完成」订阅（与 Node asyncGenerateTasks 中 sync_<draftId> 语义对齐）
ALTER TABLE games ADD COLUMN draft_subscribe_notify INTEGER DEFAULT 0;
