-- Company Operating Template System Migration
-- Creates tables for template management, transactions, deliverables, accountability, and retrospectives

-- 1. Company Templates - 公司运行模板
CREATE TABLE company_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',

    source_type TEXT NOT NULL DEFAULT 'builtin',
    parent_template_id UUID,

    template_package JSONB,
    encryption_config JSONB,

    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,

    is_public BOOLEAN NOT NULL DEFAULT false,
    share_code TEXT,
    download_count INTEGER NOT NULL DEFAULT 0,

    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    imported_at TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_templates_company ON company_templates(company_id);
CREATE INDEX idx_company_templates_slug ON company_templates(slug);
CREATE INDEX idx_company_templates_share_code ON company_templates(share_code) WHERE share_code IS NOT NULL;

-- 2. Template Subscriptions - 模板订阅
CREATE TABLE template_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES company_templates(id) ON DELETE CASCADE,

    auto_update BOOLEAN NOT NULL DEFAULT false,
    update_channel TEXT NOT NULL DEFAULT 'stable',

    is_forked BOOLEAN NOT NULL DEFAULT false,
    forked_from_id UUID REFERENCES company_templates(id),
    customizations JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_subscriptions_company ON template_subscriptions(company_id);
CREATE INDEX idx_template_subscriptions_template ON template_subscriptions(template_id);

