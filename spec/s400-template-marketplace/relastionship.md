# S400-Template-Marketplace: 公司运营模板与创作者激励系统 — Relationship

> 参考: SPEC-300-可追溯性矩阵规范

## 可追溯性矩阵

### 需求-设计-代码-测试追溯

| 需求编号 | 需求描述 | 设计文档 | 代码模块 | 测试用例 | 状态 |
|----------|----------|----------|----------|----------|------|
| REQ-TPL-001 | 模板定义与存储 | design.md §2, §3.1 | `TemplateService`, `company_templates` 表 | Test-1: 模板 CRUD | ⏳ 待开发 |
| REQ-TPL-002 | 模板加密与保护 | design.md §3.2, §6 | `TemplateEncryption` | Test-3: 加密强度 | ⏳ 待开发 |
| REQ-TPL-003 | 模板版本管理 | design.md §2.1, §11 | `template_versions` 表 | Test-1: 版本测试 | ⏳ 待开发 |
| REQ-TPL-004 | 模板分叉与谱系 | design.md §2.1, §3.3 | `template_lineages` 表, `forkTemplate` | Test-1: 分叉测试 | ⏳ 待开发 |
| REQ-TPL-005 | 免费模板发布 | design.md §4 | `TemplateMarketplace` | Test-1: 发布测试 | ⏳ 待开发 |
| REQ-TPL-006 | 付费模板发布 | design.md §4, §7 | `payment.ts`, `purchase` API | Test-1: 购买测试 | ⏳ 待开发 |
| REQ-TPL-007 | 模板搜索发现 | design.md §4, §8 | `searchTemplates`, GraphQL | Test-4: 搜索测试 | ⏳ 待开发 |
| REQ-TPL-008 | CLI 模板安装 | design.md §5 | `packages/cli/src/commands/template.ts` | Test-4: CLI 测试 | ⏳ 待开发 |
| REQ-TPL-009 | Web 模板安装 | design.md §4, UIUX §UIX-TPL-INSTALL-001 | `marketplace.ts` 路由 | Test-5: E2E 安装 | ⏳ 待开发 |
| REQ-TPL-010 | 收益分配计算 | design.md §3.3, §7 | `RevenueDistribution` | Test-1: 分配测试 | ⏳ 待开发 |
| REQ-TPL-011 | 创作者等级系统 | design.md §8 | `CreatorTierService` | Test-1: 等级测试 | ⏳ 待开发 |
| REQ-TPL-012 | 收益提现 | design.md §4 | `withdraw` API | Test-1: 提现测试 | ⏳ 待开发 |
| REQ-TPL-013 | 模板可追溯性 | design.md §3 | `TraceabilityService` | Test-5: 追溯测试 | ⏳ 待开发 |
| REQ-TPL-014 | 复盘与自我进化 | design.md §3 | `RetrospectiveService` | Test-5: 复盘测试 | ⏳ 待开发 |
| REQ-TPL-015 | 跨公司模板复制 | design.md §6 | `exportTemplate`, `importTemplate` | Test-5: 导入导出 | ⏳ 待开发 |

### 用户故事-UI/UX追溯

| 用户故事 | 涉及设计图 | 前端组件 | 状态 |
|----------|------------|----------|------|
| US-1: 模板定义与创建 | UIX-TPL-FORM-001 | `TemplateCreateWizard`, `JSONEditor` | ⏳ 待设计 |
| US-2: 模板加密与保护 | UIX-TPL-FORM-001 | `EncryptionSettings` | ⏳ 待设计 |
| US-3: 模板分叉与谱系 | UIX-TPL-LINEAGE-001, UIX-TPL-DETAIL-001 | `TemplateLineage`, `ForkButton` | ⏳ 待设计 |
| US-4: 免费模板发布 | UIX-TPL-FORM-001 | `PricingSettings` | ⏳ 待设计 |
| US-5: 付费模板发布 | UIX-TPL-DETAIL-001, UIX-TPL-INSTALL-001 | `PurchaseModal`, `PaymentForm` | ⏳ 待设计 |
| US-6: 模板搜索发现 | UIX-TPL-LIST-001 | `MarketplaceHome`, `SearchBox`, `FilterPanel` | ⏳ 待设计 |
| US-7: CLI 模板安装 | N/A (CLI) | `packages/cli` | ⏳ 待开发 |
| US-8: Web 模板安装 | UIX-TPL-INSTALL-001 | `InstallProgressModal` | ⏳ 待设计 |
| US-9: 收益分配计算 | N/A (后端) | Revenue distribution background job | ⏳ 待开发 |
| US-10: 创作者等级系统 | UIX-TPL-CREATOR-001 | `CreatorDashboard`, `TierProgress` | ⏳ 待设计 |
| US-11: 模板版本管理 | UIX-TPL-DETAIL-001, UIX-TPL-FORM-001 | `VersionSelector`, `VersionHistory` | ⏳ 待设计 |
| US-12: 模板可追溯性 | N/A (后端) | `TraceabilityMatrix` | ⏳ 待开发 |
| US-13: 复盘与自我进化 | N/A (后端) | `RetrospectiveReport` | ⏳ 待开发 |
| US-14: 跨公司模板复制 | UIX-TPL-INSTALL-001 | `ImportExportWizard` | ⏳ 待设计 |
| US-15: 收益提现 | UIX-TPL-CREATOR-001 | `WithdrawalForm`, `PayoutMethods` | ⏳ 待设计 |

