# SPEC-300 可追溯性矩阵规范 - JiGongOpc-Java

> 版本：v1.0 | 日期：2026-03-14 | 优先级：P0
>
> **说明**：本文档定义需求、设计、开发、测试全流程的可追溯性矩阵（Traceability Matrix），确保各端设计、产品开发及测试验收时能够快速定位关联关系，方便 AI 和人类理解模块全貌。

---

## 一、编号体系规范

### 1.1 需求编号（REQ）

格式：`REQ-{模块代码}-{流水号}`

| 模块代码 | 模块名称 | 示例 |
|----------|----------|------|
| COM | 公司管理（Company） | REQ-COM-001 |
| AGT | Agent 管理（Agent） | REQ-AGT-001 |
| TSK | 任务管理（Task/Issue） | REQ-TSK-001 |
| PJT | 项目管理（Project） | REQ-PJT-001 |
| GOL | 目标管理（Goal） | REQ-GOL-001 |
| APR | 审批管理（Approval） | REQ-APR-001 |
| CST | 成本管理（Cost） | REQ-CST-001 |
| INN | Inbox（收件箱） | REQ-INN-001 |
| DSH | Dashboard（仪表板） | REQ-DSH-001 |
| ORG | 组织架构（Org Chart） | REQ-ORG-001 |
| ACT | 活动日志（Activity） | REQ-ACT-001 |
| SYS | 系统管理（System） | REQ-SYS-001 |
| AUTH | 认证授权（Authentication） | REQ-AUTH-001 |
| I18N | 国际化（i18n） | REQ-I18N-001 |
| TZ | 时区管理（Timezone） | REQ-TZ-001 |

**示例**：
- `REQ-COM-001`：公司管理模块第 1 个需求
- `REQ-TSK-005`：任务管理模块第 5 个需求

### 1.2 设计图编号（UIX）

格式：`UIX-{模块代码}-{页面类型}-{流水号}`

| 页面类型 | 说明 | 示例 |
|----------|------|------|
| LIST | 列表页 | UIX-COM-LIST-001 |
| FORM | 表单页（创建/编辑） | UIX-COM-FORM-001 |
| DETAIL | 详情页 | UIX-COM-DETAIL-001 |
| DASH | 仪表板 | UIX-DSH-MAIN-001 |
| ORG | 组织架构图 | UIX-ORG-TREE-001 |
| INBOX | 收件箱 | UIX-INN-LIST-001 |
| APPROVE | 审批页 | UIX-APR-DETAIL-001 |

**示例**：
- `UIX-COM-LIST-001`：公司管理列表页设计图
- `UIX-COM-FORM-001`：公司创建/编辑表单设计图
- `UIX-TSK-DETAIL-001`：任务详情页设计图

### 1.3 接口编号（API）

格式：`API-{模块代码}-{操作类型}-{资源}-{流水号}`

| 操作类型 | 说明 | 示例 |
|----------|------|------|
| QRY | 查询（GET） | API-COM-QRY-001 |
| CMD | 创建（POST） | API-COM-CMD-001 |
| UPT | 更新（PUT/PATCH） | API-COM-UPT-001 |
| DEL | 删除（DELETE） | API-COM-DEL-001 |
| ACT | 动作/操作 | API-TSK-ACT-001 |

**示例**：
- `API-COM-QRY-001`：公司查询接口（分页列表）
- `API-COM-CMD-001`：公司创建接口
- `API-TSK-ACT-001`：任务状态转换接口

### 1.4 路由编号（RTE）

格式：`RTE-{端代码}-{模块代码}-{页面类型}-{流水号}`

| 端代码 | 说明 | 示例 |
|--------|------|------|
| WEB | Web 端 | RTE-WEB-COM-LIST-001 |
| MOB | 移动端 H5 | RTE-MOB-COM-LIST-001 |
| DSK | 桌面端 | RTE-DSK-COM-LIST-001 |
| AND | Android | RTE-AND-COM-LIST-001 |
| IOS | iOS | RTE-IOS-COM-LIST-001 |
| HRM | 鸿蒙 | RTE-HRM-COM-LIST-001 |

