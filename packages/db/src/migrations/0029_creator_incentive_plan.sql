-- Template Creator Incentive Plan - Phase A (Conservative)
-- 模板创作者激励计划 - 方案A：保守稳健型

-- ============================================
-- 1. 创作者收益账户
-- ============================================
CREATE TABLE creator_revenue_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id TEXT,              -- 人类创作者
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,  -- Agent 创作者

    -- 金额使用 DECIMAL 避免浮点误差
    total_earned DECIMAL(19, 4) NOT NULL DEFAULT 0,
    available_balance DECIMAL(19, 4) NOT NULL DEFAULT 0,
    withdrawn_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,
    pending_amount DECIMAL(19, 4) NOT NULL DEFAULT 0,  -- 待结算金额

    -- 支付信息
    payout_method JSONB,       -- { type: "bank", currency: "USD", ... }
    tax_info JSONB,            -- 税务信息

    -- 创作者等级 (bronze, silver, gold, platinum, diamond)
    tier TEXT NOT NULL DEFAULT 'bronze',
    tier_updated_at TIMESTAMPTZ,

    -- 统计
    total_templates INTEGER NOT NULL DEFAULT 0,
    total_downloads INTEGER NOT NULL DEFAULT 0,
    total_forks INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3, 2),  -- 0.00 - 5.00

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 一个创作者只能有一个账户
    UNIQUE(company_id, user_id),
    UNIQUE(company_id, agent_id)
);

CREATE INDEX idx_creator_accounts_company ON creator_revenue_accounts(company_id);
CREATE INDEX idx_creator_accounts_tier ON creator_revenue_accounts(tier);

-- ============================================
-- 2. 模板谱系追踪
-- ============================================
CREATE TABLE template_lineages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL UNIQUE REFERENCES company_templates(id) ON DELETE CASCADE,

    root_template_id UUID NOT NULL REFERENCES company_templates(id),
    parent_template_id UUID REFERENCES company_templates(id),
    generation INTEGER NOT NULL DEFAULT 0,  -- 第几代分叉

    -- 简化的祖先链（只存关键信息）
    parent_info JSONB,  -- { creatorId, creatorName, forkedAt, contribution }

    -- 统计
    fork_count INTEGER NOT NULL DEFAULT 0,
    direct_usage_count INTEGER NOT NULL DEFAULT 0,
    total_revenue_generated DECIMAL(19, 4) NOT NULL DEFAULT 0,

    -- 贡献评分 (0-100)
    originality_score INTEGER,  -- 原创度

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_lineages_root ON template_lineages(root_template_id);
CREATE INDEX idx_template_lineages_parent ON template_lineages(parent_template_id);

-- ============================================
-- 3. 收益记录主表
-- ============================================
CREATE TABLE revenue_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 收入来源
    source_type TEXT NOT NULL,  -- subscription, transaction, customization, marketplace_sale
    source_id TEXT,             -- 关联的订单/事务ID

    -- 关联模板
    template_id UUID NOT NULL REFERENCES company_templates(id),

    -- 购买者信息
    buyer_company_id UUID REFERENCES companies(id),
    buyer_user_id TEXT,

    -- 金额 (统一用 USD，结算时转换)
    total_amount DECIMAL(19, 4) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',

    -- 分配详情 (方案A)
    platform_fee DECIMAL(19, 4) NOT NULL,        -- 15%
    direct_creator_share DECIMAL(19, 4) NOT NULL, -- 60%
    ancestor_share DECIMAL(19, 4) NOT NULL,       -- 15%
    root_share DECIMAL(19, 4) NOT NULL,           -- 10%

    -- 状态
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, distributed, failed
    distributed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_records_template ON revenue_records(template_id);
CREATE INDEX idx_revenue_records_status ON revenue_records(status);
CREATE INDEX idx_revenue_records_source ON revenue_records(source_type, source_id);

