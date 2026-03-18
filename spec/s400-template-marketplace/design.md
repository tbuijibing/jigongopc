# S400-Template-Marketplace: 公司运营模板与创作者激励系统 — Design

> 参考: SPEC-400-公司运营模板与创作者激励系统
> 技术栈: Node.js + TypeScript + Express + Drizzle ORM + PostgreSQL

## 1. 系统架构

```
模板系统架构
├── 存储层
│   ├── PostgreSQL (Drizzle ORM)
│   │   ├── company_templates - 模板主表
│   │   ├── template_subscriptions - 模板订阅
│   │   ├── template_marketplace - 市场发布
│   │   ├── template_workflows - 模板工作流
│   │   ├── template_roles - 模板角色
│   │   ├── template_lineages - 谱系追踪
│   │   ├── creator_revenue_accounts - 创作者账户
│   │   ├── revenue_records - 收益记录
│   │   ├── creator_revenue_distributions - 收益分配明细
│   │   ├── creator_payout_requests - 提现申请
│   │   └── template_revenue_stats - 统计缓存
│   ├── Redis (ioredis)
│   │   ├── template:cache:* - 模板内容缓存 (TTL 10分钟)
│   │   ├── revenue:pending:* - 待结算收益
│   │   └── search:index:* - 搜索索引
│   └── Object Storage (MinIO/S3)
│       └── template-packages/* - 模板加密包存储
├── 服务层 (Function-based Service Pattern)
│   ├── templateEngineService - 模板解析/编译/导入/导出
│   ├── creatorIncentiveService - 收益分配/创作者等级
│   ├── templateMarketplaceService - 商店逻辑
│   └── paymentService - 支付处理
├── API 层 (Express Router)
│   ├── REST API - 模板管理
│   └── WebSocket - 安装进度
└── 客户端
    ├── CLI (jigong template)
    └── Web UI (React + TanStack Query)
```

## 2. 数据库 Schema (Drizzle ORM)

### 2.1 核心表定义

**company_templates - 模板主表**

```typescript
// packages/db/src/schema/company_templates.ts
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const companyTemplates = pgTable("company_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),

  // Template metadata
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  version: text("version").notNull().default("1.0.0"),

  // Template source info
  sourceType: text("source_type").notNull().default("builtin"),
  parentTemplateId: uuid("parent_template_id"),

  // Template content (encrypted for marketplace templates)
  templatePackage: jsonb("template_package").$type<{
    manifest: {
      apiVersion: string;
      kind: string;
      metadata: {
        name: string;
        version: string;
        author?: string;
        category?: string;
        encrypted?: boolean;
      };
    };
    core: {
      encrypted: boolean;
      encryptedData?: string;
      data?: {
        workflows: unknown[];
        globalRules: unknown;
        checks: unknown[];
      };
    };
    customization: {
      variables: Record<string, unknown>;
      integrations: Record<string, unknown>;
      notifications: Record<string, unknown>;
    };
    roles: unknown[];
    agentBehaviors: Record<string, unknown>;
  }>(),

  // Encryption settings
  encryptionConfig: jsonb("encryption_config").$type<{
    enabled: boolean;
    algorithm: string;
    keyId: string;
    signature: string;
    customizableFields: string[];
  }>(),

  // Activation status
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),

  // Marketplace info
  isPublic: boolean("is_public").notNull().default(false),
  shareCode: text("share_code"),
  downloadCount: integer("download_count").notNull().default(0),

  // Audit
  createdBy: text("created_by").notNull(),
  updatedBy: text("updated_by").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**template_marketplace - 模板市场**

```typescript
export const templateMarketplace = pgTable("template_marketplace", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => companyTemplates.id, { onDelete: "cascade" }),

  // Publishing info
  status: text("status").notNull().default("pending"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),

  // Metadata
  category: text("category").notNull().default("general"),
  tags: text("tags").array(),
  rating: integer("rating"),
  reviewCount: integer("review_count").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 2.2 收益相关表

**creator_revenue_accounts - 创作者收益账户**