**示例**：
- `RTE-WEB-COM-LIST-001`：Web 端公司列表页路由
- `RTE-MOB-TSK-DETAIL-001`：移动端任务详情页路由

### 1.5 测试用例编号（TST）

格式：`TST-{测试类型}-{模块代码}-{流水号}`

| 测试类型 | 说明 | 示例 |
|----------|------|------|
| UNIT | 单元测试 | TST-UNIT-COM-001 |
| INTG | 集成测试 | TST-INTG-COM-001 |
| API | API 测试 | TST-API-COM-001 |
| E2E | 端到端测试 | TST-E2E-COM-001 |
| UAT | 用户验收测试 | TST-UAT-COM-001 |

**示例**：
- `TST-UNIT-COM-001`：公司管理模块单元测试
- `TST-API-COM-001`：公司管理模块 API 测试
- `TST-E2E-COM-001`：公司管理模块端到端测试

### 1.6 组件编号（CMP）

格式：`CMP-{模块代码}-{组件类型}-{组件名}`

| 组件类型 | 说明 | 示例 |
|----------|------|------|
| PAGE | 页面组件 | CMP-COM-PAGE-CompanyList |
| CMP | 通用组件 | CMP-COM-CMP-CompanySelector |
| UTIL | 工具函数 | CMP-COM-UTIL-Formatter |
| STORE | 状态管理 | CMP-COM-STORE-CompanyStore |

**示例**：
- `CMP-COM-PAGE-CompanyList`：公司列表页面组件
- `CMP-AGT-CMP-StatusBadge`：状态徽章组件

---

## 二、可追溯性矩阵表

### 2.1 矩阵结构

每个模块必须维护一个可追溯性矩阵表，包含以下关联关系：

| 需求编号 | 需求名称 | 设计图 ID | Web 路由 | 移动端路由 | 后端 API | 前端组件 | 测试用例 | 状态 |
|----------|----------|-----------|----------|------------|----------|----------|----------|------|
| REQ-COM-001 | 公司列表查询 | UIX-COM-LIST-001 | `/company` | `/company/list` | API-COM-QRY-001 | CMP-COM-PAGE-CompanyList | TST-E2E-COM-001 | ✅ |
| REQ-COM-002 | 创建公司 | UIX-COM-FORM-001 | `/company/new` | `/company/create` | API-COM-CMD-001 | CMP-COM-PAGE-CompanyForm | TST-E2E-COM-002 | ✅ |
| REQ-COM-003 | 编辑公司 | UIX-COM-FORM-002 | `/company/:id/edit` | `/company/:id/edit` | API-COM-UPT-001 | CMP-COM-PAGE-CompanyForm | TST-E2E-COM-003 | ✅ |
| REQ-COM-004 | 删除公司 | - | - | - | API-COM-DEL-001 | - | TST-API-COM-001 | ✅ |
| REQ-COM-005 | 公司详情 | UIX-COM-DETAIL-001 | `/company/:id` | `/company/:id` | API-COM-QRY-002 | CMP-COM-PAGE-CompanyDetail | TST-E2E-COM-004 | ✅ |

### 2.2 公司管理模块完整示例

#### 2.2.1 需求 - 设计 - 路由 -API- 组件 - 测试关联表

