#!/bin/bash
# ============================================================================
# 修改 PostgreSQL 数据库用户和数据库名
# 从 geekmore 改为 jigong
# ============================================================================

set -e

echo "修改 PostgreSQL 数据库用户和数据库名..."

# 检查是否提供了 postgres 密码
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "请设置环境变量 POSTGRES_PASSWORD (postgres 超级用户密码)"
    echo "例如: export POSTGRES_PASSWORD=your_postgres_password"
    exit 1
fi

# 步骤 1: 创建新用户 jigong
echo "1. 创建新用户 jigong..."
PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -c "CREATE USER jigong WITH PASSWORD 'jigong';" 2>/dev/null || echo "用户 jigong 已存在"

# 步骤 2: 赋予超级用户权限
echo "2. 赋予 jigong 超级用户权限..."
PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -c "ALTER USER jigong WITH SUPERUSER;"

# 步骤 3: 重命名数据库 (如果 geekmore 存在)
echo "3. 检查并重命名数据库..."
DB_EXISTS=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -t -c "SELECT 1 FROM pg_database WHERE datname='geekmore';")
if [ "$DB_EXISTS" = " 1" ]; then
    # 终止连接到 geekmore 数据库的会话
    PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='geekmore';"
    # 重命名数据库
    PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -c "ALTER DATABASE geekmore RENAME TO jigong;"
    echo "数据库已重命名为 jigong"
else
    echo "数据库 geekmore 不存在，检查是否有 jigong 数据库..."
    JIGONG_EXISTS=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -t -c "SELECT 1 FROM pg_database WHERE datname='jigong';")
    if [ "$JIGONG_EXISTS" = " 1" ]; then
        echo "数据库 jigong 已存在"
    else
        echo "创建新数据库 jigong..."
        PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -c "CREATE DATABASE jigong OWNER jigong;"
    fi
fi

# 步骤 4: 修改数据库所有者
echo "4. 修改数据库所有者..."
PGPASSWORD="$POSTGRES_PASSWORD" psql -U postgres -c "ALTER DATABASE jigong OWNER TO jigong;"

# 步骤 5: 在 jigong 数据库中转移所有权
echo "5. 转移表所有权..."
PGPASSWORD="jigong" psql -U jigong -d jigong << 'EOF'
-- 转移所有表的所有权
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE 'ALTER TABLE public.' || r.tablename || ' OWNER TO jigong;';
    END LOOP;
END $$;

-- 转移所有序列的所有权
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
        EXECUTE 'ALTER SEQUENCE public.' || r.sequencename || ' OWNER TO jigong;';
    END LOOP;
END $$;
EOF

echo ""
echo "✅ 数据库修改完成!"
echo ""
echo "新连接信息:"
echo "  数据库: jigong"
echo "  用户名: jigong"
echo "  密码:   jigong"
echo "  URL:    postgres://jigong:jigong@localhost:5432/jigong"
echo ""
echo "如需删除旧用户 geekmore，请手动执行:"
echo "  DROP USER geekmore;"
