# SPEC-400 公司运营模板与创作者激励系统 - JiGongOpc

> 版本：v1.0 | 日期：2026-03-15 | 优先级：P0
>
> **说明**：本文档定义公司运营模板系统（Company Operating Template System）和模板创作者激励计划（Template Creator Incentive Plan），支持模板的创建、发布、安装、收益分配，以及完整的可追溯性和复盘机制。

---

## 一、项目概述

### 1.1 系统定位

**公司运营模板系统**是 JiGongOpc 的核心扩展，提供：
- **模板管理**：公司运营规范、流程、角色的模板化封装
- **模板商店**：支持免费和付费模板的发布与分发
- **创作者激励**：基于模板使用产生的收益分配机制
- **谱系追踪**：完整的模板分叉和演进历史记录
- **可追溯性**：从需求到代码的完整追溯链路
- **复盘进化**：基于执行结果的持续改进机制

### 1.2 核心概念

```
公司运营模板 (Company Operating Template)
├── 角色定义 (Roles) - CEO、CTO、产品经理等
├── 工作流程 (Workflows) - 事务执行流程
├── 交付物规范 (Deliverables) - 预期产出
├── 追溯矩阵 (Traceability) - 需求-设计-实现-测试关联
└── 复盘规则 (Retrospective) - 持续改进机制

模板商店 (Template Marketplace)
├── 免费模板 - 社区贡献，无限制使用
├── 付费模板 - 创作者定价，收益分成
└── Freemium - 基础免费，高级付费

创作者激励 (Creator Incentive)
├── 收益分配 - 平台 15% / 直接创作者 60% / 父模板 15% / 根模板 10%
├── 等级系统 - Bronze → Silver → Gold → Platinum → Diamond
└── 谱系收益 - 分叉链上的多级收益分享
```

### 1.3 与 CLIPHUB 的关系

| 维度 | CLIPHUB | 我们的模板系统 |
|------|---------|---------------|
| **定位** | 公司配置分享平台 (npm for companies) | 运营模板商店 + 收益系统 |
| **内容** | Agent 配置、工具定义 | 公司运营规范、流程、角色 |
| **付费模式** | V1 免费 | 免费 + 付费 |
| **分叉机制** | forked_from_id | 完整谱系追踪 + 收益分配 |
| **关系** | 基础依赖 | 自然演进 + 商业化层 |

**整合策略**：我们的系统作为 CLIPHUB V2 的付费/激励层，保持兼容。

---

## 二、需求规格 (Requirements)

### 2.1 需求概览

| 编号 | 名称 | 优先级 | 状态 | 说明 |
|------|------|--------|------|------|
| REQ-TPL-001 | 模板定义与存储 | P0 | 待开发 | 模板结构和元数据管理 |
| REQ-TPL-002 | 模板加密与保护 | P0 | 待开发 | 核心模板加密，允许定制 |
| REQ-TPL-003 | 模板版本管理 | P0 | 待开发 | Semver 版本控制 |
| REQ-TPL-004 | 模板分叉与谱系 | P0 | 待开发 | 完整谱系追踪 |
| REQ-TPL-005 | 免费模板发布 | P0 | 待开发 | 零门槛发布 |
| REQ-TPL-006 | 付费模板发布 | P0 | 待开发 | 定价和支付 |
| REQ-TPL-007 | 模板搜索发现 | P0 | 待开发 | 分类、搜索、推荐 |
| REQ-TPL-008 | CLI 模板安装 | P0 | 待开发 | 命令行一键安装 |
| REQ-TPL-009 | Web 模板安装 | P0 | 待开发 | 界面一键安装 |
| REQ-TPL-010 | 收益分配计算 | P0 | 待开发 | 多级收益分配 |
| REQ-TPL-011 | 创作者等级系统 | P1 | 待开发 | Bronze → Diamond |
| REQ-TPL-012 | 收益提现 | P1 | 待开发 | 余额提现 |
| REQ-TPL-013 | 模板可追溯性 | P0 | 待开发 | 需求-设计-实现-测试关联 |
| REQ-TPL-014 | 复盘与自我进化 | P1 | 待开发 | 持续改进机制 |
| REQ-TPL-015 | 跨公司模板复制 | P1 | 待开发 | 模板导出导入 |