| 编号 | 类型 | 编号/路径 | 说明 | 关联需求 |
|------|------|-----------|------|----------|
| REQ-001 | 需求 | REQ-COM-001 | 公司列表查询 | - |
| UIX | 设计图 | UIX-COM-LIST-001 | 公司列表页设计 | REQ-COM-001 |
| RTE-WEB | Web 路由 | `/company` | Web 端公司列表页 | REQ-COM-001 |
| RTE-MOB | 移动路由 | `/company/list` | 移动端公司列表页 | REQ-COM-001 |
| RTE-DSK | 桌面路由 | `/company` | 桌面端公司列表页 | REQ-COM-001 |
| API | 接口 | `GET /api/company/page` | 分页查询公司列表 | REQ-COM-001 |
| CMP | 组件 | `src/views/company/company-list.vue` | 公司列表组件 | REQ-COM-001 |
| TST | 测试 | TST-E2E-COM-001 | 公司列表端到端测试 | REQ-COM-001 |
| REQ-002 | 需求 | REQ-COM-002 | 创建公司 | - |
| UIX | 设计图 | UIX-COM-FORM-001 | 公司创建表单设计 | REQ-COM-002 |
| RTE-WEB | Web 路由 | `/company/new` | Web 端公司创建页 | REQ-COM-002 |
| RTE-MOB | 移动路由 | `/company/create` | 移动端公司创建页 | REQ-COM-002 |
| API | 接口 | `POST /api/company` | 创建公司接口 | REQ-COM-002 |
| CMP | 组件 | `src/views/company/company-form.vue` | 公司表单组件 | REQ-COM-002 |
| TST | 测试 | TST-E2E-COM-002 | 公司创建端到端测试 | REQ-COM-002 |
| REQ-003 | 需求 | REQ-COM-003 | 编辑公司 | - |
| UIX | 设计图 | UIX-COM-FORM-002 | 公司编辑表单设计 | REQ-COM-003 |
| RTE-WEB | Web 路由 | `/company/:id/edit` | Web 端公司编辑页 | REQ-COM-003 |
| RTE-MOB | 移动路由 | `/company/:id/edit` | 移动端公司编辑页 | REQ-COM-003 |
| API | 接口 | `PUT /api/company/:id` | 更新公司接口 | REQ-COM-003 |
| CMP | 组件 | `src/views/company/company-form.vue` | 公司表单组件 | REQ-COM-003 |
| TST | 测试 | TST-E2E-COM-003 | 公司编辑端到端测试 | REQ-COM-003 |
| REQ-004 | 需求 | REQ-COM-004 | 删除公司 | - |
| API | 接口 | `DELETE /api/company/:id` | 删除公司接口 | REQ-COM-004 |
| TST | 测试 | TST-API-COM-001 | 公司删除 API 测试 | REQ-COM-004 |
| REQ-005 | 需求 | REQ-COM-005 | 公司详情 | - |
| UIX | 设计图 | UIX-COM-DETAIL-001 | 公司详情页设计 | REQ-COM-005 |
| RTE-WEB | Web 路由 | `/company/:id` | Web 端公司详情页 | REQ-COM-005 |
| RTE-MOB | 移动路由 | `/company/:id` | 移动端公司详情页 | REQ-COM-005 |
| API | 接口 | `GET /api/company/:id` | 查询公司详情接口 | REQ-COM-005 |
| CMP | 组件 | `src/views/company/company-detail.vue` | 公司详情组件 | REQ-COM-005 |
| TST | 测试 | TST-E2E-COM-004 | 公司详情端到端测试 | REQ-COM-005 |

---

## 三、Pencil 设计图标注规范

### 3.1 设计图元数据

每个 Pencil 设计图（.pen 文件）可以有多个 Page（画布），每个 Page 代表一个设计图。在每个 Page 的名称中必须标注设计图 ID：

```
Page 名称格式：{设计图 ID} | {页面名称}

示例：
- Page 1: "LIST-001 | 公司列表页"
- Page 2: "FORM-001 | 公司创建表单"
- Page 3: "FORM-002 | 公司编辑表单"
- Page 4: "DETAIL-001 | 公司详情页"
```

在每个 Page 内部，使用文本注释标注关联信息：

```
┌─────────────────────────────────────────┐
│ [设计图元数据]                           │
│ 设计图 ID: UIX-COM-LIST-001             │
│ 关联需求：REQ-COM-001, REQ-COM-005      │
│ 创建日期：2026-03-14                    │
│ 状态：已审核                            │
└─────────────────────────────────────────┘
```

### 3.2 设计图组件标注

设计图中的每个可交互组件必须标注：

| 组件 | 标注格式 | 示例 |
|------|----------|------|
| 按钮 | `[组件类型] 关联 API` | `[Button] API-COM-CMD-001` |
| 表单 | `[组件类型] 关联 API` | `[Form] API-COM-CMD-001` |
| 表格 | `[组件类型] 关联 API` | `[Table] API-COM-QRY-001` |
| 链接 | `[组件类型] 目标路由` | `[Link] RTE-WEB-COM-DETAIL-001` |
| 弹窗 | `[组件类型] 触发条件` | `[Modal] 点击删除按钮` |

