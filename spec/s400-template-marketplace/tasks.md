# S400-Template-Marketplace: 公司运营模板与创作者激励系统 — Tasks

> 总工时: 25d | 状态: 🟡 进行中

## 任务列表

### 第一部分：技术任务

#### Task 1: 数据库 Schema 实现
- **依赖**: 无
- **工时**: 2d
- [x] 创建 `company_templates` 表（模板主表）- 迁移文件已创建
- [x] 创建 `template_versions` 表（版本管理）- 迁移文件已创建
- [x] 创建 `template_lineages` 表（谱系追踪）- 迁移文件已创建
- [x] 创建 `creator_revenue_accounts` 表（创作者账户）- 迁移文件已创建
- [x] 创建 `revenue_records` 表（收益记录）- 迁移文件已创建
- [x] 创建 `creator_revenue_distributions` 表（收益分配明细）- 迁移文件已创建
- [x] 创建 `template_revenue_stats` 表（统计缓存）- 迁移文件已创建
- [x] 编写迁移脚本 `/packages/db/src/migrations/0028_company_operating_templates.sql`
- [x] 编写迁移脚本 `/packages/db/src/migrations/0029_creator_incentive_plan.sql`
- [ ] 创建 Drizzle ORM Schema TypeScript 定义（从迁移文件同步）

#### Task 2: TemplateService 实现
- **依赖**: Task 1
- **工时**: 3d
- [x] 创建 `server/src/services/template.ts` / `template-engine.ts`
- [x] 实现 `createTemplate()` - 创建模板
- [x] 实现 `getTemplate()` - 获取模板详情（含谱系）
- [x] 实现 `updateTemplate()` - 更新模板
- [ ] 实现 `publishTemplate()` - 发布模板（待集成到商店）
- [ ] 实现 `archiveTemplate()` - 归档模板
- [x] 实现 `listCompanyTemplates()` - 公司模板列表
- [ ] 实现 `searchTemplates()` - 模板搜索（支持全文检索）
- [ ] 单元测试覆盖

#### Task 3: 模板加密模块
- **依赖**: Task 2
- **工时**: 2d
- [ ] 创建 `server/src/services/template-encryption.ts`
- [ ] 实现 AES-256-GCM 加密/解密
- [ ] 实现数字签名生成/验证
- [ ] 实现模板包打包/解包
- [ ] 实现核心层/定制层分离
- [ ] 单元测试覆盖

#### Task 4: CLI 安装命令
- **依赖**: Task 2
- **工时**: 2d
- [ ] 创建 `packages/cli/src/commands/template.ts`
- [ ] 实现 `jigong template search` 命令
- [ ] 实现 `jigong template install` 命令
- [ ] 实现 `jigong template preview` 命令
- [ ] 实现 `jigong template list` 命令
- [ ] 实现 `jigong template upgrade` 命令
- [ ] 实现 `jigong template uninstall` 命令
- [ ] 实现进度条和错误处理

#### Task 5: Web 商店界面
- **依赖**: Task 2
- **工时**: 4d
- [ ] 创建模板商店首页 `/ui/src/pages/marketplace/index.tsx`
- [ ] 实现热门模板展示
- [ ] 实现精选付费模板展示
- [ ] 实现最新发布模板展示
- [ ] 实现分类浏览
- [ ] 实现搜索功能
- [ ] 实现筛选功能（价格、分类、评分）
- [ ] 响应式布局适配

#### Task 6: 支付集成
- **依赖**: Task 2
- **工时**: 3d
- [ ] 创建 `server/src/services/payment.ts`
- [ ] 实现账户余额支付
- [ ] 集成 Stripe 信用卡支付
- [ ] 集成支付宝
- [ ] 集成微信支付
- [ ] 实现支付回调处理
- [ ] 实现退款流程
- [ ] 编写支付测试脚本

#### Task 7: 收益分配服务
- **依赖**: Task 2, Task 6
- **工时**: 3d
- [x] 创建 `server/src/services/creator-incentive.ts`
- [x] 实现收益分配计算逻辑
- [x] 实现多级收益分配（平台 15% / 直接创作者 60% / 父模板 15% / 根模板 10%）
- [ ] 实现创作者余额更新
- [x] 实现收益分配记录
- [ ] 实现退款时收益撤销
- [x] 实现收益统计缓存更新
- [ ] 单元测试覆盖