### 2.2 详细需求

#### REQ-TPL-001：模板定义与存储

**优先级**：P0

**用户故事**：
作为平台运营者，我希望定义标准化的公司运营模板结构，以便创作者可以基于统一规范创建和发布模板。

**验收标准**：

1. **When** 创作者创建模板，**Then** 系统应支持定义以下要素：
   - 角色集合（Roles）- CEO、CTO、产品经理、开发工程师等
   - 工作流程（Workflows）- 事务执行的标准流程
   - 交付物规范（Deliverables）- 每个角色的预期产出
   - 追溯矩阵（Traceability）- 需求、设计、实现、测试的关联规则
   - 复盘规则（Retrospective）- 执行后的评估和改进机制

2. **When** 模板被保存，**Then** 系统应将模板内容存储为 JSONB 格式，支持加密字段

3. **When** 模板被查询，**Then** 系统应在 100ms 内返回完整模板数据

**关联设计图**：
- UIX-TPL-FORM-001：模板创建表单

**关联接口**：
- API-TPL-CMD-001：`POST /api/templates` - 创建模板
- API-TPL-QRY-001：`GET /api/templates/:id` - 查询模板
- API-TPL-UPT-001：`PUT /api/templates/:id` - 更新模板

---

#### REQ-TPL-002：模板加密与保护

**优先级**：P0

**用户故事**：
作为模板创作者，我希望保护我的核心模板逻辑不被轻易复制，同时允许购买者在导入后进行必要的定制。

**验收标准**：

1. **When** 创作者发布付费模板，**Then** 系统应支持两层结构：
   - **核心层（Core）**：AES-256 加密，不可修改，包含核心逻辑
   - **定制层（Customization）**：明文存储，允许购买者修改

2. **When** 模板被导出，**Then** 系统应生成包含加密核心层和明文定制层的包

3. **When** 模板被导入其他公司，**Then** 系统应解密核心层并合并定制层

4. **When** 购买者尝试修改核心层，**Then** 系统应拒绝操作并提示"核心逻辑不可修改"

**加密策略**：
```
模板包结构：
├── manifest.json          # 模板元数据（明文）
├── core/                  # 核心层（AES-256 加密）
│   ├── workflows/         # 工作流定义
│   ├── roles/             # 角色定义
│   └── logic/             # 业务逻辑
├── customization/         # 定制层（明文）
│   ├── config.json        # 可配置参数
│   └── overrides/         # 覆盖规则
└── signature.json         # 数字签名
```

**关联接口**：
- API-TPL-CMD-002：`POST /api/templates/:id/export` - 导出模板
- API-TPL-CMD-003：`POST /api/templates/import` - 导入模板

---

#### REQ-TPL-003：模板版本管理

**优先级**：P0

**用户故事**：
作为模板用户，我希望能够安装特定版本的模板，并在新版本发布时选择是否升级。

**验收标准**：

1. **When** 创作者发布模板，**Then** 系统应支持 Semver 版本号（如 1.2.3）

2. **When** 用户安装模板，**Then** 系统默认安装最新稳定版本

3. **When** 用户指定版本号，**Then** 系统应安装该特定版本

4. **When** 创作者发布新版本，**Then** 系统应通知已购买的用户

5. **When** 用户升级模板，**Then** 系统应保留定制层的内容

**关联接口**：
- API-TPL-QRY-002：`GET /api/templates/:id/versions` - 查询版本列表
- API-TPL-CMD-004：`POST /api/templates/:id/upgrade` - 升级模板

---

#### REQ-TPL-004：模板分叉与谱系

**优先级**：P0

**用户故事**：
作为模板创作者，我希望基于现有模板创建改进版本，并保留与原模板的关联关系，以便在原模板产生收益时获得分成。

**验收标准**：

1. **When** 用户分叉模板，**Then** 系统应记录完整的谱系信息：
   - 根模板 ID（原始创建者）
   - 父模板 ID（直接来源）
   - 代数（第几代分叉）
   - 分叉时间和贡献描述