### 3.3 设计图文件命名

每个模块一个 .pen 文件，内部使用多个 Page 区分不同页面：

```
specs/assets/designs/
├── jigongopc/
│   ├── com/
│   │   └── jigongopc-com.pen          # 公司管理模块设计图
│   │       ├── Page 1: LIST-001 | 公司列表页
│   │       ├── Page 2: FORM-001 | 公司创建表单
│   │       ├── Page 3: FORM-002 | 公司编辑表单
│   │       └── Page 4: DETAIL-001 | 公司详情页
│   ├── agt/
│   │   └── jigongopc-agt.pen          # Agent 管理模块设计图
│   │       ├── Page 1: LIST-001 | Agent 列表页
│   │       ├── Page 2: FORM-001 | Agent 创建表单
│   │       ├── Page 3: ORG-001 | 组织架构图
│   │       └── Page 4: DETAIL-001 | Agent 详情页
│   ├── tsk/
│   │   └── jigongopc-tsk.pen          # 任务管理模块设计图
│   └── ...
└── ...
```

**设计图 ID 与 .pen 文件映射表**：

在模块的 `TRACEABILITY.md` 文件中维护映射关系：

| 设计图 ID | .pen 文件 | Page 名称 | 说明 |
|-----------|-----------|-----------|------|
| UIX-COM-LIST-001 | jigongopc-com.pen | LIST-001 | 公司列表页 |
| UIX-COM-FORM-001 | jigongopc-com.pen | FORM-001 | 公司创建表单 |
| UIX-COM-FORM-002 | jigongopc-com.pen | FORM-002 | 公司编辑表单 |
| UIX-COM-DETAIL-001 | jigongopc-com.pen | DETAIL-001 | 公司详情页 |

---

## 四、代码注释规范

### 4.1 后端控制器注释

```java
/**
 * 公司管理控制器
 *
 * 关联需求：REQ-COM-001, REQ-COM-002, REQ-COM-003, REQ-COM-004
 * 关联设计图：UIX-COM-LIST-001, UIX-COM-FORM-001, UIX-COM-DETAIL-001
 */
@RestController
@RequestMapping("/api/company")
@Api(value = "公司管理", tags = {"公司管理"})
public class CompanyController {

    /**
     * 分页查询公司列表
     *
     * 关联需求：REQ-COM-001
     * 关联设计图：UIX-COM-LIST-001
     * 关联路由：RTE-WEB-COM-LIST-001, RTE-MOB-COM-LIST-001
     * 关联接口：API-COM-QRY-001
     *
     * @param page 分页参数
     * @param request 查询条件
     * @return 公司列表
     */
    @GetMapping("/page")
    @Operation(summary = "分页查询公司列表")
    @DataScope(alias = "c")
    public R<Page<CompanyVO>> page(
        @ParameterObject Query page,
        @ParameterObject CompanyRequest request
    ) {
        // ...
    }

    /**
     * 创建公司
     *
     * 关联需求：REQ-COM-002
     * 关联设计图：UIX-COM-FORM-001
     * 关联路由：RTE-WEB-COM-FORM-001
     * 关联接口：API-COM-CMD-001
     *
     * @param request 创建请求
     * @return 是否成功
     */
    @PostMapping
    @Operation(summary = "创建公司")
    @PreAuth(RoleConstant.HAS_ROLE_ADMIN)
    public R<Boolean> create(@Validated @RequestBody CreateCompanyRequest request) {
        // ...
    }
}
```

### 4.2 前端组件注释