#### Task 8: API 接口实现
- **依赖**: Task 2, Task 6, Task 7
- **工时**: 2d
- [ ] 创建 `server/src/routes/marketplace.ts`
- [ ] 实现模板搜索 API `GET /api/v1/marketplace/templates`
- [ ] 实现模板详情 API `GET /api/v1/marketplace/templates/:id`
- [ ] 实现购买模板 API `POST /api/v1/marketplace/templates/:id/purchase`
- [ ] 实现安装模板 API `POST /api/v1/marketplace/templates/:id/install`
- [ ] 实现分叉模板 API `POST /api/v1/marketplace/templates/:id/fork`
- [ ] 实现公司模板管理 API
- [ ] 实现创作者收益 API
- [ ] API 文档（Swagger/Knife4j）

#### Task 9: 创作者中心
- **依赖**: Task 7
- **工时**: 2d
- [ ] 创建创作者中心页面 `/ui/src/pages/creator/dashboard.tsx`
- [ ] 实现收益统计展示
- [ ] 实现模板管理（发布/编辑/删除）
- [ ] 实现收益提现申请
- [ ] 实现等级进度展示
- [ ] 实现提现记录查询

#### Task 10: 谱系展示
- **依赖**: Task 2
- **工时**: 2d
- [ ] 创建谱系树组件 `/ui/src/components/TemplateLineage.tsx`
- [ ] 实现谱系树可视化
- [ ] 实现分叉关系展示
- [ ] 实现分叉详情弹窗
- [ ] 在模板详情页集成谱系展示

#### Task 11: 版本管理
- **依赖**: Task 2
- **工时**: 1d
- [ ] 实现版本号验证（Semver）
- [ ] 实现版本历史查询
- [ ] 实现版本对比
- [ ] 实现版本升级通知
- [ ] 实现升级时定制层保留

#### Task 12: 创作者等级系统
- **依赖**: Task 7
- **工时**: 2d
- [ ] 创建 `server/src/services/creator-tier.ts`
- [ ] 实现等级自动计算
- [ ] 实现等级权益应用
- [ ] 实现等级升级通知
- [ ] 实现治理权投票（Diamond 等级）

#### Task 13: GraphQL API
- **依赖**: Task 8
- **工时**: 2d
- [ ] 创建 `server/src/graphql/template.ts`
- [ ] 定义 Template GraphQL Schema
- [ ] 实现 Query 解析器
- [ ] 实现 Mutation 解析器
- [ ] 实现分页和过滤

---

### 第二部分：UI/UX 设计图

#### UI-1: 模板商店首页 (UIX-TPL-LIST-001)
- **依赖**: 无
- **工时**: 1d
- [ ] 使用 Pencil 创建设计图
- [ ] 设计 Hero 区域（标语 + 搜索框）
- [ ] 设计热门模板卡片网格
- [ ] 设计精选付费模板区域
- [ ] 设计最新发布区域
- [ ] 设计分类导航
- [ ] 导出设计图到 `/designs/UIX-TPL-LIST-001.png`

#### UI-2: 模板详情页 (UIX-TPL-DETAIL-001)
- **依赖**: UI-1
- **工时**: 1d
- [ ] 使用 Pencil 创建设计图
- [ ] 设计模板信息区域（名称、作者、评分、安装数）
- [ ] 设计价格/安装按钮区域
- [ ] 设计标签页（概览、功能、谱系、评价）
- [ ] 设计谱系树展示区
- [ ] 设计预览图轮播
- [ ] 导出设计图到 `/designs/UIX-TPL-DETAIL-001.png`

#### UI-3: 模板创建表单 (UIX-TPL-FORM-001)
- **依赖**: UI-1
- **工时**: 1d
- [ ] 使用 Pencil 创建设计图
- [ ] 设计基础信息步骤（名称、描述、分类）
- [ ] 设计内容编辑步骤（角色、流程、交付物）
- [ ] 设计定价设置步骤
- [ ] 设计加密/定制层配置
- [ ] 设计预览和发布步骤
- [ ] 导出设计图到 `/designs/UIX-TPL-FORM-001.png`

#### UI-4: 安装进度弹窗 (UIX-TPL-INSTALL-001)
- **依赖**: UI-2
- **工时**: 0.5d
- [ ] 使用 Pencil 创建设计图
- [ ] 设计下载进度条
- [ ] 设计安装步骤指示器
- [ ] 设计成功/失败状态
- [ ] 设计支付流程弹窗
- [ ] 导出设计图到 `/designs/UIX-TPL-INSTALL-001.png`