### 任务-资源追溯

| 任务编号 | 任务名称 | 依赖任务 | 数据库表 | API端点 | 前端页面 |
|----------|----------|----------|----------|---------|----------|
| Task 1 | 数据库 Schema | - | 全部表 | - | - |
| Task 2 | TemplateService | Task 1 | `company_templates` | `/templates/*` | - |
| Task 3 | 加密模块 | Task 2 | - | - | - |
| Task 4 | CLI 命令 | Task 2 | - | `/marketplace/*` | - |
| Task 5 | Web 商店 | Task 2 | - | `/marketplace/*` | `marketplace/index.tsx` |
| Task 6 | 支付集成 | Task 2 | `revenue_records` | `/purchase`, `/refund` | `PurchaseModal` |
| Task 7 | 收益分配 | Task 2, 6 | `revenue_distributions` | - | - |
| Task 8 | API 接口 | Task 6, 7 | - | 全部 REST API | - |
| Task 9 | 创作者中心 | Task 7 | - | `/creators/*` | `creator/dashboard.tsx` |
| Task 10 | 谱系展示 | Task 2 | `template_lineages` | `/lineage` | `TemplateLineage.tsx` |
| Task 11 | 版本管理 | Task 2 | `template_versions` | `/versions` | `VersionSelector` |
| Task 12 | 等级系统 | Task 7 | - | `/creators/tier` | `TierProgress` |
| Task 13 | GraphQL | Task 8 | - | `/graphql` | - |
| UI-1 | 商店首页设计 | - | - | - | UIX-TPL-LIST-001 |
| UI-2 | 详情页设计 | UI-1 | - | - | UIX-TPL-DETAIL-001 |
| UI-3 | 创建表单设计 | UI-1 | - | - | UIX-TPL-FORM-001 |
| UI-4 | 安装弹窗设计 | UI-2 | - | - | UIX-TPL-INSTALL-001 |
| UI-5 | 创作者中心设计 | UI-1 | - | - | UIX-TPL-CREATOR-001 |
| UI-6 | 谱系树设计 | UI-2 | - | - | UIX-TPL-LINEAGE-001 |
| Test-1 | 功能验收测试 | Task 1-13 | - | - | - |
| Test-2 | 性能验收测试 | Task 1-13 | - | - | - |
| Test-3 | 安全验收测试 | Task 3, 6 | - | - | - |
| Test-4 | CLI 验收测试 | Task 4 | - | - | - |
| Test-5 | E2E 测试 | Task 5, 8, 9 | - | - | - |

## 接口-需求覆盖矩阵

### REST API 覆盖

