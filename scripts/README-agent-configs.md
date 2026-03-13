# Agent Configuration Seeding

这个脚本用于批量更新 Agent 的 Soul、Tools、Skills、Memory 配置。

## 前提条件

1. Agent 必须已经在数据库中存在（通过 UI 创建）
2. 确保 Agent 名称完全匹配（区分大小写）

## 使用方法

### 方法 1：直接数据库访问（推荐）

这个方法直接操作数据库，不需要服务器运行，支持 PostgreSQL 和 PGlite。

```bash
# 使用 PGlite（默认）
node scripts/seed-db-direct.mjs

# 使用 PostgreSQL
DATABASE_URL=postgresql://localhost:5432/Jigong node scripts/seed-db-direct.mjs
```

### 方法 2：通过 API

需要服务器正在运行。

```bash
# 1. 启动服务器
pnpm dev

# 2. 获取 Company ID
curl http://localhost:3100/api/companies

# 3. 运行脚本
COMPANY_ID=your-company-id-here node scripts/seed-agents-via-api.mjs
```

### 方法 3：SQL 脚本

直接在数据库中执行 SQL。

```bash
# 编辑 scripts/seed-agent-configs-compact.sql
# 将 YOUR_COMPANY_ID_HERE 替换为你的 Company ID

# 执行 SQL
psql -d your_database -f scripts/seed-agent-configs-compact.sql
```

### 3. 检查结果

脚本会输出每个 Agent 的更新状态：

```
🚀 Starting agent configuration seed for company abc123...

📋 Found 9 agents

📝 Updating CEO总指挥 (agent-id-123)...
  ✓ Soul updated
  ✓ Tool "create_task" created
  ✓ Tool "review_progress" created
  ✓ Skill "strategic_planning" installed
  ✓ Memory "company_vision" created
✅ CEO总指挥 completed

...

✨ All agents processed!
```

## 配置内容

脚本会为以下 9 个角色更新配置：

1. **CEO总指挥** - 战略规划、资源协调
2. **测试** - 质量保证、bug 跟踪
3. **设计** - UI/UX 设计
4. **IOS** - iOS 应用开发
5. **运营** - 用户增长、数据分析
6. **产品** - 产品规划、需求管理
7. **前端** - Web 前端开发
8. **安卓** - Android 应用开发
9. **JAVA** - 后端服务开发

## 配置项说明

### Soul（灵魂）
- `systemPrompt`: 系统提示词，定义 Agent 的身份、职责、工作原则
- `personality`: 性格特征
- `constraints`: 约束条件
- `language`: 语言偏好

### Tools（工具）
- Agent 可以调用的工具和函数
- 每个工具包含名称、描述、类型、参数配置

### Skills（技能）
- Agent 具备的技能
- 每个技能包含名称、描述、熟练程度

### Memory（记忆）
- Agent 的上下文记忆
- 支持三个层级：agent（Agent 级）、project（项目级）、task（任务级）
- 每条记忆包含 key、value、类型、重要性

## Heartbeat 配置

**注意**：Heartbeat 配置需要通过 UI 手动设置，或者直接更新数据库。

推荐配置：

- **CEO总指挥**: 300秒（5分钟）
- **测试**: 600秒（10分钟）
- **设计**: 900秒（15分钟）
- **IOS**: 600秒（10分钟）
- **运营**: 900秒（15分钟）
- **产品**: 900秒（15分钟）
- **前端**: 600秒（10分钟）
- **安卓**: 600秒（10分钟）
- **JAVA**: 600秒（10分钟）

所有 Agent 建议启用：
- ✓ Heartbeat on interval
- ✓ Wake on demand
- Cooldown: 10秒
- Max concurrent runs: 1

## 自定义配置

如果需要修改配置，编辑 `scripts/agent-configs-data.mjs` 文件。

## 故障排除

### Agent 未找到

确保 Agent 名称完全匹配（区分大小写）。可以通过 API 查看所有 Agent：

```bash
curl http://localhost:3100/api/companies/YOUR_COMPANY_ID/agents
```

### API 调用失败

1. 确认服务器正在运行：`pnpm dev`
2. 检查 API_BASE 环境变量（默认：http://localhost:3100/api）
3. 查看服务器日志了解详细错误

### 权限问题

确保你有访问该 Company 的权限。在开发模式下（`local_trusted`），这通常不是问题。

## 注意事项

1. **幂等性**：脚本会创建新的 Tools、Skills、Memory，不会删除现有的
2. **Soul 更新**：Soul 会被完全替换（upsert）
3. **备份**：建议在运行脚本前备份数据库
4. **测试**：建议先在测试环境运行

## 相关文件

- `scripts/seed-agents-via-api.mjs` - 主脚本
- `scripts/agent-configs-data.mjs` - 配置数据
- `scripts/agent-configs.json` - JSON 格式的配置（备用）