```typescript
// packages/db/src/schema/creator_revenue.ts (新增)
export const creatorRevenueAccounts = pgTable("creator_revenue_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  userId: text("user_id"),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),

  // 金额使用 DECIMAL 避免浮点误差
  totalEarned: decimal("total_earned", { precision: 19, scale: 4 }).notNull().default("0"),
  availableBalance: decimal("available_balance", { precision: 19, scale: 4 }).notNull().default("0"),
  withdrawnAmount: decimal("withdrawn_amount", { precision: 19, scale: 4 }).notNull().default("0"),
  pendingAmount: decimal("pending_amount", { precision: 19, scale: 4 }).notNull().default("0"),

  // 支付信息
  payoutMethod: jsonb("payout_method"),
  taxInfo: jsonb("tax_info"),

  // 创作者等级
  tier: text("tier").notNull().default("bronze"),
  tierUpdatedAt: timestamp("tier_updated_at", { withTimezone: true }),

  // 统计
  totalTemplates: integer("total_templates").notNull().default(0),
  totalDownloads: integer("total_downloads").notNull().default(0),
  totalForks: integer("total_forks").notNull().default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**完整 Schema**

见 `/packages/db/src/migrations/0028_company_operating_templates.sql`
见 `/packages/db/src/migrations/0029_creator_incentive_plan.sql`

## 3. 服务层设计 (Function-based Pattern)

### 3.1 TemplateEngineService

```typescript
// server/src/services/template-engine.ts
import type { Db } from "@jigong/db";
import { eq, and, desc } from "drizzle-orm";
import {
  companyTemplates,
  templateMarketplace,
  templateWorkflows,
  templateRoles,
} from "@jigong/db/schema";

export interface TemplatePackage {
  manifest: {
    apiVersion: string;
    kind: string;
    metadata: {
      name: string;
      version: string;
      author?: string;
      category?: string;
      encrypted?: boolean;
    };
  };
  core: {
    encrypted: boolean;
    encryptedData?: string;
    data?: {
      workflows: unknown[];
      globalRules: unknown;
      checks: unknown[];
    };
  };
  customization: {
    variables: Record<string, unknown>;
    integrations: Record<string, unknown>;
    notifications: Record<string, unknown>;
  };
  roles: unknown[];
  agentBehaviors: Record<string, unknown>;
}

