-- ============================================================================
-- 修改 PostgreSQL 数据库用户和数据库名
-- 从 geekmore 改为 jigong
-- ============================================================================

-- 步骤 1: 创建新用户 jigong (如果不存在)
CREATE USER jigong WITH PASSWORD 'jigong';

-- 步骤 2: 赋予 jigong 用户超级用户权限
ALTER USER jigong WITH SUPERUSER;

-- 步骤 3: 重命名数据库
ALTER DATABASE geekmore RENAME TO jigong;

-- 步骤 4: 将所有对象的所有权从 geekmore 转移到 jigong
-- 这需要连接到 jigong 数据库执行

-- 步骤 5: 删除旧用户 (可选，在确认一切正常后)
-- DROP USER geekmore;
