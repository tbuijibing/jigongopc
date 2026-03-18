# SPEC-006 核心概念对照表 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0

---

## 一、核心概念映射

基于 jigongopc-master/doc/spec.md 的核心概念，对照本项目的实现方案：

### 1.1 公司模型 (Company Model)

| JiGongOpc 概念 | JiGongOpc-Java 实现 | 说明 |
|---------------|---------------------|------|
| Company | t_company | 公司实体 |
| Board (董事会) | t_board_member + 权限系统 | 人类监督层 |
| Board Powers | @PreAuth + @DataScope | 权限控制 |
| Budget Delegation | 级联预算字段 | 公司→Agent→Task |

**遗漏补充**：
- 董事会成员表 `t_board_member`
- 董事会审批记录表 `t_board_approval`
- 审批事项类型：Agent 创建、CEO 战略计划、预算变更

### 1.2 Agent 模型

| JiGongOpc 概念 | JiGongOpc-Java 实现 | 说明 |
|---------------|---------------------|------|
| Agent Identity | t_agent | Agent 实体 |
| Adapter Type | adapter_type VARCHAR | process/http/gateway |
| Adapter Config | adapter_config JSONB | 适配器配置 |
| Context Delivery | context_mode VARCHAR | fat-payload/thin-ping |
| JiGongOpc Skill | SKILL.md 文档 | Agent 交互指南 |

**遗漏补充**：
- Agent 描述字段 `description`（能力/职责说明）
- Agent Skill 文档（作为资源文件）
- 连接字符串生成接口

### 1.3 组织架构 (Org Structure)

| JiGongOpc 概念 | JiGongOpc-Java 实现 | 说明 |
|---------------|---------------------|------|
| Hierarchical Structure | reports_to BIGINT | 汇报关系 |
| Full Visibility | 数据权限控制 | 全员可见 |
| Cross-Team Work | 跨团队任务 | 任务分配 |
| Request Depth | request_depth INT | 委托深度 |
| Billing Code | billing_code VARCHAR | 成本归属 |

### 1.4 心跳系统 (Heartbeat System)

| JiGongOpc 概念 | JiGongOpc-Java 实现 | 说明 |
|---------------|---------------------|------|
| Heartbeat | XXL-Job 定时任务 | 心跳调度 |
| Execution Adapter | jigongopc-openclaw 模块 | 执行适配器 |
| invoke() | OpenClawGatewayClient.connect() | 启动 |
| status() | OpenClawGatewayClient.status() | 查询状态 |
| cancel() | OpenClawGatewayClient.cancel() | 取消 |
| Pause Behavior | 优雅停止 + 宽限期 | 暂停机制 |

**遗漏补充**：
- 宽限期配置（默认 30 秒）
- 心跳失败重试策略
- 健康监控仪表板

### 1.5 任务层级 (Task Hierarchy)

| JiGongOpc 概念 | JiGongOpc-Java 实现 | 说明 |
|---------------|---------------------|------|
| Initiative | t_initiative | 公司目标 |
| Project | t_project | 项目 |
| Milestone | t_milestone | 里程碑 |
| Issue | t_issue | 任务 |
| Sub-Issue | t_issue (parent_id) | 子任务 |

**遗漏补充**：
- Initiative（倡议/目标）实体
- Milestone（里程碑）实体
- 任务状态机：backlog → todo → in_progress → review → done

### 1.6 成本追踪 (Cost Tracking)

| JiGongOpc 概念 | JiGongOpc-Java 实现 | 说明 |
|---------------|---------------------|------|
| Token Cost | t_cost (token_count) | Token 消耗 |
| Dollar Cost | t_cost (amount_cents) | 美元成本 |
| Per-Agent | company_id + agent_id | Agent 维度 |
| Per-Task | task_id | 任务维度 |
| Per-Company | company_id | 公司维度 |
| Soft Alerts | 预算阈值告警 | 80% 告警 |
| Hard Ceiling | 自动暂停 | 100% 暂停 |

### 1.7 默认 Agent (Default Agents)

| JiGongOpc 概念 | JiGongOpc-Java 实现 | 说明 |
|---------------|---------------------|------|
| Default Agent | 默认 Agent 模板 | 基础 Agent |
| Default CEO | CEO Agent 模板 | 战略 Agent |
| Bootstrap Flow | CEO 启动流程 | 启动序列 |

**遗漏补充**：
- CEO Agent 模板配置
- 战略分解审批流程
- Agent 技能文档（SKILL.md）

---

## 二、架构对比

### 2.1 部署模型

| 维度 | JiGongOpc | JiGongOpc-Java |
|------|-----------|----------------|
| 部署模式 | 自托管单租户 | BladeX 微服务 |
| 数据库 | PGlite(嵌入)/Supabase | PostgreSQL 15+ |
| 前端 | React + Vite | Saber 3 (Vue 3) |
| 后端 | TypeScript + Hono | BladeX (Spring Boot) |
| Auth | Better Auth | BladeX blade-auth |