```vue
<!--
公司列表页组件

关联需求：REQ-COM-001
关联设计图：UIX-COM-LIST-001
关联路由：RTE-WEB-COM-LIST-001
关联接口：API-COM-QRY-001
关联组件：CMP-COM-PAGE-CompanyList
关联测试：TST-E2E-COM-001

@module company
@since 2026-03-14
-->

<template>
  <div class="company-list">
    <!-- 页头 -->
    <div class="page-header">
      <h2 class="page-title">{{ t('company.title') }}</h2>
      <!-- 关联设计图元素：UIX-COM-LIST-001 / btn-create -->
      <el-button type="primary" @click="handleCreate">
        {{ t('company.create') }}
      </el-button>
    </div>

    <!-- 表格 -->
    <!-- 关联设计图元素：UIX-COM-LIST-001 / tbl-company-list -->
    <!-- 关联接口：API-COM-QRY-001 -->
    <el-table
      v-loading="loading"
      :data="companyList"
      border
      stripe
    >
      <!-- ... -->
    </el-table>
  </div>
</template>

<script setup>
/**
 * 公司列表页逻辑
 *
 * 关联需求：REQ-COM-001
 * 关联接口：API-COM-QRY-001
 */
import { ref, reactive, onMounted } from 'vue';
import companyApi from '@/api/company'; // API-COM-QRY-001
</script>
```

### 4.3 API 客户端注释

```javascript
/**
 * 公司管理 API 客户端
 *
 * 模块：company
 * 关联需求：REQ-COM-001, REQ-COM-002, REQ-COM-003, REQ-COM-004, REQ-COM-005
 */

/**
 * 分页查询公司列表
 *
 * 关联需求：REQ-COM-001
 * 关联设计图：UIX-COM-LIST-001
 * 关联接口：API-COM-QRY-001
 * 请求类型：GET
 *
 * @param {Object} params 查询参数
 * @param {number} params.current 当前页
 * @param {number} params.size 每页大小
 * @param {string} params.keyword 关键字
 * @returns {Promise}
 */
export function getPage(params) {
  return request({
    url: '/api/company/page', // API-COM-QRY-001
    method: 'get',
    params,
  });
}

/**
 * 创建公司
 *
 * 关联需求：REQ-COM-002
 * 关联设计图：UIX-COM-FORM-001
 * 关联接口：API-COM-CMD-001
 * 请求类型：POST
 *
 * @param {Object} data 创建请求
 * @returns {Promise}
 */
export function create(data) {
  return request({
    url: '/api/company', // API-COM-CMD-001
    method: 'post',
    data,
  });
}
```

### 4.4 测试用例注释

```javascript
/**
 * 公司管理模块端到端测试
 *
 * 模块：company
 * 关联需求：REQ-COM-001, REQ-COM-002, REQ-COM-003, REQ-COM-004
 * 关联设计图：UIX-COM-LIST-001, UIX-COM-FORM-001
 * 关联路由：RTE-WEB-COM-LIST-001, RTE-WEB-COM-FORM-001
 * 关联接口：API-COM-QRY-001, API-COM-CMD-001, API-COM-UPT-001, API-COM-DEL-001
 */

describe('公司管理模块', () => {
  /**
   * 测试：公司列表查询
   * 关联需求：REQ-COM-001
   * 关联测试：TST-E2E-COM-001
   */
  it('应该能够查询公司列表', () => {
    // ...
  });

  /**
   * 测试：创建公司
   * 关联需求：REQ-COM-002
   * 关联测试：TST-E2E-COM-002
   */
  it('应该能够创建公司', () => {
    // ...
  });

  /**
   * 测试：编辑公司
   * 关联需求：REQ-COM-003
   * 关联测试：TST-E2E-COM-003
   */
  it('应该能够编辑公司', () => {
    // ...
  });

  /**
   * 测试：删除公司
   * 关联需求：REQ-COM-004
   * 关联测试：TST-API-COM-001
   */
  it('应该能够删除公司', () => {
    // ...
  });
});
```

---

## 五、需求文档结构规范

每个需求文档（requirements.md）必须包含以下关联信息：

### 5.1 需求文档模板

