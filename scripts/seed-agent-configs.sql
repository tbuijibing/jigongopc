-- ============================================================================
-- Seed Agent Configurations
-- ============================================================================
-- This script updates Soul, Tools, Skills, Memory for 9 agent roles
-- 
-- Prerequisites:
-- 1. Agents must already exist in the database with the exact names
-- 2. You need to know your company_id
-- 
-- Usage:
--   For PostgreSQL: psql -d your_database -f scripts/seed-agent-configs.sql
--   For PGlite: Use the repair-migration.mjs pattern to execute
--
-- IMPORTANT: Replace 'YOUR_COMPANY_ID_HERE' with your actual company UUID
-- ============================================================================

-- Set your company ID here
\set company_id 'YOUR_COMPANY_ID_HERE'

-- ============================================================================
-- Helper: Clean up existing configs (optional, comment out if you want to keep)
-- ============================================================================
-- DELETE FROM agent_souls WHERE company_id = :'company_id';
-- DELETE FROM agent_tools WHERE company_id = :'company_id';
-- DELETE FROM agent_skills WHERE company_id = :'company_id';
-- DELETE FROM agent_memories WHERE company_id = :'company_id';

-- ============================================================================
-- 1. CEO总指挥 (121)
-- ============================================================================

-- Soul
INSERT INTO agent_souls (company_id, agent_id, system_prompt, personality, constraints, language, version, created_at, updated_at)
SELECT 
  a.company_id,
  a.id,
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
  '必须遵守公司政策和法律法规；决策要基于数据和事实',
  'zh',
  1,
  NOW(),
  NOW()
FROM agents a 
WHERE a.name = 'CEO总指挥' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id) 
DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt,
  personality = EXCLUDED.personality,
  constraints = EXCLUDED.constraints,
  language = EXCLUDED.language,
  version = agent_souls.version + 1,
  updated_at = NOW();

-- Tools
INSERT INTO agent_tools (company_id, agent_id, name, description, tool_type, config, created_at, updated_at)
SELECT a.company_id, a.id, 'create_task', '创建新任务并分配给团队成员', 'function', 
  '{"parameters": {"title": "string", "assignee": "string", "priority": "string"}}'::jsonb,
  NOW(), NOW()
FROM agents a WHERE a.name = 'CEO总指挥' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, name) DO NOTHING;

INSERT INTO agent_tools (company_id, agent_id, name, description, tool_type, config, created_at, updated_at)
SELECT a.company_id, a.id, 'review_progress', '查看项目和任务进度', 'function',
  '{"parameters": {"project_id": "string", "time_range": "string"}}'::jsonb,
  NOW(), NOW()
FROM agents a WHERE a.name = 'CEO总指挥' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, name) DO NOTHING;

-- Skills
INSERT INTO agent_skills (company_id, agent_id, skill_name, description, proficiency_level, created_at, updated_at)
SELECT a.company_id, a.id, 'strategic_planning', '制定战略规划和路线图', 'expert', NOW(), NOW()
FROM agents a WHERE a.name = 'CEO总指挥' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, skill_name) DO NOTHING;

INSERT INTO agent_skills (company_id, agent_id, skill_name, description, proficiency_level, created_at, updated_at)
SELECT a.company_id, a.id, 'resource_allocation', '优化资源分配', 'expert', NOW(), NOW()
FROM agents a WHERE a.name = 'CEO总指挥' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, skill_name) DO NOTHING;

INSERT INTO agent_skills (company_id, agent_id, skill_name, description, proficiency_level, created_at, updated_at)
SELECT a.company_id, a.id, 'team_coordination', '协调跨部门团队', 'expert', NOW(), NOW()
FROM agents a WHERE a.name = 'CEO总指挥' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, skill_name) DO NOTHING;

-- Memory
INSERT INTO agent_memories (company_id, agent_id, memory_layer, scope_id, key, value, memory_type, importance, created_at, updated_at)
SELECT a.company_id, a.id, 'agent', NULL, 'company_vision', '公司愿景和长期目标', 'context', 10, NOW(), NOW()
FROM agents a WHERE a.name = 'CEO总指挥' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, memory_layer, key) WHERE scope_id IS NULL DO NOTHING;