export function templateEngineService(db: Db) {
  return {
    /**
     * Parse and validate a template package
     */
    async parseTemplate(content: string): Promise<{
      valid: boolean;
      errors: string[];
      warnings: string[];
      package: TemplatePackage | null;
    }> {
      const errors: string[] = [];
      const warnings: string[] = [];

      try {
        const pkg = JSON.parse(content) as TemplatePackage;

        // Validate manifest
        if (!pkg.manifest?.apiVersion) errors.push("Missing manifest.apiVersion");
        if (!pkg.manifest?.kind) errors.push("Missing manifest.kind");
        if (!pkg.manifest?.metadata?.name) errors.push("Missing manifest.metadata.name");
        if (!pkg.manifest?.metadata?.version) errors.push("Missing manifest.metadata.version");

        // Validate core section
        if (!pkg.core) {
          errors.push("Missing core section");
        } else if (pkg.core.encrypted && !pkg.core.encryptedData) {
          errors.push("Core is encrypted but missing encryptedData");
        } else if (!pkg.core.encrypted && !pkg.core.data) {
          errors.push("Core is not encrypted but missing data");
        }

        if (errors.length > 0) {
          return { valid: false, errors, warnings, package: null };
        }

        return { valid: true, errors, warnings, package: pkg };
      } catch (e) {
        errors.push(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
        return { valid: false, errors, warnings, package: null };
      }
    },

    /**
     * Import a template package
     */
    async importTemplate(
      companyId: string,
      packageContent: string,
      options: {
        importedBy: string;
        sourceType?: string;
        isDefault?: boolean;
      }
    ): Promise<{ success: boolean; templateId?: string; errors?: string[] }> {
      const parseResult = await this.parseTemplate(packageContent);

      if (!parseResult.valid) {
        return { success: false, errors: parseResult.errors };
      }

      const pkg = parseResult.package!;
      const slug = this.generateSlug(pkg.manifest.metadata.name);

      // Check for duplicate slug
      const existing = await db
        .select({ id: companyTemplates.id })
        .from(companyTemplates)
        .where(and(
          eq(companyTemplates.companyId, companyId),
          eq(companyTemplates.slug, slug)
        ))
        .limit(1);

      if (existing.length > 0) {
        return { success: false, errors: [`Template with slug "${slug}" already exists`] };
      }

      // Create template record
      const [template] = await db
        .insert(companyTemplates)
        .values({
          companyId,
          name: pkg.manifest.metadata.name,
          slug,
          description: `Imported from ${options.sourceType || "unknown"}`,
          version: pkg.manifest.metadata.version,
          sourceType: options.sourceType || "imported",
          templatePackage: pkg,
          isActive: true,
          isDefault: options.isDefault || false,
          createdBy: options.importedBy,
          updatedBy: options.importedBy,
          importedAt: new Date(),
        })
        .returning();

      // Extract and save workflows/roles...

      return { success: true, templateId: template.id };
    },

    /**
     * Export a template package
     */
    async exportTemplate(
      templateId: string,
      options?: {
        includeCustomization?: boolean;
        encryptCore?: boolean;
      }
    ): Promise<{ success: boolean; content?: string; error?: string }> {
      const [template] = await db
        .select()
        .from(companyTemplates)
        .where(eq(companyTemplates.id, templateId))
        .limit(1);

      if (!template) {
        return { success: false, error: "Template not found" };
      }

      const pkg = template.templatePackage as TemplatePackage;

      // Prepare export package
      const exportPkg: TemplatePackage = {
        manifest: pkg.manifest,
        core: pkg.core,
        customization: options?.includeCustomization !== false ? pkg.customization : {
          variables: {},
          integrations: {},
          notifications: {},
        },
        roles: pkg.roles,
        agentBehaviors: pkg.agentBehaviors,
      };

      // Encrypt core if requested
      if (options?.encryptCore && !pkg.core.encrypted) {
        exportPkg.core = {
          encrypted: true,
          encryptedData: await this.encryptCore(pkg.core.data),
        };
      }

      return { success: true, content: JSON.stringify(exportPkg, null, 2) };
    },

    /**
     * Create a copy (fork) of a template
     */
    async forkTemplate(
      templateId: string,
      companyId: string,
      forkedBy: string,
      customizations?: Record<string, unknown>
    ): Promise<{ success: boolean; newTemplateId?: string; error?: string }> {
      const exportResult = await this.exportTemplate(templateId, {
        includeCustomization: true,
        encryptCore: false,
      });

      if (!exportResult.success) {
        return { success: false, error: exportResult.error };
      }

      const pkg = JSON.parse(exportResult.content!) as TemplatePackage;
      pkg.manifest.metadata.name = `${pkg.manifest.metadata.name} (Fork)`;

      if (customizations) {
        pkg.customization = { ...pkg.customization, ...customizations };
      }

      return this.importTemplate(companyId, JSON.stringify(pkg), {
        importedBy: forkedBy,
        sourceType: "forked",
      });
    },

    /**
     * Publish a template to the marketplace
     */
    async publishToMarketplace(
      templateId: string,
      options: {
        category?: string;
        tags?: string[];
        publishedBy: string;
      }
    ): Promise<{ success: boolean; error?: string }> {
      const shareCode = this.generateShareCode();

      await db
        .update(companyTemplates)
        .set({
          isPublic: true,
          shareCode,
          updatedAt: new Date(),
        })
        .where(eq(companyTemplates.id, templateId));

      await db.insert(templateMarketplace).values({
        companyId: template.companyId,
        templateId,
        status: "pending",
        category: options.category || "general",
        tags: options.tags || [],
      });

      return { success: true };
    },

    // Private helpers
    generateSlug(name: string): string {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        + "-"
        + Date.now().toString(36);
    },

    generateShareCode(): string {
      return "tpl-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    },

    async encryptCore(_data: unknown): Promise<string> {
      // TODO: Implement AES-256-GCM encryption
      return Buffer.from(JSON.stringify(_data)).toString("base64");
    },
  };
}

export type TemplateEngineService = ReturnType<typeof templateEngineService>;
```

### 3.2 CreatorIncentiveService

```typescript
// server/src/services/creator-incentive.ts
import type { Db } from "@jigong/db";
import { eq, and, desc } from "drizzle-orm";
import {
  companyTemplates,
  templateLineages,
  creatorRevenueAccounts,
  revenueRecords,
  creatorRevenueDistributions,
  templateRevenueStats,
} from "@jigong/db/schema";

// 方案A：保守稳健型 分配配置
export const REVENUE_SHARE_CONFIG = {
  platformFee: 15,        // 15% 平台抽成
  directCreator: 60,      // 60% 直接使用创作者
  ancestors: 15,          // 15% 直接父模板
  root: 10,               // 10% 根模板创作者
};

// 创作者等级配置
export const CREATOR_TIERS = [
  {
    tier: "bronze",
    name: "创作者",
    requirements: { templates: 1, downloads: 0, revenue: 0, rating: 0 },
    benefits: { revenueBonus: 0, platformFeeDiscount: 0 },
  },
  {
    tier: "silver",
    name: "资深创作者",
    requirements: { templates: 3, downloads: 50, revenue: 500, rating: 4.0 },
    benefits: { revenueBonus: 5, platformFeeDiscount: 2 },
  },
  {
    tier: "gold",
    name: "金牌创作者",
    requirements: { templates: 5, downloads: 200, revenue: 2000, rating: 4.2 },
    benefits: { revenueBonus: 10, platformFeeDiscount: 5 },
  },
  {
    tier: "platinum",
    name: "白金创作者",
    requirements: { templates: 10, downloads: 1000, revenue: 10000, rating: 4.5 },
    benefits: { revenueBonus: 15, platformFeeDiscount: 10 },
  },
  {
    tier: "diamond",
    name: "钻石创作者",
    requirements: { templates: 20, downloads: 5000, revenue: 50000, rating: 4.8 },
    benefits: { revenueBonus: 20, platformFeeDiscount: 15 },
  },
];

export function creatorIncentiveService(db: Db) {
  return {
    /**
     * 计算并执行收益分配
     */
    async distributeRevenue(input: {
      templateId: string;
      buyerCompanyId?: string;
      sourceType: "subscription" | "transaction" | "customization" | "marketplace_sale";
      sourceId?: string;
      totalAmount: number;
      currency: string;
    }): Promise<{
      success: boolean;
      revenueRecordId?: string;
      distributions: Array<{
        accountId: string;
        creatorName: string;
        amount: number;
        percentage: number;
        type: "direct_creator" | "parent_template" | "root_template";
      }>;
      platformFee: number;
      error?: string;
    }> {
      try {
        // 1. 获取模板信息
        const template = await db.query.companyTemplates.findFirst({
          where: eq(companyTemplates.id, input.templateId),
        });

        if (!template) {
          return { success: false, error: "Template not found", distributions: [], platformFee: 0 };
        }

        // 2. 获取模板谱系
        const lineage = await db.query.templateLineages.findFirst({
          where: eq(templateLineages.templateId, input.templateId),
        });

        // 3. 创建收益记录
        const platformFee = Math.round(input.totalAmount * REVENUE_SHARE_CONFIG.platformFee / 100);
        const directShare = Math.round(input.totalAmount * REVENUE_SHARE_CONFIG.directCreator / 100);
        const ancestorShare = Math.round(input.totalAmount * REVENUE_SHARE_CONFIG.ancestors / 100);
        const rootShare = input.totalAmount - platformFee - directShare - ancestorShare;

        const [revenueRecord] = await db
          .insert(revenueRecords)
          .values({
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            templateId: input.templateId,
            buyerCompanyId: input.buyerCompanyId,
            totalAmount: input.totalAmount.toString(),
            currency: input.currency,
            platformFee: platformFee.toString(),
            directCreatorShare: directShare.toString(),
            ancestorShare: ancestorShare.toString(),
            rootShare: rootShare.toString(),
            status: "pending",
          })
          .returning();

        const distributions: Array<{
          accountId: string;
          creatorName: string;
          amount: number;
          percentage: number;
          type: "direct_creator" | "parent_template" | "root_template";
        }> = [];

        // 4. 分配直接创作者收益
        if (template.createdBy) {
          const directAccount = await this.getOrCreateAccount(template.companyId, template.createdBy);
          await db.insert(creatorRevenueDistributions).values({
            revenueRecordId: revenueRecord.id,
            accountId: directAccount.id,
            amount: directShare.toString(),
            percentage: REVENUE_SHARE_CONFIG.directCreator,
            distributionType: "direct_creator",
            status: "pending",
          });
          distributions.push({
            accountId: directAccount.id,
            creatorName: directAccount.creatorName || "Unknown",
            amount: directShare,
            percentage: REVENUE_SHARE_CONFIG.directCreator,
            type: "direct_creator",
          });
        }

        // 5. 分配父模板收益
        if (lineage?.parentTemplateId && lineage.parentInfo) {
          const parentCreatorId = (lineage.parentInfo as { creatorId?: string }).creatorId;
          if (parentCreatorId) {
            const parentAccount = await this.getOrCreateAccount(template.companyId, parentCreatorId);
            await db.insert(creatorRevenueDistributions).values({
              revenueRecordId: revenueRecord.id,
              accountId: parentAccount.id,
              amount: ancestorShare.toString(),
              percentage: REVENUE_SHARE_CONFIG.ancestors,
              distributionType: "parent_template",
              status: "pending",
            });
            distributions.push({
              accountId: parentAccount.id,
              creatorName: parentAccount.creatorName || "Unknown",
              amount: ancestorShare,
              percentage: REVENUE_SHARE_CONFIG.ancestors,
              type: "parent_template",
            });
          }
        }

        // 6. 分配根模板收益
        if (lineage?.rootTemplateId) {
          const rootTemplate = await db.query.companyTemplates.findFirst({
            where: eq(companyTemplates.id, lineage.rootTemplateId),
          });
          if (rootTemplate?.createdBy && rootTemplate.createdBy !== template.createdBy) {
            const rootAccount = await this.getOrCreateAccount(template.companyId, rootTemplate.createdBy);
            await db.insert(creatorRevenueDistributions).values({
              revenueRecordId: revenueRecord.id,
              accountId: rootAccount.id,
              amount: rootShare.toString(),
              percentage: REVENUE_SHARE_CONFIG.root,
              distributionType: "root_template",
              status: "pending",
            });
            distributions.push({
              accountId: rootAccount.id,
              creatorName: rootAccount.creatorName || "Unknown",
              amount: rootShare,
              percentage: REVENUE_SHARE_CONFIG.root,
              type: "root_template",
            });
          }
        }

        // 7. 标记为已分配
        await db
          .update(revenueRecords)
          .set({ status: "distributed", distributedAt: new Date() })
          .where(eq(revenueRecords.id, revenueRecord.id));

        return {
          success: true,
          revenueRecordId: revenueRecord.id,
          distributions,
          platformFee,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          distributions: [],
          platformFee: 0,
        };
      }
    },

    /**
     * 获取或创建创作者账户
     */
    async getOrCreateAccount(
      companyId: string,
      userId: string
    ): Promise<{ id: string; creatorName?: string }> {
      const existing = await db.query.creatorRevenueAccounts.findFirst({
        where: and(
          eq(creatorRevenueAccounts.companyId, companyId),
          eq(creatorRevenueAccounts.userId, userId)
        ),
      });

      if (existing) {
        return { id: existing.id, creatorName: userId };
      }

      const [account] = await db
        .insert(creatorRevenueAccounts)
        .values({ companyId, userId, tier: "bronze" })
        .returning();

      return { id: account.id, creatorName: userId };
    },

    /**
     * 记录模板分叉
     */
    async recordTemplateFork(
      templateId: string,
      parentTemplateId: string,
      creatorId: string,
      contribution: string
    ): Promise<void> {
      const parentLineage = await db.query.templateLineages.findFirst({
        where: eq(templateLineages.templateId, parentTemplateId),
      });

      const generation = parentLineage ? parentLineage.generation + 1 : 1;
      const rootTemplateId = parentLineage?.rootTemplateId || parentTemplateId;

      await db.insert(templateLineages).values({
        templateId,
        rootTemplateId,
        parentTemplateId,
        generation,
        parentInfo: {
          creatorId,
          forkedAt: new Date().toISOString(),
          contribution,
        },
      });
    },

    /**
     * 检查并更新创作者等级
     */
    async checkAndUpdateTier(accountId: string): Promise<string | null> {
      const account = await db.query.creatorRevenueAccounts.findFirst({
        where: eq(creatorRevenueAccounts.id, accountId),
      });

      if (!account) return null;

      const currentTierIndex = CREATOR_TIERS.findIndex(t => t.tier === account.tier);

      for (let i = currentTierIndex + 1; i < CREATOR_TIERS.length; i++) {
        const nextTier = CREATOR_TIERS[i];
        const meetsRequirements =
          account.totalTemplates >= nextTier.requirements.templates &&
          account.totalDownloads >= nextTier.requirements.downloads &&
          parseFloat(account.totalEarned) >= nextTier.requirements.revenue;

        if (meetsRequirements) {
          await db
            .update(creatorRevenueAccounts)
            .set({ tier: nextTier.tier, tierUpdatedAt: new Date(), updatedAt: new Date() })
            .where(eq(creatorRevenueAccounts.id, accountId));

          return nextTier.tier;
        }
      }

      return null;
    },
  };
}

export type CreatorIncentiveService = ReturnType<typeof creatorIncentiveService>;
```

## 4. API 设计 (Express Router)

### 4.1 REST API 路由

```typescript
// server/src/routes/marketplace.ts
import { Router } from "express";
import { requireAuth, requireCompanyRole } from "../middleware/auth.js";
import { templateEngineService } from "../services/template-engine.js";
import { creatorIncentiveService } from "../services/creator-incentive.js";
import { getDb } from "@jigong/db";

const router = Router();

// 公开端点 - 模板搜索
router.get("/marketplace/templates", async (req, res) => {
  const db = getDb();
  const { category, q, page = 1, limit = 20 } = req.query;

  // 实现搜索逻辑
  const templates = await db.query.templateMarketplace.findMany({
    where: (m, { eq, and }) => {
      const conditions = [eq(m.status, "published")];
      if (category) conditions.push(eq(m.category, category as string));
      return and(...conditions);
    },
    with: {
      template: true,
    },
    limit: parseInt(limit as string),
    offset: (parseInt(page as string) - 1) * parseInt(limit as string),
  });

  res.json({ success: true, data: templates });
});

// 公开端点 - 模板详情
router.get("/marketplace/templates/:id", async (req, res) => {
  const db = getDb();
  const template = await db.query.companyTemplates.findFirst({
    where: (t, { eq, and }) => and(
      eq(t.id, req.params.id),
      eq(t.isPublic, true)
    ),
  });

  if (!template) {
    return res.status(404).json({ success: false, error: "Template not found" });
  }

  res.json({ success: true, data: template });
});

// 需要认证 - 购买模板
router.post(
  "/marketplace/templates/:id/purchase",
  requireAuth,
  async (req, res) => {
    const db = getDb();
    const service = creatorIncentiveService(db);

    // 实现购买逻辑
    const result = await service.distributeRevenue({
      templateId: req.params.id,
      buyerCompanyId: req.user!.companyId,
      sourceType: "marketplace_sale",
      totalAmount: req.body.amount,
      currency: req.body.currency || "USD",
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: result });
  }
);

// 需要认证 - 安装模板
router.post(
  "/marketplace/templates/:id/install",
  requireAuth,
  async (req, res) => {
    const db = getDb();
    const engine = templateEngineService(db);

    // 检查购买状态
    // 导出并安装模板
    const result = await engine.forkTemplate(
      req.params.id,
      req.user!.companyId,
      req.user!.id,
      req.body.customizations
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, data: { templateId: result.newTemplateId } });
  }
);

// 公司管理 - 创建模板
router.post(
  "/companies/:companyId/templates",
  requireAuth,
  requireCompanyRole("admin"),
  async (req, res) => {
    const db = getDb();
    const engine = templateEngineService(db);

    const result = await engine.importTemplate(
      req.params.companyId,
      JSON.stringify(req.body.package),
      {
        importedBy: req.user!.id,
        sourceType: "created",
      }
    );

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors });
    }

    res.json({ success: true, data: { templateId: result.templateId } });
  }
);