### 2.2 技术栈映射

| 功能 | JiGongOpc | JiGongOpc-Java |
|------|-----------|----------------|
| ORM | Drizzle ORM | MyBatis Plus |
| 调度 | 自研心跳 | XXL-Job |
| 网关 | - | Blade Gateway |
| Agent 通信 | WebSocket | OpenClaw Gateway |

---

## 三、遗漏的核心功能

### 3.1 高优先级 (P0)

#### 3.1.1 任务原子检出 (Atomic Task Checkout)

**描述**：任务采用单一分配模型，原子性 checkout 防止冲突

**实现方案**：
```sql
-- 任务 checkout 状态机
ALTER TABLE t_issue ADD COLUMN checkout_run_id VARCHAR(50);
ALTER TABLE t_issue ADD COLUMN checkout_agent_id BIGINT;
ALTER TABLE t_issue ADD COLUMN checkout_time TIMESTAMPTZ;
ALTER TABLE t_issue ADD COLUMN checkout_status VARCHAR(20);
-- pending/checked_out/in_progress/completed/failed

-- 原子 checkout 接口
POST /api/issue/{id}/checkout
{
  "agentId": 123,
  "runId": "run-abc-123"
}

-- 数据库层面使用乐观锁
UPDATE t_issue
SET checkout_status = 'checked_out',
    checkout_agent_id = :agentId,
    checkout_run_id = :runId,
    checkout_time = NOW()
WHERE id = :id
  AND (checkout_status IS NULL OR checkout_status = 'completed')
```

#### 3.1.2 崩溃恢复 (Crash Recovery)

**描述**：JiGongOpc 不自动重新分配，而是通过仪表板暴露停滞任务

**实现方案**：
- 停滞任务检测：`checkout_status = 'in_progress' AND last_activity < NOW() - INTERVAL '30 minutes'`
- 停滞任务仪表板
- 人工或管理 Agent 决定如何处理

#### 3.1.3 连接字符串生成 (Connection String Generation)

**描述**：Agent 创建时生成连接字符串，包含 URL、API Key 和说明

**实现方案**：
```java
public class AgentConnectionService {

    public ConnectionString generateConnection(Agent agent) {
        String apiKey = apiKeyService.generate(agent.getId());
        String url = baseUrl + "/api/agent/" + agent.getId();
        String instructions = loadInstructions("agent-" + agent.getAdapterType());

        return new ConnectionString(url, apiKey, instructions);
    }

    private String loadInstructions(String adapterType) {
        // 根据适配器类型加载对应说明
        // process: 环境变量配置说明
        // http: Webhook 配置说明
        // gateway: OpenClaw 连接说明
    }
}
```

#### 3.1.4 工作产出物 (Work Artifacts)

**描述**：JiGongOpc 不管理工作产出物（代码库、文件系统等），但需要记录产出物链接

**实现方案**：
```sql
-- 任务产出物表
CREATE TABLE t_work_artifact (
    id              BIGSERIAL PRIMARY KEY,
    issue_id        BIGINT NOT NULL REFERENCES t_issue(id),
    artifact_type   VARCHAR(50) NOT NULL,  -- code/doc/deployment
    artifact_url    VARCHAR(500) NOT NULL,
    artifact_desc   TEXT,
    create_agent_id BIGINT,
    create_time     TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE t_work_artifact IS '任务产出物登记表';
```

### 3.2 中优先级 (P1)

#### 3.2.1 模板导出/导入 (Template Export/Import)

**描述**：导出公司配置（Agent 定义、组织架构、适配器配置）作为可移植模板

**导出格式**：
```json
{
  "templateVersion": "1.0",
  "company": {
    "name": "示例公司",
    "initiatives": [...],
    "agents": [
      {
        "name": "CEO",
        "role": "ceo",
        "adapterType": "gateway",
        "adapterConfig": {...},
        "reportsTo": null
      }
    ],
    "orgChart": {...}
  }
}
```

#### 3.2.2 人类参与任务 (Human-in-the-Loop)

**描述**：Agent 可以创建任务分配给人类，人类通过 UI 完成任务

**实现方案**：
- 任务支持分配给 `assignee_user_id` (BladeX 用户)
- 人类完成任务后，如果请求 Agent 支持 pingback，发送唤醒通知
- 通过 WebSocket/SSE 推送通知

#### 3.2.3 实时 UI 更新 (Real-time Updates)

**描述**：Org Chart、仪表板等需要实时更新 Agent 状态

**实现方案**：
- WebSocket 推送 Agent 状态变更
- SSE 推送任务进度
- 前端订阅更新

### 3.3 低优先级 (P2)