#### UI-5: 创作者中心 (UIX-TPL-CREATOR-001)
- **依赖**: UI-1
- **工时**: 1d
- [ ] 使用 Pencil 创建设计图
- [ ] 设计收益概览仪表盘
- [ ] 设计模板管理列表
- [ ] 设计收益趋势图表
- [ ] 设计等级进度展示
- [ ] 设计提现申请界面
- [ ] 导出设计图到 `/designs/UIX-TPL-CREATOR-001.png`

#### UI-6: 谱系树展示 (UIX-TPL-LINEAGE-001)
- **依赖**: UI-2
- **工时**: 1d
- [ ] 使用 Pencil 创建设计图
- [ ] 设计树状图布局
- [ ] 设计节点卡片样式
- [ ] 设计分叉连接线
- [ ] 设计节点详情弹窗
- [ ] 设计时间轴视图
- [ ] 导出设计图到 `/designs/UIX-TPL-LINEAGE-001.png`

---

### 第三部分：验收标准及测试脚本

#### Test-1: 功能验收测试脚本
- **依赖**: Task 1-13
- **工时**: 1d
- [ ] 编写模板 CRUD 测试脚本
- [ ] 编写加密/解密测试脚本
- [ ] 编写购买/安装测试脚本
- [ ] 编写分叉测试脚本
- [ ] 编写收益分配测试脚本
- [ ] 编写退款测试脚本

#### Test-2: 性能验收测试脚本
- **依赖**: Task 1-13
- **工时**: 0.5d
- [ ] 编写模板查询性能测试（目标 < 100ms）
- [ ] 编写商店搜索性能测试（目标 < 200ms）
- [ ] 编写收益分配性能测试（目标 < 1s）
- [ ] 编写并发安装测试

#### Test-3: 安全验收测试脚本
- **依赖**: Task 3, Task 6
- **工时**: 0.5d
- [ ] 编写加密强度测试（AES-256-GCM）
- [ ] 编写签名验证测试
- [ ] 编写权限控制测试
- [ ] 编写支付安全测试

#### Test-4: CLI 验收测试脚本
- **依赖**: Task 4
- **工时**: 0.5d
- [ ] 编写 search 命令测试
- [ ] 编写 install 命令测试
- [ ] 编写 upgrade 命令测试
- [ ] 编写错误处理测试

#### Test-5: E2E 测试脚本
- **依赖**: Task 5, Task 8, Task 9
- **工时**: 1d
- [ ] 编写完整的购买安装流程 E2E 测试
- [ ] 编写分叉模板 E2E 测试
- [ ] 编写创作者收益 E2E 测试
- [ ] 编写跨公司导入 E2E 测试

---

## 任务依赖图

```
Task 1 (数据库) ─────────────────────────────────────────────────────┐
     │                                                                │
     ├─→ Task 2 (TemplateService) ──┬─→ Task 3 (加密) ──┬─→ Task 11 (版本)      │
     │                              │                   │                      │
     │                              ├─→ Task 4 (CLI)    │                      │
     │                              │                   │                      │
     │                              ├─→ Task 5 (Web)    │                      │
     │                              │                   │                      │
     │                              ├─→ Task 8 (API)    │                      │
     │                              │                   │                      │
     │                              └─→ Task 10 (谱系)  │                      │
     │                                                  │                      │
     ├─→ Task 6 (支付) ─────────────┬─→ Task 7 (收益) ──┴─→ Task 9 (创作者中心) │
     │                              │                   │                      │
     │                              │                   └─→ Task 12 (等级)       │
     │                              │                                          │
     └──────────────────────────────┴──────────────────────────────────────────┘

UI-1 (商店首页) ──┬─→ UI-2 (详情页) ──┬─→ UI-4 (安装弹窗)
                 │                    │
                 └─→ UI-3 (创建表单)   └─→ UI-6 (谱系展示)

UI-1 ──→ UI-5 (创作者中心)

Test-1~5 依赖所有技术任务和UI实现完成
```

---

## 工时汇总

| 类别 | 任务数 | 工时 |
|------|--------|------|
| 技术任务 | 13 | 27d |
| UI/UX 设计 | 6 | 5.5d |
| 验收测试 | 5 | 3d |
| **合计** | **24** | **35.5d** |