| API 端点 | 覆盖的需求 | 用户故事 |
|----------|------------|----------|
| `GET /api/v1/marketplace/templates` | REQ-TPL-006, REQ-TPL-007 | US-5, US-6 |
| `GET /api/v1/marketplace/templates/:id` | REQ-TPL-006 | US-5 |
| `POST /api/v1/marketplace/templates/:id/purchase` | REQ-TPL-006 | US-5 |
| `POST /api/v1/marketplace/templates/:id/install` | REQ-TPL-009 | US-8 |
| `POST /api/v1/marketplace/templates/:id/fork` | REQ-TPL-004 | US-3 |
| `POST /api/v1/marketplace/templates/:id/refund` | REQ-TPL-006 | US-5 |
| `GET /api/v1/companies/:id/templates` | REQ-TPL-001 | US-1 |
| `POST /api/v1/companies/:id/templates` | REQ-TPL-001 | US-1 |
| `PUT /api/v1/companies/:id/templates/:tid` | REQ-TPL-001 | US-1 |
| `DELETE /api/v1/companies/:id/templates/:tid` | REQ-TPL-001 | US-1 |
| `POST /api/v1/companies/:id/templates/:tid/publish` | REQ-TPL-005, REQ-TPL-006 | US-4, US-5 |
| `POST /api/v1/companies/:id/templates/:tid/export` | REQ-TPL-002, REQ-TPL-015 | US-2, US-14 |
| `POST /api/v1/companies/:id/templates/import` | REQ-TPL-015 | US-14 |
| `GET /api/v1/creators/:id/revenue` | REQ-TPL-010, REQ-TPL-012 | US-9, US-15 |
| `POST /api/v1/creators/:id/withdraw` | REQ-TPL-012 | US-15 |
| `GET /api/v1/templates/:id/lineage` | REQ-TPL-004 | US-3 |
| `GET /api/v1/templates/:id/versions` | REQ-TPL-011 | US-11 |
| `POST /api/v1/templates/:id/versions` | REQ-TPL-011 | US-11 |

### GraphQL Schema 覆盖

| GraphQL Type/Query/Mutation | 覆盖的需求 |
|----------------------------|-----------|
| `type Template` | REQ-TPL-001, REQ-TPL-003, REQ-TPL-006 |
| `type Pricing` | REQ-TPL-005, REQ-TPL-006 |
| `type Lineage` | REQ-TPL-004 |
| `Query.templates` | REQ-TPL-007 |
| `Query.template` | REQ-TPL-006 |
| `Query.creatorRevenue` | REQ-TPL-010 |
| `Mutation.purchaseTemplate` | REQ-TPL-006 |
| `Mutation.installTemplate` | REQ-TPL-009 |
| `Mutation.forkTemplate` | REQ-TPL-004 |

## 数据库-需求覆盖矩阵

| 表名 | 覆盖的需求 | 字段映射 |
|------|-----------|----------|
| `company_templates` | REQ-TPL-001, REQ-TPL-005, REQ-TPL-006 | 全部基础字段 |
| `template_versions` | REQ-TPL-003 | version, changelog, content_diff |
| `template_lineages` | REQ-TPL-004 | parent_template_id, root_template_id, fork_generation |
| `creator_revenue_accounts` | REQ-TPL-010, REQ-TPL-012 | balance, total_earned, withdrawal_methods |
| `revenue_records` | REQ-TPL-006, REQ-TPL-010 | amount, currency, status, buyer_id |
| `creator_revenue_distributions` | REQ-TPL-010 | recipient_type, percentage, amount |
| `template_revenue_stats` | REQ-TPL-010 | install_count, rating_avg, revenue_total |

## 验收标准-需求验证矩阵

| 需求 | 验收标准来源 | 验证方式 |
|------|-------------|----------|
| REQ-TPL-001 | requirements.md EARS | 单元测试 + 集成测试 |
| REQ-TPL-002 | requirements.md EARS | 安全审计 + 渗透测试 |
| REQ-TPL-003 | requirements.md EARS | 版本测试 + 升级测试 |
| REQ-TPL-004 | requirements.md EARS | 分叉测试 + 谱系验证 |
| REQ-TPL-005 | requirements.md EARS | 发布流程测试 |
| REQ-TPL-006 | requirements.md EARS | 支付测试 + 退款测试 |
| REQ-TPL-007 | requirements.md EARS | 搜索性能测试 |
| REQ-TPL-008 | requirements.md EARS | CLI 功能测试 |
| REQ-TPL-009 | requirements.md EARS | E2E 安装测试 |
| REQ-TPL-010 | requirements.md EARS | 收益计算准确性测试 |
| REQ-TPL-011 | requirements.md EARS | 等级自动计算测试 |
| REQ-TPL-012 | requirements.md EARS | 提现流程测试 |
| REQ-TPL-013 | requirements.md EARS | 追溯链路验证 |
| REQ-TPL-014 | requirements.md EARS | 复盘报告生成测试 |
| REQ-TPL-015 | requirements.md EARS | 导入导出测试 |

## 变更历史

| 日期 | 版本 | 作者 | 变更说明 |
|------|------|------|----------|
| 2026-03-15 | v1.0 | AI Assistant | 初始版本，建立完整的追溯矩阵 |