// 公司管理 - 发布模板到市场
router.post(
  "/companies/:companyId/templates/:templateId/publish",
  requireAuth,
  requireCompanyRole("admin"),
  async (req, res) => {
    const db = getDb();
    const engine = templateEngineService(db);

    const result = await engine.publishToMarketplace(req.params.templateId, {
      category: req.body.category,
      tags: req.body.tags,
      publishedBy: req.user!.id,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true });
  }
);

// 创作者中心 - 获取收益报告
router.get(
  "/creators/:creatorId/revenue",
  requireAuth,
  async (req, res) => {
    const db = getDb();
    const service = creatorIncentiveService(db);

    // 验证只能查看自己的收益
    if (req.params.creatorId !== req.user!.id) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const account = await db.query.creatorRevenueAccounts.findFirst({
      where: (a, { eq, and }) => and(
        eq(a.userId, req.params.creatorId),
        eq(a.companyId, req.user!.companyId)
      ),
    });

    if (!account) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }

    const report = await service.getCreatorRevenueReport(account.id, {
      start: new Date(req.query.start as string),
      end: new Date(req.query.end as string),
    });

    res.json({ success: true, data: report });
  }
);

export default router;
```

### 4.2 API 响应格式

```typescript
// 统一响应格式
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 示例成功响应
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "SaaS Starter",
    "slug": "saas-starter"
  }
}

