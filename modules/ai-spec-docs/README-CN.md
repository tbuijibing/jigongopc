# AI 规范文档模块 (ai-spec-docs)

AI 规范文档模块是 OPC 系统的服务器端模块，用于管理和维护 AI 开发规范文档。它通过 docspec-server 提供文档的存储、读取、编辑和版本控制功能。

## 目录

- [功能特性](#功能特性)
- [系统架构](#系统架构)
- [安装指南](#安装指南)
- [配置说明](#配置说明)
- [使用指南](#使用指南)
- [API 参考](#api-参考)
- [故障排除](#故障排除)
- [常见问题](#常见问题)

## 功能特性

- 📁 **文档管理** - 浏览、读取、编辑规范文档
- 📋 **前缀过滤** - 按文档前缀（如 FSD、FSC、FSP）分类管理
- 🔍 **搜索功能** - 快速查找指定文档
- 📊 **状态显示** - 显示文档大小、创建时间等元数据
- 🚀 **项目初始化** - 使用模板快速初始化新项目
- 🔗 **docspec-server 集成** - 与外部文档服务无缝对接

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        OPC 系统                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  UI 层 (React)                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │           SpecDocs.tsx (文档管理页面)            │  │  │
│  │  │   - 文档列表/搜索/过滤                           │  │  │
│  │  │   - 查看/编辑对话框                              │  │  │
│  │  │   - 项目初始化向导                               │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               Server 层 (Express)                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │          ai-spec-docs 模块 (worker.ts)          │  │  │
│  │  │   - GET  /docs          - 获取文档列表          │  │  │
│  │  │   - GET  /docs/*        - 获取文档内容          │  │  │
│  │  │   - POST /docs          - 创建/更新文档         │  │  │
│  │  │   - GET  /templates     - 获取项目模板          │  │  │
│  │  │   - POST /init          - 初始化项目            │  │  │
│  │  │   - GET  /health        - 健康检查              │  │  │
│  │  │   - POST /config        - 更新配置              │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              docspec-server (外部服务)                 │  │
│  │   - 文档存储和版本控制                                 │  │
│  │   - 权限管理和访问控制                                 │  │
│  │   - 文档模板和项目初始化                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 安装指南

### 前置条件

1. **Node.js** >= 18.x
2. **pnpm** >= 8.x
3. **docspec-server** 运行中（可选，用于文档存储）

### 安装步骤

1. **确认模块已安装**

   ```bash
   ls modules/ai-spec-docs
   ```

   应包含以下文件：
   - `package.json`
   - `manifest.json`
   - `src/worker.ts`
   - `USAGE-GUIDE.md`

2. **安装依赖**

   ```bash
   pnpm install
   ```

3. **构建模块**

   ```bash
   pnpm --filter @jigongai/mod-ai-spec-docs build
   ```

4. **启动开发服务器**

   ```bash
   pnpm dev
   ```

## 配置说明

### 环境变量配置

在项目根目录创建或编辑 `.env` 文件：

```bash
# DocSpec Server 配置
DOCSPEC_SERVER_URL=http://localhost:4000
DOCSPEC_ADMIN_TOKEN=your-admin-token-here
```

### 配置文件方式

或者在 `jigong.config.json` 中添加：

```json
{
  "docspec": {
    "serverUrl": "http://localhost:4000",
    "adminToken": "your-admin-token-here"
  }
}
```

### 健康检查

配置完成后，可以通过健康检查端点验证配置：

```bash
curl http://localhost:3100/api/health
```

响应应包含：

```json
{
  "status": "ok",
  "docspecServerUrl": "http://localhost:4000",
  ...
}
```

## 使用指南

### 1. 访问文档管理页面

1. 打开浏览器访问 `http://localhost:3100`
2. 在左侧导航栏点击 **"AI 规范文档"**（Work 分类下）
3. 或直接访问 `http://localhost:3100/FSD/spec-docs`

### 2. 浏览文档列表

- **搜索**：在搜索框输入关键词过滤文档
- **前缀过滤**：使用下拉菜单选择文档前缀（全部/FSD/FSC/FSP 等）
- **查看文档**：点击文档名称或"查看"按钮
- **编辑文档**：点击"编辑"按钮（需要写权限）

### 3. 查看文档内容

1. 点击文档列表中的"查看"按钮
2. 在弹出的对话框中查看文档完整内容
3. 如需编辑，点击"编辑此文档"按钮

### 4. 编辑文档

1. 点击文档列表中的"编辑"按钮
2. 在编辑对话框中修改文档内容
3. 点击"保存"提交更改
4. 系统会显示保存成功/失败的提示

### 5. 初始化新项目

1. 点击页面右上角的"初始化项目"按钮
2. 输入项目名称
3. 选择项目模板（如果有可用模板）
4. 点击"初始化"开始创建项目
5. 等待初始化完成提示

## API 参考

### 基础信息

- **Base URL**: `/api/modules/ai-spec-docs`
- **认证**: 需要有效的会话或 API Key

### 端点列表

#### 1. 获取文档列表

```http
GET /api/modules/ai-spec-docs/docs?prefix=FSD&role=board
```

**查询参数**：
- `prefix` (可选): 文档前缀过滤，如 "FSD", "FSC", "FSP"
- `role` (可选): 角色标识，如 "board"

**响应示例**：
```json
{
  "files": [
    {
      "path": "FSD-001.md",
      "size": 1024,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-02T00:00:00Z",
      "write": true
    }
  ],
  "prefixes": ["FSD", "FSC", "FSP"]
}
```

#### 2. 获取文档内容

```http
GET /api/modules/ai-spec-docs/docs/FSD-001.md
```

**路径参数**：
- 文档路径：`FSD-001.md`

**查询参数**：
- `role` (可选): 角色标识

**响应**：文档原始内容（text/plain）

#### 3. 创建/更新文档

```http
POST /api/modules/ai-spec-docs/docs
Content-Type: application/json

{
  "path": "FSD-002.md",
  "content": "# 新文档\n\n这是文档内容...",
  "metadata": {
    "title": "新规范文档",
    "version": "1.0.0"
  }
}
```

**请求体**：
- `path`: 文档路径
- `content`: 文档内容
- `metadata` (可选): 元数据对象

**响应**：
```json
{
  "success": true,
  "path": "FSD-002.md"
}
```

#### 4. 获取项目模板

```http
GET /api/modules/ai-spec-docs/templates
```

**响应示例**：
```json
{
  "templates": [
    {
      "id": "template-1",
      "name": "标准项目模板",
      "description": "包含基础文档结构"
    }
  ]
}
```

#### 5. 初始化项目

```http
POST /api/modules/ai-spec-docs/init
Content-Type: application/json

{
  "projectName": "my-new-project",
  "template": "template-1"
}
```

**请求体**：
- `projectName`: 项目名称
- `template` (可选): 模板 ID

**响应**：
```json
{
  "projectId": "proj-xxx",
  "success": true
}
```

#### 6. 健康检查

```http
GET /api/modules/ai-spec-docs/health
```

**响应示例**：
```json
{
  "status": "ok",
  "docspecServerUrl": "http://localhost:4000",
  "configured": true
}
```

#### 7. 更新配置

```http
POST /api/modules/ai-spec-docs/config
Content-Type: application/json

{
  "docspecServerUrl": "http://new-server:4000",
  "docspecAdminToken": "new-token"
}
```

## 故障排除

### 问题 1: 页面显示"docspec-server 未配置"

**症状**：页面顶部显示黄色警告框，提示 docspec-server 未配置

**解决方案**：
1. 检查 `.env` 文件是否包含 `DOCSPEC_SERVER_URL`
2. 确认 docspec-server 服务正在运行
3. 重启 OPC 开发服务器

### 问题 2: 文档列表为空

**症状**：文档列表显示"暂无文档"

**可能原因**：
- docspec-server 未配置
- docspec-server 中没有文档
- 前缀过滤条件不匹配

**解决方案**：
1. 检查健康检查端点确认配置
2. 清除前缀过滤器（选择"全部"）
3. 检查 docspec-server 日志

### 问题 3: 保存文档失败

**症状**：点击保存后显示错误提示

**可能原因**：
- 没有写权限
- docspec-server 连接失败
- 文档内容格式错误

**解决方案**：
1. 检查用户权限
2. 查看服务器日志获取详细错误信息
3. 确认 docspec-server 可访问

### 问题 4: 导航栏没有"AI 规范文档"入口

**症状**：左侧导航栏找不到"AI 规范文档"选项

**解决方案**：
1. 确认模块已正确安装
2. 检查 `ui/src/components/Sidebar.tsx` 是否包含导航项
3. 清除浏览器缓存并刷新页面

## 常见问题

### Q: ai-spec-docs 是插件还是模块？

**A**: ai-spec-docs 是一个**服务器端模块**，不是 UI 插件。它在服务器启动时自动加载，提供 REST API 端点。UI 页面（SpecDocs.tsx）是 OPC 系统内置的，用于访问这些 API。

### Q: 为什么 FSD/plugins 页面看不到 ai-spec-docs？

**A**: FSD/plugins 页面显示的是用户可安装的**UI 插件**，而 ai-spec-docs 是服务器端模块，不会在该页面显示。ai-spec-docs 的功能通过左侧导航栏的"AI 规范文档"入口访问。

### Q: 必须配置 docspec-server 才能使用吗？

**A**: 不是必须的。没有配置 docspec-server 时，模块仍可运行，但无法进行文档的存储和读取操作。页面会显示警告提示。

### Q: 如何获取 docspec-server？

**A**: docspec-server 是一个独立的文档服务，需要单独部署。请参考 docspec-server 项目的安装文档。

### Q: 支持哪些文档格式？

**A**: 主要支持 Markdown (.md) 格式的文档。其他文本格式理论上也可用，但 Markdown 是推荐格式。

### Q: 文档权限如何控制？

**A**: 文档权限由 docspec-server 控制。通过 `role` 参数传递角色信息，docspec-server 根据角色决定是否授予读写权限。

---

## 相关文件

- [`worker.ts`](src/worker.ts) - 模块主入口和 API 实现
- [`manifest.json`](manifest.json) - 模块清单和配置
- [`USAGE-GUIDE.md`](USAGE-GUIDE.md) - 英文使用指南
- [`ui/src/pages/SpecDocs.tsx`](../../ui/src/pages/SpecDocs.tsx) - UI 页面组件
- [`ui/src/components/Sidebar.tsx`](../../ui/src/components/Sidebar.tsx) - 侧边栏导航

## 更新日志

### v1.0.0
- 初始版本发布
- 支持文档列表、读取、编辑
- 支持项目初始化
- 集成 docspec-server
- 添加 UI 管理页面