INSERT INTO agent_memories (company_id, agent_id, memory_layer, scope_id, key, value, memory_type, importance, created_at, updated_at)
SELECT a.company_id, a.id, 'agent', NULL, 'current_priorities', '当前季度优先事项', 'context', 9, NOW(), NOW()
FROM agents a WHERE a.name = 'CEO总指挥' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, memory_layer, key) WHERE scope_id IS NULL DO NOTHING;


-- ============================================================================
-- 2. 测试 (127)
-- ============================================================================

-- Soul
INSERT INTO agent_souls (company_id, agent_id, system_prompt, personality, constraints, language, version, created_at, updated_at)
SELECT 
  a.company_id, a.id,
  '# 身份
你是专业的测试工程师，负责保证产品质量和用户体验。

# 性格特征
- 细致严谨：不放过任何细节问题
- 质量至上：坚持高质量标准
- 沟通清晰：能准确描述问题和复现步骤

# 核心职责
1. 编写和执行测试用例
2. 进行功能测试、回归测试、性能测试
3. 发现和报告 bug
4. 验证 bug 修复
5. 自动化测试脚本开发

# 工作原则
- 测试覆盖要全面，包括边界情况
- Bug 报告要详细，包含复现步骤和截图
- 优先测试高风险和核心功能

# 输出格式
- Bug 报告：标题、严重程度、复现步骤、预期结果、实际结果、环境信息',
  '细致严谨、质量至上、沟通清晰',
  '必须客观公正地评估质量；不能跳过测试步骤',
  'zh', 1, NOW(), NOW()
FROM agents a WHERE a.name = '测试' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id) DO UPDATE SET
  system_prompt = EXCLUDED.system_prompt, personality = EXCLUDED.personality,
  constraints = EXCLUDED.constraints, version = agent_souls.version + 1, updated_at = NOW();

-- Tools
INSERT INTO agent_tools (company_id, agent_id, name, description, tool_type, config, created_at, updated_at)
SELECT a.company_id, a.id, 'create_bug_report', '创建 bug 报告', 'function',
  '{"parameters": {"title": "string", "severity": "string", "steps": "array"}}'::jsonb, NOW(), NOW()
FROM agents a WHERE a.name = '测试' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, name) DO NOTHING;

INSERT INTO agent_tools (company_id, agent_id, name, description, tool_type, config, created_at, updated_at)
SELECT a.company_id, a.id, 'run_test_suite', '执行测试套件', 'function',
  '{"parameters": {"suite_name": "string", "environment": "string"}}'::jsonb, NOW(), NOW()
FROM agents a WHERE a.name = '测试' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, name) DO NOTHING;

-- Skills
INSERT INTO agent_skills (company_id, agent_id, skill_name, description, proficiency_level, created_at, updated_at)
VALUES 
  ((SELECT company_id FROM agents WHERE name = '测试' AND company_id = :'company_id'),
   (SELECT id FROM agents WHERE name = '测试' AND company_id = :'company_id'),
   'functional_testing', '功能测试和用例设计', 'expert', NOW(), NOW()),
  ((SELECT company_id FROM agents WHERE name = '测试' AND company_id = :'company_id'),
   (SELECT id FROM agents WHERE name = '测试' AND company_id = :'company_id'),
   'automation_testing', '自动化测试脚本开发', 'advanced', NOW(), NOW()),
  ((SELECT company_id FROM agents WHERE name = '测试' AND company_id = :'company_id'),
   (SELECT id FROM agents WHERE name = '测试' AND company_id = :'company_id'),
   'bug_tracking', '缺陷跟踪和管理', 'expert', NOW(), NOW())
ON CONFLICT (company_id, agent_id, skill_name) DO NOTHING;

-- Memory
INSERT INTO agent_memories (company_id, agent_id, memory_layer, scope_id, key, value, memory_type, importance, created_at, updated_at)
SELECT a.company_id, a.id, 'agent', NULL, 'test_standards', '测试标准和质量要求', 'context', 9, NOW(), NOW()
FROM agents a WHERE a.name = '测试' AND a.company_id = :'company_id'
ON CONFLICT (company_id, agent_id, memory_layer, key) WHERE scope_id IS NULL DO NOTHING;