// 示例错误响应
{
  "success": false,
  "error": "Template not found"
}
```

## 5. CLI 设计

### 5.1 命令结构

```typescript
// packages/cli/src/commands/template.ts
import { Command } from "commander";

const templateCommand = new Command("template");

// 搜索模板
templateCommand
  .command("search <keyword>")
  .option("--category <category>", "Filter by category")
  .option("--price <range>", "Price range (free/paid/all)")
  .option("--sort <field>", "Sort field (downloads/rating/price)")
  .action(async (keyword, options) => {
    // 调用 API 搜索
    const results = await api.searchTemplates({
      keyword,
      category: options.category,
      priceRange: options.price,
      sort: options.sort,
    });

    // 表格展示结果
    console.table(results.map(t => ({
      name: `${t.owner}/${t.slug}`,
      version: t.version,
      price: t.pricing.type === "free" ? "Free" : `$${t.pricing.priceUSD}`,
      downloads: t.downloadCount,
      rating: t.ratingAvg,
    })));
  });

// 安装模板
templateCommand
  .command("install <source>")
  .description("Install a template from marketplace or other sources")
  .option("--version <version>", "Specific version to install")
  .option("--path <path>", "Installation path")
  .action(async (source, options) => {
    const spinner = ora("Installing template...").start();

    try {
      // 1. 解析来源
      const parsed = parseSource(source);

      // 2. 检查购买状态
      const purchaseStatus = await api.checkPurchase(parsed);
      if (!purchaseStatus.purchased && purchaseStatus.price > 0) {
        spinner.stop();
        const proceed = await confirm(`Purchase ${source} for $${purchaseStatus.price}?`);
        if (!proceed) return;
        // 引导支付流程...
      }

      // 3. 下载模板包
      spinner.text = "Downloading template package...";
      const packageData = await api.downloadTemplate(parsed, options.version);

      // 4. 验证并导入
      spinner.text = "Installing template...";
      await api.installTemplate(packageData);

      spinner.succeed(`Template ${source} installed successfully!`);
    } catch (error) {
      spinner.fail(`Installation failed: ${error.message}`);
    }
  });

