-- ============================================================================
-- Seed Agent Configurations (Compact Version)
-- ============================================================================
-- Usage: Replace YOUR_COMPANY_ID_HERE with your actual company UUID
--        psql -d your_database -v company_id='your-uuid-here' -f scripts/seed-agent-configs-compact.sql
-- ============================================================================

-- Helper function to upsert soul
CREATE OR REPLACE FUNCTION upsert_agent_soul(
  p_company_id UUID,
  p_agent_name TEXT,
  p_system_prompt TEXT,
  p_personality TEXT,
  p_constraints TEXT,
  p_language TEXT DEFAULT 'zh'
) RETURNS VOID AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  SELECT id INTO v_agent_id FROM agents WHERE name = p_agent_name AND company_id = p_company_id;
  IF v_agent_id IS NULL THEN
    RAISE NOTICE 'Agent % not found', p_agent_name;
    RETURN;
  END IF;
  
  INSERT INTO agent_souls (company_id, agent_id, system_prompt, personality, constraints, language, version, created_at, updated_at)
  VALUES (p_company_id, v_agent_id, p_system_prompt, p_personality, p_constraints, p_language, 1, NOW(), NOW())
  ON CONFLICT (company_id, agent_id) 
  DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    personality = EXCLUDED.personality,
    constraints = EXCLUDED.constraints,
    language = EXCLUDED.language,
    version = agent_souls.version + 1,
    updated_at = NOW();
  
  RAISE NOTICE 'Soul updated for %', p_agent_name;
END;
$$ LANGUAGE plpgsql;

-- Helper function to add tool
CREATE OR REPLACE FUNCTION add_agent_tool(
  p_company_id UUID,
  p_agent_name TEXT,
  p_tool_name TEXT,
  p_description TEXT,
  p_config JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  SELECT id INTO v_agent_id FROM agents WHERE name = p_agent_name AND company_id = p_company_id;
  IF v_agent_id IS NULL THEN RETURN; END IF;
  
  INSERT INTO agent_tools (company_id, agent_id, name, description, tool_type, config, created_at, updated_at)
  VALUES (p_company_id, v_agent_id, p_tool_name, p_description, 'function', p_config, NOW(), NOW())
  ON CONFLICT (company_id, agent_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Helper function to add skill
CREATE OR REPLACE FUNCTION add_agent_skill(
  p_company_id UUID,
  p_agent_name TEXT,
  p_skill_name TEXT,
  p_description TEXT,
  p_level TEXT DEFAULT 'intermediate'
) RETURNS VOID AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  SELECT id INTO v_agent_id FROM agents WHERE name = p_agent_name AND company_id = p_company_id;
  IF v_agent_id IS NULL THEN RETURN; END IF;
  
  INSERT INTO agent_skills (company_id, agent_id, skill_name, description, proficiency_level, created_at, updated_at)
  VALUES (p_company_id, v_agent_id, p_skill_name, p_description, p_level, NOW(), NOW())
  ON CONFLICT (company_id, agent_id, skill_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Helper function to add memory
CREATE OR REPLACE FUNCTION add_agent_memory(
  p_company_id UUID,
  p_agent_name TEXT,
  p_key TEXT,
  p_value TEXT,
  p_importance INT DEFAULT 5
) RETURNS VOID AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  SELECT id INTO v_agent_id FROM agents WHERE name = p_agent_name AND company_id = p_company_id;
  IF v_agent_id IS NULL THEN RETURN; END IF;
  
  INSERT INTO agent_memories (company_id, agent_id, memory_layer, scope_id, key, value, memory_type, importance, created_at, updated_at)
  VALUES (p_company_id, v_agent_id, 'agent', NULL, p_key, p_value, 'context', p_importance, NOW(), NOW())
  ON CONFLICT (company_id, agent_id, memory_layer, key) WHERE scope_id IS NULL DO NOTHING;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- Set your company ID here
-- ============================================================================
\set company_id 'YOUR_COMPANY_ID_HERE'

-- Or pass it as a variable: psql -v company_id='uuid-here' -f script.sql

-- ============================================================================
-- 1. CEO总指挥
-- ============================================================================
SELECT upsert_agent_soul(
  :'company_id'::uuid,
  'CEO总指挥',
  '# 身份
你是公司的 CEO 和总指挥，负责整个公司的战略规划、资源协调和团队管理。

# 性格特征
- 战略思维：善于从全局视角思考问题
- 决策果断：能够快速做出关键决策
- 沟通清晰：善于向团队传达愿景和目标
- 责任担当：对公司整体结果负责

# 核心职责
1. 制定公司战略和发展方向
2. 协调各部门资源和优先级
3. 审批重要决策和预算
4. 监控项目进度和团队绩效
5. 处理跨部门冲突和问题升级

# 工作原则
- 优先处理高优先级和阻塞性问题
- 定期检查各团队的工作进展
- 确保资源合理分配
- 及时做出决策，避免团队等待
- 保持与各部门负责人的沟通

# 输出格式
- 决策要清晰明确，包含理由
- 任务分配要具体，指定负责人和截止时间
- 进度报告要简洁，突出关键指标和风险',
  '战略思维、决策果断、沟通清晰、责任担当',
  '必须遵守公司政策和法律法规；决策要基于数据和事实'
);

SELECT add_agent_tool(:'company_id'::uuid, 'CEO总指挥', 'create_task', '创建新任务并分配给团队成员', 
  '{"parameters": {"title": "string", "assignee": "string", "priority": "string"}}'::jsonb);
SELECT add_agent_tool(:'company_id'::uuid, 'CEO总指挥', 'review_progress', '查看项目和任务进度',
  '{"parameters": {"project_id": "string", "time_range": "string"}}'::jsonb);

SELECT add_agent_skill(:'company_id'::uuid, 'CEO总指挥', 'strategic_planning', '制定战略规划和路线图', 'expert');
SELECT add_agent_skill(:'company_id'::uuid, 'CEO总指挥', 'resource_allocation', '优化资源分配', 'expert');
SELECT add_agent_skill(:'company_id'::uuid, 'CEO总指挥', 'team_coordination', '协调跨部门团队', 'expert');

SELECT add_agent_memory(:'company_id'::uuid, 'CEO总指挥', 'company_vision', '公司愿景和长期目标', 10);
SELECT add_agent_memory(:'company_id'::uuid, 'CEO总指挥', 'current_priorities', '当前季度优先事项', 9);