2. **When** 分叉模板产生收益，**Then** 系统应按以下比例分配：
   - 平台：15%
   - 直接创作者：60%
   - 父模板创作者：15%
   - 根模板创作者：10%

3. **When** 用户查看模板详情，**Then** 系统应展示完整的谱系树

**关联数据库表**：
- `template_lineages` - 谱系追踪表

**关联接口**：
- API-TPL-CMD-005：`POST /api/templates/:id/fork` - 分叉模板
- API-TPL-QRY-003：`GET /api/templates/:id/lineage` - 查询谱系

---

#### REQ-TPL-005：免费模板发布

**优先级**：P0

**用户故事**：
作为模板创作者，我希望免费发布模板以建立声誉和吸引用户，为后续付费模板积累受众。

**验收标准**：

1. **When** 创作者选择"免费发布"，**Then** 系统应立即发布模板，无需支付审核费用

2. **When** 用户安装免费模板，**Then** 系统应无任何费用产生

3. **When** 免费模板被安装，**Then** 系统应记录安装统计用于创作者声誉积累

4. **When** 免费模板被分叉，**Then** 系统应正常记录谱系，但无收益分配（除非分叉后的模板付费）

**关联接口**：
- API-TPL-CMD-006：`POST /api/templates/:id/publish` - 发布模板（支持 pricing.type = 'free'）

---

#### REQ-TPL-006：付费模板发布

**优先级**：P0

**用户故事**：
作为模板创作者，我希望为我的高质量模板设定价格，并在用户购买时获得收益。

**验收标准**：

1. **When** 创作者设置模板价格，**Then** 系统应支持多币种定价（USD、CNY 等）

2. **When** 用户购买付费模板，**Then** 系统应支持多种支付方式：
   - 账户余额（优先推荐）
   - 信用卡（Stripe）
   - 支付宝
   - 微信支付

3. **When** 支付完成，**Then** 系统应立即解锁模板并允许安装

4. **When** 购买完成，**Then** 系统应立即执行收益分配

5. **When** 用户请求退款（7天内），**Then** 系统应撤销收益分配并退款

**关联接口**：
- API-TPL-CMD-007：`POST /api/templates/:id/purchase` - 购买模板
- API-TPL-CMD-008：`POST /api/templates/:id/refund` - 退款

---

#### REQ-TPL-007：模板搜索发现

**优先级**：P0

**用户故事**：
作为模板用户，我希望能够方便地发现和搜索我需要的模板。

**验收标准**：

1. **When** 用户访问模板商店首页，**Then** 系统应展示：
   - 热门模板（按安装数排序）
   - 精选付费模板
   - 最新发布的模板
   - 分类浏览

2. **When** 用户输入搜索关键词，**Then** 系统应在 200ms 内返回匹配结果

3. **When** 用户按分类筛选，**Then** 系统应支持多级分类（行业、规模、用途）

4. **When** 用户按价格筛选，**Then** 系统应支持"仅看免费"、"价格区间"等选项

**关联设计图**：
- UIX-TPL-LIST-001：模板商店列表页

**关联接口**：
- API-TPL-QRY-004：`GET /api/marketplace/templates` - 搜索模板

---

#### REQ-TPL-008：CLI 模板安装

**优先级**：P0

**用户故事**：
作为开发者，我希望通过命令行一键安装模板，就像使用 npm install 一样简单。

**验收标准**：

1. **When** 用户运行 `jigong template install owner/template-name`，**Then** 系统应在 3 秒内完成免费模板安装

2. **When** 用户运行安装付费模板的命令，**Then** 系统应：
   - 检查用户是否已购买
   - 未购买则提示购买流程
   - 已购买则直接下载安装

3. **When** 用户运行 `jigong template search keyword`，**Then** 系统应返回匹配的模板列表

4. **When** 用户运行 `jigong template preview owner/template-name`，**Then** 系统应展示模板预览