// 列出已安装模板
templateCommand
  .command("list")
  .option("--json", "Output as JSON")
  .option("--outdated", "Show outdated templates")
  .action(async (options) => {
    const templates = await api.listInstalledTemplates();

    if (options.json) {
      console.log(JSON.stringify(templates, null, 2));
    } else {
      console.table(templates.map(t => ({
        name: t.name,
        version: t.version,
        latest: t.latestVersion,
        status: t.version === t.latestVersion ? "✓" : "↑",
      })));
    }
  });

// 升级模板
templateCommand
  .command("upgrade [source]")
  .option("--all", "Upgrade all templates")
  .option("--dry-run", "Show what would be upgraded without making changes")
  .action(async (source, options) => {
    // 实现升级逻辑
  });

// 发布模板
templateCommand
  .command("publish [path]")
  .option("--public", "Publish as public template")
  .option("--private", "Publish as private template")
  .option("--version <version>", "Version to publish")
  .action(async (templatePath, options) => {
    // 实现发布逻辑
  });

export default templateCommand;
```

## 6. 模板包结构

```
template-package-v1.json
{
  "manifest": {
    "apiVersion": "jigong.io/v1",
    "kind": "CompanyOperatingTemplate",
    "metadata": {
      "name": "SaaS Starter",
      "version": "1.2.0",
      "slug": "saas-starter",
      "author": "fireteam",
      "category": "startup",
      "encrypted": true
    }
  },
  "core": {
    "encrypted": true,
    "encryptedData": "<base64-encoded-encrypted-data>",
    "signature": "<digital-signature>"
  },
  "customization": {
    "variables": {
      "companyName": { "type": "string", "required": true },
      "primaryColor": { "type": "color", "default": "#3B82F6" },
      "enableAnalytics": { "type": "boolean", "default": true }
    },
    "integrations": {
      "slack": { "optional": true },
      "github": { "optional": false }
    },
    "notifications": {
      "welcomeEmail": { "enabled": true, "template": "welcome" }
    }
  },
  "roles": [
    { "code": "product_manager", "name": "产品经理", "permissions": [...] }
  ],
  "agentBehaviors": {
    "planning_agent": { "template": "agile", "sprintDuration": 14 },
    "review_agent": { "template": "thorough", "checklist": [...] }
  }
}
```

## 7. 加密策略

### 7.1 核心层加密 (AES-256-GCM)

```typescript
// server/src/services/template-encryption.ts
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedLayer {
  iv: string;
  authTag: string;
  data: string;
}

