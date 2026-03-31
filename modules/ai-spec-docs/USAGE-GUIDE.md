# ai-spec-docs 模块使用指南

## 概述

**ai-spec-docs** 是一个规范驱动的 AI 开发系统模块，专为 OPC（Open Platform for Collaboration）设计。

### 核心理念

- **规范驱动**：AI 严格按照规范文件执行开发工作
- **95% 自动化**：AI 完成 95% 的编码工作，人类只做监督和审查
- **不犯错**：通过明确的规范约束，避免 AI 自由发挥导致的错误

### 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      OPC 平台                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              ai-spec-docs 模块                       │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │    │
│  │  │ 文档管理 │  │ 模板系统 │  │ 项目初始化│          │    │
│  │  └──────────┘  └──────────┘  └──────────┘          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    docspec-server                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 文档存储 │  │ 模板引擎 │  │ 权限控制 │  │ 版本管理 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 1. 前置条件

确保以下服务正在运行：

- **OPC 服务器**：`http://localhost:3100`
- **docspec-server**：`http://localhost:4000`（或其他地址）

### 2. 配置连接

首先配置 ai-spec-docs 模块连接到 docspec-server：

```bash
# 设置 docspec-server 地址
curl -X POST http://localhost:3100/api/modules/ai-spec-docs/config \
  -H "Content-Type: application/json" \
  -d '{
    "key": "docspecServerUrl",
    "value": "http://localhost:4000"
  }'

# 设置 admin token（可选，用于认证）
curl -X POST http://localhost:3100/api/modules/ai-spec-docs/config \
  -H "Content-Type: application/json" \
  -d '{
    "key": "docspecAdminToken",
    "value": "your-admin-token-here"
  }'
```

### 3. 验证配置

```bash
curl http://localhost:3100/api/modules/ai-spec-docs/health
```

预期响应：
```json
{
  "status": "ok",
  "docspecServerUrl": "configured",
  "docspecAdminToken": "configured",
  "config": {
    "docspecServerUrl": "http://localhost:4000",
    "docspecAdminToken": "***"
  }
}
```

---

## API 参考

### 配置管理

#### POST /api/modules/ai-spec-docs/config

设置模块配置项。

**请求体：**
```json
{
  "key": "docspecServerUrl",
  "value": "http://localhost:4000"
}
```

**有效配置键：**
| 键名 | 说明 |
|------|------|
| `docspecServerUrl` | docspec-server 的 HTTP 地址 |
| `docspecAdminToken` | 管理员认证 token（可选） |

**响应：**
```json
{
  "success": true,
  "key": "docspecServerUrl",
  "message": "Configuration updated successfully"
}
```

---

### 健康检查

#### GET /api/modules/ai-spec-docs/health

检查模块运行状态和配置。

**响应：**
```json
{
  "status": "ok",
  "docspecServerUrl": "configured",
  "docspecAdminToken": "not configured",
  "config": {
    "docspecServerUrl": "http://localhost:4000",
    "docspecAdminToken": null
  }
}
```

---

### 文档管理

#### GET /api/modules/ai-spec-docs/docs

列出当前可访问的文档。

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `prefix` | string | 路径前缀过滤 |
| `role` | string | 角色权限过滤 |

**示例：**
```bash
# 列出所有文档
curl http://localhost:3100/api/modules/ai-spec-docs/docs

# 按前缀过滤
curl "http://localhost:3100/api/modules/ai-spec-docs/docs?prefix=specs/"

# 按角色过滤
curl "http://localhost:3100/api/modules/ai-spec-docs/docs?role=developer"
```

**响应：**
```json
{
  "role": "admin",
  "count": 5,
  "files": [
    {
      "path": "specs/api-design.md",
      "size": 2048,
      "modifiedAt": "2026-03-30T10:00:00Z",
      "write": true
    }
  ]
}
```

---

#### GET /api/modules/ai-spec-docs/docs/:path

读取指定文档内容。

**路径参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `path` | string | 文档路径（支持 URL 编码） |

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `role` | string | 角色权限 |