**CLI 命令**：
```bash
# 安装免费模板
jigong template install fireteam/saas-starter

# 安装特定版本
jigong template install fireteam/saas-starter@1.2.0

# 从 GitHub 安装
jigong template install github:owner/repo/template-name

# 搜索模板
jigong template search "电商"

# 预览模板
jigong template preview fireteam/saas-starter

# 列出已安装模板
jigong template list

# 升级模板
jigong template upgrade fireteam/saas-starter
```

---

#### REQ-TPL-009：Web 模板安装

**优先级**：P0

**用户故事**：
作为非技术用户，我希望通过 Web 界面一键安装模板，操作像 App Store 一样简单。

**验收标准**：

1. **When** 用户在 Web 界面浏览模板，**Then** 每个模板应显示"预览"和"安装"按钮

2. **When** 用户点击免费模板的"安装"，**Then** 系统应立即开始安装并显示进度

3. **When** 用户点击付费模板的"购买并安装"，**Then** 系统应：
   - 显示支付弹窗
   - 支持账户余额和第三方支付
   - 支付完成后自动开始安装

4. **When** 安装完成，**Then** 系统应显示"安装成功"并引导用户激活模板

**关联设计图**：
- UIX-TPL-DETAIL-001：模板详情页
- UIX-TPL-INSTALL-001：安装进度弹窗

---

#### REQ-TPL-010：收益分配计算

**优先级**：P0

**用户故事**：
作为平台运营者，我希望在每次模板购买时自动执行收益分配，确保创作者及时获得回报。

**验收标准**：

1. **When** 付费模板被购买，**Then** 系统应在 1 秒内完成收益分配计算

2. **When** 收益分配执行，**Then** 各参与方应按以下比例获得收益：
   - 平台：15%
   - 直接创作者：60%
   - 父模板创作者：15%（如果有）
   - 根模板创作者：10%（如果有）

3. **When** 模板没有父模板，**Then** 父模板份额应分配给直接创作者

4. **When** 模板本身就是根模板，**Then** 根模板份额应分配给直接创作者

5. **When** 收益分配完成，**Then** 系统应更新各创作者的账户余额

**收益分配示例**：
```
场景：Carol 购买 Template B ($120)
Template B 分叉自 Template A（Alice 创建）

分配结果：
- 平台：$18 (15%)
- Bob（Template B 创作者）：$72 (60%)
- Alice（父模板 + 根模板）：$30 (15% + 10% = 25%)
```

**关联数据库表**：
- `revenue_records` - 收益记录
- `creator_revenue_distributions` - 收益分配明细

**关联接口**：
- API-TPL-ACT-001：`POST /api/templates/:id/distribute` - 执行收益分配

---

#### REQ-TPL-011：创作者等级系统

**优先级**：P1

**用户故事**：
作为模板创作者，我希望通过持续创作获得等级提升，享受更多平台权益。

**验收标准**：

1. **When** 创作者满足升级条件，**Then** 系统应自动提升其等级

2. **When** 创作者等级提升，**Then** 系统应通知创作者并展示新权益

3. **When** 创作者查看个人中心，**Then** 系统应展示当前等级和升级进度

**等级定义**：
| 等级 | 名称 | 要求 | 权益 |
|------|------|------|------|
| Bronze | 创作者 | 1 个模板 | 基础收益分成 |
| Silver | 资深创作者 | 3 模板 + 50 下载 + $500 收益 + 4.0 评分 | +5% 收益加成，平台费 -2% |
| Gold | 金牌创作者 | 5 模板 + 200 下载 + $2000 收益 + 4.2 评分 | +10% 收益加成，平台费 -5% |
| Platinum | 白金创作者 | 10 模板 + 1000 下载 + $10000 收益 + 4.5 评分 | +15% 收益加成，平台费 -10%，专属客服 |
| Diamond | 钻石创作者 | 20 模板 + 5000 下载 + $50000 收益 + 4.8 评分 | +20% 收益加成，平台费 -15%，治理权 |

---

#### REQ-TPL-012：收益提现

**优先级**：P1

**用户故事**：
作为模板创作者，我希望将收益提现到我的银行账户或第三方支付账户。

**验收标准**：

1. **When** 创作者申请提现，**Then** 系统应验证可提现余额 ≥ $100