-- 3. Template Marketplace - 模板市场
CREATE TABLE template_marketplace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES company_templates(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'pending',
    published_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,

    category TEXT NOT NULL DEFAULT 'general',
    tags TEXT[],
    rating INTEGER,
    review_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_marketplace_status ON template_marketplace(status);
CREATE INDEX idx_template_marketplace_category ON template_marketplace(category);

-- 4. Template Workflows - 模板工作流定义
CREATE TABLE template_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES company_templates(id) ON DELETE CASCADE,

    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    definition JSONB,

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_workflows_company ON template_workflows(company_id);
CREATE INDEX idx_template_workflows_template ON template_workflows(template_id);

-- 5. Template Roles - 模板角色定义
CREATE TABLE template_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES company_templates(id) ON DELETE CASCADE,

    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    definition JSONB,

    is_active BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_roles_company ON template_roles(company_id);
CREATE INDEX idx_template_roles_template ON template_roles(template_id);

-- 6. Project Template Assignments - 项目模板分配
CREATE TABLE project_template_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES company_templates(id) ON DELETE CASCADE,

    variable_overrides JSONB,
    disabled_workflows TEXT[],
    custom_workflows JSONB,

    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_by TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_template_assignments_project ON project_template_assignments(project_id);

-- 7. Transactions - 事务
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    code TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,

    issue_id UUID REFERENCES issues(id),

    workflow_id UUID NOT NULL REFERENCES template_workflows(id),
    current_phase TEXT NOT NULL DEFAULT 'init',

    status TEXT NOT NULL DEFAULT 'active',
    blocked_reason TEXT,
    blocked_at TIMESTAMPTZ,

    organizer_agent_id UUID,
    organizer_user_id TEXT,

    phase_history JSONB DEFAULT '[]',
    progress JSONB DEFAULT '{"totalDeliverables":0,"completedDeliverables":0,"requiredRoles":0,"assignedRoles":0,"phaseProgress":{}}',
    pending_suggestions JSONB DEFAULT '[]',

    completed_at TIMESTAMPTZ,
    completed_by TEXT,

    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_company ON transactions(company_id);
CREATE INDEX idx_transactions_project ON transactions(project_id);
CREATE INDEX idx_transactions_issue ON transactions(issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX idx_transactions_workflow ON transactions(workflow_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- 8. Transaction Role Assignments - 事务角色分配
CREATE TABLE transaction_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

    role_code TEXT NOT NULL,
    role_name TEXT NOT NULL,

    agent_id UUID,
    user_id TEXT,

    assigned_by TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    is_active BOOLEAN NOT NULL DEFAULT true,
    deactivated_at TIMESTAMPTZ,
    deactivated_reason TEXT,

    required_deliverables JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transaction_role_assignments_transaction ON transaction_role_assignments(transaction_id);
CREATE INDEX idx_transaction_role_assignments_agent ON transaction_role_assignments(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_transaction_role_assignments_user ON transaction_role_assignments(user_id) WHERE user_id IS NOT NULL;

-- 9. Transaction Deliverables - 事务交付物
CREATE TABLE transaction_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    role_assignment_id UUID REFERENCES transaction_role_assignments(id) ON DELETE CASCADE,

    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    phase TEXT NOT NULL,

    content TEXT,
    content_type TEXT NOT NULL DEFAULT 'markdown',
    external_url TEXT,

    template_path TEXT,

    status TEXT NOT NULL DEFAULT 'pending',

    submitted_at TIMESTAMPTZ,
    submitted_by TEXT,
    submitted_content TEXT,

    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    review_comments TEXT,
    review_decision TEXT,

    is_required BOOLEAN NOT NULL DEFAULT true,
    is_blocking BOOLEAN NOT NULL DEFAULT true,

    validation_rules JSONB,
    validation_passed BOOLEAN,

    version INTEGER NOT NULL DEFAULT 1,
    history JSONB DEFAULT '[]',

    is_auto_generated BOOLEAN NOT NULL DEFAULT false,
    generation_source TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transaction_deliverables_company ON transaction_deliverables(company_id);
CREATE INDEX idx_transaction_deliverables_transaction ON transaction_deliverables(transaction_id);
CREATE INDEX idx_transaction_deliverables_role ON transaction_deliverables(role_assignment_id) WHERE role_assignment_id IS NOT NULL;
CREATE INDEX idx_transaction_deliverables_phase ON transaction_deliverables(phase);
CREATE INDEX idx_transaction_deliverables_status ON transaction_deliverables(status);

-- 10. Deliverable Dependencies - 交付物依赖
CREATE TABLE deliverable_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    dependent_id UUID NOT NULL REFERENCES transaction_deliverables(id) ON DELETE CASCADE,
    dependency_id UUID NOT NULL REFERENCES transaction_deliverables(id) ON DELETE CASCADE,

    dependency_type TEXT NOT NULL DEFAULT 'requires',
    is_blocking BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deliverable_dependencies_dependent ON deliverable_dependencies(dependent_id);
CREATE INDEX idx_deliverable_dependencies_dependency ON deliverable_dependencies(dependency_id);

-- 11. Accountability Trails - 责任追溯
CREATE TABLE accountability_trails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL,
    event_code TEXT,

    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT,

    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_name TEXT,

    context JSONB,
    reason TEXT,
    justification TEXT,
    evidence JSONB,
    impact JSONB,

    parent_event_id UUID REFERENCES accountability_trails(id),
    chain_depth INTEGER NOT NULL DEFAULT 0,

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accountability_trails_company ON accountability_trails(company_id);
CREATE INDEX idx_accountability_trails_transaction ON accountability_trails(transaction_id);
CREATE INDEX idx_accountability_trails_actor ON accountability_trails(actor_type, actor_id);
CREATE INDEX idx_accountability_trails_occurred ON accountability_trails(occurred_at);
CREATE INDEX idx_accountability_trails_event ON accountability_trails(event_type);

-- 12. Transaction Timelines - 事务时间线
CREATE TABLE transaction_timelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

    entry_type TEXT NOT NULL,
    entry_data JSONB NOT NULL,

    display_order INTEGER NOT NULL,
    is_milestone BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transaction_timelines_transaction ON transaction_timelines(transaction_id);
CREATE INDEX idx_transaction_timelines_order ON transaction_timelines(transaction_id, display_order);

-- 13. Retrospectives - 复盘记录
CREATE TABLE retrospectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'pending',

    what_went_well TEXT[],
    what_went_wrong TEXT[],
    what_to_improve TEXT[],

    metrics JSONB,
    analysis JSONB,
    template_improvements JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',

    participants TEXT[],
    conducted_by TEXT,

    scheduled_at TIMESTAMPTZ,
    conducted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    ai_summary TEXT,
    ai_insights JSONB,

    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_retrospectives_company ON retrospectives(company_id);
CREATE INDEX idx_retrospectives_transaction ON retrospectives(transaction_id);
CREATE INDEX idx_retrospectives_status ON retrospectives(status);

-- 14. Retrospective Patterns - 复盘模式库
CREATE TABLE retrospective_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    pattern_code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,

    matching_rules JSONB,

    occurrence_count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    related_transaction_ids UUID[],
    suggested_actions JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_retrospective_patterns_company ON retrospective_patterns(company_id);
CREATE INDEX idx_retrospective_patterns_category ON retrospective_patterns(category);

-- 15. Template Evolution Logs - 模板演进日志
CREATE TABLE template_evolution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    change_type TEXT NOT NULL,
    target_template_id UUID NOT NULL,

    source_type TEXT NOT NULL,
    source_id UUID,

    change_description TEXT NOT NULL,
    previous_value JSONB,
    new_value JSONB,

    affected_transactions INTEGER NOT NULL DEFAULT 0,
    expected_improvement TEXT,

    can_rollback BOOLEAN NOT NULL DEFAULT true,
    rolled_back_at TIMESTAMPTZ,
    rollback_reason TEXT,

    approved_by TEXT,
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_template_evolution_logs_company ON template_evolution_logs(company_id);
CREATE INDEX idx_template_evolution_logs_template ON template_evolution_logs(target_template_id);