**示例：**
```bash
# 读取文档
curl "http://localhost:3100/api/modules/ai-spec-docs/docs/specs/api-design.md"

# 带角色权限读取
curl "http://localhost:3100/api/modules/ai-spec-docs/docs/specs/api-design.md?role=developer"
```

**响应：**
```json
{
  "path": "specs/api-design.md",
  "content": "# API Design Specification\n\n...",
  "metadata": {
    "version": "1.0.0",
    "author": "team",
    "createdAt": "2026-03-30T10:00:00Z"
  }
}
```

---

#### POST /api/modules/ai-spec-docs/docs

创建或更新文档。

**请求体：**
```json
{
  "path": "specs/api-design.md",
  "content": "# API Design Specification\n\n...",
  "metadata": {
    "version": "1.0.0",
    "author": "team"
  }
}
```

**示例：**
```bash
curl -X POST http://localhost:3100/api/modules/ai-spec-docs/docs \
  -H "Content-Type: application/json" \
  -d '{
    "path": "specs/api-design.md",
    "content": "# API Design Specification\n\n## Endpoints\n\n...",
    "metadata": {
      "version": "1.0.0",
      "author": "team"
    }
  }'
```

**响应：**
```json
{
  "path": "specs/api-design.md",
  "success": true
}
```

---

### 模板管理

#### GET /api/modules/ai-spec-docs/templates

获取可用的规范模板。

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | string | 模板类型过滤 |

**示例：**
```bash
# 获取所有模板
curl http://localhost:3100/api/modules/ai-spec-docs/templates

# 获取特定类型模板
curl "http://localhost:3100/api/modules/ai-spec-docs/templates?type=api-spec"
```

**响应：**
```json
{
  "templates": [
    {
      "id": "api-spec",
      "name": "API 规范模板",
      "description": "RESTful API 设计规范"
    },
    {
      "id": "feature-spec",
      "name": "功能规范模板",
      "description": "功能开发规范"
    }
  ]
}
```

---

### 项目初始化

#### POST /api/modules/ai-spec-docs/init

初始化新项目的规范结构。

**请求体：**
```json
{
  "projectName": "my-new-project",
  "template": "standard"
}
```

**参数说明：**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectName` | string | ✓ | 项目名称 |
| `template` | string | ✗ | 模板类型（默认：standard） |

**示例：**
```bash
curl -X POST http://localhost:3100/api/modules/ai-spec-docs/init \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "opc-feature-module",
    "template": "standard"
  }'
```

**响应：**
```json
{
  "success": true,
  "projectId": "proj_abc123"
}
```

---

## 工作流程示例

### 场景 1：新项目规范初始化

```bash
# 1. 配置连接
curl -X POST http://localhost:3100/api/modules/ai-spec-docs/config \
  -H "Content-Type: application/json" \
  -d '{"key": "docspecServerUrl", "value": "http://localhost:4000"}'

# 2. 初始化项目规范
curl -X POST http://localhost:3100/api/modules/ai-spec-docs/init \
  -H "Content-Type: application/json" \
  -d '{"projectName": "opc-feature-module"}'

# 3. 查看生成的规范文档
curl http://localhost:3100/api/modules/ai-spec-docs/docs

# 4. 读取项目 README
curl "http://localhost:3100/api/modules/ai-spec-docs/docs/opc-feature-module/README.md"
```

### 场景 2：编写 API 规范

```bash
# 1. 获取 API 规范模板
curl "http://localhost:3100/api/modules/ai-spec-docs/templates?type=api-spec"

# 2. 创建 API 规范文档
curl -X POST http://localhost:3100/api/modules/ai-spec-docs/docs \
  -H "Content-Type: application/json" \
  -d '{
    "path": "specs/user-api.md",
    "content": "# User API Specification\n\n## Endpoints\n\n### GET /users\n\n...",
    "metadata": {
      "type": "api-spec",
      "version": "1.0.0"
    }
  }'

# 3. 验证规范已保存
curl "http://localhost:3100/api/modules/ai-spec-docs/docs/specs/user-api.md"
```

### 场景 3：团队协作

```bash
# 1. 列出团队可访问的文档
curl "http://localhost:3100/api/modules/ai-spec-docs/docs?role=team"