2. **When** 提现申请提交，**Then** 系统应进入审核流程（自动或人工）

3. **When** 提现完成，**Then** 系统应扣除相应余额并记录交易

4. **When** 创作者查看收益报告，**Then** 系统应展示：
   - 总收益、可提现余额、待结算金额
   - 按模板汇分的收益
   - 按时间段汇分的收益

---

#### REQ-TPL-013：模板可追溯性

**优先级**：P0

**用户故事**：
作为项目管理者，我希望在使用模板创建的项目中，能够追溯从需求到代码的完整链路。

**验收标准**：

1. **When** 项目使用模板创建，**Then** 系统应自动生成追溯矩阵

2. **When** 事务被创建，**Then** 系统应自动关联相关的 spec 文档

3. **When** 代码被提交，**Then** 系统应自动关联对应的事务和需求

4. **When** 用户查看事务详情，**Then** 系统应展示完整的追溯链路：
   - 需求 → 设计 → 实现 → 测试

**追溯矩阵结构**：
| 需求 | 设计图 | 后端 API | 前端组件 | 数据库表 | 测试用例 |
|------|--------|----------|----------|----------|----------|
| REQ-001 | UIX-001 | API-001 | CMP-001 | table_xxx | TST-001 |

---

#### REQ-TPL-014：复盘与自我进化

**优先级**：P1

**用户故事**：
作为模板创作者，我希望了解我的模板在实际使用中的表现，以便持续改进。

**验收标准**：

1. **When** 基于模板的事务完成，**Then** 系统应自动生成复盘报告

2. **When** 复盘报告生成，**Then** 系统应分析：
   - 流程执行效率
   - 角色工作负载
   - 交付物质量
   - 与预期的偏差

3. **When** 多个复盘数据积累，**Then** 系统应识别优化模式

4. **When** 创作者查看模板分析，**Then** 系统应提供改进建议

---

#### REQ-TPL-015：跨公司模板复制

**优先级**：P1

**用户故事**：
作为公司管理员，我希望将其他公司的优秀模板导入到我们公司使用。

**验收标准**：

1. **When** 模板被导出，**Then** 系统应生成可移植的模板包

2. **When** 模板包被导入新公司，**Then** 系统应：
   - 解密核心层
   - 保留定制层供修改
   - 建立与原始模板的谱系关联

3. **When** 导入的模板产生收益，**Then** 原始创作者应获得相应分成

---

## 三、技术设计 (Design)

### 3.1 系统架构

```
模板系统架构
├── 存储层
│   ├── 模板元数据 (PostgreSQL)
│   ├── 模板内容 (JSONB / 加密存储)
│   └── 谱系数据 (PostgreSQL)
├── 服务层
│   ├── TemplateService - 模板 CRUD
│   ├── TemplateEngine - 模板编译/导出/导入
│   ├── TemplateMarketplace - 商店逻辑
│   ├── CreatorIncentive - 收益分配
│   └── TraceabilityService - 追溯矩阵
├── API 层
│   ├── REST API - 模板管理
│   ├── GraphQL - 商店查询
│   └── WebSocket - 安装进度
└── 客户端
    ├── CLI (jigong template)
    ├── Web UI (Saber 3)
    └── SDK (TypeScript/Java)
```

### 3.2 数据库设计

**核心表**：

1. **company_templates** - 模板主表
2. **template_lineages** - 谱系追踪
3. **creator_revenue_accounts** - 创作者账户
4. **revenue_records** - 收益记录
5. **creator_revenue_distributions** - 收益分配
6. **template_revenue_stats** - 统计缓存

**详细 Schema**：
```sql
-- 见 /packages/db/src/migrations/0028_company_operating_templates.sql
-- 和 /packages/db/src/migrations/0029_creator_incentive_plan.sql
```

### 3.3 API 设计

