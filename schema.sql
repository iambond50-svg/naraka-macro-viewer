-- 永劫无间宏数据库 Schema for Cloudflare D1

CREATE TABLE IF NOT EXISTS macros (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    application_id TEXT,
    category TEXT DEFAULT '',
    macro_type TEXT NOT NULL,
    action_name TEXT DEFAULT '',
    read_only INTEGER DEFAULT 0,
    macro_data TEXT NOT NULL
);

-- 创建索引提升查询性能
CREATE INDEX IF NOT EXISTS idx_macros_name ON macros(name);
CREATE INDEX IF NOT EXISTS idx_macros_category ON macros(category);
CREATE INDEX IF NOT EXISTS idx_macros_type ON macros(macro_type);