-- ============================================
-- 4. 创作者收益分配明细
-- ============================================
CREATE TABLE creator_revenue_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revenue_record_id UUID NOT NULL REFERENCES revenue_records(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES creator_revenue_accounts(id),

    -- 分配信息
    amount DECIMAL(19, 4) NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL,

    -- 分配类型 (方案A简化)
    distribution_type TEXT NOT NULL,  -- direct_creator, parent_template, root_template

    -- 状态
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, credited, disputed
    credited_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revenue_distributions_record ON creator_revenue_distributions(revenue_record_id);
CREATE INDEX idx_revenue_distributions_account ON creator_revenue_distributions(account_id);
CREATE INDEX idx_revenue_distributions_status ON creator_revenue_distributions(status);

-- ============================================
-- 5. 收益结算周期表
-- ============================================
CREATE TABLE revenue_settlement_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 周期信息
    cycle_type TEXT NOT NULL,  -- daily, weekly, monthly
    cycle_start TIMESTAMPTZ NOT NULL,
    cycle_end TIMESTAMPTZ NOT NULL,

    -- 统计
    total_revenue DECIMAL(19, 4) NOT NULL DEFAULT 0,
    total_distributed DECIMAL(19, 4) NOT NULL DEFAULT 0,
    total_accounts INTEGER NOT NULL DEFAULT 0,

    -- 状态
    status TEXT NOT NULL DEFAULT 'open',  -- open, processing, completed, failed

    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 6. 提现申请
-- ============================================
CREATE TABLE creator_payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES creator_revenue_accounts(id),

    amount DECIMAL(19, 4) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',

    -- 支付详情
    payout_method JSONB NOT NULL,
    recipient_info JSONB NOT NULL,  -- 收款人信息

    -- 状态
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, processing, completed, rejected, failed

    -- 处理信息
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    transaction_id TEXT,  -- 外部交易ID

    -- 失败信息
    failure_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payout_requests_account ON creator_payout_requests(account_id);
CREATE INDEX idx_payout_requests_status ON creator_payout_requests(status);

-- ============================================
-- 7. 创作者等级历史
-- ============================================
CREATE TABLE creator_tier_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES creator_revenue_accounts(id) ON DELETE CASCADE,

    old_tier TEXT NOT NULL,
    new_tier TEXT NOT NULL,

    -- 升级原因
    reason TEXT NOT NULL,  -- templates_count, downloads_count, revenue_threshold, manual_review
    metrics_snapshot JSONB,  -- 当时的统计数据

    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by TEXT  -- 系统升级则为 null
);

CREATE INDEX idx_tier_history_account ON creator_tier_history(account_id);

-- ============================================
-- 8. 模板收入统计 (缓存表，加速查询)
-- ============================================
CREATE TABLE template_revenue_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL UNIQUE REFERENCES company_templates(id) ON DELETE CASCADE,

    -- 收入统计
    total_sales INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(19, 4) NOT NULL DEFAULT 0,
    total_forks INTEGER NOT NULL DEFAULT 0,
    total_usage INTEGER NOT NULL DEFAULT 0,  -- 被使用次数

    -- 本月统计
    monthly_sales INTEGER NOT NULL DEFAULT 0,
    monthly_revenue DECIMAL(19, 4) NOT NULL DEFAULT 0,

    -- 评分
    rating_count INTEGER NOT NULL DEFAULT 0,
    rating_sum INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3, 2),

    -- 更新时间
    stats_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_stats_revenue ON template_revenue_stats(total_revenue DESC);
CREATE INDEX idx_template_stats_rating ON template_revenue_stats(average_rating DESC);

-- ============================================
-- 触发器：自动更新统计
-- ============================================

-- 当收益分配完成时，更新账户余额
CREATE OR REPLACE FUNCTION update_creator_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'credited' AND OLD.status != 'credited' THEN
        UPDATE creator_revenue_accounts
        SET
            available_balance = available_balance + NEW.amount,
            total_earned = total_earned + NEW.amount,
            updated_at = NOW()
        WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_creator_balance
    AFTER UPDATE ON creator_revenue_distributions
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_balance();

-- 当提现完成时，扣减余额
CREATE OR REPLACE FUNCTION update_creator_balance_on_payout()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE creator_revenue_accounts
        SET
            available_balance = available_balance - NEW.amount,
            withdrawn_amount = withdrawn_amount + NEW.amount,
            updated_at = NOW()
        WHERE id = NEW.account_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_balance_on_payout
    AFTER UPDATE ON creator_payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_creator_balance_on_payout();