| 编号 | 方法 | 路径 | 说明 |
|------|------|------|------|
| API-TPL-QRY-001 | GET | `/api/templates/:id` | 查询模板详情 |
| API-TPL-CMD-001 | POST | `/api/templates` | 创建模板 |
| API-TPL-UPT-001 | PUT | `/api/templates/:id` | 更新模板 |
| API-TPL-CMD-002 | POST | `/api/templates/:id/export` | 导出模板 |
| API-TPL-CMD-003 | POST | `/api/templates/import` | 导入模板 |
| API-TPL-CMD-005 | POST | `/api/templates/:id/fork` | 分叉模板 |
| API-TPL-CMD-006 | POST | `/api/templates/:id/publish` | 发布模板 |
| API-TPL-CMD-007 | POST | `/api/templates/:id/purchase` | 购买模板 |
| API-TPL-QRY-004 | GET | `/api/marketplace/templates` | 搜索模板 |
| API-TPL-ACT-001 | POST | `/api/templates/:id/distribute` | 收益分配 |

---

## 四、UI/UX 设计

### 4.1 设计图列表

| 编号 | 名称 | 类型 | 说明 |
|------|------|------|------|
| UIX-TPL-LIST-001 | 模板商店首页 | LIST | 热门、精选、分类 |
| UIX-TPL-DETAIL-001 | 模板详情页 | DETAIL | 介绍、评价、购买 |
| UIX-TPL-FORM-001 | 模板创建表单 | FORM | 创建/编辑模板 |
| UIX-TPL-INSTALL-001 | 安装进度弹窗 | MODAL | 安装进度展示 |
| UIX-TPL-CREATOR-001 | 创作者中心 | DASH | 收益、统计、等级 |
| UIX-TPL-LINEAGE-001 | 谱系树展示 | TREE | 模板分叉历史 |

### 4.2 关键交互流程

**安装流程**：
```
浏览模板 → 查看详情 → 点击安装 → (付费检查) → 下载 → 激活 → 完成
```

**发布流程**：
```
创建模板 → 定义角色/流程 → 设置价格 → 预览 → 发布 → 审核 → 上线
```

---

## 五、任务分解

### 5.1 任务列表

| 编号 | 任务 | 优先级 | 工时 | 依赖 |
|------|------|--------|------|------|
| TSK-TPL-001 | 数据库 Schema 实现 | P0 | 2d | - |
| TSK-TPL-002 | TemplateService 实现 | P0 | 3d | TSK-TPL-001 |
| TSK-TPL-003 | 模板加密模块 | P0 | 2d | TSK-TPL-002 |
| TSK-TPL-004 | CLI 安装命令 | P0 | 2d | TSK-TPL-002 |
| TSK-TPL-005 | Web 商店界面 | P0 | 4d | TSK-TPL-002 |
| TSK-TPL-006 | 支付集成 | P0 | 3d | TSK-TPL-005 |
| TSK-TPL-007 | 收益分配服务 | P0 | 3d | TSK-TPL-006 |
| TSK-TPL-008 | 创作者中心 | P1 | 2d | TSK-TPL-007 |
| TSK-TPL-009 | 谱系展示 | P1 | 2d | TSK-TPL-002 |
| TSK-TPL-010 | 追溯矩阵实现 | P0 | 3d | TSK-TPL-002 |

---

## 六、验收标准

### 6.1 功能验收

| 需求 | 验收项 | 通过标准 |
|------|--------|----------|
| REQ-TPL-001 | 模板创建 | 支持完整的模板结构定义 |
| REQ-TPL-002 | 模板加密 | 核心层加密，定制层可修改 |
| REQ-TPL-004 | 分叉谱系 | 完整记录谱系链 |
| REQ-TPL-008 | CLI 安装 | 3 秒内完成免费模板安装 |
| REQ-TPL-010 | 收益分配 | 1 秒内完成分配计算 |

### 6.2 性能验收

| 指标 | 目标值 |
|------|--------|
| 模板查询 | < 100ms |
| 模板安装 | < 3s (免费) / < 10s (含支付) |
| 收益分配 | < 1s |
| 商店搜索 | < 200ms |

### 6.3 安全验收

| 项 | 要求 |
|----|------|
| 加密强度 | AES-256-GCM |
| 支付安全 | PCI DSS 合规 |
| 权限控制 | RBAC + 数据范围 |

---

## 七、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-03-15 | AI Assistant | 初始版本，整合所有沟通内容 |