#### 3.3.1 知识库插件 (Knowledge Base Plugin)

**描述**：核心不包含知识库，作为插件后续添加

#### 3.3.2 外部收支跟踪 (Revenue/Expense Plugin)

**描述**：Token/LLM 成本是核心功能，外部收支作为插件

---

## 四、数据库 Schema 补充

### 4.1 董事会相关

```sql
-- 董事会成员表
CREATE TABLE t_board_member (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES t_company(id),
    user_id         BIGINT NOT NULL,  -- BladeX 用户 ID
    role            VARCHAR(50) DEFAULT 'member',  -- member/chair
    permissions     TEXT[],  -- 权限列表
    is_active       BOOLEAN DEFAULT TRUE,
    create_time     TIMESTAMPTZ DEFAULT NOW(),
    update_time     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE KEY uk_company_user (company_id, user_id)
);

COMMENT ON TABLE t_board_member IS '董事会成员表';
COMMENT ON COLUMN t_board_member.permissions IS '权限：[APPROVE_HIRE, APPROVE_STRATEGY, SET_BUDGET, PAUSE_AGENT, ...]';

-- 董事会审批记录表
CREATE TABLE t_board_approval (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES t_company(id),
    approval_type   VARCHAR(50) NOT NULL,  -- HIRE_AGENT/APPROVE_STRATEGY/BUDGET_CHANGE
    target_id       BIGINT NOT NULL,  -- 目标实体 ID
    target_type     VARCHAR(50) NOT NULL,  -- AGENT/STRATEGY/BUDGET
    proposer_id     BIGINT,  -- 提案人（可能是 CEO Agent）
    approver_id     BIGINT NOT NULL,  -- 审批人（Board 成员）
    decision        VARCHAR(20) NOT NULL,  -- APPROVED/REJECTED/PENDING
    reason          TEXT,
    create_time     TIMESTAMPTZ DEFAULT NOW(),
    update_time     TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE t_board_approval IS '董事会审批记录表';
```

### 4.2 目标层级补充

```sql
-- 倡议/公司目标表
CREATE TABLE t_initiative (
    id              BIGSERIAL PRIMARY KEY,
    company_id      BIGINT NOT NULL REFERENCES t_company(id),
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) DEFAULT 'active',  -- active/completed/archived
    target_date     DATE,
    progress_percent INT DEFAULT 0,
    create_user     BIGINT,
    create_time     TIMESTAMPTZ DEFAULT NOW(),
    update_user     BIGINT,
    update_time     TIMESTAMPTZ DEFAULT NOW(),
    is_deleted      BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE t_initiative IS '公司倡议/目标表';

-- 里程碑表
CREATE TABLE t_milestone (
    id              BIGSERIAL PRIMARY KEY,
    initiative_id   BIGINT REFERENCES t_initiative(id),
    project_id      BIGINT REFERENCES t_project(id),
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    target_date     DATE,
    completed_date  TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending/in_progress/completed
    sort_order      INT DEFAULT 0,
    create_time     TIMESTAMPTZ DEFAULT NOW(),
    update_time     TIMESTAMPTZ DEFAULT NOW(),
    is_deleted      BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE t_milestone IS '里程碑表';
```

### 4.3 Agent 补充字段

```sql
ALTER TABLE t_agent ADD COLUMN description TEXT;
COMMENT ON COLUMN t_agent.description IS 'Agent 描述：职责和能力说明';

ALTER TABLE t_agent ADD COLUMN context_mode VARCHAR(20) DEFAULT 'thin-ping';
COMMENT ON COLUMN t_agent.context_mode IS '上下文交付模式：fat-payload/thin-ping';

ALTER TABLE t_agent ADD COLUMN last_checkout_run_id VARCHAR(50);
COMMENT ON COLUMN t_agent.last_checkout_run_id IS '最近一次 checkout 的运行 ID';
```

---

## 五、API 补充

### 5.1 任务检出相关

```
POST   /api/issue/{id}/checkout      # 原子检出任务
POST   /api/issue/{id}/checkin       # 检入任务（完成/失败）
GET    /api/issue/stale              # 查询停滞任务
POST   /api/issue/{id}/release       # 释放任务（人工干预）
```

### 5.2 连接字符串相关

```
POST   /api/agent/{id}/connection    # 生成连接字符串
GET    /api/agent/{id}/connection    # 获取连接字符串
```

### 5.3 董事会审批相关

```
POST   /api/board/approval           # 提交审批
GET    /api/board/approvals          # 查询待审批列表
POST   /api/board/approval/{id}/approve   # 批准
POST   /api/board/approval/{id}/reject    # 拒绝
```

### 5.4 产出物相关

```
POST   /api/issue/{id}/artifact      # 登记产出物
GET    /api/issue/{id}/artifacts     # 查询产出物列表
```

---

## 六、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