export async function encryptCoreLayer(
  data: unknown,
  key: Buffer
): Promise<EncryptedLayer> {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const serialized = JSON.stringify(data);
  let encrypted = cipher.update(serialized, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    data: encrypted,
  };
}

export async function decryptCoreLayer(
  encrypted: EncryptedLayer,
  key: Buffer
): Promise<unknown> {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encrypted.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "hex"));

  let decrypted = decipher.update(encrypted.data, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}
```

### 7.2 加密流程

```
1. 创作者导出模板
   └── 选择"发布到市场"
       └── 系统加密核心层
           ├── 生成随机 AES-256 密钥
           ├── 加密 core.data
           ├── 生成数字签名
           └── 密钥存储在服务端(仅服务端可解密)

2. 用户购买/安装模板
   └── 系统验证购买状态
       └── 返回解密密钥
           └── 客户端解密核心层
               └── 合并定制层
                   └── 安装到公司
```

## 8. 创作者等级系统

```typescript
// 等级配置 (已存在于 creator-incentive.ts)
const CREATOR_TIERS = [
  { tier: "bronze",   name: "创作者",     requirements: { templates: 1,   downloads: 0,    revenue: 0,     rating: 0 },   benefits: { revenueBonus: 0,  platformFeeDiscount: 0 } },
  { tier: "silver",   name: "资深创作者", requirements: { templates: 3,   downloads: 50,   revenue: 500,   rating: 4.0 }, benefits: { revenueBonus: 5,  platformFeeDiscount: 2 } },
  { tier: "gold",     name: "金牌创作者", requirements: { templates: 5,   downloads: 200,  revenue: 2000,  rating: 4.2 }, benefits: { revenueBonus: 10, platformFeeDiscount: 5 } },
  { tier: "platinum", name: "白金创作者", requirements: { templates: 10,  downloads: 1000, revenue: 10000, rating: 4.5 }, benefits: { revenueBonus: 15, platformFeeDiscount: 10 } },
  { tier: "diamond",  name: "钻石创作者", requirements: { templates: 20,  downloads: 5000, revenue: 50000, rating: 4.8 }, benefits: { revenueBonus: 20, platformFeeDiscount: 15 } },
];

