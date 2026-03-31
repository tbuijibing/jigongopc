# ai-spec-docs 模块使用指南

## 系统定位
规范驱动的 AI 开发系统：老项目快速生成规范文件，AI 按规范完成 95% 工作，人类只做监督。

## 1. 配置模块

在使用前需要配置 docspec-server 的连接信息。通过 OPC 的配置系统设置：

```bash
# 设置 docspec-server 地址
curl -X POST http://localhost:3102/api/modules/ai-spec-docs/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"key": "docspecServerUrl", "value": "http://your-docspec-server:8000"}'

# 设置管理员令牌（可选）
curl -X POST http://localhost:3102/api/modules/ai-spec-docs/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"key": "docspecAdminToken", "value": "your-admin-token"}'
```

## 2. API 使用示例

### 健康检查
```bash
curl http://localhost:3102/api/modules/ai-spec-docs/health
```

### 列出文档
```bash
# 列出所有文档
curl http://localhost:3102/api/modules/ai-spec-docs/docs

# 按前缀过滤
curl "http://localhost:3102/api/modules/ai-spec-docs/docs?prefix=spec/"

# 按角色过滤
curl "http://localhost:3102/api/modules/ai-spec-docs/docs?role=developer"
```

### 读取文档
```bash
curl "http://localhost:3102/api/modules/ai-spec-docs/docs/spec/SPEC-001.md"
```

### 创建/更新文档
```bash
curl -X POST http://localhost:3102/api/modules/ai-spec-docs/docs \
  -H "Content-Type: application/json" \
  -d '{
    "path": "spec/SPEC-001.md",
    "content": "# 规范文档内容...",
    "metadata": {"version": "1.0", "author": "team"}
  }'
```

### 获取模板
```bash
curl http://localhost:3102/api/modules/ai-spec-docs/templates
```

### 初始化项目
```bash
curl -X POST http://localhost:3102/api/modules/ai-spec-docs/init \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "my-project",
    "template": "standard"
  }'
```

## 3. OPC 界面使用

在 OPC 界面中，模块会自动注册以下事件监听：

- `issue:created` - 当 Issue 创建时触发
- `issue:assigned` - 当 Issue 分配时触发

## 4. 后台服务

模块会自动运行后台服务：

- `docspec-cache-cleanup` - 每小时清理缓存

## 5. 安装步骤

### 5.1 复制插件到 OPC 模块目录

```bash
# 将 ai-spec-docs 复制到 OPC 的 modules 目录
cp -r /Users/justin/github/ai-spec/opc/modules/ai-spec-docs /Users/justin/github/opc/modules/ai-spec-docs
```

### 5.2 修改 OPC 的 package.json

在 OPC 项目的 `package.json` 中添加工作空间引用：

```json
{
  "workspaces": [
    "modules/*"
  ]
}
```

### 5.3 修改 OPC 的模块加载器

编辑 `/Users/justin/github/opc/server/src/modules/loader.ts`，添加 ai-spec-docs 模块：

```typescript
// 在 loadModules 函数中添加：
// ── ai-spec-docs ─────────────────────────────────────────────────────
try {
  const aiSpecDocs = await import("@jigongai/mod-ai-spec-docs");
  const registerFn = aiSpecDocs.default as RegisterFn;
  const mod = loadModule("ai-spec-docs", registerFn, db, { enabled: true });
  if (mod.router) {
    modulesRouter.use("/ai-spec-docs", (req, _res, next) => {
      const actor = req.actor;
      if (actor.type === "board" && actor.userId) {
        if (!req.headers["x-user-id"]) {
          req.headers["x-user-id"] = actor.userId;
        }
      }
      next();
    }, mod.router);
    pinoLogger.info("Module mounted: ai-spec-docs → /api/modules/ai-spec-docs");
  }
} catch (err) {
  pinoLogger.warn({ err }, "Failed to load ai-spec-docs module; skipping");
}
```

### 5.4 安装依赖并构建

```bash
cd /Users/justin/github/opc
pnpm install
pnpm build
```

### 5.5 配置插件

在 OPC 管理界面中配置 ai-spec-docs 插件：