```markdown
# {模块名称} 需求文档

## 需求概览

| 编号 | 名称 | 优先级 | 状态 | 设计图 | API | 测试 |
|------|------|--------|------|--------|-----|------|
| REQ-{MOD}-001 | 需求名称 1 | P0 | ✅ | UIX-{MOD}-XXX | API-{MOD}-XXX | TST-XXX |
| REQ-{MOD}-002 | 需求名称 2 | P0 | ✅ | UIX-{MOD}-XXX | API-{MOD}-XXX | TST-XXX |

## 详细需求

### REQ-{MOD}-001：需求名称 1

**优先级**：P0

**状态**：已完成

**用户故事**：
作为 {角色}，我希望 {目标}，以便 {价值}。

**验收标准**：
1. When 条件 1，Then 结果 1
2. When 条件 2，Then 结果 2

**关联设计图**：
- UIX-{MOD}-XXX：设计图名称

**关联路由**：
- RTE-WEB-{MOD}-XXX：`/path`
- RTE-MOB-{MOD}-XXX：`/path`

**关联接口**：
- API-{MOD}-XXX：`GET /api/xxx`

**关联组件**：
- CMP-{MOD}-PAGE-Xxx：组件名称

**关联测试**：
- TST-E2E-{MOD}-001：端到端测试
- TST-API-{MOD}-001：API 测试

**国际化 key**：
- {mod}.field.name
- {mod}.button.create
```

---

## 六、AI 辅助定位规范

为了方便 AI 快速定位模块关联关系，所有文档和代码必须遵循以下规范：

### 6.1 关键词标注

在文档和代码中使用以下关键词标注关联关系：

| 关键词 | 用途 | 示例 |
|--------|------|------|
| `@requirement` | 关联需求 | `@requirement REQ-COM-001` |
| `@design` | 关联设计图 | `@design UIX-COM-LIST-001` |
| `@designFile` | 关联 Pencil 文件 | `@designFile jigongopc-com.pen` |
| `@designPage` | 关联设计图 Page | `@designPage LIST-001` |
| `@route` | 关联路由 | `@route RTE-WEB-COM-LIST-001` |
| `@api` | 关联接口 | `@api API-COM-QRY-001` |
| `@component` | 关联组件 | `@component CMP-COM-PAGE-CompanyList` |
| `@test` | 关联测试 | `@test TST-E2E-COM-001` |
| `@i18n` | 关联国际化 key | `@i18n company.title` |

### 6.2 Pencil 设计图读取

Claude Code 通过 Pencil MCP 工具读取 .pen 文件：

```
1. 使用 mcp__pencil__open_document 打开 .pen 文件
2. 使用 mcp__pencil__batch_get 读取 Page 列表和节点
3. 通过 Page 名称中的 ID 前缀识别设计图
4. 通过节点名称中的标注识别组件关联
```

**示例：读取公司管理模块设计图**

```
1. 打开文件：specs/assets/designs/jigongopc/com/jigongopc-com.pen
2. 读取 Page 列表，找到名称包含 "LIST-001" 的 Page
3. 读取该 Page 中的组件，查找名称包含 "[Button]" 的节点
4. 从节点名称中解析关联的 API 编号
```

### 6.3 索引文件

在每个模块目录下创建 `TRACEABILITY.md` 索引文件：