// 等级权益应用
function applyTierBenefits(amount: number, tier: string): number {
  const benefits = CREATOR_TIERS.find(t => t.tier === tier)?.benefits;
  if (!benefits) return amount;

  // 收益加成
  const bonus = amount * (benefits.revenueBonus / 100);

  // 平台费减免 (影响直接收益份额)
  const feeDiscount = benefits.platformFeeDiscount;

  return amount + bonus;
}
```

## 9. 退款策略

```typescript
// server/src/services/refund.ts
const REFUND_POLICY = {
  windowDays: 7,              // 7天无理由退款
  maxUsagePercent: 10,        // 使用率超过10%不可退款
  requiredReason: false       // 是否要求退款原因
};

export async function processRefund(
  db: Db,
  purchaseId: string
): Promise<{ success: boolean; reason?: string }> {
  const purchase = await db.query.revenueRecords.findFirst({
    where: eq(revenueRecords.id, purchaseId),
  });

  if (!purchase) {
    return { success: false, reason: "Purchase not found" };
  }

  // 1. 检查退款窗口
  const daysSincePurchase = daysBetween(purchase.createdAt, new Date());
  if (daysSincePurchase > REFUND_POLICY.windowDays) {
    return { success: false, reason: "超过退款期限" };
  }

  // 2. 检查使用率
  const usage = await calculateTemplateUsage(purchase.templateId, purchase.buyerCompanyId);
  if (usage.percent > REFUND_POLICY.maxUsagePercent) {
    return { success: false, reason: "模板使用率过高，不符合退款条件" };
  }

  // 3. 撤销收益分配
  await reverseRevenueDistribution(db, purchase.id);

  // 4. 撤销安装权限
  await revokeTemplateAccess(db, purchase.templateId, purchase.buyerCompanyId);

  return { success: true };
}
```

## 10. 前端组件设计

### 10.1 TanStack Query Hooks

```typescript
// ui/src/hooks/useTemplates.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useMarketplaceTemplates(filters: TemplateFilters) {
  return useQuery({
    queryKey: ["marketplace", "templates", filters],
    queryFn: () => api.searchTemplates(filters),
  });
}

export function useInstallTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { templateId: string; customizations?: Record<string, unknown> }) =>
      api.installTemplate(params.templateId, params.customizations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", "templates"] });
    },
  });
}

export function useCreatorRevenueReport(accountId: string, period: DateRange) {
  return useQuery({
    queryKey: ["creator", "revenue", accountId, period],
    queryFn: () => api.getCreatorRevenueReport(accountId, period),
    enabled: !!accountId,
  });
}
```

### 10.2 React 组件

```typescript
// ui/src/components/marketplace/TemplateCard.tsx
export function TemplateCard({ template }: { template: MarketplaceTemplate }) {
  const installMutation = useInstallTemplate();

  return (
    <Card className="template-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{template.name}</CardTitle>
          <Badge variant={template.pricing.type === "free" ? "secondary" : "default"}>
            {template.pricing.type === "free" ? "免费" : `$${template.pricing.priceUSD}`}
          </Badge>
        </div>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>⭐ {template.ratingAvg}</span>
          <span>⬇️ {template.downloadCount}</span>
          <span>👤 {template.ownerName}</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => installMutation.mutate({ templateId: template.id })}
          disabled={installMutation.isPending}
        >
          {installMutation.isPending ? "安装中..." : "安装"}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

## 11. 错误处理

```typescript
// server/src/middleware/error-handler.ts
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("Error:", err);

  // 模板特定错误
  if (err instanceof TemplateNotFoundError) {
    return res.status(404).json({
      success: false,
      error: "TEMPLATE_NOT_FOUND",
      message: err.message,
    });
  }

  if (err instanceof TemplateValidationError) {
    return res.status(400).json({
      success: false,
      error: "TEMPLATE_VALIDATION_FAILED",
      message: err.message,
      errors: err.errors,
    });
  }

  if (err instanceof PaymentRequiredError) {
    return res.status(402).json({
      success: false,
      error: "PAYMENT_REQUIRED",
      message: "This template requires purchase",
      price: err.price,
    });
  }

  // 通用错误
  res.status(500).json({
    success: false,
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
}
```

## 参考文件

| 文件 | 说明 |
|------|------|
| `/server/src/services/template-engine.ts` | 模板引擎服务实现 |
| `/server/src/services/creator-incentive.ts` | 创作者激励服务实现 |
| `/packages/db/src/schema/company_templates.ts` | 模板表 Schema |
| `/packages/db/src/migrations/0029_creator_incentive_plan.sql` | 激励计划数据库迁移 |

---

## 变更历史

| 日期 | 版本 | 作者 | 变更说明 |
|------|------|------|----------|
| 2026-03-15 | v1.0 | AI Assistant | 初始版本，对齐现有技术栈 |