- `docspecServerUrl`: docspec-server 地址，如 `http://localhost:4000`
- `docspecAdminToken`: 从 docspec-server 获取的管理员 JWT Token

获取 Token 方法：
```bash
curl -X POST http://localhost:4000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"sub": "admin", "role": "admin", "secret": "dev-token-secret"}'
```

### 5.6 启动 OPC

```bash
cd /Users/justin/github/opc
pnpm dev
```

## 6. 使用流程

### 6.1 新项目接入

1. 访问 OPC 界面
2. 选择 "新建项目接入"
3. 填写项目信息、代码仓库、团队成员
4. 生成配置文件
5. 按提示完成接入

### 6.2 AI 开发工作流

1. 人类在 OPC 中创建 Issue，描述需求
2. AI Agent 接收任务
3. AI 使用 `spec.get-template` 获取相关规范
4. AI 使用 `spec.read` 读取现有文档
5. AI 按规范完成开发
6. AI 使用 `spec.draft` 创建文档变更 MR
7. 人类 Review 批准

## 7. 提供的 Tools

| Tool | 描述 |
|------|------|
| `spec.list` | 列出当前角色可访问的文档 |
| `spec.read` | 读取指定文档内容 |
| `spec.draft` | 起草文档变更并创建 GitLab MR |
| `spec.search` | 在文档中搜索关键词 |
| `spec.update-auto` | CI/CD 自动更新 AUTO 区域 |
| `spec.get-template` | 获取规范模板 |

## 8. 提供的 Actions

| Action | 描述 |
|--------|------|
| `init-project` | 初始化项目（创建 OPC 公司 + Agent + 文档目录） |
| `list-projects` | 列出已接入的项目 |
| `spec-draft` | AI Agent 起草文档 |

## 9. 生成的配置文件

| 文件 | 用途 |
|------|------|
| `project-inventory.yaml` | 项目清单 |
| `.spec-permissions.yaml` | 权限配置 |
| `init-spec-dirs.sh` | 初始化脚本 |
| `gitlab-ci-snippet.yaml` | GitLab CI 配置片段 |
| `plugin-config.yaml` | OPC 插件配置 |

## 10. 故障排查

### 插件无法加载

1. 检查模块路径是否正确
2. 检查 TypeScript 编译是否成功
3. 查看 OPC 日志中的错误信息

### 无法连接 docspec-server

1. 确认 docspec-server 已启动
2. 检查 `docspecServerUrl` 配置
3. 检查防火墙设置

### Token 无效

1. 确认 Token 未过期（8 小时）
2. 检查 `docspecAdminToken` 配置
3. 重新生成 Token

## 11. 配置 docspec-server 连接

⚠️ **注意：此模块需要配合 docspec-server 使用。**

### 11.1 部署 docspec-server

如果你还没有部署 docspec-server，需要先部署：

```bash
# 1. 克隆并进入 docspec-server 目录
git clone <your-docspec-server-repo>
cd docspec-server

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，设置 SPEC_REPO_PATH 等配置

# 4. 启动服务
npm run dev
# → http://localhost:4000
```

### 11.2 配置连接信息

在 OPC 中配置 docspec-server 连接：

```bash
# 设置 docspec-server 地址
curl -X POST http://localhost:3102/api/modules/ai-spec-docs/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"key": "docspecServerUrl", "value": "http://localhost:4000"}'

# 设置管理员 Token（可选）
curl -X POST http://localhost:3102/api/modules/ai-spec-docs/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{"key": "docspecAdminToken", "value": "eyJhbGc..."}'
```

获取 admin Token 方法：
```bash
curl -X POST http://localhost:4000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"sub": "admin", "role": "admin", "secret": "dev-token-secret"}'
```

### 11.3 验证配置

```bash
# 检查健康状态
curl http://localhost:3102/api/modules/ai-spec-docs/health

# 成功响应：
# {"status":"ok","docspecServerUrl":"configured"}
```

## 12. 注意事项

- docspec-server 和 ai-spec-docs 模块必须同时运行
- 确保 `docspecServerUrl` 配置正确且可访问
- Token 有效期为 8 小时，过期需要重新获取