# 2. 读取特定角色的文档
curl "http://localhost:3100/api/modules/ai-spec-docs/docs/specs/api-design.md?role=developer"

# 3. 更新文档（需要 write 权限）
curl -X POST http://localhost:3100/api/modules/ai-spec-docs/docs \
  -H "Content-Type: application/json" \
  -d '{
    "path": "specs/api-design.md",
    "content": "# API Design Specification v2\n\n...",
    "metadata": {
      "version": "2.0.0",
      "updatedBy": "developer"
    }
  }'
```

---

## 最佳实践

### 1. 规范文件组织

```
project-name/
├── README.md           # 项目概述
├── specs/              # 规范文档
│   ├── api-design.md   # API 设计规范
│   ├── data-model.md   # 数据模型规范
│   └── ui-design.md    # UI 设计规范
├── templates/          # 模板文件
│   └── component.md    # 组件模板
└── decisions/          # 架构决策记录
    └── adr-001.md      # 第一个决策记录
```

### 2. 版本控制

在 metadata 中始终包含版本信息：

```json
{
  "path": "specs/api-design.md",
  "content": "...",
  "metadata": {
    "version": "1.0.0",
    "changelog": "Initial version",
    "author": "team"
  }
}
```

### 3. 角色权限

使用角色参数控制访问权限：

```bash
# 管理员可读写
curl "http://localhost:3100/api/modules/ai-spec-docs/docs?role=admin"

# 开发者只读
curl "http://localhost:3100/api/modules/ai-spec-docs/docs?role=developer"

# 观察者有限访问
curl "http://localhost:3100/api/modules/ai-spec-docs/docs?role=viewer"
```

---

## 故障排除

### 问题：配置未生效

**症状：**
```json
{
  "docspecServerUrl": "not configured"
}
```

**解决：**
```bash
# 重新配置
curl -X POST http://localhost:3100/api/modules/ai-spec-docs/config \
  -H "Content-Type: application/json" \
  -d '{"key": "docspecServerUrl", "value": "http://localhost:4000"}'

# 验证配置
curl http://localhost:3100/api/modules/ai-spec-docs/health
```

### 问题：docspec-server 连接失败

**症状：**
```
Error: docspec API error: 503 Service Unavailable
```

**解决：**
1. 确认 docspec-server 正在运行
2. 检查地址配置是否正确
3. 验证网络连接

```bash
# 测试 docspec-server 连接
curl http://localhost:4000/api/health

# 检查 OPC 到 docspec-server 的网络
ping localhost
```

### 问题：权限不足

**症状：**
```json
{
  "error": "Permission denied"
}
```

**解决：**
1. 确认角色参数正确
2. 检查 docspec-server 的权限配置
3. 验证 admin token（如需要）

---

## 常见问题 (FAQ)

### Q: ai-spec-docs 是 UI 插件吗？

**A:** 不是。ai-spec-docs 是服务器端模块，提供 REST API，不是 UI 插件。它不会在 FSD/plugins 页面显示。

### Q: 如何与 AI 协作？

**A:** 
1. 编写规范文档定义需求
2. AI 读取规范并生成代码
3. 人类审查 AI 的输出
4. 必要时更新规范

### Q: 支持哪些文档格式？

**A:** 主要支持 Markdown 格式，也支持 JSON/YAML 等结构化格式。

### Q: 如何备份规范文档？

**A:** 使用 GET 端点导出所有文档：

```bash
# 导出所有文档
curl http://localhost:3100/api/modules/ai-spec-docs/docs | \
  jq -r '.files[].path' | \
  while read path; do
    curl "http://localhost:3100/api/modules/ai-spec-docs/docs/$path" > "$path"
  done
```

---

## 附录

### 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DOCSPEC_SERVER_URL` | docspec-server 地址 | `http://localhost:4000` |
| `DOCSPEC_ADMIN_TOKEN` | 管理员 token | `your-token` |

### 相关文档

- [manifest.json](./manifest.json) - 模块清单
- [README.md](./README.md) - 模块概述
- [INSTALL.md](./INSTALL.md) - 安装指南

### 支持

如有问题，请在 OPC 项目中提交 Issue 或联系开发团队。