```markdown
# 公司管理模块可追溯性索引

## 模块信息

- 模块代码：COM
- 模块名称：公司管理
- 负责人：xxx
- 状态：开发中

## 快速链接

### 需求
- [需求文档](./requirements.md)

### 设计图
**Pencil 文件**：[jigongopc-com.pen](../../assets/designs/jigongopc/com/jigongopc-com.pen)

| 编号 | 名称 | Page | 说明 | 状态 |
|------|------|------|------|------|
| UIX-COM-LIST-001 | 公司列表页 | LIST-001 | 公司列表页面设计 | ✅ |
| UIX-COM-FORM-001 | 公司创建表单 | FORM-001 | 公司创建表单设计 | ✅ |
| UIX-COM-FORM-002 | 公司编辑表单 | FORM-002 | 公司编辑表单设计 | ✅ |
| UIX-COM-DETAIL-001 | 公司详情页 | DETAIL-001 | 公司详情页面设计 | ✅ |

**说明**：使用 Pencil MCP 工具读取设计图时，先打开 .pen 文件，然后根据 Page 名称中的 ID 前缀定位具体页面。

### 路由
| 端 | 路径 | 组件 |
|----|------|------|
| Web | `/company` | [company-list.vue](../../../../web/saber3-jigongopc/src/views/company/company-list.vue) |
| Web | `/company/new` | [company-form.vue](../../../../web/saber3-jigongopc/src/views/company/company-form.vue) |

### API
| 编号 | 方法 | 路径 | 说明 | Controller |
|------|------|------|------|------------|
| API-COM-QRY-001 | GET | `/api/company/page` | 分页查询 | CompanyController.page() |
| API-COM-CMD-001 | POST | `/api/company` | 创建公司 | CompanyController.create() |

### 测试
| 编号 | 类型 | 文件 | 覆盖需求 |
|------|------|------|----------|
| TST-E2E-COM-001 | E2E | [company.e2e.spec.js](../../../../web/saber3-jigongopc/e2e/company.e2e.spec.js) | REQ-COM-001 |
| TST-API-COM-001 | API | [CompanyApiTest.java](../../../../backend/company/src/test/java/CompanyApiTest.java) | REQ-COM-004 |

## 完整矩阵

| 需求 | 设计图 | Web 路由 | 移动路由 | API | 组件 | 测试 | 状态 |
|------|--------|----------|----------|-----|------|------|------|
| REQ-COM-001 | UIX-COM-LIST-001 | `/company` | `/company/list` | API-COM-QRY-001 | company-list.vue | TST-E2E-COM-001 | ✅ |
| REQ-COM-002 | UIX-COM-FORM-001 | `/company/new` | `/company/create` | API-COM-CMD-001 | company-form.vue | TST-E2E-COM-002 | ✅ |
```

### 6.4 AI 搜索提示

当 AI 需要定位某个功能时，按照以下优先级搜索：

1. **搜索需求编号**：`REQ-COM-001`
2. **搜索设计图 ID**：`UIX-COM-LIST-001`
3. **搜索 Pencil 文件**：`jigongopc-com.pen` + Page 名称 `LIST-001`
4. **搜索接口编号**：`API-COM-QRY-001`
5. **搜索路由编号**：`RTE-WEB-COM-LIST-001`
6. **搜索组件编号**：`CMP-COM-PAGE-CompanyList`
7. **搜索测试编号**：`TST-E2E-COM-001`

**Pencil 设计图读取示例**：

```
1. 打开设计图文件：
   specs/assets/designs/jigongopc/com/jigongopc-com.pen

2. 使用 mcp__pencil__batch_get 读取 Page 列表：
   patterns: [{ type: "frame" }], readDepth: 1

3. 查找 Page 名称包含 "LIST-001" 的页面

4. 读取该 Page 中的组件，解析名称中的标注：
   - "[Button] API-COM-CMD-001" → 关联创建 API
   - "[Table] API-COM-QRY-001" → 关联查询 API
```

---

## 七、验收测试关联规范

### 7.1 验收测试矩阵

每个需求必须有对应的验收测试用例：

| 需求编号 | 需求名称 | 功能测试 | 性能测试 | 安全测试 | 兼容性测试 | 国际化测试 |
|----------|----------|----------|----------|----------|------------|------------|
| REQ-COM-001 | 公司列表查询 | TST-E2E-COM-001 | TST-PERF-COM-001 | TST-SEC-COM-001 | TST-COMP-COM-001 | TST-I18N-COM-001 |
| REQ-COM-002 | 创建公司 | TST-E2E-COM-002 | - | TST-SEC-COM-002 | TST-COMP-COM-002 | TST-I18N-COM-002 |

### 7.2 测试覆盖率要求

| 测试类型 | 覆盖率要求 | 验证方式 |
|----------|------------|----------|
| 单元测试 | 代码覆盖率 ≥ 80% | JaCoCo 报告 |
| API 测试 | 接口覆盖率 ≥ 95% | Postman/Newman |
| E2E 测试 | 核心流程覆盖率 ≥ 90% | Cypress/Playwright |
| 兼容性测试 | 主流浏览器 ≥ 95% | BrowserStack |
| 国际化测试 | 所有支持语言 100% | 人工 + 自动化 |

---

## 八、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-14 | AI Assistant | 初始版本 |
